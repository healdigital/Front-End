import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

// Load environment variables before importing Payload.
dotenv.config({ path: '.env.local' });

console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'YES' : 'NO');
console.log('PAYLOAD_SECRET loaded:', process.env.PAYLOAD_SECRET ? 'YES' : 'NO');

if (!process.env.PAYLOAD_SECRET) {
  console.error('PAYLOAD_SECRET not found in .env.local.');
  process.exit(1);
}

const payloadModule = await import('payload');
const payload = payloadModule.default;
const initPayload = payload.init as unknown as (options: {
  config: unknown;
  express: unknown;
  onInit?: () => Promise<void>;
}) => Promise<void>;

const configModule = await import('./payload.config.js');
const config = configModule.default;

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://lacuisinedebernard.com',
  'https://www.lacuisinedebernard.com',
  'https://staging.lacuisinedebernard.com',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];

const parseOrigin = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigins = (): Set<string> => {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(/[,\n;]+/)
    .map((item) => parseOrigin(item.trim()))
    .filter((item): item is string => Boolean(item));

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

const getRequestOrigin = (req: Request): string | null => {
  const fromOriginHeader = parseOrigin(req.headers.origin);
  if (fromOriginHeader) return fromOriginHeader;

  if (typeof req.headers.referer === 'string') {
    return parseOrigin(req.headers.referer);
  }

  return null;
};

const isSafeMethod = (method: string): boolean => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto']
    : '';
  if (process.env.NODE_ENV === 'production' && forwardedProto.includes('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = getRequestOrigin(req);
  const isAllowedOrigin = requestOrigin ? allowedOrigins.has(requestOrigin) : false;

  if (isAllowedOrigin && requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  if (req.method === 'OPTIONS') {
    if (requestOrigin && !isAllowedOrigin) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    res.sendStatus(204);
    return;
  }

  next();
};

const csrfOriginCheck = (req: Request, res: Response, next: NextFunction) => {
  if (isSafeMethod(req.method)) {
    next();
    return;
  }

  const requestOrigin = getRequestOrigin(req);
  const allowNoOrigin =
    process.env.CSRF_ALLOW_NO_ORIGIN === '1' || process.env.NODE_ENV !== 'production';

  if (!requestOrigin) {
    if (allowNoOrigin) {
      next();
      return;
    }

    res.status(403).json({ error: 'Missing origin for state-changing request' });
    return;
  }

  if (!getAllowedOrigins().has(requestOrigin)) {
    res.status(403).json({ error: 'CSRF origin check failed' });
    return;
  }

  next();
};

const bodyLimit = process.env.BODY_PARSER_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ limit: bodyLimit, extended: true }));
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(csrfOriginCheck);

const start = async () => {
  try {
    console.log('Initializing Payload CMS...');

    await initPayload({
      config,
      express: app,
      onInit: async () => {
        console.log('Payload CMS initialized successfully');
      },
    });

    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`API: http://localhost:${PORT}/api`);

    app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        message: 'Payload server is running',
        adminUrl: `http://localhost:${PORT}/admin`,
        apiUrl: `http://localhost:${PORT}/api`,
      });
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT} (localhost:${PORT})`);
      console.log(`Try: http://localhost:${PORT}/health`);
    });
  } catch (error: unknown) {
    console.error('Error initializing Payload:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
};

await start();
