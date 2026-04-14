import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { startPeriodicCleanup } from './services/cleanupService.js';
import uploadRouter, { handleMulterError } from './routes/upload.js';
import processRouter from './routes/process.js';
import progressRouter from './routes/progress.js';
import downloadRouter from './routes/download.js';
import sessionRouter from './routes/session.js';

const app = express();
const PORT = process.env['PORT'] ?? 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/upload', uploadRouter);
app.use('/api/process', processRouter);
app.use('/api/progress', progressRouter);
app.use('/api/download', downloadRouter);
app.use('/api', sessionRouter);

// Multer error handler (must be after routes)
app.use(handleMulterError);

// Serve built client in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback: serve index.html for all non-API routes
  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(clientDistPath, 'index.html'));
  });
}

// Start periodic session cleanup (every 5 min, removes sessions older than 30 min)
const cleanupHandle = startPeriodicCleanup();

const server = app.listen(PORT, () => {
  console.log(`slicePDF server running on port ${PORT}`);
});

// Graceful shutdown
function shutdown() {
  clearInterval(cleanupHandle);
  server.close();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
