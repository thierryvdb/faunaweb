export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(jwt, { secret: env.jwtSecret });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      return reply.code(401).send({ mensagem: 'Nao autorizado' });
    }
  });

  app.get('/status', async () => ({ mensagem: 'API operacional' }));

  app.register(registerRoutes);

  return app;
}
