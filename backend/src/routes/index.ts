import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
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
import { quadrantsRoutes } from './quadrants';
import { aircraftModelsRoutes } from './aircraftModels';

async function routes(app: FastifyInstance) {
  await app.register(authRoutes);

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/auth') || request.url === '/status') {
      return;
    }
    await app.authenticate(request, reply);
  });

  const plugins = [
    lookupsRoutes,
    quadrantsRoutes,
    airportsRoutes,
    locationsRoutes,
    teamsRoutes,
    speciesRoutes,
    aircraftModelsRoutes,
    movementsRoutes,
    sightingsRoutes,
    strikesRoutes,
    controlActionsRoutes,
    attractorsRoutes,
    kpisRoutes,
    reportsRoutes,
    complianceRoutes,
    analyticsRoutes,
    usersRoutes
  ];

  for (const [idx, plugin] of plugins.entries()) {
    if (typeof plugin !== 'function') {
      throw new Error(`Route plugin at position ${idx} is invalid: ${plugin}`);
    }
    const pluginName = plugin.name || `route-plugin-${idx}`;
    const wrapped = fp(plugin, { name: pluginName });
    app.log.info({ plugin: pluginName }, 'Registering plugin');
    await app.register(wrapped);
  }
}

export const registerRoutes = fp(routes, { name: 'registerRoutes' });
