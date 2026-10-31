"""Exercise the offline skill maintenance CLI through disposable repositories."""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml


REPO = Path(__file__).resolve().parents[1]
CLI = REPO / "scripts/matt_skills.py"


class SkillMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(REPO / ".agents", self.root / ".agents")

    def run_cli(self, action="audit", success=True):
        result = subprocess.run(
            [sys.executable, str(CLI), action, "--root", str(self.root)],
            capture_output=True, text=True,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def test_released_set_passes_and_unrelated_skills_are_allowed(self):
        extra = self.root / ".agents/skills/ponytail"
        extra.mkdir()
        (extra / "SKILL.md").write_text("An unrelated future skill.\n")
        self.run_cli()

    def agent_path(self, name="ask-matt"):
        return self.root / f".agents/skills/{name}/agents/openai.yaml"

    def change_agent(self, change, name="ask-matt"):
        path = self.agent_path(name)
        metadata = yaml.safe_load(path.read_text())
        change(metadata)
        path.write_text(yaml.safe_dump(metadata, sort_keys=False))

    def snapshot(self):
        return {p.relative_to(self.root).as_posix(): p.read_bytes()
                for p in self.root.rglob("*") if p.is_file()}

    def test_audit_rejects_disabled_missing_and_wrong_metadata(self):
        original = self.agent_path().read_bytes()
        mutations = [
            lambda m: m["policy"].update(allow_implicit_invocation=False),
            lambda m: m["policy"].update(allow_implicit_invocation="true"),
            lambda m: m["policy"].update(allow_implicit_invocation=1),
            lambda m: m.pop("policy"),
            lambda m: m["interface"].pop("default_prompt"),
            lambda m: m["interface"].update(default_prompt="Use $different-skill."),
            lambda m: m.pop("dependencies"),
            lambda m: m["dependencies"]["tools"][0].update(value="unregistered_server"),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutations.index(mutation)):
                self.agent_path().write_bytes(original)
                self.change_agent(mutation)
                before = self.snapshot()
                self.run_cli(success=False)
                self.assertEqual(self.snapshot(), before)
        self.agent_path().write_bytes(original)
        skill = self.root / ".agents/skills/ask-matt/SKILL.md"
        original_skill = skill.read_bytes()
        for replacement in (
            original_skill.replace(b"name: ask-matt", b"name: code-review", 1),
            original_skill.replace(b"description:", b"disable-model-invocation: true\ndescription:", 1),
            original_skill.replace(b"description:", b"lost-description:", 1),
        ):
            skill.write_bytes(replacement)
            self.run_cli(success=False)
        skill.write_bytes(original_skill)
        self.agent_path().unlink()
        self.run_cli(success=False)

    def test_reapply_restores_overrides_and_preserves_all_other_content(self):
        approved = yaml.safe_load(self.agent_path().read_text())
        skill = self.root / ".agents/skills/ask-matt/SKILL.md"
        pristine_skill = skill.read_bytes()
        # Unknown metadata is outside the documented BO overrides.
        skill.write_bytes(pristine_skill.replace(
            b"description:", b"argument-hint: retained\ndisable-model-invocation: true\nlost-description:", 1))
        self.change_agent(lambda m: m.update(
            policy={"allow_implicit_invocation": False, "future_policy": "retained"},
            dependencies={"tools": [], "future_dependency": "retained"},
        ))
        self.change_agent(lambda m: m["interface"].update(default_prompt="lost", future_field="retained"))
        before = self.snapshot()
        self.run_cli("reapply")
        self.run_cli()
        actual = yaml.safe_load(self.agent_path().read_text())
        self.assertEqual(actual["interface"]["default_prompt"], approved["interface"]["default_prompt"])
        self.assertEqual(actual["dependencies"]["tools"], approved["dependencies"]["tools"])
        self.assertIs(actual["policy"]["allow_implicit_invocation"], True)
        self.assertEqual(actual["interface"]["future_field"], "retained")
        self.assertEqual(actual["policy"]["future_policy"], "retained")
        self.assertEqual(actual["dependencies"]["future_dependency"], "retained")
        front, body = skill.read_bytes().split(b"\n---\n", 1)
        self.assertEqual(body, pristine_skill.split(b"\n---\n", 1)[1])
        self.assertEqual(yaml.safe_load(front[4:])["argument-hint"], "retained")
        self.assertNotIn("disable-model-invocation", yaml.safe_load(front[4:]))
        self.assertEqual(yaml.safe_load(front[4:])["description"],
                         yaml.safe_load(pristine_skill.split(b"\n---\n", 1)[0][4:])["description"])
        after = self.snapshot()
        changed = {p for p in before if before[p] != after[p]}
        self.assertEqual(changed, {".agents/skills/ask-matt/SKILL.md",
                                   ".agents/skills/ask-matt/agents/openai.yaml"})
        self.run_cli("reapply")
        self.assertEqual(self.snapshot(), after, "Reapply should be byte-idempotent")

    def test_protected_damage_stops_reapply_before_any_metadata_writes(self):
        # Metadata in the first skill needs repair; damage is found later.
        self.change_agent(lambda m: m.pop("dependencies"))
        paths = [".agents/MATT-SKILLS-LICENSE",
                 ".agents/skills/writing-for-agents/SKILL-MECHANICS.md",
                 ".agents/skills/writing-for-agents/SKILL.md"]
        for relative in paths:
            path = self.root / relative
            original = path.read_bytes()
            for missing in (False, True):
                with self.subTest(path=relative, missing=missing):
                    if missing:
                        path.unlink()
                    else:
                        path.write_bytes(original + b"Unexpected change.\n")
                    before = self.snapshot()
                    self.run_cli("reapply", success=False)
                    self.assertEqual(self.snapshot(), before)
                    path.write_bytes(original)

    def test_malformed_manifest_and_metadata_stop_before_any_writes(self):
        self.change_agent(lambda m: m.pop("dependencies"))
        path = self.root / ".agents/matt-skills.json"
        original = path.read_text()
        mutations = [
            lambda m: m["invocation"].update(allow_implicit_invocation=False),
            lambda m: m["released_skills"].pop(),
            lambda m: m["released_skills"].__setitem__(0, "../escape"),
            lambda m: m["released_skills"].__setitem__(0, "code-review"),
            lambda m: m["skills"].pop("writing-for-agents"),
            lambda m: m["skills"]["writing-for-agents"].update(body_sha256="invalid"),
            lambda m: m["skills"]["writing-for-agents"].update(default_prompt="Use $writing-for-agents-extra."),
            lambda m: m["skills"]["writing-for-agents"]["tools"][0].update(value="other"),
            lambda m: m["protected_files"].update({"../escape": "0" * 64}),
        ]
        for mutation in mutations:
            value = json.loads(original)
            mutation(value)
            with self.subTest(mutation=mutations.index(mutation)):
                path.write_text(json.dumps(value))
                before = self.snapshot()
                self.run_cli("reapply", success=False)
                self.assertEqual(self.snapshot(), before)
        for malformed in ('{"schema_version": 1, "schema_version": 1}', '{broken'):
            path.write_text(malformed)
            before = self.snapshot()
            self.run_cli("reapply", success=False)
            self.assertEqual(self.snapshot(), before)
        path.write_text(original)
        agent = self.agent_path("writing-for-agents")
        for malformed in ("interface: [", "interface: {}\ninterface: {}\n", "policy: false\n"):
            agent.write_text(malformed)
            before = self.snapshot()
            self.run_cli("reapply", success=False)
            self.assertEqual(self.snapshot(), before)

    def test_unexpected_resources_and_symlinks_require_review(self):
        self.change_agent(lambda m: m.pop("dependencies"))
        resource = self.root / ".agents/skills/writing-for-agents/unreviewed.md"
        resource.write_text("Unreviewed resource.\n")
        before = self.snapshot()
        self.run_cli("reapply", success=False)
        self.assertEqual(self.snapshot(), before)
        resource.unlink()
        protected = self.root / ".agents/skills/writing-for-agents/SKILL-MECHANICS.md"
        external = self.root / "external.md"
        protected.rename(external)
        protected.symlink_to(external)
        before = self.snapshot()
        self.run_cli("reapply", success=False)
        self.assertEqual(self.snapshot(), before)

    def test_reapply_preserves_metadata_shared_through_yaml_anchors(self):
        self.agent_path().write_text(
            "interface: &shared\n  default_prompt: custom\n  display_name: Retained\n"
            "custom_metadata: *shared\n"
            "policy:\n  allow_implicit_invocation: false\n"
        )
        before = yaml.safe_load(self.agent_path().read_text())
        self.run_cli("reapply")
        actual = yaml.safe_load(self.agent_path().read_text())
        self.assertEqual(actual["custom_metadata"], before["custom_metadata"])
        self.assertEqual(actual["interface"]["display_name"], "Retained")


if __name__ == "__main__":
    unittest.main()
