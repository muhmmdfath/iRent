"""Package reviewed application sources; exclude credentials and local data."""
from pathlib import Path
import subprocess
import tarfile

root = Path(__file__).resolve().parent.parent
tracked = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', 'backend', 'frontend'], cwd=root, text=True).splitlines()
sources = []
for name in tracked:
    p = Path(name)
    if p.name.startswith('.env') or 'storage' in p.parts or 'node_modules' in p.parts:
        continue
    sources.append(name)
sources += ['.dockerignore']
sources += [str(p.relative_to(root)).replace('\\', '/') for p in (root/'deploy').glob('*') if p.is_file()]
target = root/'backend/storage/deployment/source.tar.gz'
target.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(target, 'w:gz') as archive:
    for name in sorted(set(sources)):
        archive.add(root/name, arcname=name, recursive=False)
print(f'Packaged {len(set(sources))} source files ({target.stat().st_size} bytes); no local database or proofs.')
