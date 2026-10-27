import type { IncomingMessage, ServerResponse } from 'node:http';

export interface AiServerConfig {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  imageModel: string;
}

export declare function handleAiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: AiServerConfig,
): void;
