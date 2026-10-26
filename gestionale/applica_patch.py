# Produce la pagina del gestionale con la scheda "Contratto di vendita" in più.
#   python3 -I gestionale/applica_patch.py <pagina_pubblicata.html> <pagina_con_contratto.html>
# Il nucleo (calcoli e testi) viene copiato da src/20_contratto_nucleo.js; la scheda da gestionale/contratto_sezione.js.
import os, re, sys
if len(sys.argv) != 3:
    sys.exit('uso: applica_patch.py <pagina_pubblicata.html> <pagina_con_contratto.html>')
qui = os.path.dirname(os.path.abspath(__file__))
radice = os.path.dirname(qui)
src = open(sys.argv[1], encoding='utf-8').read()
nucleo_file = open(os.path.join(radice, 'src', '20_contratto_nucleo.js'), encoding='utf-8').read()
m = re.search(r'(function contrattoNucleo\(risorse\) \{[\s\S]*?\n\}\n)\n/\*\* Risorse del nucleo', nucleo_file)
assert m, 'nucleo non trovato in src/20_contratto_nucleo.js'
nucleo = m.group(1)
sezione = open(os.path.join(qui, 'contratto_sezione.js'), encoding='utf-8').read().replace('__NUCLEO__', nucleo)

def sost(testo, a, b, n=1):
    c = testo.count(a)
    assert c == n, f'ancora trovata {c} volte (attese {n}): {a[:80]!r}'
    return testo.replace(a, b)

out = src
# --- CSS (primo </style>: il foglio di stile della pagina) ---
css = """
/* CONTRATTO:CSS — anteprima del contratto di vendita (prefisso .con-) */
.con-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.con-tag{font-size:11px;color:#666;padding-bottom:8px}
.con-rule{margin:2px 0 18px}
.con-title{font-family:'Poppins',sans-serif;font-weight:700;font-size:24px;color:#333;margin:0 0 2px;letter-spacing:.2px}
.con-sub{font-size:14px;color:#333;margin:0 0 12px}
.con-rif{font-size:12.5px;line-height:1.55;margin-bottom:4px}
.con-rif .hint{font-size:11.5px}
.con-r{margin:0 0 4px;font-size:13px;line-height:1.5}
.con-tab{width:100%;border-collapse:collapse;font-size:13px;margin-top:2px}
.con-tab td{padding:8px 10px;border-bottom:1px solid #e4e8e8;vertical-align:top}
.con-tab td.imp{text-align:right;white-space:nowrap;width:24%}
.con-tab tr.dettaglio td{padding-top:5px;padding-bottom:5px;color:#333}
.con-tot{display:flex;justify-content:space-between;background:var(--teal);color:#fff;font-weight:700;font-size:15px;padding:10px 12px;margin-top:10px}
.con-nota{font-size:12.5px;line-height:1.5;margin:10px 0 0}
.con-p{font-size:12.5px;line-height:1.5;margin:0 0 9px}
.con-luogo{margin-top:12px}
.con-pie{margin-top:28px;padding-top:6px;border-top:1px solid #ccc;font-size:10.5px;color:#666}
"""
i = out.index('</style>')
out = out[:i] + css + out[i:]

# --- registro degli strumenti ---
out = sost(out, " {id:'prev',lab:'Preventivo',ico:I.euro},",
           " {id:'prev',lab:'Preventivo',ico:I.euro},\n {id:'contratto',lab:'Contratto',ico:I.note},   /* contratto: contratto di vendita */")
out = sost(out, " {l:'Documenti', t:['riparazione','ce','patente','dogana','plus','prev']},",
           " {l:'Documenti', t:['riparazione','ce','patente','dogana','plus','prev','contratto']},")
out = sost(out, " plus:['Migelino Plus','Il certificato di protezione degli apparecchi: danni accidentali, smarrimento e furto.'],",
           " plus:['Migelino Plus','Il certificato di protezione degli apparecchi: danni accidentali, smarrimento e furto.'],\n"
           " contratto:['Contratto di vendita','Il contratto che il cliente firma: dati, fornitura e prezzo, pagamento e consegna, condizioni. PDF pronto da inviare.'],")
out = sost(out, "const TIPI={riparazione:'Riparazione',ce:'Dichiarazione CE',patente:'Scheda patente',dogana:'Dogana',plus:'Migelino Plus'};",
           "const TIPI={riparazione:'Riparazione',ce:'Dichiarazione CE',patente:'Scheda patente',dogana:'Dogana',plus:'Migelino Plus',contratto:'Contratto di vendita'};")
# --- modulo, anteprima, PDF ---
out = sost(out, "({riparazione:fRip,ce:fCE,patente:fPat,dogana:fDog,plus:fPlus})[TAB]();",
           "({riparazione:fRip,ce:fCE,patente:fPat,dogana:fDog,plus:fPlus,contratto:fCon})[TAB]();")
out = sost(out, "sheet.innerHTML=({riparazione:pRip,ce:pCE,patente:pPat,dogana:pDog,plus:pPlus})[TAB]();",
           "sheet.innerHTML=({riparazione:pRip,ce:pCE,patente:pPat,dogana:pDog,plus:pPlus,contratto:pCon})[TAB]();")
out = sost(out, "try{({riparazione:pdfRip,ce:pdfCE,patente:pdfPat,dogana:pdfDog,plus:pdfPlus})[tab]();}",
           "try{({riparazione:pdfRip,ce:pdfCE,patente:pdfPat,dogana:pdfDog,plus:pdfPlus,contratto:pdfCon})[tab]();}")
# --- controlli prima del PDF (stessa finestra degli avvisi USMAF) ---
out = sost(out, "  const avvisi=controlliDogana(tab);",
           "  const avvisi=tab==='contratto'? controlliContratto(tab) : controlliDogana(tab);   /* contratto: controlli */")
out = sost(out, "    modal('Controlla la richiesta USMAF',",
           "    modal(tab==='contratto'?'Controlla il contratto':'Controlla la richiesta USMAF',")
out = sost(out, "      '<p class=\"hint\">Puoi scaricare lo stesso il PDF, ma l\\'USMAF potrebbe respingere la richiesta.</p>',",
           "      '<p class=\"hint\">'+(tab==='contratto'?'Puoi scaricare lo stesso il PDF: i dati mancanti si completano a mano prima della firma.':'Puoi scaricare lo stesso il PDF, ma l\\'USMAF potrebbe respingere la richiesta.')+'</p>',")
# --- righe della fornitura: aggiungi / rimuovi ---
out = sost(out, "  document.querySelectorAll('#form [data-rmart]').forEach(b=>b.onclick=()=>{",
           "  document.querySelectorAll('#form [data-addcon]').forEach(b=>b.onclick=()=>{   /* contratto: voci della fornitura */\n"
           "    syncForm(); const o=d('contratto'); o.articoli=o.articoli||[]; o.articoli.push({qta:'1'}); saveD(); render();});\n"
           "  document.querySelectorAll('#form [data-rmcon]').forEach(b=>b.onclick=()=>{\n"
           "    syncForm(); const o=d('contratto'); (o.articoli||[]).splice(+b.dataset.rmcon,1); if(!o.articoli.length) o.articoli=[{qta:'1'}]; saveD(); render();});\n"
           "  document.querySelectorAll('#form [data-rmart]').forEach(b=>b.onclick=()=>{")
# --- home: «Comincia da qui» ---
out = sost(out, "      '<button class=\"btn btn-sm\" data-home=\"plus\">'+sv(I.shield)+'Migelino Plus</button>'+",
           "      '<button class=\"btn btn-sm\" data-home=\"plus\">'+sv(I.shield)+'Migelino Plus</button>'+\n"
           "      '<button class=\"btn btn-sm\" data-home=\"contratto\">'+sv(I.note)+'Contratto di vendita</button>'+")
# --- compilazione rapida da testo ---
out = sost(out, "  if(['riparazione','ce','patente','dogana'].indexOf(tab)<0) return '';",
           "  if(['riparazione','ce','patente','dogana','contratto'].indexOf(tab)<0) return '';")
out = sost(out, "  dogana:{fatt:'fatt',fattData:'fattData',awb:'awb',tipo:'tipo',corriere:'corriere',voce:'voce',iva:'iva',",
           "  contratto:{cliente:'cliente',cf:'cf',sesso:'sesso',tel:'tel',email:'email',res:'res',comune:'comune',cap:'cap',prov:'prov',\n"
           "    azienda:'azienda',firmatario:'firmatario',data:'data'},   /* contratto: campi riconosciuti dal testo */\n"
           "  dogana:{fatt:'fatt',fattData:'fattData',awb:'awb',tipo:'tipo',corriere:'corriere',voce:'voce',iva:'iva',")
# --- il codice della scheda, dopo build() ---
anc = "\n/* ================= MODALI ================= */\n"
out = sost(out, anc, "\n" + sezione + anc)

# un commento in testa alla pagina ricorda da dove viene la scheda
out = sost(out, "<meta name=\"migelino-cloud\" content=\"1\">",
           "<meta name=\"migelino-cloud\" content=\"1\">\n<!-- scheda Contratto di vendita aggiunta il 26/10/2026 (nucleo condiviso con il Foglio Google, repo DenisColla/shopify) -->")
open(sys.argv[2], 'w', encoding='utf-8').write(out)
print('scritto', sys.argv[2], len(out), 'caratteri (+', len(out) - len(src), ')')
