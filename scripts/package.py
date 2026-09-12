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
with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
    for source in ("extension/manifest.json", "extension/content.js", "README.md", "LICENSE"):
        bundle.write(root / source, Path(source).name)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(destination / "SHA256SUMS.txt").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
print(f"{archive.name}: {digest}")
