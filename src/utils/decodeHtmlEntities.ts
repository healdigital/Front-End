import { maybeRepairMojibake } from './repairMojibake';

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00A0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  deg: '\u00B0',
  para: '\u00B6',
  sect: '\u00A7',
  dagger: '\u2020',
  ddagger: '\u2021',
  bull: '\u2022',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  times: '\u00D7',
  divide: '\u00F7',
  permil: '\u2030',
  plusmn: '\u00B1',
  macr: '\u00AF',
  acute: '\u00B4',
  cedil: '\u00B8',
  middot: '\u00B7',
  uml: '\u00A8',
  iexcl: '\u00A1',
  iquest: '\u00BF',
  agrave: '\u00E0',
  aacute: '\u00E1',
  acirc: '\u00E2',
  atilde: '\u00E3',
  auml: '\u00E4',
  aring: '\u00E5',
  aelig: '\u00E6',
  ccedil: '\u00E7',
  egrave: '\u00E8',
  eacute: '\u00E9',
  ecirc: '\u00EA',
  euml: '\u00EB',
  igrave: '\u00EC',
  iacute: '\u00ED',
  icirc: '\u00EE',
  iuml: '\u00EF',
  ntilde: '\u00F1',
  ograve: '\u00F2',
  oacute: '\u00F3',
  ocirc: '\u00F4',
  otilde: '\u00F5',
  ouml: '\u00F6',
  oslash: '\u00F8',
  ugrave: '\u00F9',
  uacute: '\u00FA',
  ucirc: '\u00FB',
  uuml: '\u00FC',
  yacute: '\u00FD',
  yuml: '\u00FF',
  szlig: '\u00DF',
  thorn: '\u00FE',
  eth: '\u00F0',
};

const decodeNamedEntity = (entityName: string): string | null => {
  const resolved = NAMED_ENTITIES[entityName.toLowerCase()];
  if (!resolved) return null;

  const isUppercase = entityName === entityName.toUpperCase();
  if (
    isUppercase &&
    resolved.length === 1 &&
    resolved.toLocaleLowerCase() !== resolved.toLocaleUpperCase()
  ) {
    return resolved.toLocaleUpperCase();
  }

  return resolved;
};

/**
 * Decode common HTML entities on the server and repair obvious mojibake.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  let decoded = String(text);

  // Unwrap double-encoded entities (for example "&amp;eacute;").
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded.replace(
      /&amp;(?=(#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]+;))/g,
      '&',
    );
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

  decoded = decoded.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entityName) => {
    const resolved = decodeNamedEntity(String(entityName || ''));
    return resolved ?? match;
  });

  decoded = decoded.replace(/&#0*39;/g, "'");

  return maybeRepairMojibake(decoded);
}
