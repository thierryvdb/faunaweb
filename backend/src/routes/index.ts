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
import { quadrantsRoutes } from './quadrants';
import { aircraftModelsRoutes } from './aircraftModels';

export async function registerRoutes(app: FastifyInstance) {
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

  const displaySymbol = Symbol.for('fastify.display-name');
  plugins.forEach((plugin, idx) => {
    if (typeof plugin !== 'function') {
      throw new Error(`Plugin na posição ${idx} é inválido: ${plugin}`);
    }
    if (!plugin[displaySymbol]) {
      Object.defineProperty(plugin, displaySymbol, {
        value: plugin.name || `anonymous-plugin-${idx}`,
        enumerable: false
      });
    }
  });

  for (const plugin of plugins) {
    await app.register(plugin);
  }
}
