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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

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
