/**
 * Client minimo per l'API Messages di Claude (HTTP diretto: Apps Script non ha
 * un SDK ufficiale). Risposte sempre in JSON vincolato a uno schema
 * (output_config.format), con fallback automatico lato server se il modello
 * rifiuta la richiesta.
 */

var Claude = (function () {
  function ErroreClaude(messaggio, codice, dettagli) {
    this.name = 'ErroreClaude';
    this.message = messaggio;
    this.codice = codice || 0;
    this.dettagli = dettagli || '';
  }
  ErroreClaude.prototype = Object.create(Error.prototype);

  function testo(t) {
    return { type: 'text', text: String(t) };
  }

  function pdf(base64) {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }

  function immagine(base64, mimeType) {
    var tipo = String(mimeType || '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : String(mimeType).toLowerCase();
    return { type: 'image', source: { type: 'base64', media_type: tipo, data: base64 } };
  }

  function corpo(opz, conFallback) {
    var richiesta = {
      model: Impostazioni.obbligatoria(CHIAVI.CLAUDE_MODEL),
      max_tokens: opz.maxToken,
      system: [{ type: 'text', text: opz.sistema, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opz.contenuti }],
      output_config: {
        effort: opz.sforzo,
        format: { type: 'json_schema', schema: opz.schema }
      }
    };
    if (conFallback) richiesta.fallbacks = 'default';
    return richiesta;
  }

  function intestazioni(conFallback) {
    var h = {
      'x-api-key': Impostazioni.obbligatoria(CHIAVI.ANTHROPIC_API_KEY),
      'anthropic-version': CONFIG.CLAUDE_VERSIONE_API
    };
    if (conFallback) h['anthropic-beta'] = CONFIG.CLAUDE_BETA_FALLBACK;
    return h;
  }

  /** Legge la risposta: controlla il motivo di arresto e restituisce il JSON prodotto. */
  function interpreta(risposta) {
    if (risposta.stop_reason === 'refusal') {
      throw new ErroreClaude('Il modello ha rifiutato la richiesta', 200, JSON.stringify(risposta.stop_details || {}));
    }
    if (risposta.stop_reason === 'max_tokens') {
      throw new ErroreClaude('Risposta troncata (max_tokens)', 200, '');
    }
    var blocchi = (risposta.content || []).filter(function (b) { return b.type === 'text'; });
    var json = blocchi.map(function (b) { return b.text; }).join('');
    try {
      return { dati: JSON.parse(json), modello: risposta.model, uso: risposta.usage || {} };
    } catch (e) {
      throw new ErroreClaude('Risposta non in formato JSON', 200, json.slice(0, 300));
    }
  }

  /**
   * opz = { sistema, contenuti, schema, sforzo, maxToken }
   * Restituisce { dati, modello, uso }.
   */
  function chiama(opz) {
    var conFallback = true;
    var ultimoErrore = null;
    var attese = [2000, 6000, 15000];
    var sforzo = opz.sforzo;
    for (var tentativo = 0; tentativo < CONFIG.CLAUDE_TENTATIVI; tentativo++) {
      var risposta;
      try {
        risposta = UrlFetchApp.fetch(CONFIG.CLAUDE_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: intestazioni(conFallback),
          payload: JSON.stringify(corpo({ sistema: opz.sistema, contenuti: opz.contenuti, schema: opz.schema, sforzo: sforzo, maxToken: opz.maxToken }, conFallback)),
          muteHttpExceptions: true
        });
      } catch (e) {
        // Timeout o rete: riprova con uno sforzo più basso (risposta più rapida).
        ultimoErrore = new ErroreClaude('Chiamata a Claude non riuscita: ' + (e && e.message ? e.message : e), 0, '');
        if (sforzo !== 'low') sforzo = 'low';
        Utilities.sleep(attese[Math.min(tentativo, attese.length - 1)]);
        continue;
      }
      var codice = risposta.getResponseCode();
      var testoRisposta = risposta.getContentText();
      if (codice === 200) return interpreta(JSON.parse(testoRisposta));
      ultimoErrore = new ErroreClaude('Errore API Claude HTTP ' + codice, codice, testoRisposta.slice(0, 500));
      if (codice === 400 && conFallback && /fallback/i.test(testoRisposta)) {
        conFallback = false;   // account o piattaforma senza fallback: riprova subito senza
        tentativo--;
        continue;
      }
      if (codice === 429 || codice === 408 || codice === 529 || codice >= 500) {
        Utilities.sleep(attese[Math.min(tentativo, attese.length - 1)]);
        continue;
      }
      throw ultimoErrore;
    }
    throw ultimoErrore;
  }

  return {
    chiama: chiama,
    testo: testo,
    pdf: pdf,
    immagine: immagine,
    ErroreClaude: ErroreClaude
  };
})();
