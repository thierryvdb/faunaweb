import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/status', async () => ({ mensagem: 'API operacional' }));

  app.register(registerRoutes);

  return app;
}
