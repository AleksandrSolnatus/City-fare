from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'template.html').read_text().replace('/*__BODY__*/',(root/'body.js').read_text()).replace('/*__APP__*/',(root/'app.js').read_text())
(root/'City-Fare-Sand-Power-001.html').write_text(html)
print(len(html.encode()),'bytes; self-contained')
