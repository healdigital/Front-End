import express from 'express';
import payload from 'payload';
import dotenv from 'dotenv';
import config from './payload.config.ts';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Payload
await payload.init({
  config,
  secret: process.env.PAYLOAD_SECRET,
  expressApp: app,
  onInit: async () => {
    payload.logger.info(`Payload CMS running on http://localhost:${PORT}/admin`);
  },
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
