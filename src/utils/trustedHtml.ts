const EVENT_HANDLER_ATTR = /\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL = /(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;

export const sanitizeTrustedHtml = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(EVENT_HANDLER_ATTR, '')
    .replace(JAVASCRIPT_PROTOCOL, '$1="#"');
};
