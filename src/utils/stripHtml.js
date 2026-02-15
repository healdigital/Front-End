function decodeNamedEntities(text) {
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&hellip;': '\u2026',
    '&mdash;': '\u2014',
    '&ndash;': '\u2013',
    '&bull;': '\u2022',
    '&deg;': '\u00B0',
    '&frac12;': '\u00BD',
    '&frac14;': '\u00BC',
    '&frac34;': '\u00BE',
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entities[entity] || entity);
}

function decodeHtmlEntities(text = '') {
  if (!text) return '';

  let decoded = text;

  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    const intCode = Number(code);
    return Number.isFinite(intCode) ? String.fromCharCode(intCode) : _;
  });

  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const intCode = Number.parseInt(hex, 16);
    return Number.isFinite(intCode) ? String.fromCharCode(intCode) : _;
  });

  return decodeNamedEntities(decoded);
}

export function stripHtml(html = '') {
  const input = typeof html === 'string' ? html : '';
  const withoutTags = input.replace(/<[^>]*>?/gm, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

