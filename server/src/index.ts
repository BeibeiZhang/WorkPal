import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import memoryRouter from './routes/memory.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Attachments arrive as base64 data URLs; a single PNG easily exceeds the
// default 100kb body limit. Match the client-side per-file cap (8 MB) and
// allow a few in flight.
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', chatRouter);
app.use('/api', memoryRouter);

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
  if (process.env.YOUTUBE_API_KEY) {
    console.log('✅ YOUTUBE_API_KEY loaded — search_videos tool is active');
  } else {
    console.warn('⚠️  YOUTUBE_API_KEY not set — search_videos tool disabled');
  }
  if (process.env.TAVILY_API_KEY) {
    console.log('✅ TAVILY_API_KEY loaded — web_search tool is active');
  } else {
    console.warn('⚠️  TAVILY_API_KEY not set — web_search tool disabled');
  }
});
