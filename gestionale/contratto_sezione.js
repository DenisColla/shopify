
/* ==================================================================
   CONTRATTO DI VENDITA  (scheda «Contratto»)
   Il documento che il cliente firma: parti, fornitura e prezzo, pagamento
   e consegna, condizioni. Calcoli e testi vengono da contrattoNucleo(),
   lo stesso nucleo del Foglio Google (repository DenisColla/shopify,
   src/20_contratto_nucleo.js): modificarlo lì e ricopiarlo qui.
   ================================================================== */
__NUCLEO__

const CON_TAGLINE='Soluzioni Acustiche Avanzate & Teleaudiologia';
const CON_SITO='www.migelino.it';
function conRisorse(az){
  az=az||S.aziende[0];
  const righe=(az.righe||[]).map(x=>String(x));
  const email=(righe.join(' ').match(/[\w.+-]+@[\w.-]+\.\w+/)||['support@migelino.it'])[0];
  const tel=(righe.find(r=>/^\+?[\d\s]{8,}$/.test(r.trim()))||'').trim();
  const sede=String(az.sede||'').replace(/\s+—\s+(.+)$/,' ($1)');
  return {
    logo:LOGO,
    venditore:az.nome+(sede?', '+sede:'')+', operante in Italia come Migelino Italia.',
    firmaPer:'Firma per '+az.nome,
    tagline:CON_TAGLINE,
    pie:[az.nome,CON_SITO,email,tel].filter(Boolean).join(' | '),
    emailSupporto:email,
    sito:CON_SITO,
    provaGiorni:30,
    garanziaMesi:(S.opzioni&&+S.opzioni.garanziaMesi)||24
  };
}
function conNucleo(az){ return contrattoNucleo(conRisorse(az)); }
const CON_TITOLI=['Sig.','Sig.ra','Dott.','Dott.ssa',''];
/* dal modulo (chiavi piatte, righe in o.articoli) alla struttura del nucleo */
function conDati(o,N){
  N=N||conNucleo();
  const titolo = o.titolo===undefined ? (o.sesso==='F'?'Sig.ra':'Sig.') : o.titolo;
  return N.normalizza({
    numero:o.protocollo||'',
    sottotitolo:o.sottotitolo,
    preventivo:{numero:o.prevNum,data:o.prevData},
    dataSottoscrizione:o.dataFirma,
    cliente:{titolo:titolo,nome:o.cliente,cognome:'',codiceFiscale:o.cf,indirizzo:o.res,indirizzo2:o.res2,
      cap:o.cap,comune:o.comune,provincia:o.prov,telefono:o.tel,email:o.email},
    righe:(o.articoli||[]).map(A=>({descrizione:A.descrizione,dettaglio:A.dettaglio,quantita:A.qta,prezzo:A.prezzo,
      sconto:A.sconto,etichettaSconto:A.etSconto,etichettaDopoSconto:A.etDopo,omaggio:!!A.omaggio})),
    notaFornitura:o.notaForn,
    spedizioneInclusa:o.spedInclusa!==false,
    pagamento:{modalita:o.pagMod,finanziaria:o.finanziaria,rate:o.rate,maggiorazione:o.magg,acconto:o.acconto,testo:o.pagTesto},
    consegna:{diversa:!!o.consDiversa,destinatario:o.consDest,indirizzo:o.consRes,indirizzo2:o.consRes2,
      cap:o.consCap,comune:o.consComune,provincia:o.consProv,note:o.consNote},
    condizioni:{prova:o.prova!==false,garanziaMesi:o.garMesi,estensione:o.estensione,note:o.condNote},
    luogo:o.luogoFirma
  });
}

/* ---------------- modulo ---------------- */
function fCon(){
  const tab='contratto', o=d(tab);
  if(!o.data) o.data=today();
  if(o.azienda===undefined){ const ag=(S.aziende||[]).find(a=>a.id==='ag'); if(ag) o.azienda=ag.id; }
  if(!Array.isArray(o.articoli)||!o.articoli.length) o.articoli=[{qta:'1'}];
  if(o.pagMod===undefined) o.pagMod='BONIFICO';
  if(o.finanziaria===undefined) o.finanziaria='HeyLight';
  if(o.rate===undefined) o.rate='12';
  if(o.magg===undefined) o.magg='6';
  if(o.garMesi===undefined) o.garMesi=String((S.opzioni&&S.opzioni.garanziaMesi)||24);
  if(o.prova===undefined) o.prova=true;
  if(o.spedInclusa===undefined) o.spedInclusa=true;
  const N=conNucleo(), dati=conDati(o,N), calc=N.calcola(dati);
  const titolo = o.titolo===undefined ? (o.sesso==='F'?'Sig.ra':'Sig.') : o.titolo;
  const rateale = o.pagMod==='FINANZIAMENTO'||o.pagMod==='RATE';
  let art='';
  o.articoli.forEach((A,i)=>{
    const K=k=>'art.'+i+'.'+k;
    const r=N.normalizza({righe:[{quantita:A.qta,prezzo:A.prezzo,sconto:A.sconto,omaggio:!!A.omaggio}]}).righe[0];
    const importo=r.quantita*r.prezzo;
    const riep='Importo '+N.euro(importo)+(r.quantita>1?' ('+r.quantita+' × '+N.euro(r.prezzo)+')':'')+
      (r.omaggio?' — in omaggio: addebito 0,00 €':(r.sconto>0?' — dopo lo sconto '+N.euro(Math.max(0,importo-Math.min(r.sconto,importo))):''));
    art+=CARD('con_art'+i,(o.articoli.length>1?'Voce '+(i+1):'Apparecchi e accessori'),
      FLD({k:K('descrizione'),label:'Descrizione',value:A.descrizione||'',req:i===0,ph:'es. Oticon Intent 1 - coppia (2 apparecchi)'})+
      '<div class="row3">'+
      FLD({k:K('qta'),label:'Quantità',type:'number',value:A.qta||'1'})+
      FLD({k:K('prezzo'),label:'Prezzo unitario (€, IVA inclusa)',value:A.prezzo||'',req:i===0,ph:'es. 1.790,00'})+
      FLD({k:K('sconto'),label:'Sconto sulla voce (€)',value:A.sconto||'',ph:'facoltativo'})+
      '</div>'+
      FLD({k:K('dettaglio'),label:'Dettaglio stampato sotto la voce',value:A.dettaglio||'',ph:'es. Colore selezionato: Honey Beige'})+
      CHK(K('omaggio'),'Fornito in omaggio','nel contratto compaiono il valore e lo sconto integrale',!!A.omaggio)+
      '<div class="row2">'+
      FLD({k:K('etSconto'),label:'Etichetta dello sconto o dell\'omaggio',value:A.etSconto||'',ph:'es. Sconto sulla coppia'})+
      FLD({k:K('etDopo'),label:'Etichetta della riga dopo lo sconto',value:A.etDopo||'',ph:'es. Prezzo della coppia dopo lo sconto'})+
      '</div><p class="hint">'+esc(riep)+'</p>',
      (o.articoli.length>1?'<button class="btn btn-sm btn-danger-text" data-rmcon="'+i+'">Rimuovi</button>':''));
  });
  return cardRapida(tab)+blocIntest(tab)+
  CARD('con_int','Contratto',
    FLD({k:'sottotitolo',label:'Sottotitolo sotto il titolo',value:v(tab,'sottotitolo',''),
      ph:N.sottotitoloProposto(dati)||'es. Oticon Intent 1 - Coppia | SmartCharger incluso gratuitamente',
      hint:'Vuoto = proposto dalla fornitura.'})+
    '<div class="row3">'+
    FLD({k:'prevNum',label:'Preventivo n.',value:v(tab,'prevNum',''),ph:'es. 2026/0895'})+
    FLD({k:'prevData',label:'Data del preventivo',type:'date',value:v(tab,'prevData','')})+
    FLD({k:'dataFirma',label:'Data di sottoscrizione',type:'date',value:v(tab,'dataFirma',''),hint:'Vuota = riga da compilare a mano alla firma.'})+
    '</div>'+
    FLD({k:'luogoFirma',label:'Luogo della firma',value:v(tab,'luogoFirma',''),ph:'facoltativo, es. Napoli'})+
    '<p class="hint">Il numero del contratto è il <b>protocollo</b> qui sopra: viene assegnato quando scarichi il PDF.</p>')+
  CARD('con_cli','Cliente',
    clienteBlocco(tab)+
    '<div class="row3">'+
    FLD({k:'titolo',label:'Titolo',type:'select',value:titolo,opts:CON_TITOLI.map(t=>({v:t,l:t||'(nessuno)'}))})+
    FLD({k:'cliente',label:'Nome e cognome',value:v(tab,'cliente',''),req:true})+
    FLD({k:'cf',label:'Codice fiscale',value:v(tab,'cf','')})+
    '</div><div class="row2">'+
    FLD({k:'tel',label:'Telefono',value:v(tab,'tel','')})+
    FLD({k:'email',label:'Email',value:v(tab,'email',''),hint:'Serve per inviare il contratto.'})+
    '</div>'+
    '<div class="field"><label>Indirizzo (via e numero civico) <span class="req">*</span></label><div class="combo">'+
    '<input type="text" id="f_res" data-k="res" value="'+esc(v(tab,'res',''))+'" placeholder="Scrivi la via e scegli dall\'elenco" autocomplete="off">'+
    '<div class="combo-list" id="res_list"></div></div>'+
    '<p class="hint" id="res_hint">Suggerimenti da OpenStreetMap: scrivi almeno 4 lettere. Comune, CAP e provincia si compilano da soli.</p></div>'+
    FLD({k:'res2',label:'Scala, interno, presso',value:v(tab,'res2',''),ph:'facoltativo, es. Parco Lucrezia'})+
    '<div class="row3">'+
    FLD({k:'comune',label:'Comune',value:v(tab,'comune',''),req:true})+
    FLD({k:'cap',label:'CAP',value:v(tab,'cap',''),req:true})+
    FLD({k:'prov',label:'Provincia (sigla)',value:v(tab,'prov',''),req:true})+
    '</div>'+
    '<div class="inline"><button class="btn btn-sm" data-savecli="1">'+sv(I.user)+'Salva in anagrafica</button></div>')+
  art+
  '<div class="card"><div class="card-body"><div class="inline" style="justify-content:space-between">'+
    '<button class="btn btn-sm" data-addcon="1">'+sv(I.plus)+'Aggiungi una voce</button>'+
    '<span class="hint">Totale contratto, IVA inclusa: <b id="con_tot">'+esc(N.euro(calc.totale))+'</b></span></div>'+
    FLD({k:'notaForn',label:'Nota sotto il totale',type:'textarea',rows:2,value:v(tab,'notaForn',''),
      ph:N.notaFornituraProposta(dati)||'Nessuna nota',hint:'Vuota = proposta in automatico (omaggi e spedizione inclusa).'})+
    CHK('spedInclusa','Spedizione inclusa','frase «Non sono previsti ulteriori addebiti di spedizione»',o.spedInclusa!==false)+
  '</div></div>'+
  CARD('con_pag','Pagamento',
    '<div class="row2">'+
    FLD({k:'pagMod',label:'Modalità di pagamento',type:'select',value:o.pagMod,cls:'casc',opts:N.MODALITA.map(m=>({v:m.codice,l:m.nome}))})+
    FLD({k:'acconto',label:'Acconto alla conferma (€)',value:v(tab,'acconto',''),ph:'facoltativo'})+
    '</div>'+
    (rateale?'<div class="row3">'+
      FLD({k:'rate',label:'Numero di rate',type:'number',value:o.rate})+
      (o.pagMod==='FINANZIAMENTO'
        ? FLD({k:'finanziaria',label:'Finanziaria',value:o.finanziaria,ph:'HeyLight'})+
          FLD({k:'magg',label:'Maggiorazione complessiva (%)',value:o.magg,hint:'0 = tasso zero. Non è TAN o TAEG: il contratto lo precisa.'})
        : '')+
      '</div>':'')+
    (o.pagMod==='ALTRO'?FLD({k:'pagTesto',label:'Descrizione della modalità (stampata nel contratto)',type:'textarea',rows:2,value:v(tab,'pagTesto',''),req:true}):'')+
    '<p class="hint" id="con_riep">'+esc(calc.pagamento.righe.map(x=>x[0]+': '+x[1]).join(' · '))+'</p>')+
  CARD('con_cons','Consegna',
    '<div class="row2">'+
    FLD({k:'consDest',label:'Nome del destinatario',value:v(tab,'consDest',''),ph:'vuoto = il cliente'})+
    FLD({k:'consNote',label:'Note sulla consegna',value:v(tab,'consNote',''),ph:'facoltative'})+
    '</div>'+
    CHK('consDiversa','Indirizzo di consegna diverso dalla residenza','',!!o.consDiversa)+
    (o.consDiversa
      ? '<div class="row2">'+
        FLD({k:'consRes',label:'Indirizzo di consegna',value:v(tab,'consRes',''),req:true})+
        FLD({k:'consRes2',label:'Scala, interno, presso',value:v(tab,'consRes2','')})+
        '</div><div class="row3">'+
        FLD({k:'consComune',label:'Comune',value:v(tab,'consComune',''),req:true})+
        FLD({k:'consCap',label:'CAP',value:v(tab,'consCap',''),req:true})+
        FLD({k:'consProv',label:'Provincia',value:v(tab,'consProv',''),req:true})+
        '</div>'
      : ''))+
  CARD('con_cond','Condizioni',
    CHK('prova','Prova convenzionale di 30 giorni','se la togli, il contratto rimanda ai soli diritti di legge',o.prova!==false)+
    '<div class="row2">'+
    FLD({k:'garMesi',label:'Garanzia (mesi dalla consegna)',type:'number',value:o.garMesi,hint:'Minimo 24: la garanzia legale di conformità.'})+
    FLD({k:'estensione',label:'Estensione di garanzia concordata',value:v(tab,'estensione',''),ph:'facoltativa, es. Migelino Plus: 4 anni'})+
    '</div>'+
    FLD({k:'condNote',label:'Condizioni particolari',type:'textarea',rows:3,value:v(tab,'condNote',''),ph:'facoltative: diventano l\'ultimo paragrafo della sezione 4'}));
}
/* legami propri della scheda (il modulo si ridisegna a ogni render) */
function conAggancia(){
  if(TAB!=='contratto') return;
  const lega=(id,fn)=>{ const el=document.getElementById(id); if(!el||el.dataset.con) return; el.dataset.con='1'; el.addEventListener('change',fn); };
  lega('f_consDiversa',()=>{ syncForm(); setTimeout(render,0); });
  lega('f_titolo',()=>{ d('contratto').titolo=document.getElementById('f_titolo').value; saveD(); });
  const N=conNucleo(), o=d('contratto'), c=N.calcola(conDati(o,N));
  const t=document.getElementById('con_tot'); if(t) t.textContent=N.euro(c.totale);
  const r=document.getElementById('con_riep'); if(r) r.textContent=c.pagamento.righe.map(x=>x[0]+': '+x[1]).join(' · ');
}

/* ---------------- anteprima (foglio A4) ---------------- */
function pCon(){
  try{ conAggancia(); }catch(e){}
  const {o,az,fi}=ctx('contratto');
  const N=conNucleo(az), R=conRisorse(az), dati=conDati(o,N), c=N.calcola(dati), T=N.testi(c);
  const riga=(l,vHtml)=>'<p class="con-r"><b>'+esc(l)+':</b> '+vHtml+'</p>';
  const vuoto='____________________';
  const indRes=[o.res,o.res2].filter(x=>String(x||'').trim()).join(', ');
  const cli=dati.cliente;
  let h='<div class="con-head"><div class="con-tag">'+esc(R.tagline)+'</div><div class="doc-logo"><img src="'+LOGO+'" alt=""></div></div>'+
    '<hr class="doc-rule con-rule">'+
    '<div class="con-title">CONTRATTO DI VENDITA</div>'+
    (T.sottotitolo?'<div class="con-sub">'+mko(T.sottotitolo,'sottotitolo')+'</div>':'')+
    '<div class="con-rif">'+
    (o.protocollo?'<div>Contratto n. <b>'+mko(o.protocollo,'protocollo')+'</b></div>':'<div class="hint">Contratto n. (il protocollo viene assegnato allo scarico del PDF)</div>')+
    ((dati.preventivo.numero||dati.preventivo.data)
      ? '<div>Riferimento: preventivo'+(dati.preventivo.numero?' n. <b>'+mko(dati.preventivo.numero,'prevNum')+'</b>':'')+
        (dati.preventivo.data?' del '+mko(N.dataIt(dati.preventivo.data),'prevData'):'')+'</div>' : '')+
    '<div>Data di sottoscrizione: '+(dati.dataSottoscrizione?mko(N.dataIt(dati.dataSottoscrizione),'dataFirma'):vuoto)+'</div></div>';
  h+='<div class="doc-sec">1. Parti e dati del cliente</div>'+
    riga('Venditore',esc(R.venditore))+
    riga('Cliente',(cli.titolo?esc(cli.titolo)+' ':'')+mkr(o.cliente,'cliente'))+
    riga('Codice fiscale',String(o.cf||'').trim()?'<b>'+mko(cli.codiceFiscale,'cf')+'</b>':'<span class="mk no" data-va="cf" title="Vai al campo"></span>')+
    riga('Indirizzo',mkr(indRes,'res'))+
    riga('CAP / Comune / Provincia',mkr(cli.cap,'cap')+' '+mkr(cli.comune,'comune')+' ('+mkr(cli.provincia,'prov')+')')+
    riga('Telefono',String(o.tel||'').trim()?mko(o.tel,'tel'):'<span class="mk no" data-va="tel" title="Vai al campo"></span>')+
    riga('E-mail',String(o.email||'').trim()?mko(o.email,'email'):'<span class="mk no" data-va="email" title="Vai al campo"></span>');
  h+='<div class="doc-sec">2. Fornitura e prezzo concordato</div><table class="con-tab">'+
    (c.righe.length
      ? c.righe.map(r=>{
          const campo = r.tipo==='voce'?'art.'+r.indice+'.descrizione' : r.tipo==='dettaglio'?'art.'+r.indice+'.dettaglio' : 'art.'+r.indice+'.sconto';
          const testo = r.tipo==='voce'? mkr(dati.righe[r.indice].descrizione,campo) : mko(r.testo,campo);
          const imp = r.importo===null?'' : (r.tipo==='voce'&&!(dati.righe[r.indice].prezzo>0)? mkr('','art.'+r.indice+'.prezzo') : mko(N.euro(r.importo),r.tipo==='voce'?'art.'+r.indice+'.prezzo':campo));
          return '<tr class="'+r.tipo+'"><td>'+testo+'</td><td class="imp">'+imp+'</td></tr>'; }).join('')
      : '<tr><td>'+mkr('','art.0.descrizione')+'</td><td class="imp">'+mkr('','art.0.prezzo')+'</td></tr>')+
    '</table><div class="con-tot"><span>TOTALE CONTRATTO - IVA INCLUSA</span><span>'+esc(N.euro(c.totale))+'</span></div>'+
    (T.notaFornitura?'<p class="con-nota">'+mko(T.notaFornitura,'notaForn').replace(/\n/g,'<br>')+'</p>':'');
  h+='<div class="doc-sec">3. Pagamento e consegna</div>'+
    c.pagamento.righe.map(r=>riga(r[0],mko(r[1],'pagMod'))).join('')+
    '<p class="con-r"><b>Indirizzo di consegna:</b> '+(T.consegnaIndirizzo?mko(T.consegnaIndirizzo,o.consDiversa?'consRes':'res'):mkr('',o.consDiversa?'consRes':'res'))+
    '. Nome destinatario: '+(T.consegnaDestinatario?mko(T.consegnaDestinatario,'consDest'):mkr('','cliente'))+
    (dati.consegna.note?'. '+mko(dati.consegna.note,'consNote'):'')+'</p>'+
    (c.pagamento.nota?'<p class="con-nota">'+esc(c.pagamento.nota)+'</p>':'');
  h+='<div class="doc-sec">4. Servizi e condizioni della fornitura</div>'+
    T.condizioni.map(p=>'<p class="con-p"><b>'+esc(p[0])+'</b> '+esc(p[1]).replace(/\n/g,'<br>')+'</p>').join('');
  h+='<div class="doc-sec">5. Accettazione e firme</div>'+
    '<p class="con-p">'+esc(T.accettazione)+'</p><p class="con-p">'+esc(T.privacy)+'</p>'+
    '<div class="plus-luogo con-luogo">Luogo e data: '+(String(o.luogoFirma||'').trim()?mko(o.luogoFirma,'luogoFirma')+', ':'')+'______________________________</div>'+
    '<div class="plus-firme"><div class="cli"><div class="riga"></div>Firma del cliente'+
    (o.cliente?'<div class="nm">'+esc((cli.titolo?cli.titolo+' ':'')+o.cliente)+'</div>':'')+'</div>'+
    pvSign(az,fi,null,R.firmaPer)+'</div>'+
    '<div class="con-pie">'+esc(R.pie)+'</div>';
  return h;
}

/* ---------------- controlli prima del PDF (avvisano, non bloccano) ---------------- */
function controlliContratto(tab){
  if(tab!=='contratto') return [];
  const o=d(tab), N=conNucleo(), dati=conDati(o,N), c=N.calcola(dati);
  const fuori=[];
  const cf=String(o.cf||'').trim();
  if(cf&&!cfValido(cf)) fuori.push('Il codice fiscale «'+cf+'» non supera il controllo: ricontrollalo.');
  if(cf&&String(o.cliente||'').trim()&&typeof cfAbbinaNome==='function'&&!cfAbbinaNome(cf.toUpperCase(),o.cliente)) fuori.push('Il codice fiscale non combacia con «'+o.cliente+'».');
  if(!cf) fuori.push('Manca il codice fiscale: nel PDF resta una riga da completare a mano prima della firma.');
  if(String(o.cap||'').trim()&&!/^\d{5}$/.test(String(o.cap).trim())) fuori.push('Il CAP deve avere 5 cifre.');
  if(String(o.prov||'').trim()&&!/^[A-Za-z]{2}$/.test(String(o.prov).trim())) fuori.push('La provincia va scritta come sigla di due lettere (es. NA).');
  if(String(o.email||'').trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(o.email).trim())) fuori.push('L\'email «'+o.email+'» non sembra valida.');
  if(!String(o.tel||'').trim()) fuori.push('Manca il telefono del cliente.');
  if(!c.righe.length) fuori.push('Nessuna voce di fornitura compilata.');
  else if(c.totale<=0) fuori.push('Il totale del contratto è pari a zero.');
  (dati.righe||[]).forEach((r,i)=>{
    if((r.descrizione||r.prezzo>0)&&!r.descrizione) fuori.push('Voce '+(i+1)+': manca la descrizione.');
    if(r.descrizione&&!r.omaggio&&!(r.prezzo>0)) fuori.push('Voce '+(i+1)+' («'+r.descrizione+'»): prezzo pari a zero.');
    if(!r.omaggio&&r.sconto>r.quantita*r.prezzo) fuori.push('Voce '+(i+1)+': lo sconto supera l\'importo (viene limitato).');
  });
  const p=dati.pagamento;
  if((p.modalita==='FINANZIAMENTO'||p.modalita==='RATE')&&p.rate<2) fuori.push('Numero di rate non valido: minimo 2.');
  if(p.modalita==='FINANZIAMENTO'&&p.maggiorazione>30) fuori.push('Maggiorazione del finanziamento oltre il 30%: controlla.');
  if(p.modalita==='ALTRO'&&!p.testo) fuori.push('Modalità «Altro»: descrivi il pagamento.');
  if(p.acconto>0&&c.totale>0&&p.acconto>=c.totale) fuori.push('L\'acconto è pari o superiore al totale.');
  if(dati.consegna.diversa&&(!dati.consegna.indirizzo||!dati.consegna.comune||!/^\d{5}$/.test(dati.consegna.cap)||!dati.consegna.provincia))
    fuori.push('Indirizzo di consegna incompleto (via, CAP di 5 cifre, comune, provincia).');
  if(+o.garMesi>0&&+o.garMesi<24) fuori.push('Garanzia sotto i 24 mesi: nel PDF viene indicata comunque la garanzia legale di 24 mesi.');
  return fuori;
}

/* ---------------- PDF (jsPDF, come gli altri documenti) ---------------- */
/* etichetta in grassetto e valore di seguito, a capo sulla larghezza piena */
function conKvPDF(doc,p,label,val,opz){
  opz=opz||{}; const size=opz.size||10, lh=opz.lh||1.45, step=size*0.3528*lh;
  doc.setFontSize(size); doc.setTextColor.apply(doc,opz.color||INK);
  doc.setFont('helvetica','bold'); const L=label+(opz.senzaDuePunti?' ':': '); const wL=doc.getTextWidth(L);
  doc.setFont('helvetica',opz.valBold?'bold':'normal');
  const testo=String(val==null?'':val).replace(/\s*\n+\s*/g,' ');
  const prime=doc.splitTextToSize(testo,Math.max(20,CW-wL));
  const resto=prime.slice(1).join(' ');
  const lines=[prime[0]||''].concat(resto?doc.splitTextToSize(resto,CW):[]);
  if(lines.length<=4) p.brk(step*lines.length+1);
  doc.setFont('helvetica','bold'); doc.setFontSize(size); doc.setTextColor.apply(doc,opz.color||INK); doc.text(L,ML,p.y);
  doc.setFont('helvetica',opz.valBold?'bold':'normal'); doc.text(lines[0],ML+wL,p.y); p.y+=step;
  lines.slice(1).forEach(l=>{ p.brk(step+1); doc.text(l,ML,p.y); p.y+=step; });
}
function conSezPDF(doc,p,t){ p.gap(3.5); p.brk(26); secPDF(doc,p,t); p.gap(1); }
function conTabPDF(doc,p,righe,N){
  const wImp=40, size=10, step=size*0.3528*1.4;
  righe.forEach(r=>{
    const dett=r.tipo==='dettaglio';
    doc.setFont('helvetica','normal'); doc.setFontSize(size);
    const L=doc.splitTextToSize(String(r.testo||''),CW-wImp-8);
    const h=L.length*step+(dett?3.4:4.2);
    p.brk(h+1);
    const y0=p.y;
    doc.setTextColor.apply(doc,dett?[51,51,51]:INK);
    L.forEach((l,i)=>doc.text(l,ML+3,y0+i*step));
    if(r.importo!==null){ doc.setTextColor.apply(doc,INK); doc.text(N.euro(r.importo),ML+CW-3,y0,{align:'right'}); }
    p.y=y0+(L.length-1)*step+(dett?2.2:3);
    doc.setDrawColor(228,232,232); doc.setLineWidth(.2); doc.line(ML,p.y,ML+CW,p.y);
    p.y+=dett?3.6:4.4;
  });
}
function conTotPDF(doc,p,label,importo){
  p.brk(13);
  doc.setFillColor(32,156,178); doc.rect(ML,p.y-2.2,CW,9.2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(255,255,255);
  doc.text(label,ML+3,p.y+4); doc.text(importo,ML+CW-3,p.y+4,{align:'right'});
  doc.setTextColor.apply(doc,INK); p.y+=12;
}
function conTestaPDF(doc,p,R){
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,GREY);
  doc.text(R.tagline,ML,MT+9);
  try{ doc.addImage(LOGO,'PNG',PW-MR-19,MT-5,19,15.6); }catch(e){}
  doc.setDrawColor.apply(doc,TEAL); doc.setLineWidth(.6); doc.line(ML,MT+13.5,ML+CW,MT+13.5); doc.setLineWidth(.2);
  p.y=MT+23;
}
function pdfCon(){
  const {o,az,fi}=ctx('contratto');
  const N=conNucleo(az), R=conRisorse(az), dati=conDati(o,N), c=N.calcola(dati), T=N.testi(c);
  const doc=newDoc(), p=P(doc);
  p.suNuovaPagina=()=>conTestaPDF(doc,p,R);
  conTestaPDF(doc,p,R);
  p.txt('CONTRATTO DI VENDITA',{size:17,style:'bold',color:[51,51,51]});
  if(T.sottotitolo) p.txt(T.sottotitolo,{size:10.5,color:[51,51,51],lh:1.4});
  p.gap(3);
  if(o.protocollo) conKvPDF(doc,p,'Contratto n.',o.protocollo,{size:9.5,valBold:true,senzaDuePunti:true});
  if(dati.preventivo.numero||dati.preventivo.data)
    conKvPDF(doc,p,'Riferimento',('preventivo'+(dati.preventivo.numero?' n. '+dati.preventivo.numero:'')+(dati.preventivo.data?' del '+N.dataIt(dati.preventivo.data):'')),{size:9.5});
  conKvPDF(doc,p,'Data di sottoscrizione',dati.dataSottoscrizione?N.dataIt(dati.dataSottoscrizione):'____________________',{size:9.5});
  p.gap(1);
  const cli=dati.cliente, vuoto='____________________';
  conSezPDF(doc,p,'1. Parti e dati del cliente');
  conKvPDF(doc,p,'Venditore',R.venditore);
  conKvPDF(doc,p,'Cliente',((cli.titolo?cli.titolo+' ':'')+(o.cliente||'')).trim()||vuoto);
  conKvPDF(doc,p,'Codice fiscale',cli.codiceFiscale||vuoto,{valBold:!!cli.codiceFiscale});
  conKvPDF(doc,p,'Indirizzo',[o.res,o.res2].filter(x=>String(x||'').trim()).join(', ')||vuoto);
  conKvPDF(doc,p,'CAP / Comune / Provincia',((cli.cap+' '+cli.comune).trim()+(cli.provincia?' ('+cli.provincia+')':'')).trim()||vuoto);
  conKvPDF(doc,p,'Telefono',String(o.tel||'').trim()||vuoto);
  conKvPDF(doc,p,'E-mail',String(o.email||'').trim()||vuoto);
  conSezPDF(doc,p,'2. Fornitura e prezzo concordato');
  conTabPDF(doc,p,c.righe.length?c.righe:[{testo:vuoto,importo:null,tipo:'voce'}],N);
  conTotPDF(doc,p,'TOTALE CONTRATTO - IVA INCLUSA',N.euro(c.totale));
  if(T.notaFornitura){ p.txt(T.notaFornitura,{size:9.5,lh:1.4}); }
  conSezPDF(doc,p,'3. Pagamento e consegna');
  c.pagamento.righe.forEach(r=>conKvPDF(doc,p,r[0],r[1]));
  conKvPDF(doc,p,'Indirizzo di consegna',(T.consegnaIndirizzo||vuoto)+'. Nome destinatario: '+(T.consegnaDestinatario||vuoto)+(dati.consegna.note?'. '+dati.consegna.note:''));
  if(c.pagamento.nota){ p.gap(.5); p.txt(c.pagamento.nota,{size:9.5,lh:1.4}); }
  conSezPDF(doc,p,'4. Servizi e condizioni della fornitura');
  T.condizioni.forEach(par=>{ conKvPDF(doc,p,par[0],par[1],{size:9.8,lh:1.42,senzaDuePunti:true}); p.gap(2); });
  conSezPDF(doc,p,'5. Accettazione e firme');
  p.txt(T.accettazione,{size:9.8,lh:1.42}); p.gap(2);
  p.txt(T.privacy,{size:9.8,lh:1.42}); p.gap(3);
  p.txt('Luogo e data: '+(dati.luogo?dati.luogo+', ':'')+'______________________________',{size:10});
  /* firme: la riga del cliente a sinistra, a destra timbro e firma del profilo (come gli altri documenti) */
  const gr=S.opzioni.firmaGrafica!==false, tb=S.opzioni.timbro!==false;
  p.brk(14+(gr?(tb?66:48):38));
  const y0=p.y;
  signPDF(doc,p,az,fi,null,R.firmaPer);
  const yl=y0+36;
  doc.setDrawColor(32,156,178); doc.setLineWidth(.4); doc.line(ML,yl,ML+CW*0.40,yl); doc.setLineWidth(.2);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor.apply(doc,GREY); doc.text('Firma del cliente',ML,yl+4.5);
  if(o.cliente){ doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor.apply(doc,INK);
    doc.splitTextToSize((cli.titolo?cli.titolo+' ':'')+o.cliente,CW*0.40).forEach((l,i)=>doc.text(l,ML,yl+9.6+i*4.6)); }
  p.y=Math.max(p.y,yl+14);
  /* piè di pagina su ogni pagina (il numero di pagina lo aggiunge salva()) */
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){ doc.setPage(i);
    doc.setDrawColor(204,204,204); doc.setLineWidth(.2); doc.line(ML,PH-13.5,ML+CW,PH-13.5);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110,110,110); doc.text(R.pie,ML,PH-10); }
  doc.setPage(n);
  salva(doc,'Contratto di vendita - '+(o.cliente||'cliente')+' - '+it(o.data).replace(/\//g,'-'),'contratto');
}
