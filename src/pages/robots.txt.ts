const CANONICAL_HOST = 'lacuisinedebernard.com';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

const productionRobots = `User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /wp-json/
Disallow: /wp-content/
Disallow: /.env
Disallow: /.env.*
Disallow: /node_modules/
Disallow: /src/
Disallow: /scripts/
Disallow: /package.json
Disallow: /package-lock.json
Disallow: /search?*
Disallow: /*?q=*
Disallow: /*?s=*
Disallow: /*?page=*
Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;

const stagingRobots = `User-agent: *
Disallow: /
`;

const isCanonicalOrigin = (candidate: string): boolean => {
  try {
    const parsed = new URL(candidate);
    return parsed.hostname === CANONICAL_HOST;
  } catch {
    return false;
  }
};

export function GET() {
  const envSite = import.meta.env.PUBLIC_SITE_URL || '';
  const isProduction = isCanonicalOrigin(envSite);
  const body = isProduction ? productionRobots : stagingRobots;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': isProduction ? 'index, follow' : 'noindex, nofollow',
    },
  });
}
