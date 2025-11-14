import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import env from './config/env';
import { registerRoutes } from './routes';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    }
  });
  app.register(jwt, {
    secret: env.jwtSecret,
    sign: {
      expiresIn: '4h'
    }
  });

  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (error) {
      return reply.code(401).send({ mensagem: 'Nao autorizado' });
    }
  });

  app.get('/status', async () => ({ mensagem: 'API operacional' }));

  // Register routes - wrap in async plugin
  app.register(async (instance) => {
    await registerRoutes(instance);
  });

  return app;
}
