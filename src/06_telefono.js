/**
 * Numeri di telefono: normalizzazione nel formato internazionale E.164 (+39...).
 */

var Telefono = (function () {
  /** Restituisce il numero in formato E.164 oppure '' se non è un numero plausibile. */
  function normalizza(numero, paese) {
    var grezzo = String(numero || '').trim();
    if (!grezzo) return '';
    var n = grezzo.replace(/[\s.\-()/]/g, '');
    if (/^00\d/.test(n)) n = '+' + n.slice(2);
    if (!/^\+?\d+$/.test(n)) return '';
    var italia = !paese || String(paese).toUpperCase() === 'IT';
    if (n.charAt(0) !== '+') {
      if (!italia) return '';
      if (/^39(3\d{8,9}|0\d{5,10})$/.test(n)) n = '+' + n;
      else if (/^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n)) n = '+39' + n;
      else return '';
    }
    if (/^\+39/.test(n)) return /^\+39(3\d{8,9}|0\d{5,10})$/.test(n) ? n : '';
    return /^\+[1-9]\d{7,14}$/.test(n) ? n : '';
  }

  function cellulare(numeroE164) {
    return /^\+393\d{8,9}$/.test(String(numeroE164 || ''));
  }

  return { normalizza: normalizza, cellulare: cellulare };
})();
