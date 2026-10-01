/**
 * Shopify Admin GraphQL: ricerca cliente ed esecuzione del piano di scrittura.
 * Autenticazione: app del Dev Dashboard con "client credentials" (token di 24 ore
 * rinnovato in automatico) oppure, in alternativa, un token fisso già esistente.
 * Permessi necessari: read_customers, write_customers.
 */

var Shopify = (function () {
  var CHIAVE_CACHE = 'shopify_token_v1';

  var Q_CERCA = 'query CercaClienti($q: String!) { customers(first: 5, query: $q) { nodes { id firstName lastName note tags numberOfOrders ' +
    'defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber } defaultAddress { id } ' +
    'addressesV2(first: 20) { nodes { id firstName lastName company address1 address2 city provinceCode zip countryCodeV2 phone } } } } }';
  var M_CREA_CLIENTE = 'mutation CreaCliente($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }';
  var M_AGGIORNA_CLIENTE = 'mutation AggiornaCliente($input: CustomerInput!) { customerUpdate(input: $input) { customer { id } userErrors { field message } } }';
  var M_CREA_INDIRIZZO = 'mutation CreaIndirizzo($customerId: ID!, $address: MailingAddressInput!, $setAsDefault: Boolean) { ' +
    'customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: $setAsDefault) { address { id } userErrors { field message } } }';
  var M_AGGIORNA_INDIRIZZO = 'mutation AggiornaIndirizzo($customerId: ID!, $addressId: ID!, $address: MailingAddressInput!, $setAsDefault: Boolean) { ' +
    'customerAddressUpdate(customerId: $customerId, addressId: $addressId, address: $address, setAsDefault: $setAsDefault) { address { id } userErrors { field message } } }';
  var M_TAG = 'mutation AggiungiTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { field message } } }';
  var M_ELIMINA = 'mutation EliminaCliente($input: CustomerDeleteInput!) { customerDelete(input: $input) { deletedCustomerId userErrors { field message } } }';
  var Q_NEGOZIO = 'query Negozio { shop { name myshopifyDomain } currentAppInstallation { accessScopes { handle } } }';
  // Legge un cliente con tutti i campi protetti usati (nome, email, telefono, indirizzo).
  var Q_PROVA_CLIENTI = 'query ProvaClienti { customers(first: 1) { nodes { id firstName lastName defaultEmailAddress { emailAddress } ' +
    'defaultPhoneNumber { phoneNumber } addressesV2(first: 1) { nodes { address1 zip } } } } }';

  function ErroreShopify(messaggio, dettagli, codice) {
    this.name = 'ErroreShopify';
    this.message = messaggio;
    this.dettagli = dettagli || [];
    this.codice = codice || '';
  }
  ErroreShopify.prototype = Object.create(Error.prototype);

  /** Dominio .myshopify.com del negozio; accetta anche "https://…", percorsi e il solo nome. */
  function negozio() {
    var d = String(Impostazioni.obbligatoria(CHIAVI.SHOPIFY_SHOP)).trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return d.indexOf('.') < 0 ? d + '.myshopify.com' : d;
  }

  /** Client ID e Secret hanno la precedenza: il token fisso si usa solo se mancano. */
  function modoAccesso() {
    if (Impostazioni.leggi(CHIAVI.SHOPIFY_CLIENT_ID, '') && Impostazioni.leggi(CHIAVI.SHOPIFY_CLIENT_SECRET, '')) return 'CREDENZIALI';
    return Impostazioni.leggi(CHIAVI.SHOPIFY_ACCESS_TOKEN, '') ? 'TOKEN_FISSO' : '';
  }

  /** Spiega in chiaro i rifiuti più comuni della richiesta del token. */
  function erroreToken(codice, testo) {
    var aiuto = 'Controlla Client ID e Client secret (Dev Dashboard → app → Settings)';
    if (/shop_not_permitted/i.test(testo)) aiuto = 'L\'app e il negozio devono essere nella stessa organizzazione del Dev Dashboard';
    else if (codice === 404 || !/myshopify\.com$/.test(negozio())) aiuto = 'Controlla il dominio del negozio: deve finire con .myshopify.com';
    else if (/not.?installed|installation/i.test(testo)) aiuto = 'Installa l\'app sul negozio (Dev Dashboard → Install app)';
    return new ErroreShopify('Shopify: token non ottenuto (HTTP ' + codice + ')', [String(testo).slice(0, 300), aiuto]);
  }

  function token(rinnova) {
    var modo = modoAccesso();
    if (modo === 'TOKEN_FISSO') return Impostazioni.leggi(CHIAVI.SHOPIFY_ACCESS_TOKEN, '');
    if (!modo) throw new ErroreShopify('Shopify non configurato: inserisci Client ID e Client secret con "Configura"');
    var cache = CacheService.getScriptCache();
    if (!rinnova) {
      var salvato = cache.get(CHIAVE_CACHE);
      if (salvato) return salvato;
    }
    var r = UrlFetchApp.fetch('https://' + negozio() + '/admin/oauth/access_token', {
      method: 'post',
      payload: {
        grant_type: 'client_credentials',
        client_id: Impostazioni.obbligatoria(CHIAVI.SHOPIFY_CLIENT_ID),
        client_secret: Impostazioni.obbligatoria(CHIAVI.SHOPIFY_CLIENT_SECRET)
      },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw erroreToken(r.getResponseCode(), r.getContentText());
    var dati;
    try {
      dati = JSON.parse(r.getContentText());
    } catch (e) {
      dati = {};
    }
    if (!dati.access_token) throw erroreToken(r.getResponseCode(), r.getContentText());
    var durata = Math.max(60, Math.min(21600, (Number(dati.expires_in) || 3600) - 600));
    cache.put(CHIAVE_CACHE, dati.access_token, durata);
    return dati.access_token;
  }

  function graphql(query, variabili) {
    var rinnova = false;
    for (var tentativo = 0; tentativo < 4; tentativo++) {
      var r = UrlFetchApp.fetch('https://' + negozio() + '/admin/api/' + CONFIG.SHOPIFY_API_VERSIONE + '/graphql.json', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Shopify-Access-Token': token(rinnova) },
        payload: JSON.stringify({ query: query, variables: variabili || {} }),
        muteHttpExceptions: true
      });
      var codice = r.getResponseCode();
      if (codice === 401 && !rinnova && modoAccesso() === 'CREDENZIALI') { rinnova = true; continue; }
      if (codice === 429 || codice >= 500) { Utilities.sleep(2000 * (tentativo + 1)); continue; }
      if (codice === 401) {
        throw new ErroreShopify('Shopify HTTP 401', [r.getContentText().slice(0, 300), modoAccesso() === 'TOKEN_FISSO'
          ? 'Il token fisso non è valido: usa Client ID e Client secret dell\'app (guida, sezione B)'
          : 'Token rifiutato: controlla che l\'app sia installata sul negozio (Dev Dashboard → Install app)']);
      }
      if (codice !== 200) throw new ErroreShopify('Shopify HTTP ' + codice, [r.getContentText().slice(0, 300)]);
      var corpo = JSON.parse(r.getContentText());
      if (corpo.errors && corpo.errors.length) {
        var limitato = corpo.errors.some(function (e) { return e.extensions && e.extensions.code === 'THROTTLED'; });
        if (limitato) { Utilities.sleep(2000 * (tentativo + 1)); continue; }
        throw new ErroreShopify('Shopify: errore GraphQL', corpo.errors.map(function (e) { return e.message; }));
      }
      return corpo.data;
    }
    throw new ErroreShopify('Shopify non disponibile dopo più tentativi');
  }

  function erroriUtente(payload) {
    return (payload && payload.userErrors) || [];
  }

  function numerico(gid) {
    var m = /\/(\d+)(?:\?|$)/.exec(String(gid || ''));
    return m ? m[1] : '';
  }

  function urlCliente(gid) {
    return 'https://admin.shopify.com/store/' + negozio().split('.')[0] + '/customers/' + numerico(gid);
  }

  /** Cerca un cliente per email (corrispondenza esatta). Restituisce la struttura per Decisione, o null. */
  function cercaCliente(email) {
    var e = String(email || '').toLowerCase().trim();
    if (!e) return null;
    var dati = graphql(Q_CERCA, { q: 'email:"' + e.replace(/"/g, '') + '"' });
    var trovati = (dati.customers.nodes || []).filter(function (c) {
      return c.defaultEmailAddress && String(c.defaultEmailAddress.emailAddress).toLowerCase() === e;
    });
    if (!trovati.length) return null;
    var c = trovati[0];
    return {
      id: c.id,
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      phone: c.defaultPhoneNumber ? c.defaultPhoneNumber.phoneNumber : '',
      note: c.note || '',
      tags: c.tags || [],
      ordini: Number(c.numberOfOrders) || 0,
      defaultAddressId: c.defaultAddress ? c.defaultAddress.id : null,
      indirizzi: (c.addressesV2.nodes || []).map(function (a) {
        return { id: a.id, company: a.company || '', interno: Indirizzi.daShopify(a), raw: a };
      })
    };
  }

  function telefonoGiaUsato(errori) {
    return errori.some(function (e) {
      return /phone/i.test(String(e.field || '')) || /phone|telefono/i.test(e.message || '');
    });
  }

  function emailGiaUsata(errori) {
    return errori.some(function (e) {
      return /email/i.test(String(e.field || '')) && /taken|already|già/i.test(e.message || '');
    });
  }

  function creaCliente(input, avvisi) {
    var d = graphql(M_CREA_CLIENTE, { input: input }).customerCreate;
    var errori = erroriUtente(d);
    if (errori.length && emailGiaUsata(errori)) {
      // creato nel frattempo (a mano o da un'altra casella): chi chiama rilegge il cliente e completa
      throw new ErroreShopify('Cliente già esistente con questa email', errori.map(function (e) { return e.message; }), 'EMAIL_ESISTENTE');
    }
    if (errori.length && input.phone && telefonoGiaUsato(errori)) {
      avvisi.push('Telefono ' + input.phone + ' già usato da un altro cliente: creato senza telefono');
      var senza = JSON.parse(JSON.stringify(input));
      delete senza.phone;
      d = graphql(M_CREA_CLIENTE, { input: senza }).customerCreate;
      errori = erroriUtente(d);
    }
    if (errori.length) throw new ErroreShopify('Creazione cliente non riuscita', errori.map(function (e) { return e.message; }));
    return d.customer.id;
  }

  function aggiornaCliente(input, avvisi) {
    var d = graphql(M_AGGIORNA_CLIENTE, { input: input }).customerUpdate;
    var errori = erroriUtente(d);
    if (errori.length && input.phone && telefonoGiaUsato(errori)) {
      avvisi.push('Telefono ' + input.phone + ' già usato da un altro cliente: non aggiunto');
      var senza = JSON.parse(JSON.stringify(input));
      delete senza.phone;
      d = graphql(M_AGGIORNA_CLIENTE, { input: senza }).customerUpdate;
      errori = erroriUtente(d);
    }
    if (errori.length) throw new ErroreShopify('Aggiornamento cliente non riuscito', errori.map(function (e) { return e.message; }));
  }

  /** Crea o aggiorna un indirizzo; se Shopify rifiuta la provincia prova le sigle equivalenti (Sardegna). */
  function scriviIndirizzo(clienteId, voce) {
    var sigle = voce.address.provinceCode ? Comuni.equivalenti(voce.address.provinceCode) : [null];
    var ultimi = [];
    for (var i = 0; i < sigle.length; i++) {
      var address = JSON.parse(JSON.stringify(voce.address));
      if (sigle[i]) address.provinceCode = sigle[i];
      var d = voce.azione === 'AGGIORNA'
        ? graphql(M_AGGIORNA_INDIRIZZO, { customerId: clienteId, addressId: voce.addressId, address: address, setAsDefault: !!voce.predefinito }).customerAddressUpdate
        : graphql(M_CREA_INDIRIZZO, { customerId: clienteId, address: address, setAsDefault: !!voce.predefinito }).customerAddressCreate;
      ultimi = erroriUtente(d);
      if (!ultimi.length) return;
      var suProvincia = ultimi.some(function (e) { return /province|provinc/i.test(String(e.field || '') + ' ' + e.message); });
      if (!suProvincia) break;
    }
    throw new ErroreShopify('Indirizzo (' + voce.ruolo + ') non salvato', ultimi.map(function (e) { return e.message; }));
  }

  function eliminaCliente(clienteId) {
    try {
      graphql(M_ELIMINA, { input: { id: clienteId } });
    } catch (e) {
      // se l'eliminazione fallisce l'errore principale viene comunque segnalato
    }
  }

  /**
   * Esegue il piano prodotto da Decisione.valuta(). Per un cliente nuovo la
   * scrittura è "tutto o niente": se un indirizzo non viene accettato il
   * cliente appena creato viene eliminato.
   * Restituisce { clienteId, url, avvisi }.
   */
  function eseguiPiano(piano) {
    var avvisi = [];
    if (piano.esito === 'CREA') {
      var id = creaCliente(piano.cliente, avvisi);
      try {
        piano.indirizzi.forEach(function (voce) { scriviIndirizzo(id, voce); });
      } catch (e) {
        eliminaCliente(id);
        throw e;
      }
      return { clienteId: id, url: urlCliente(id), avvisi: avvisi };
    }
    if (piano.esito === 'AGGIORNA') {
      if (piano.cliente) aggiornaCliente(piano.cliente, avvisi);
      piano.indirizzi.forEach(function (voce) { scriviIndirizzo(piano.clienteId, voce); });
      var t = graphql(M_TAG, { id: piano.clienteId, tags: [piano.tag] }).tagsAdd;
      if (erroriUtente(t).length) avvisi.push('Tag non aggiunto');
      return { clienteId: piano.clienteId, url: urlCliente(piano.clienteId), avvisi: avvisi };
    }
    return { clienteId: piano.clienteId || null, url: piano.clienteId ? urlCliente(piano.clienteId) : '', avvisi: avvisi };
  }

  /** Prova accesso, permessi e lettura dei dati protetti dei clienti. */
  function verifica() {
    var d = graphql(Q_NEGOZIO, {});
    var permessi = ((d.currentAppInstallation && d.currentAppInstallation.accessScopes) || []).map(function (s) { return s.handle; });
    var mancanti = ['read_customers', 'write_customers'].filter(function (p) {
      return permessi.indexOf(p) < 0 && !(p === 'read_customers' && permessi.indexOf('write_customers') >= 0);
    });
    if (mancanti.length) {
      throw new ErroreShopify('Shopify: all\'app mancano i permessi ' + mancanti.join(', '),
        ['Aggiungili in una nuova versione dell\'app nel Dev Dashboard (Versions → Create version → Release) e approvali sul negozio']);
    }
    try {
      graphql(Q_PROVA_CLIENTI, {});
    } catch (e) {
      throw new ErroreShopify('Shopify: l\'app non può leggere i dati dei clienti',
        [].concat(e.dettagli && e.dettagli.length ? e.dettagli : [e.message],
          'Nel Dev Dashboard abilita i dati protetti dei clienti (Name, Email, Phone, Address)'));
    }
    return { name: d.shop.name, myshopifyDomain: d.shop.myshopifyDomain, modo: modoAccesso(), permessi: permessi };
  }

  return {
    cercaCliente: cercaCliente,
    eseguiPiano: eseguiPiano,
    urlCliente: urlCliente,
    verifica: verifica,
    graphql: graphql,
    ErroreShopify: ErroreShopify
  };
})();
