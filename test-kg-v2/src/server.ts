import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './api';

const port = 3000;

console.log(`Server is running on http://localhost:${port}`);
console.log('Environment check - OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY);

serve({
  fetch: app.fetch,
  port,
});
