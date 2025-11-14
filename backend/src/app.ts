import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import env from './config/env';
import { registerRoutes } from './routes';

export function buildApp() {
  const app = Fastify({ logger: true });

  // Validate plugin imports
  if (typeof cors !== 'function') {
    throw new Error(`@fastify/cors is ${typeof cors}, expected function`);
  }
  if (typeof multipart !== 'function') {
    throw new Error(`@fastify/multipart is ${typeof multipart}, expected function`);
  }
  if (typeof jwt !== 'function') {
    throw new Error(`@fastify/jwt is ${typeof jwt}, expected function`);
  }
  if (typeof registerRoutes !== 'function') {
    throw new Error(`registerRoutes is ${typeof registerRoutes}, expected function`);
  }

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

  // Register all application routes
  app.register(registerRoutes);

  return app;
}
