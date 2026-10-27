import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAiRequest } from './aiHandler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);

const cfg = {
  apiKey: process.env.AI_API_KEY || '',
  baseUrl: process.env.AI_BASE_URL || '',
  visionModel: process.env.AI_VISION_MODEL || '',
  imageModel: process.env.AI_IMAGE_MODEL || '',
};

const app = express();
app.disable('x-powered-by');

app.all('/api/ai/*', (req, res) => {
  handleAiRequest(req, res, cfg);
});

app.use(express.static(path.join(root, 'dist'), { index: 'index.html' }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(root, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`TYPE LAB running at http://localhost:${port}`);
  console.log(
    cfg.apiKey
      ? `AI enabled — vision: ${cfg.visionModel || '(unset)'}, image: ${cfg.imageModel || '(unset)'}`
      : 'AI disabled — set AI_API_KEY to enable font analysis and glyph generation.',
  );
});
