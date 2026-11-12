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
expected='0c9fb81a579541807483128928a3bd1c757d88bcb0d3a520de9f0f8a6e438092'
if digest!=expected:
    raise SystemExit(f'FAIL: generated {digest}, expected {expected}')
out=root/'REBUILT-City-Fare-Sand-Power-002.html'
if out.exists() and out.read_bytes()!=bytes_out:
    raise SystemExit('Refusing to replace an unrelated existing rebuild')
out.write_bytes(bytes_out)
print(f'PASS: {out.name} ({len(bytes_out)} bytes), sha256={digest}')
