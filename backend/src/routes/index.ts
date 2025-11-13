import { FastifyInstance } from 'fastify';
import { lookupsRoutes } from './lookups';
import { airportsRoutes } from './airports';
import { locationsRoutes } from './locations';
import { speciesRoutes } from './species';
import { movementsRoutes } from './movements';
import { sightingsRoutes } from './sightings';
import { strikesRoutes } from './strikes';
import { controlActionsRoutes } from './controlActions';
import { attractorsRoutes } from './attractors';
import { kpisRoutes } from './kpis';
import { reportsRoutes } from './reports';
import { teamsRoutes } from './teams';
import { authRoutes } from './auth';
import { complianceRoutes } from './compliance';
import { analyticsRoutes } from './analytics';
import { usersRoutes } from './users';

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
  await app.register(complianceRoutes);
  await app.register(analyticsRoutes);
  await app.register(usersRoutes);
}
