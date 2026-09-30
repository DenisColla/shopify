/**
 * Pipeline: dal messaggio Gmail all'anagrafica su Shopify.
 *
 *  filtro a regole -> riconoscimento conferma (Claude) -> raccolta mail e allegati
 *  -> estrazione (Claude) -> cliente esistente? -> decisione (regole Migelino)
 *  -> scrittura su Shopify (solo LIVE) -> etichetta Gmail -> Registro
 *
 * Gira sulla casella di chi ha attivato il trigger (Denis, Silvia, Marco...).
 * La scrittura su Shopify avviene sotto un blocco condiviso tra le caselle, così
 * due caselle che ricevono la stessa conferma non creano due volte il cliente.
 */

var Pipeline = (function () {
  var ETICHETTA_PER_ESITO = {
    CREA: CONFIG.ETICHETTE.CREATA,
    AGGIORNA: CONFIG.ETICHETTE.AGGIORNATA,
    COMPLETO: CONFIG.ETICHETTE.AGGIORNATA,
    DATI_MANCANTI: CONFIG.ETICHETTE.DATI_MANCANTI,
    DUBBIO: CONFIG.ETICHETTE.DUBBIA,
    DUBBIA: CONFIG.ETICHETTE.DUBBIA,
    ERRORE: CONFIG.ETICHETTE.ERRORE
  };
  var TESTO_ESITO = {
    CREA: 'Anagrafica creata',
    AGGIORNA: 'Anagrafica completata',
    COMPLETO: 'Anagrafica già completa',
    DATI_MANCANTI: 'Dati mancanti: nulla creato',
    DUBBIO: 'Paziente non chiaro: nulla creato',
    DUBBIA: 'Conferma dubbia',
    NON_CONFERMA: 'Non è una conferma',
    ERRORE: 'Errore'
  };

  function scadenza(inizio) {
    return Date.now() - inizio > CONFIG.MAX_MS_ESECUZIONE;
  }

  /** Riduce il piano a ciò che serve nel Registro in modalità ombra. */
  function proposta(piano) {
    return { esito: piano.esito, cliente: piano.cliente || null, indirizzi: (piano.indirizzi || []).map(function (i) {
      return { ruolo: i.ruolo, azione: i.azione, predefinito: i.predefinito, address: i.address };
    }) };
  }

  /**
   * Cerca il cliente, decide ed eventualmente scrive su Shopify sotto un blocco
   * condiviso tra tutte le caselle. Se nel frattempo il cliente è stato creato
   * (a mano o da un'altra casella) rilegge e completa invece di duplicare.
   */
  function decidiEScrivi(msg, estrazione, tipo, modalita, avvisiRaccolta) {
    var lock = LockService.getScriptLock();
    lock.waitLock(60000);
    try {
      for (var tentativo = 0; tentativo < 2; tentativo++) {
        var esistente = Shopify.cercaCliente(msg.mittente);
        var piano = Decisione.valuta({
          estrazione: estrazione,
          email: msg.mittente,
          clienteEsistente: esistente,
          soglia: Impostazioni.sogliaCampo(),
          tipoConferma: tipo,
          dataConferma: msg.dataIso
        });
        piano.avvisi = piano.avvisi.concat(avvisiRaccolta);
        var risultato = { clienteId: esistente ? esistente.id : null, url: esistente ? Shopify.urlCliente(esistente.id) : '', avvisi: [] };
        if (modalita === 'LIVE' && (piano.esito === 'CREA' || piano.esito === 'AGGIORNA')) {
          try {
            risultato = Shopify.eseguiPiano(piano);
          } catch (e) {
            if (e && e.codice === 'EMAIL_ESISTENTE' && tentativo === 0) continue;
            throw e;
          }
          piano.avvisi = piano.avvisi.concat(risultato.avvisi);
        }
        return { piano: piano, risultato: risultato };
      }
      throw new Error('Cliente creato nel frattempo ma non ritrovato su Shopify');
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Elabora un messaggio. opzioni:
   *  - forzato: true se richiesto con l'etichetta "▶ Crea" (salta riconoscimento)
   *  - modalita: 'LIVE' | 'OMBRA'
   * Restituisce { esito, usatoClaude }.
   */
  function elaboraMessaggio(msg, opzioni) {
    var modalita = opzioni.modalita;
    var casella = Posta.casella();
    var voce = {
      modalita: modalita, casella: casella, email: msg.mittente, paziente: msg.nome, linkMail: Posta.link(msg.threadId)
    };
    var statoPrecedente = Stato.statoPaziente(msg.mittente);
    var completamento = !!(statoPrecedente && statoPrecedente.esito === 'DATI_MANCANTI');
    var tipo = opzioni.forzato ? 'MANUALE' : completamento ? statoPrecedente.tipo : '';

    try {
      if (!opzioni.forzato && !completamento) {
        var filtro = Prefiltro.valuta(msg, { haRelazione: !!statoPrecedente || Posta.haRelazione(msg.mittente, msg) });
        if (!filtro.passa) return { esito: 'IGNORATO', usatoClaude: false };

        var riconoscimento = Classificatore.classifica(Posta.conversazione(msg.threadId, msg.id));
        voce.tipo = riconoscimento.tipo;
        voce.probabilita = riconoscimento.probabilita;
        voce.frase = riconoscimento.frase_chiave;
        if (riconoscimento.categoria !== 'CONFERMA') {
          voce.esito = TESTO_ESITO[riconoscimento.categoria];
          voce.dettagli = riconoscimento.motivazione;
          if (riconoscimento.categoria === 'DUBBIA') {
            if (modalita === 'LIVE') Posta.impostaEsito(msg.threadId, CONFIG.ETICHETTE.DUBBIA);
            Stato.salvaStatoPaziente(msg.mittente, { esito: 'DUBBIA', tipo: riconoscimento.tipo, threadId: msg.threadId, casella: casella });
          }
          Registro.scrivi(voce);
          return { esito: riconoscimento.categoria, usatoClaude: true };
        }
        tipo = riconoscimento.tipo;
      } else {
        voce.tipo = tipo;
        voce.frase = opzioni.forzato ? 'Richiesta manuale (etichetta ▶ Crea)' : 'Completamento dopo dati mancanti';
      }

      // Raccolta ed estrazione
      var raccolta = Posta.dossier(msg.mittente, opzioni.finoAMs || null);
      var estrazione = Estrattore.estrai({
        mittente: { nome: msg.nome, email: msg.mittente },
        tipoConferma: tipo,
        dataConferma: msg.dataIso,
        allegati: raccolta.allegati,
        nonLeggibili: raccolta.nonLeggibili,
        messaggi: raccolta.messaggi
      });
      // Dati letti in precedenza (anche da un'altra casella) quando mancava qualcosa
      if (completamento && statoPrecedente.estrazione) estrazione = Estrattore.unisci(statoPrecedente.estrazione, estrazione);
      var nomeCompleto = [estrazione.nome && estrazione.nome.valore, estrazione.cognome && estrazione.cognome.valore].filter(Boolean).join(' ');
      if (nomeCompleto) voce.paziente = Testo.maiuscoleNome(nomeCompleto);

      var avvisiRaccolta = raccolta.nonLeggibili.length ? ['Allegati non leggibili: ' + raccolta.nonLeggibili.join(', ')] : [];
      var scrittura = decidiEScrivi(msg, estrazione, tipo, modalita, avvisiRaccolta);
      var piano = scrittura.piano;
      var risultato = scrittura.risultato;

      voce.esito = TESTO_ESITO[piano.esito] + (modalita === 'OMBRA' && (piano.esito === 'CREA' || piano.esito === 'AGGIORNA') ? ' (simulata)' : '');
      voce.linkCliente = risultato.url;
      voce.dettagli = Decisione.riepilogo(piano);
      voce.proposta = proposta(piano);
      if (modalita === 'LIVE') {
        Posta.impostaEsito(msg.threadId, ETICHETTA_PER_ESITO[piano.esito]);
        // la conferma poteva essere in un'altra conversazione della stessa casella: aggiorna anche quella
        var stessaCasella = !statoPrecedente || !statoPrecedente.casella || statoPrecedente.casella === casella;
        if (completamento && stessaCasella && statoPrecedente.threadId && statoPrecedente.threadId !== msg.threadId) {
          try { Posta.impostaEsito(statoPrecedente.threadId, ETICHETTA_PER_ESITO[piano.esito]); } catch (x) { /* conversazione non più disponibile */ }
        }
      }
      var nuovoStato = { esito: piano.esito, tipo: tipo, threadId: msg.threadId, casella: casella };
      if (piano.esito === 'DATI_MANCANTI') nuovoStato.estrazione = Estrattore.compatta(estrazione); // per completare dopo
      Stato.salvaStatoPaziente(msg.mittente, nuovoStato);
      Registro.scrivi(voce);
      return { esito: piano.esito, usatoClaude: true };
    } catch (e) {
      voce.esito = TESTO_ESITO.ERRORE;
      voce.errore = String(e && e.message ? e.message : e) + (e && e.dettagli ? ' — ' + [].concat(e.dettagli).join('; ') : '');
      if (modalita === 'LIVE') {
        try { Posta.impostaEsito(msg.threadId, CONFIG.ETICHETTE.ERRORE); } catch (x) { /* ignora */ }
      }
      Registro.scrivi(voce);
      return { esito: 'ERRORE', usatoClaude: true };
    }
  }

  /** Conversazioni con l'etichetta "▶ Crea" messa a mano dall'ufficio. */
  function elaboraManuali(inizio, modalita) {
    var threads = Posta.conversazioniConEtichetta(CONFIG.ETICHETTE.CREA_MANUALE, 5);
    threads.forEach(function (t) {
      if (scadenza(inizio)) return;
      var esterni = t.getMessages().filter(function (m) { return !Prefiltro.interno(Testo.estraiEmail(m.getFrom())); });
      Posta.togliEtichetta(t.getId(), CONFIG.ETICHETTE.CREA_MANUALE);
      if (!esterni.length) return;
      var ultimo = esterni[esterni.length - 1];
      Stato.segnaElaborato(ultimo.getId()); // evita che venga rielaborato anche come messaggio nuovo
      elaboraMessaggio(Posta.dto(ultimo), { forzato: true, modalita: modalita });
    });
  }

  /**
   * Conversazioni di questa casella ferme su "Dati mancanti" il cui paziente è stato
   * poi completato (anche da un'altra casella): aggiorna l'etichetta.
   */
  function riallineaEtichette(modalita) {
    if (modalita !== 'LIVE') return;
    Posta.conversazioniConEtichetta(CONFIG.ETICHETTE.DATI_MANCANTI, 20).forEach(function (t) {
      var esterni = t.getMessages().filter(function (m) { return !Prefiltro.interno(Testo.estraiEmail(m.getFrom())); });
      if (!esterni.length) return;
      var stato = Stato.statoPaziente(Testo.estraiEmail(esterni[esterni.length - 1].getFrom()));
      if (stato && (stato.esito === 'CREA' || stato.esito === 'AGGIORNA' || stato.esito === 'COMPLETO')) {
        Posta.impostaEsito(t.getId(), ETICHETTA_PER_ESITO[stato.esito]);
      }
    });
  }

  /** Esecuzione periodica (trigger ogni 10 minuti). */
  function esegui() {
    var inizio = Date.now();
    var lock = LockService.getUserLock(); // un giro alla volta per casella; le caselle non si bloccano a vicenda
    if (!lock.tryLock(5000)) return;
    try {
      var modalita = Impostazioni.modalita();
      Posta.creaEtichette();
      elaboraManuali(inizio, modalita);
      riallineaEtichette(modalita);

      var messaggi = Posta.nuoviMessaggi(Stato.ultimoControllo());
      var conClaude = 0;
      var ultimo = null;
      var completato = true;
      for (var i = 0; i < messaggi.length; i++) {
        if (scadenza(inizio) || conClaude >= CONFIG.MAX_MESSAGGI_PER_ESECUZIONE) { completato = false; break; }
        var m = messaggi[i];
        if (!Stato.giaElaborato(m.getId())) {
          // segnato PRIMA: un errore imprevisto non deve far ripetere (e pagare) la stessa elaborazione a ogni giro
          Stato.segnaElaborato(m.getId());
          try {
            var r = elaboraMessaggio(Posta.dto(m), { forzato: false, modalita: modalita });
            if (r.usatoClaude) conClaude++;
          } catch (e) {
            Logger.log('Errore imprevisto sul messaggio ' + m.getId() + ': ' + (e && e.message ? e.message : e));
            conClaude++;
          }
        }
        ultimo = m.getDate().getTime();
      }
      if (completato) Stato.salvaUltimoControllo(inizio);
      else if (ultimo) Stato.salvaUltimoControllo(ultimo);
      Stato.battito(Posta.casella(), messaggi.length + ' messaggi nuovi, ' + conClaude + ' analizzati');
      Stato.pulisci();
    } finally {
      lock.releaseLock();
    }
  }

  return { esegui: esegui, elaboraMessaggio: elaboraMessaggio };
})();
