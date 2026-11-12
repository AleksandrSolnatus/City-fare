from pathlib import Path
import hashlib
root=Path(__file__).resolve().parent
source=(root/'template.html').read_text(encoding='utf-8')
for label,file in [('BODY','body.js'),('VIEW','view.js'),('APP','app.js')]:
    token='/*__'+label+'__*/'
    assert source.count(token)==1
    source=source.replace(token,(root/file).read_text(encoding='utf-8'))
bytes_out=source.encode('utf-8')
digest=hashlib.sha256(bytes_out).hexdigest()
# Prior receipt claimed 0c9fb81a...; see CHECKSUM-CORRECTION.txt. Artifact unchanged.
expected='4e729d83e8c4d11b6d778adfa9f79a86d84f3354e4ba4d73a54a791302db143c'
if digest!=expected:
    raise SystemExit(f'FAIL: generated {digest}, expected {expected}')
out=root/'REBUILT-City-Fare-Sand-Power-002.html'
if out.exists() and out.read_bytes()!=bytes_out:
    raise SystemExit('Refusing to replace an unrelated existing rebuild')
out.write_bytes(bytes_out)
print(f'PASS: {out.name} ({len(bytes_out)} bytes), sha256={digest}')
