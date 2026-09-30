/**
 * Decisione: dal risultato dell'estrazione al piano di scrittura su Shopify.
 * È il punto in cui si applicano le regole di Migelino:
 *
 *  1. OBBLIGATORI: nome, cognome, indirizzo di RESIDENZA e indirizzo di SPEDIZIONE.
 *     Se ne manca anche uno solo non si crea nulla (esito DATI_MANCANTI).
 *  2. Un campo si scrive solo se supera la soglia di confidenza e i controlli
 *     automatici; altrimenti resta vuoto e viene segnalato.
 *  3. Il codice fiscale va SOLO nel campo "Azienda" dell'indirizzo; se manca o
 *     non supera i controlli resta vuoto (lo inserisce l'ufficio).
 *  4. Convenzione dell'ufficio: indirizzo predefinito = spedizione; se la residenza è
 *     diversa diventa un secondo indirizzo con il CF in Azienda (fatturazione).
 *  5. Su un cliente esistente si completano solo i campi vuoti: mai sovrascrivere.
 */

var Decisione = (function () {
  var FONTI_RESIDENZA = ['DOCUMENTO_IDENTITA', 'DICHIARAZIONE_EMAIL', 'PREVENTIVO_FIRMATO'];
  var FONTI_SPEDIZIONE = ['DICHIARAZIONE_EMAIL', 'PREVENTIVO_FIRMATO'];

  function pct(x) {
    return Math.round((Number(x) || 0) * 100) + '%';
  }

  function presente(campo) {
    return !!(campo && String(campo.valore || '').trim());
  }

  /** Valuta un campo semplice: { ok, valore, motivo }. */
  function leggiCampo(campo, soglia) {
    if (!presente(campo)) return { ok: false, valore: '', motivo: 'non trovato' };
    if ((Number(campo.confidenza) || 0) < soglia) {
      return { ok: false, valore: String(campo.valore).trim(), motivo: 'lettura incerta (' + pct(campo.confidenza) + ')' };
    }
    return { ok: true, valore: String(campo.valore).trim(), motivo: '' };
  }

  function dataValida(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var anno = new Date().getUTCFullYear();
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] &&
      +m[1] >= 1900 && +m[1] <= anno;
  }

  function nomeValido(s) {
    return /[A-Za-zÀ-ÿ]{2,}/.test(s || '');
  }

  /** Indirizzo dall'estrazione: { ok, indirizzo, motivo, avvisi }. */
  function leggiIndirizzo(x, fontiAmmesse, soglia, extra) {
    var vuoto = !x || !(String(x.via || '') + String(x.cap || '') + String(x.comune || '')).trim();
    if (vuoto) return { ok: false, motivo: 'non indicato', avvisi: [] };
    if (fontiAmmesse.indexOf(x.fonte) < 0) {
      return { ok: false, motivo: 'fonte non valida (' + x.fonte + ')', avvisi: [] };
    }
    if ((Number(x.confidenza) || 0) < soglia) {
      return { ok: false, motivo: 'lettura incerta (' + pct(x.confidenza) + ')', avvisi: [] };
    }
    var ind = Indirizzi.normalizza({
      via: x.via, civico: x.civico, dettagli: x.dettagli, cap: x.cap, comune: x.comune,
      provincia: x.provincia, paese: x.paese,
      presso: extra && extra.presso, destinatarioNome: extra && extra.destinatarioNome,
      destinatarioCognome: extra && extra.destinatarioCognome, telefono: extra && extra.telefono
    });
    var v = Indirizzi.valida(ind);
    if (!v.ok) return { ok: false, motivo: v.problemi.join(', '), avvisi: v.avvisi };
    return { ok: true, indirizzo: ind, motivo: '', avvisi: v.avvisi };
  }

  function sembraCf(testo) {
    return CodiceFiscale.formatoValido(testo);
  }

  function dataItaliana(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  /** Analizza estrazione + cliente esistente e restituisce i dati accettati. */
  function analizza(e, soglia) {
    var r = { mancanti: [], scartati: [], avvisi: [] };

    var nome = leggiCampo(e.nome, soglia);
    var cognome = leggiCampo(e.cognome, soglia);
    r.nome = nome.ok && nomeValido(nome.valore) ? Testo.maiuscoleNome(nome.valore) : '';
    r.cognome = cognome.ok && nomeValido(cognome.valore) ? Testo.maiuscoleNome(cognome.valore) : '';
    if (!r.nome) r.scartati.push({ campo: 'nome', motivo: nome.motivo || 'non valido' });
    if (!r.cognome) r.scartati.push({ campo: 'cognome', motivo: cognome.motivo || 'non valido' });

    var sesso = leggiCampo(e.sesso, soglia);
    r.sesso = sesso.ok && /^[MF]$/i.test(sesso.valore) ? sesso.valore.toUpperCase() : '';
    var data = leggiCampo(e.data_nascita, soglia);
    r.dataNascita = data.ok && dataValida(data.valore) ? data.valore : '';

    // Codice fiscale: valido, coerente con il documento, mai calcolato.
    var cf = leggiCampo(e.codice_fiscale, soglia);
    r.cf = '';
    if (!presente(e.codice_fiscale)) {
      r.scartati.push({ campo: 'codice fiscale', motivo: 'non presente in documenti o mail' });
    } else if (!cf.ok) {
      r.scartati.push({ campo: 'codice fiscale', motivo: cf.motivo });
    } else {
      var valore = CodiceFiscale.normalizza(cf.valore);
      var luogo = presente(e.luogo_nascita) ? Comuni.trova(e.luogo_nascita.valore) : null;
      var verifica = CodiceFiscale.verificaCoerenza(valore, {
        cognome: r.cognome, nome: r.nome, dataNascita: r.dataNascita, sesso: r.sesso,
        codiceCatastale: luogo ? luogo.catastale : null
      });
      if (!verifica.valido) {
        r.scartati.push({ campo: 'codice fiscale', motivo: 'carattere di controllo errato' });
      } else if (!verifica.coerente) {
        r.scartati.push({ campo: 'codice fiscale', motivo: 'non coerente con nome, cognome e data di nascita del documento' });
      } else {
        r.cf = valore;
        if (verifica.luogo === false) r.avvisi.push('Luogo di nascita del CF diverso da quello letto (possibile comune soppresso)');
      }
    }

    var tel = leggiCampo(e.telefono, soglia);
    r.telefono = tel.ok ? Telefono.normalizza(tel.valore) : '';
    if (!r.telefono) r.scartati.push({ campo: 'telefono', motivo: tel.ok ? 'numero non valido' : tel.motivo });

    // Residenza
    var res = leggiIndirizzo(e.residenza, FONTI_RESIDENZA, soglia, { telefono: r.telefono });
    r.residenza = res.ok ? res.indirizzo : null;
    if (!res.ok) r.mancanti.push('indirizzo di residenza: ' + res.motivo);
    r.avvisi = r.avvisi.concat(res.avvisi || []);

    // Spedizione
    var s = e.spedizione || {};
    r.spedizione = null;
    r.spedizioneUgualeResidenza = false;
    if (s.stessa_della_residenza === 'SI') {
      if (r.residenza) {
        r.spedizione = r.residenza;
        r.spedizioneUgualeResidenza = true;
      } else {
        r.mancanti.push('indirizzo di spedizione: coincide con la residenza, che però manca');
      }
    } else if (s.stessa_della_residenza === 'NO') {
      var telDest = Telefono.normalizza(s.telefono_destinatario);
      var sped = leggiIndirizzo(s.indirizzo, FONTI_SPEDIZIONE, soglia, {
        presso: s.presso, destinatarioNome: s.destinatario_nome, destinatarioCognome: s.destinatario_cognome,
        telefono: telDest || r.telefono
      });
      if (sped.ok) {
        r.spedizione = sped.indirizzo;
        r.avvisi = r.avvisi.concat(sped.avvisi || []);
        var stessaPersona = !sped.indirizzo.destinatarioNome && !sped.indirizzo.destinatarioCognome;
        if (r.residenza && stessaPersona && !sped.indirizzo.presso && Indirizzi.uguali(sped.indirizzo, r.residenza)) {
          r.spedizione = r.residenza;
          r.spedizioneUgualeResidenza = true;
        }
      } else {
        r.mancanti.push('indirizzo di spedizione: ' + sped.motivo);
      }
    } else {
      r.mancanti.push('indirizzo di spedizione: non indicato dal paziente');
    }
    return r;
  }

  /** Persona sull'indirizzo di spedizione e valore del campo Azienda (convenzione dell'ufficio). */
  function datiSpedizione(a) {
    var sp = a.spedizione;
    var altraPersona = !!(sp.destinatarioNome || sp.destinatarioCognome);
    var azienda = sp.presso ? sp.presso : altraPersona ? '' : a.cf;
    return {
      nome: altraPersona ? sp.destinatarioNome : a.nome,
      cognome: altraPersona ? sp.destinatarioCognome : a.cognome,
      azienda: azienda,
      telefono: sp.telefono || a.telefono
    };
  }

  function nota(tipo, dataConferma, azione, daCompletare) {
    var tipoTesto = tipo === 'PROVA' ? 'conferma prova' : tipo === 'MANUALE' ? 'richiesta manuale' : 'conferma acquisto';
    var testo = 'Anagrafica ' + azione + ' automaticamente dalla mail del ' + dataItaliana(dataConferma) + ' (' + tipoTesto + ').';
    if (daCompletare.length) testo += ' Da completare: ' + daCompletare.join(', ') + '.';
    return testo;
  }

  function daCompletare(a) {
    var lista = [];
    if (!a.cf) lista.push('codice fiscale');
    if (!a.telefono) lista.push('telefono');
    return lista;
  }

  /** Piano per un cliente NUOVO. */
  function pianoNuovo(a, input) {
    var piano = {
      esito: 'CREA', clienteId: null, indirizzi: [], tag: CONFIG.TAG_CLIENTE,
      campiScritti: ['nome', 'cognome', 'email', 'residenza', 'spedizione']
    };
    if (a.cf) piano.campiScritti.push('codice fiscale');
    if (a.telefono) piano.campiScritti.push('telefono');
    piano.cliente = {
      firstName: a.nome,
      lastName: a.cognome,
      email: input.email,
      note: nota(input.tipoConferma, input.dataConferma, 'creata', daCompletare(a)),
      tags: [CONFIG.TAG_CLIENTE]
    };
    if (a.telefono) piano.cliente.phone = a.telefono;
    var paziente = { nome: a.nome, cognome: a.cognome, azienda: a.cf, telefono: a.telefono };
    if (a.spedizioneUgualeResidenza) {
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'UNICO', predefinito: true, address: Indirizzi.perShopify(a.residenza, paziente) });
    } else {
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'SPEDIZIONE', predefinito: true, address: Indirizzi.perShopify(a.spedizione, datiSpedizione(a)) });
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'RESIDENZA', predefinito: false, address: Indirizzi.perShopify(a.residenza, paziente) });
    }
    return piano;
  }

  /** Piano per un cliente ESISTENTE: completa solo ciò che manca. */
  function pianoEsistente(a, cliente, input, avvisi) {
    var piano = { esito: 'AGGIORNA', clienteId: cliente.id, indirizzi: [], tag: CONFIG.TAG_CLIENTE, campiScritti: [] };
    var aggiornamento = {};
    if (!cliente.firstName && a.nome) { aggiornamento.firstName = a.nome; piano.campiScritti.push('nome'); }
    if (!cliente.lastName && a.cognome) { aggiornamento.lastName = a.cognome; piano.campiScritti.push('cognome'); }
    if (!cliente.phone && a.telefono) { aggiornamento.phone = a.telefono; piano.campiScritti.push('telefono'); }
    if (cliente.firstName && a.nome && Testo.chiave(cliente.firstName) !== Testo.chiave(a.nome)) {
      avvisi.push('Nome in Shopify "' + cliente.firstName + '" diverso dal documento "' + a.nome + '" (non modificato)');
    }
    if (cliente.lastName && a.cognome && Testo.chiave(cliente.lastName) !== Testo.chiave(a.cognome)) {
      avvisi.push('Cognome in Shopify "' + cliente.lastName + '" diverso dal documento "' + a.cognome + '" (non modificato)');
    }

    var paziente = { nome: a.nome || cliente.firstName, cognome: a.cognome || cliente.lastName, azienda: a.cf, telefono: a.telefono };
    var esistenti = cliente.indirizzi || [];

    function trovaUguale(ind) {
      for (var i = 0; i < esistenti.length; i++) if (Indirizzi.uguali(esistenti[i].interno, ind)) return esistenti[i];
      return null;
    }

    if (a.residenza) {
      var gia = trovaUguale(a.residenza);
      var predefinitaResidenza = a.spedizioneUgualeResidenza;
      if (!gia) {
        piano.indirizzi.push({ azione: 'CREA', ruolo: a.spedizioneUgualeResidenza ? 'UNICO' : 'RESIDENZA', predefinito: predefinitaResidenza,
          address: Indirizzi.perShopify(a.residenza, paziente) });
        piano.campiScritti.push('residenza');
      } else {
        var serveCf = a.cf && !gia.company;
        var serveDefault = predefinitaResidenza && cliente.defaultAddressId !== gia.id;
        if (serveCf || serveDefault) {
          var completo = Indirizzi.daShopifyAInput(gia.raw);
          if (serveCf) completo.company = a.cf;
          piano.indirizzi.push({ azione: 'AGGIORNA', addressId: gia.id, ruolo: 'RESIDENZA', predefinito: serveDefault, address: completo });
          if (serveCf) piano.campiScritti.push('codice fiscale');
        } else if (a.cf && gia.company && CodiceFiscale.normalizza(gia.company) !== a.cf && sembraCf(gia.company)) {
          avvisi.push('CF in Shopify diverso da quello letto (non modificato)');
        }
      }
    }

    if (a.spedizione && !a.spedizioneUgualeResidenza) {
      var giaSped = trovaUguale(a.spedizione);
      if (!giaSped) {
        piano.indirizzi.push({ azione: 'CREA', ruolo: 'SPEDIZIONE', predefinito: true, address: Indirizzi.perShopify(a.spedizione, datiSpedizione(a)) });
        piano.campiScritti.push('spedizione');
      } else if (cliente.defaultAddressId !== giaSped.id) {
        piano.indirizzi.push({ azione: 'AGGIORNA', addressId: giaSped.id, ruolo: 'SPEDIZIONE', predefinito: true,
          address: Indirizzi.daShopifyAInput(giaSped.raw) });
      }
    }

    if (!Object.keys(aggiornamento).length && !piano.indirizzi.length) {
      piano.esito = 'COMPLETO';
      return piano;
    }
    // La nota si aggiunge in coda a quella esistente, senza cancellarla.
    var riga = nota(input.tipoConferma, input.dataConferma, 'completata', daCompletare(a));
    aggiornamento.id = cliente.id;
    aggiornamento.note = cliente.note ? cliente.note + '\n' + riga : riga;
    piano.cliente = aggiornamento;
    return piano;
  }

  /**
   * input = { estrazione, email, clienteEsistente (o null), soglia, tipoConferma, dataConferma }
   * clienteEsistente = { id, firstName, lastName, phone, note, tags, defaultAddressId,
   *                      indirizzi: [{ id, company, interno (indirizzo normalizzato) }] }
   */
  function valuta(input) {
    var e = input.estrazione;
    var a = analizza(e, input.soglia);
    var esistente = input.clienteEsistente;
    var avvisi = a.avvisi.slice();
    if (e.note) avvisi.push('Nota di lettura: ' + e.note);

    var base = { mancanti: a.mancanti.slice(), scartati: a.scartati, avvisi: avvisi, dati: a };

    if (e.paziente_identificato !== 'SI') {
      base.esito = 'DUBBIO';
      base.mancanti.unshift('non è chiaro chi sia il paziente' + (e.piu_persone ? ' (documenti di più persone)' : ''));
      return base;
    }

    // Regola 1: senza nome, cognome, residenza e spedizione non si crea nulla.
    var mancaNome = !a.nome && !(esistente && esistente.firstName);
    var mancaCognome = !a.cognome && !(esistente && esistente.lastName);
    var residenzaEsistente = esistente && (esistente.indirizzi || []).some(function (i) { return sembraCf(i.company); });
    var spedizioneEsistente = esistente && esistente.defaultAddressId;
    if (mancaNome) base.mancanti.unshift('nome');
    if (mancaCognome) base.mancanti.unshift('cognome');

    var haResidenza = !!a.residenza || !!residenzaEsistente;
    var haSpedizione = !!a.spedizione || !!spedizioneEsistente;
    if (mancaNome || mancaCognome || !haResidenza || !haSpedizione) {
      base.esito = 'DATI_MANCANTI';
      if (esistente) {
        // Per un cliente esistente i dati possono già essere in Shopify: tieni solo ciò che manca davvero.
        base.mancanti = base.mancanti.filter(function (m) {
          if (/^indirizzo di residenza/.test(m)) return !haResidenza;
          if (/^indirizzo di spedizione/.test(m)) return !haSpedizione;
          return true;
        });
      }
      return base;
    }

    var piano = esistente ? pianoEsistente(a, esistente, input, avvisi) : pianoNuovo(a, input);
    piano.mancanti = [];
    piano.scartati = a.scartati;
    piano.avvisi = avvisi;
    piano.dati = a;
    return piano;
  }

  /** Riassunto leggibile per il Registro. */
  function riepilogo(piano) {
    var parti = [];
    if (piano.campiScritti && piano.campiScritti.length) parti.push('Scritti: ' + piano.campiScritti.join(', '));
    if (piano.mancanti && piano.mancanti.length) parti.push('Mancanti: ' + piano.mancanti.join('; '));
    var scartati = piano.scartati || [];
    if (scartati.length) parti.push('Non scritti: ' + scartati.map(function (s) { return s.campo + ' (' + s.motivo + ')'; }).join('; '));
    if (piano.avvisi && piano.avvisi.length) parti.push('Avvisi: ' + piano.avvisi.join('; '));
    return parti.join(' | ');
  }

  return { valuta: valuta, analizza: analizza, riepilogo: riepilogo, dataItaliana: dataItaliana };
})();
