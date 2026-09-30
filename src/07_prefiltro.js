/**
 * Filtro a regole (gratuito, prima di chiamare Claude). Deve essere largo: il suo
 * compito è solo scartare ciò che sicuramente non è una conferma (mail interne,
 * automatiche, newsletter, persone con cui Migelino non ha mai parlato).
 */

var Prefiltro = (function () {
  var PAROLE_CHIAVE = [
    /conferm/, /accett/, /proced/, /firmat/, /allego/, /allegat/, /document/,
    /carta d.?identit/, /identita/, /\bci\b/, /tessera/, /codice fiscale/, /\bc\.?f\.?\b/,
    /indirizz/, /spedi/, /spediz/, /ordin/, /acquist/, /\bprova\b/, /provar/, /preventiv/,
    /bonifico/, /fattur/, /residen/, /\bok\b/, /va bene/, /d.?accordo/, /\bsi\b/
  ];
  var TIPI_DOCUMENTO = /^(application\/pdf|image\/(jpeg|jpg|png|gif|webp|heic|heif))$/i;

  function interno(email) {
    var dominio = String(email || '').split('@')[1] || '';
    return CONFIG.DOMINI_INTERNI.indexOf(dominio.toLowerCase()) >= 0;
  }

  function automatico(email) {
    return CONFIG.MITTENTI_AUTOMATICI.some(function (re) { return re.test(email); });
  }

  function haParoleChiave(testo) {
    var t = Testo.rimuoviAccenti(testo).toLowerCase();
    return PAROLE_CHIAVE.some(function (re) { return re.test(t); });
  }

  function haAllegatiDocumento(allegati) {
    return (allegati || []).some(function (a) {
      return TIPI_DOCUMENTO.test(a.mimeType) && (a.inLinea ? a.dimensione >= CONFIG.MIN_BYTE_IMMAGINE_IN_LINEA : true);
    });
  }

  /**
   * msg: { mittente, oggetto, testoNuovo, allegati }
   * contesto: { haRelazione } = Migelino ha già scritto a questo mittente
   * Restituisce { passa, motivo }.
   */
  function valuta(msg, contesto) {
    if (!msg.mittente) return { passa: false, motivo: 'mittente sconosciuto' };
    if (interno(msg.mittente)) return { passa: false, motivo: 'mittente interno' };
    if (automatico(msg.mittente)) return { passa: false, motivo: 'mittente automatico' };
    if (!contesto.haRelazione) return { passa: false, motivo: 'nessuna conversazione precedente con Migelino' };
    var testo = (msg.oggetto || '') + '\n' + (msg.testoNuovo || '');
    if (haParoleChiave(testo) || haAllegatiDocumento(msg.allegati)) return { passa: true, motivo: '' };
    return { passa: false, motivo: 'nessuna parola chiave né documento allegato' };
  }

  return {
    valuta: valuta,
    interno: interno,
    automatico: automatico,
    haParoleChiave: haParoleChiave,
    haAllegatiDocumento: haAllegatiDocumento
  };
})();
