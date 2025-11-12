export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/auth') || request.url === '/status') {
      return;
    }
    await app.authenticate(request, reply);
  });

  await app.register(lookupsRoutes);
  await app.register(airportsRoutes);
  await app.register(locationsRoutes);
  await app.register(teamsRoutes);
  await app.register(speciesRoutes);
  await app.register(movementsRoutes);
  await app.register(sightingsRoutes);
  await app.register(strikesRoutes);
  await app.register(controlActionsRoutes);
  await app.register(attractorsRoutes);
  await app.register(kpisRoutes);
  await app.register(reportsRoutes);
}
