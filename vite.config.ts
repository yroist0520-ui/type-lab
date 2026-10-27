import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { handleAiRequest } from './server/aiHandler.mjs';

/**
 * Dev server middleware for /api/ai/*.
 * The AI key is read from the Node environment only — it is never sent to the browser.
 */
function aiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'type-lab-ai-dev-server',
    configureServer(server) {
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/ai/')) return next();
        handleAiRequest(req, res, {
          apiKey: env.AI_API_KEY || process.env.AI_API_KEY || '',
          baseUrl: env.AI_BASE_URL || process.env.AI_BASE_URL || '',
          visionModel: env.AI_VISION_MODEL || process.env.AI_VISION_MODEL || '',
          imageModel: env.AI_IMAGE_MODEL || process.env.AI_IMAGE_MODEL || '',
        });
      };
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'AI_');
  return {
    plugins: [react(), aiDevServer(env)],
    server: { port: 5173 },
    build: { outDir: 'dist' },
  };
});
