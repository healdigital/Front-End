import { maybeRepairMojibake } from './repairMojibake';

/**
 * Decode common HTML entities on the server and repair obvious mojibake.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  let decoded = String(text);

  const doubleEncodedPattern = /&amp;(#\d+;|#x[0-9a-fA-F]+;|[a-z]+;)/gi;
  if (doubleEncodedPattern.test(decoded)) {
    decoded = decoded.replace(doubleEncodedPattern, '&$1');
  }

  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    try {
      return String.fromCodePoint(Number.parseInt(dec, 10));
    } catch {
      return match;
    }
  });

  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
    try {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    } catch {
      return match;
    }
  });

  const entities: [string, string][] = [
    ['&nbsp;', '\u00A0'],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&quot;', '"'],
    ['&apos;', "'"],
    ['&amp;', '&'],
    ['&Agrave;', 'À'],
    ['&agrave;', 'à'],
    ['&Aacute;', 'Á'],
    ['&aacute;', 'á'],
    ['&Acirc;', 'Â'],
    ['&acirc;', 'â'],
    ['&Atilde;', 'Ã'],
    ['&atilde;', 'ã'],
    ['&Auml;', 'Ä'],
    ['&auml;', 'ä'],
    ['&Aring;', 'Å'],
    ['&aring;', 'å'],
    ['&AElig;', 'Æ'],
    ['&aelig;', 'æ'],
    ['&Ccedil;', 'Ç'],
    ['&ccedil;', 'ç'],
    ['&Egrave;', 'È'],
    ['&egrave;', 'è'],
    ['&Eacute;', 'É'],
    ['&eacute;', 'é'],
    ['&Ecirc;', 'Ê'],
    ['&ecirc;', 'ê'],
    ['&Euml;', 'Ë'],
    ['&euml;', 'ë'],
    ['&Igrave;', 'Ì'],
    ['&igrave;', 'ì'],
    ['&Iacute;', 'Í'],
    ['&iacute;', 'í'],
    ['&Icirc;', 'Î'],
    ['&icirc;', 'î'],
    ['&Iuml;', 'Ï'],
    ['&iuml;', 'ï'],
    ['&Ntilde;', 'Ñ'],
    ['&ntilde;', 'ñ'],
    ['&Ograve;', 'Ò'],
    ['&ograve;', 'ò'],
    ['&Oacute;', 'Ó'],
    ['&oacute;', 'ó'],
    ['&Ocirc;', 'Ô'],
    ['&ocirc;', 'ô'],
    ['&Otilde;', 'Õ'],
    ['&otilde;', 'õ'],
    ['&Ouml;', 'Ö'],
    ['&ouml;', 'ö'],
    ['&Oslash;', 'Ø'],
    ['&oslash;', 'ø'],
    ['&Ugrave;', 'Ù'],
    ['&ugrave;', 'ù'],
    ['&Uacute;', 'Ú'],
    ['&uacute;', 'ú'],
    ['&Ucirc;', 'Û'],
    ['&ucirc;', 'û'],
    ['&Uuml;', 'Ü'],
    ['&uuml;', 'ü'],
    ['&Yacute;', 'Ý'],
    ['&yacute;', 'ý'],
    ['&THORN;', 'Þ'],
    ['&thorn;', 'þ'],
    ['&ETH;', 'Ð'],
    ['&eth;', 'ð'],
    ['&szlig;', 'ß'],
    ['&yuml;', 'ÿ'],
    ['&copy;', '©'],
    ['&reg;', '®'],
    ['&deg;', '°'],
    ['&para;', '¶'],
    ['&sect;', '§'],
    ['&dagger;', '†'],
    ['&Dagger;', '‡'],
    ['&bull;', '•'],
    ['&rsquo;', '’'],
    ['&lsquo;', '‘'],
    ['&rdquo;', '”'],
    ['&ldquo;', '“'],
    ['&ndash;', '–'],
    ['&mdash;', '—'],
    ['&hellip;', '…'],
    ['&times;', '×'],
    ['&divide;', '÷'],
    ['&permil;', '‰'],
    ['&plusmn;', '±'],
    ['&macr;', '¯'],
    ['&acute;', '´'],
    ['&cedil;', '¸'],
    ['&middot;', '·'],
    ['&uml;', '¨'],
    ['&iquest;', '¿'],
    ['&iexcl;', '¡'],
    ['&#039;', "'"],
  ];

  for (const [entity, char] of entities) {
    if (decoded.includes(entity)) {
      decoded = decoded.split(entity).join(char);
    }
  }

  return maybeRepairMojibake(decoded);
}
