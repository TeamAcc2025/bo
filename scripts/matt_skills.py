"""Audit vendored Matt skills, or explicitly reapply BO's reviewed metadata."""

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys

import yaml


MANIFEST = ".agents/matt-skills.json"
FRONTMATTER = re.compile(rb"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)
NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
SHA256 = re.compile(r"[0-9a-f]{64}")


class InvalidInput(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidInput(message)


def unique_mapping(pairs):
    result = {}
    for key, value in pairs:
        require(isinstance(key, str) and key not in result, "Duplicate or invalid mapping key")
        result[key] = value
    return result


class UniqueLoader(yaml.SafeLoader):
    pass


def yaml_mapping(loader, node):
    return unique_mapping(loader.construct_pairs(node, deep=True))


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, yaml_mapping)


def read_yaml(data, label):
    try:
        result = yaml.load(data, Loader=UniqueLoader)
    except (yaml.YAMLError, UnicodeError, ValueError) as exc:
        raise InvalidInput(f"Invalid YAML: {label}") from exc
    require(isinstance(result, dict), f"Expected a YAML mapping: {label}")
    return result


def keys(value, expected, label):
    require(isinstance(value, dict) and set(value) == set(expected), f"Invalid fields: {label}")


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def read_file(root, relative):
    path = PurePosixPath(relative)
    require(not path.is_absolute() and ".." not in path.parts, "Unsafe file path")
    current = root
    for part in path.parts:
        current = current / part
        require(not current.is_symlink(), f"Symlink is not protected content: {relative}")
    require(current.is_file(), f"Missing file: {relative}")
    return current.read_bytes()


def load_manifest(root):
    try:
        manifest = json.loads(read_file(root, MANIFEST), object_pairs_hook=unique_mapping)
    except (ValueError, UnicodeError) as exc:
        raise InvalidInput("Invalid skill manifest JSON") from exc
    keys(manifest, {"schema_version", "upstream", "invocation", "released_skills", "skills", "protected_files"}, MANIFEST)
    require(type(manifest["schema_version"]) is int and manifest["schema_version"] == 1,
            "Unsupported manifest schema")
    invocation = manifest["invocation"]
    keys(invocation, {"allow_implicit_invocation", "omit_frontmatter"}, "invocation")
    require(invocation["allow_implicit_invocation"] is True
            and invocation["omit_frontmatter"] == ["disable-model-invocation"],
            "Invalid BO invocation policy")
    upstream = manifest["upstream"]
    keys(upstream, {"repository", "release", "revision"}, "upstream")
    require(upstream["repository"] == "https://github.com/mattpocock/skills"
            and nonempty(upstream["release"])
            and isinstance(upstream["revision"], str)
            and re.fullmatch(r"[0-9a-f]{40}", upstream["revision"]), "Invalid upstream provenance")
    names = manifest["released_skills"]
    require(isinstance(names, list) and len(names) == 27
            and all(isinstance(n, str) and len(n) <= 64 and NAME.fullmatch(n) for n in names)
            and len(set(names)) == len(names), "Expected 27 unique valid released skill names")
    keys(manifest["skills"], names, "released skill overrides")
    for name, skill in manifest["skills"].items():
        keys(skill, {"description", "default_prompt", "tools", "body_sha256"}, name)
        require(nonempty(skill["description"]) and nonempty(skill["default_prompt"]),
                f"Missing description or default prompt: {name}")
        require(re.search(r"\$" + re.escape(name) + r"(?![a-zA-Z0-9_-])", skill["default_prompt"]),
                f"Default prompt must invoke its exact skill: {name}")
        require(isinstance(skill["body_sha256"], str) and SHA256.fullmatch(skill["body_sha256"]),
                f"Invalid body hash: {name}")
        tools = skill["tools"]
        require(isinstance(tools, list) and len(tools) == 1, f"Invalid tool dependency: {name}")
        keys(tools[0], {"type", "value", "description"}, f"{name} dependency")
        require(tools[0]["type"] == "mcp" and tools[0]["value"] == "codex_apps"
                and nonempty(tools[0]["description"]), f"Invalid native MCP dependency: {name}")
    protected = manifest["protected_files"]
    require(isinstance(protected, dict) and ".agents/MATT-SKILLS-LICENSE" in protected,
            "Missing protected license")
    for path, digest in protected.items():
        parts = PurePosixPath(path).parts
        resource = (len(parts) >= 4 and parts[:2] == (".agents", "skills")
                    and parts[2] in names and "/".join(parts[3:]) not in {"SKILL.md", "agents/openai.yaml"})
        require((path == ".agents/MATT-SKILLS-LICENSE" or resource)
                and ".." not in parts and PurePosixPath(path).as_posix() == path
                and isinstance(digest, str) and SHA256.fullmatch(digest), "Invalid protected file entry")
    return manifest


def prepare(root, manifest):
    """Validate all protected content and plan all metadata changes before writing."""
    resources = {".agents/MATT-SKILLS-LICENSE"}
    changes = {}
    for name, approved in manifest["skills"].items():
        folder = f".agents/skills/{name}"
        skill_path = f"{folder}/SKILL.md"
        data = read_file(root, skill_path)
        match = FRONTMATTER.match(data)
        require(match is not None, f"Missing frontmatter: {name}")
        body = data[match.end():]
        require(hashlib.sha256(body).hexdigest() == approved["body_sha256"],
                f"Protected instruction body changed: {name}")
        front = read_yaml(match[1], skill_path)
        require(front.get("name") == name, f"Invalid or changed skill name: {name}")
        target = deepcopy(front)
        target["description"] = approved["description"]
        for field in manifest["invocation"]["omit_frontmatter"]:
            target.pop(field, None)
        if front != target:
            changes[skill_path] = b"---\n" + dump_yaml(target) + b"---\n" + body

        agent_path = f"{folder}/agents/openai.yaml"
        agent = read_yaml(read_file(root, agent_path), agent_path)
        target = deepcopy(agent)
        for section in ("interface", "policy", "dependencies"):
            require(isinstance(target.setdefault(section, {}), dict), f"Invalid {section}: {name}")
            # Break shared YAML anchors so overrides cannot alter unrelated fields.
            target[section] = dict(target[section])
        target["interface"]["default_prompt"] = approved["default_prompt"]
        target["policy"]["allow_implicit_invocation"] = manifest["invocation"]["allow_implicit_invocation"]
        target["dependencies"]["tools"] = approved["tools"]
        # YAML booleans must be booleans: Python considers 1 equal to True.
        implicit = agent.get("policy", {}).get("allow_implicit_invocation")
        if agent != target or implicit is not True:
            changes[agent_path] = dump_yaml(target)
        for path in (root / folder).rglob("*"):
            relative = path.relative_to(root).as_posix()
            require(not path.is_symlink(), f"Unexpected symlink: {relative}")
            if path.is_file() and relative not in {skill_path, agent_path}:
                resources.add(relative)

    require(resources == set(manifest["protected_files"]), "Protected resource inventory changed")
    for relative, digest in manifest["protected_files"].items():
        require(hashlib.sha256(read_file(root, relative)).hexdigest() == digest,
                f"Protected file changed: {relative}")
    return changes


def dump_yaml(value):
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=1000).encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("audit", "reapply"))
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        root = args.root.resolve()
        manifest = load_manifest(root)
        changes = prepare(root, manifest)
        if args.action == "reapply":
            for relative, content in changes.items():
                (root / relative).write_bytes(content)
            changes = prepare(root, manifest)
        require(not changes, "BO metadata differs from manifest: " + ", ".join(changes))
    except (InvalidInput, OSError, RecursionError) as exc:
        # Parser exceptions can contain input; report only our controlled errors.
        message = str(exc) if isinstance(exc, InvalidInput) else "Unable to process skill files"
        print(f"Matt skill {args.action} failed: {message}", file=sys.stderr)
        return 1
    print(f"Matt skill {args.action}: 27 released skills verified (offline)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
