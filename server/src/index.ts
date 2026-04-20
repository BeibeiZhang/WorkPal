import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import claudeChatRouter from './routes/claudeChat.js';
import projectRouter from './routes/project.js';
import sessionRouter from './routes/session.js';
import reaperRouter from './routes/reaper.js';
import memoryRouter from './routes/memory.js';
import connectorsRouter from './routes/connectors.js';
import animationsRouter from './routes/animations.js';
import agentVideoStatusRouter from './routes/agentVideoStatus.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Attachments arrive as base64 data URLs; a single PNG easily exceeds the
// default 100kb body limit. Match the client-side per-file cap (8 MB) and
// allow a few in flight.
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', chatRouter);
app.use('/api', claudeChatRouter);
app.use('/api', projectRouter);
app.use('/api', sessionRouter);
app.use('/api', reaperRouter);
app.use('/api', memoryRouter);
app.use('/api', connectorsRouter);
app.use('/api', animationsRouter);
app.use('/api', agentVideoStatusRouter);

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — /api/claude-chat will fail');
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
  const googleReady = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  if (googleReady) {
    console.log('✅ Google OAuth configured — Gmail + Calendar connect flows active');
  } else {
    console.warn('⚠️  Google OAuth not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in server/.env to enable Gmail + Calendar connectors');
  }
  if (!process.env.MEMORY_PASSWORD) {
    console.warn('⚠️  MEMORY_PASSWORD not set — connector mutations + memory writes will be blocked');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY not set — connectors + memory persistence will fail');
  }
});
