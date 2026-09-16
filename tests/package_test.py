import json
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def main():
    shutil.rmtree(DIST, ignore_errors=True)
    subprocess.run([sys.executable, "scripts/package.py"], cwd=ROOT, check=True)

    manifest = json.loads((ROOT / "extension/manifest.json").read_text(encoding="utf-8"))
    archive = DIST / f"songsterr-auto-continue-{manifest['version']}.zip"
    required = {"manifest.json"}
    for content_script in manifest.get("content_scripts", []):
        required.update(content_script.get("js", []))

    with ZipFile(archive) as bundle:
        packaged = set(bundle.namelist())

    missing = sorted(required - packaged)
    if missing:
        raise AssertionError(f"release ZIP is missing manifest-referenced files: {missing}")

    print("release ZIP contains every manifest-referenced script")


if __name__ == "__main__":
    main()
