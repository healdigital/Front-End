import { createSign } from 'node:crypto';

const GA_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA_DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

type GaPageViewRow = {
  pagePath: string;
  screenPageViews: number;
};

const getEnv = (name: string): string => String(process.env[name] || '').trim();

const getGaConfig = () => {
  const propertyId = getEnv('GA4_PROPERTY_ID');
  const clientEmail = getEnv('GA4_CLIENT_EMAIL');
  const privateKey = getEnv('GA4_PRIVATE_KEY').replace(/\\n/g, '\n');
  const lookbackDays = Number(getEnv('GA4_POPULAR_LOOKBACK_DAYS') || '90');

  if (!propertyId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    propertyId,
    clientEmail,
    privateKey,
    lookbackDays: Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 90,
  };
};

const base64UrlEncode = (value: string): string =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createJwtAssertion = (clientEmail: string, privateKey: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: GA_SCOPE,
      aud: GA_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${unsigned}.${signature}`;
};

const fetchAccessToken = async (clientEmail: string, privateKey: string): Promise<string | null> => {
  try {
    const assertion = createJwtAssertion(clientEmail, privateKey);
    const response = await fetch(GA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json();
    return typeof payload?.access_token === 'string' ? payload.access_token : null;
  } catch {
    return null;
  }
};

const toPositiveInt = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export async function getPopularPageViews(limit = 50): Promise<GaPageViewRow[]> {
  const config = getGaConfig();
  if (!config) return [];

  const accessToken = await fetchAccessToken(config.clientEmail, config.privateKey);
  if (!accessToken) return [];

  try {
    const response = await fetch(`${GA_DATA_API_BASE}/properties/${config.propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${config.lookbackDays}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit,
      }),
    });

    if (!response.ok) return [];

    const payload = await response.json();
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];

    return rows
      .map((row: any) => {
        const pagePath = String(row?.dimensionValues?.[0]?.value || '').trim();
        const screenPageViews = toPositiveInt(row?.metricValues?.[0]?.value);
        return pagePath && screenPageViews > 0 ? { pagePath, screenPageViews } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
