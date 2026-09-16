"""Package only installable files and public documentation; validate tag/version."""
import hashlib
import json
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "extension/manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
tag = os.environ.get("GITHUB_REF", "")
if tag.startswith("refs/tags/") and tag != f"refs/tags/v{version}":
    raise SystemExit("Tag must match extension/manifest.json version")
destination = root / "dist"
destination.mkdir(exist_ok=True)
archive = destination / f"songsterr-auto-continue-{version}.zip"

runtime_files = ["manifest.json", *manifest["icons"].values()]
for content_script in manifest.get("content_scripts", []):
    runtime_files.extend(content_script.get("js", []))
runtime_files = list(dict.fromkeys(runtime_files))

with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
    for source in runtime_files:
        bundle.write(root / "extension" / source, source)
    for source in ("README.md", "LICENSE"):
        bundle.write(root / source, source)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(destination / "SHA256SUMS.txt").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
print(f"{archive.name}: {digest}")
