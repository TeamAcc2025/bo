import json
import os
from pathlib import Path
import subprocess
import sys
import time


options = json.loads(sys.argv[1])
prompt = sys.stdin.read()
phase = "implement" if "<phase>implement</phase>" in prompt else "review"
assert f"<phase>{phase}</phase>" in prompt


def git(*args):
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def event(kind):
    value = {
        "type": kind,
        "phase": phase,
        "id": options["id"],
        "time": int(time.time() * 1000),
        "cwd": os.getcwd(),
        "branch": git("branch", "--show-current"),
        "config": os.environ.get("GIT_CONFIG_GLOBAL"),
    }
    with Path(options["trace"]).open("a", encoding="utf8") as trace:
        trace.write(json.dumps(value) + "\n")


def emit(result):
    print(json.dumps({"type": "result", "result": result}), flush=True)


private_dir = Path(options["dir"])
state_path = private_dir / "fixture-state.json"
state = (
    json.loads(state_path.read_text(encoding="utf8"))
    if state_path.exists()
    else {"implementations": 0, "feedback": []}
)
task = json.loads((private_dir / "task.json").read_text(encoding="utf8"))
assert task["body"] == options["body"]
assert task["body"] not in prompt, "Task text must be loaded as data, not expanded in the prompt"
event("start")
if options["delay"]:
    time.sleep(options["delay"] / 1000)

if phase == "implement":
    state["implementations"] += 1
    state["feedback"].append((private_dir / "feedback.txt").read_text(encoding="utf8"))
    state_path.write_text(json.dumps(state), encoding="utf8")
    if options["mode"] != "nochange":
        bad = options["mode"] == "checkfailure" or (
            options["mode"] == "repair" and state["implementations"] == 1
        )
        Path("result.txt").write_text("bad\n" if bad else "good\n", encoding="utf8")
        git("add", "result.txt")
        if git("diff", "--cached", "--name-only"):
            git("commit", "-m", "Implement synthetic task")
    if options["mode"] == "dirty":
        Path("unfinished.txt").write_text("Uncommitted synthetic work\n", encoding="utf8")
    event("end")
    emit(
        "Incomplete attempt"
        if options["mode"] == "missingmarker"
        else "<implementation>complete</implementation>"
    )
else:
    if options["mode"] == "reviewdirty":
        Path("result.txt").write_text("Reviewer changed files\n", encoding="utf8")
    if options["mode"] == "reviewcommit":
        Path("result.txt").write_text("Reviewer changed HEAD\n", encoding="utf8")
        git("add", "result.txt")
        git("commit", "-m", "Unexpected reviewer commit")
    event("end")
    emit(
        '<review>{"verdict":"revise","findings":["Correct the synthetic behavior"]}</review>'
        if options["mode"] == "reviewfailure"
        else '<review>{"verdict":"pass","findings":[]}</review>'
    )
