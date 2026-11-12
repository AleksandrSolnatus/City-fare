from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
text=(root/'template.html').read_text(encoding='utf-8')
for label,name in [('BODY','body.js'),('HUNT','hunt.js'),('VIEW','view.js'),('APP','app.js')]:
    token='/*__'+label+'__*/'
    assert text.count(token)==1
    text=text.replace(token,(root/name).read_text(encoding='utf-8'))
blob=text.encode('utf-8')
(root/'City-Fare-Sand-Power-005.html').write_bytes(blob)
(root/'build-receipt.json').write_text(json.dumps({'artifact':'City-Fare-Sand-Power-005.html','bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'origin':'5f9ce25c4defa427cd44b6c63f63e552047fecb9','inputs':{f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['template.html','body.js','hunt.js','view.js','app.js']}},indent=2)+'\n')
print('Built',len(blob),'bytes;',hashlib.sha256(blob).hexdigest())
