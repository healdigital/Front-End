import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug: Check environment variables
console.log('MONGODB_URI loaded:', !!process.env.MONGODB_URI ? 'YES ✓' : 'NO ✗');
console.log('PAYLOAD_SECRET loaded:', !!process.env.PAYLOAD_SECRET ? 'YES ✓' : 'NO ✗');

if (!process.env.PAYLOAD_SECRET) {
  console.error('❌ PAYLOAD_SECRET not found in .env.local!');
  process.exit(1);
}

// Dynamic import of Payload after dotenv is loaded
const payloadModule = await import('payload');
const payload = payloadModule.default;

// Import config
const configModule = await import('./payload.config.js');
const config = configModule.default;

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialize Payload
const start = async () => {
  try {
    console.log('Initializing Payload CMS...');
    
    // Initialize Payload
    await payload.init({
      config,
      secret: process.env.PAYLOAD_SECRET,
      express: app,
      onInit: async () => {
        console.log(`✅ Payload CMS initialized successfully`);
      },
    });

    console.log(`🚀 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📡 API: http://localhost:${PORT}/api`);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok',
        message: 'Payload server is running',
        adminUrl: `http://localhost:${PORT}/admin`,
        apiUrl: `http://localhost:${PORT}/api`
      });
    });

    // Start the Express server (listen on all interfaces to avoid localhost binding issues)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\nServer listening on http://0.0.0.0:${PORT} (localhost:${PORT})`);
      console.log(`\nTry: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Error initializing Payload:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Run start function
await start();
