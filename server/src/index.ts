import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', chatRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`WorkPal server running on http://localhost:${PORT}`);

  // Check API key configuration
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set — LLM calls will fail');
  }
  if (process.env.UNSPLASH_ACCESS_KEY) {
    console.log('✅ UNSPLASH_ACCESS_KEY loaded — search_images tool is active');
  } else {
    console.warn('⚠️  UNSPLASH_ACCESS_KEY not set — search_images tool disabled');
  }
});
