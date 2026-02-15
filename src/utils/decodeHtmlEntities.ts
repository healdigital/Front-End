/**
 * Comprehensive HTML entity decoder for server-side use
 * Handles numeric (decimal/hex), named entities, and double-encoded content
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  let decoded = text;
  
  // First pass: handle double-encoded ampersand (&amp; -> &)
  // Only do this once to avoid breaking actual ampersands
  const doubleEncodedPattern = /&amp;(#\d+;|#x[0-9a-fA-F]+;|[a-z]+;)/gi;
  if (doubleEncodedPattern.test(decoded)) {
    decoded = decoded.replace(/&amp;(#\d+;|#x[0-9a-fA-F]+;|[a-z]+;)/gi, '&$1');
  }

  // Decode numeric entities (decimal) - &#233; or &#0233;
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    try {
      const code = parseInt(dec, 10);
      // Use fromCodePoint for better Unicode support (especially for emoji and rare chars)
      return String.fromCodePoint(code);
    } catch (e) {
      return match;
    }
  });

  // Decode numeric entities (hexadecimal) - &#xE9; &#xe9;
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCodePoint(code);
    } catch (e) {
      return match;
    }
  });
  
  // Named HTML entities - comprehensive map
  // Using split/join is faster than regex for multiple replacements
  const entities: [string, string][] = [
    // Basic
    ['&nbsp;', '\u00A0'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], 
    ['&apos;', "'"], ['&amp;', '&'],
    
    // Latin 1 Supplement (À–ÿ)
    ['&Agrave;', 'À'], ['&agrave;', 'à'], ['&Aacute;', 'Á'], ['&aacute;', 'á'],
    ['&Acirc;', 'Â'], ['&acirc;', 'â'], ['&Atilde;', 'Ã'], ['&atilde;', 'ã'],
    ['&Auml;', 'Ä'], ['&auml;', 'ä'], ['&Aring;', 'Å'], ['&aring;', 'å'],
    ['&AElig;', 'Æ'], ['&aelig;', 'æ'], ['&Ccedil;', 'Ç'], ['&ccedil;', 'ç'],
    ['&Egrave;', 'È'], ['&egrave;', 'è'], ['&Eacute;', 'É'], ['&eacute;', 'é'],
    ['&Ecirc;', 'Ê'], ['&ecirc;', 'ê'], ['&Euml;', 'Ë'], ['&euml;', 'ë'],
    ['&Igrave;', 'Ì'], ['&igrave;', 'ì'], ['&Iacute;', 'Í'], ['&iacute;', 'í'],
    ['&Icirc;', 'Î'], ['&icirc;', 'î'], ['&Iuml;', 'Ï'], ['&iuml;', 'ï'],
    ['&Ntilde;', 'Ñ'], ['&ntilde;', 'ñ'], ['&Ograve;', 'Ò'], ['&ograve;', 'ò'],
    ['&Oacute;', 'Ó'], ['&oacute;', 'ó'], ['&Ocirc;', 'Ô'], ['&ocirc;', 'ô'],
    ['&Otilde;', 'Õ'], ['&otilde;', 'õ'], ['&Ouml;', 'Ö'], ['&ouml;', 'ö'],
    ['&Oslash;', 'Ø'], ['&oslash;', 'ø'], ['&Ugrave;', 'Ù'], ['&ugrave;', 'ù'],
    ['&Uacute;', 'Ú'], ['&uacute;', 'ú'], ['&Ucirc;', 'Û'], ['&ucirc;', 'û'],
    ['&Uuml;', 'Ü'], ['&uuml;', 'ü'], ['&Yacute;', 'Ý'], ['&yacute;', 'ý'],
    ['&THORN;', 'Þ'], ['&thorn;', 'þ'], ['&ETH;', 'Ð'], ['&eth;', 'ð'],
    ['&szlig;', 'ß'], ['&yuml;', 'ÿ'],
    
    // Common symbols
    ['&copy;', '©'], ['&reg;', '®'], ['&deg;', '°'], ['&para;', '¶'],
    ['&sect;', '§'], ['&dagger;', '†'], ['&Dagger;', '‡'], ['&bull;', '•'],
    
    // Quotes and dashes
    ['&rsquo;', "'"], ['&lsquo;', "'"], ['&rdquo;', '"'], ['&ldquo;', '"'],
    ['&ndash;', '–'], ['&mdash;', '—'], ['&hellip;', '…'], ['&times;', '×'],
    ['&divide;', '÷'], ['&permil;', '‰'],
    
    // Math/arrows
    ['&plusmn;', '±'], ['&macr;', '¯'], ['&acute;', '´'], ['&cedil;', '¸'],
    ['&middot;', '·'], ['&uml;', '¨'], ['&iquest;', '¿'], ['&iexcl;', '¡'],
    ['&#039;', "'"],
  ];

  for (const [entity, char] of entities) {
    if (decoded.includes(entity)) {
      decoded = decoded.split(entity).join(char);
    }
  }

  return decoded;
}
