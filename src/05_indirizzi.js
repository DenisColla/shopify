/**
 * Indirizzi: normalizzazione, controlli di completezza/coerenza, confronto e
 * conversione nel formato Shopify (MailingAddressInput).
 */

var Indirizzi = (function () {
  var PAESI = {
    italia: 'IT', italy: 'IT', it: 'IT', svizzera: 'CH', switzerland: 'CH', ch: 'CH',
    'san marino': 'SM', sm: 'SM', germania: 'DE', germany: 'DE', francia: 'FR', france: 'FR',
    austria: 'AT', spagna: 'ES', spain: 'ES', bulgaria: 'BG', 'regno unito': 'GB',
    'stati uniti': 'US', usa: 'US'
  };
  var TIPI_VIA = /\b(via|viale|piazza|piazzale|piazzetta|corso|largo|strada|str|vicolo|contrada|localita|frazione|borgo|salita|lungomare|lungo|traversa|rione|v|p|za|zza|le|so|go)\b/g;
  var PARTICELLE = /\b(di|del|dello|della|dei|degli|delle|da|dal|dalla|in|e|a|al|alla|ai|agli|alle|san|santa|santo|s)\b/g;
  var CIVICO_FINALE = /^(.*?)[,\s]+((?:n\.?\s*)?\d+\s*[A-Za-z]?(?:\s*\/\s*[A-Za-z0-9]+)?|snc|s\.n\.c\.?)\s*$/i;

  function t(s) {
    return Testo.spazi(s);
  }

  function codicePaese(paese) {
    var p = Testo.chiave(paese);
    if (!p) return 'IT';
    if (/^[a-z]{2}$/.test(p)) return p.toUpperCase();
    return PAESI[p] || 'IT';
  }

  /** Separa "Via Roma 16" in via + civico quando il civico non è stato indicato a parte. */
  function separaCivico(via, civico) {
    var v = t(via);
    var c = t(civico);
    if (c) return { via: v, civico: c };
    var m = CIVICO_FINALE.exec(v);
    if (m) return { via: t(m[1]), civico: t(m[2]).replace(/^n\.?\s*/i, '') };
    return { via: v, civico: '' };
  }

  function normalizzaCivico(civico) {
    var c = t(civico).replace(/^n\.?\s*/i, '').replace(/\s*\/\s*/g, '/');
    if (/^s\.?n\.?c\.?$/i.test(c)) return 'snc';
    return c.toUpperCase();
  }

  /** Normalizza un indirizzo interno (vedi la struttura in fondo al file). */
  function normalizza(ind) {
    var sep = separaCivico(ind.via, ind.civico);
    var paese = codicePaese(ind.paese);
    var n = {
      via: paese === 'IT' ? Testo.maiuscoleIndirizzo(sep.via) : t(sep.via),
      civico: normalizzaCivico(sep.civico),
      dettagli: t(ind.dettagli),
      cap: t(ind.cap).replace(/\s+/g, ''),
      comune: t(ind.comune),
      provincia: t(ind.provincia).toUpperCase().replace(/[^A-Z]/g, ''),
      paese: paese,
      presso: t(ind.presso),
      destinatarioNome: Testo.maiuscoleNome(ind.destinatarioNome),
      destinatarioCognome: Testo.maiuscoleNome(ind.destinatarioCognome),
      telefono: t(ind.telefono)
    };
    if (paese === 'IT') {
      if (/^\d{4}$/.test(n.cap)) n.cap = '0' + n.cap;
      var comune = Comuni.trova(n.comune, n.provincia || null);
      if (comune) {
        n.comune = comune.nome;
        if (!n.provincia) n.provincia = comune.sigla;
      } else {
        n.comune = Testo.maiuscoleIndirizzo(n.comune);
      }
      if (!n.provincia && n.cap) n.provincia = Comuni.siglaDaCap(n.cap) || '';
      if (n.presso && !/^c\/o\b/i.test(n.presso)) n.presso = 'C/O ' + n.presso;
    }
    return n;
  }

  /** Controlla completezza e coerenza. problemi = bloccanti, avvisi = informativi. */
  function valida(ind) {
    var problemi = [];
    var avvisi = [];
    if (!ind.via) problemi.push('via mancante');
    if (!ind.comune) problemi.push('comune mancante');
    if (ind.paese === 'IT') {
      if (!ind.civico) problemi.push('numero civico mancante');
      if (!/^\d{5}$/.test(ind.cap)) problemi.push('CAP mancante o non valido');
      if (!Comuni.siglaValida(ind.provincia)) problemi.push('provincia mancante o non valida');
      if (/^\d{5}$/.test(ind.cap) && Comuni.siglaValida(ind.provincia)) {
        var coerente = Comuni.capCoerente(ind.cap, ind.provincia);
        if (coerente === false) problemi.push('CAP ' + ind.cap + ' non compatibile con la provincia ' + ind.provincia);
        if (coerente === null) avvisi.push('CAP non verificabile');
      }
      if (ind.comune && !Comuni.trova(ind.comune, ind.provincia)) {
        avvisi.push('comune "' + ind.comune + '" non presente in tabella (frazione o nome diverso)');
      }
    } else if (!ind.cap) {
      problemi.push('codice postale mancante');
    }
    return { ok: problemi.length === 0, problemi: problemi, avvisi: avvisi };
  }

  function chiaveVia(via) {
    return Testo.chiave(via).replace(TIPI_VIA, ' ').replace(PARTICELLE, ' ').replace(/\s+/g, ' ').trim();
  }

  function chiaveConfronto(ind) {
    return [chiaveVia(ind.via), Testo.chiave(ind.civico).replace(/\s+/g, ''), t(ind.cap)].join('|');
  }

  function uguali(a, b) {
    if (!a || !b) return false;
    return chiaveConfronto(a) === chiaveConfronto(b);
  }

  function address1(ind) {
    return t(ind.via + (ind.civico ? ' ' + ind.civico : ''));
  }

  /** Converte in MailingAddressInput di Shopify. persona = {nome, cognome, azienda, telefono}. */
  function perShopify(ind, persona) {
    var indirizzo = {
      address1: address1(ind),
      city: ind.comune,
      zip: ind.cap,
      countryCode: ind.paese,
      firstName: persona.nome || null,
      lastName: persona.cognome || null
    };
    if (ind.dettagli) indirizzo.address2 = ind.dettagli;
    if (ind.paese === 'IT' && ind.provincia) indirizzo.provinceCode = ind.provincia;
    if (persona.azienda) indirizzo.company = persona.azienda;
    if (persona.telefono) indirizzo.phone = persona.telefono;
    return indirizzo;
  }

  /** Indirizzo letto da Shopify -> MailingAddressInput completo (per aggiornarlo senza perdere campi). */
  function daShopifyAInput(a) {
    var input = {};
    ['address1', 'address2', 'city', 'company', 'firstName', 'lastName', 'phone', 'provinceCode', 'zip'].forEach(function (k) {
      if (a && a[k] !== null && a[k] !== undefined && a[k] !== '') input[k] = a[k];
    });
    if (a && (a.countryCodeV2 || a.countryCode)) input.countryCode = a.countryCodeV2 || a.countryCode;
    return input;
  }

  /** Converte un indirizzo letto da Shopify nella struttura interna (per i confronti). */
  function daShopify(a) {
    var sep = separaCivico(a.address1, '');
    return normalizza({
      via: sep.via, civico: sep.civico, dettagli: a.address2, cap: a.zip, comune: a.city,
      provincia: a.provinceCode, paese: a.countryCodeV2 || a.countryCode || 'IT'
    });
  }

  return {
    normalizza: normalizza,
    valida: valida,
    uguali: uguali,
    chiaveConfronto: chiaveConfronto,
    perShopify: perShopify,
    daShopify: daShopify,
    daShopifyAInput: daShopifyAInput,
    address1: address1,
    separaCivico: separaCivico,
    codicePaese: codicePaese
  };
})();

/*
 * Struttura interna di un indirizzo:
 * { via, civico, dettagli, cap, comune, provincia, paese, presso,
 *   destinatarioNome, destinatarioCognome, telefono }
 */
