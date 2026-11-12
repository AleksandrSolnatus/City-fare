from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
text=(root/'template.html').read_text(encoding='utf-8')
for label,name in [('BODY','body.js'),('ROUTE','route.js'),('VIEW','view.js'),('APP','app.js')]:
    token='/*__'+label+'__*/'
    assert text.count(token)==1
    text=text.replace(token,(root/name).read_text(encoding='utf-8'))
blob=text.encode('utf-8')
(root/'City-Fare-Sand-Power-003.html').write_bytes(blob)
(root/'build-receipt.json').write_text(json.dumps({'artifact':'City-Fare-Sand-Power-003.html','bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'origin':'81794ff917be89b9cd5e405b32477cc0ff9d9681','inputs':{f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['template.html','body.js','route.js','view.js','app.js']}},indent=2)+'\n')
print('Built',len(blob),'bytes;',hashlib.sha256(blob).hexdigest())
