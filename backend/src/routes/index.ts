import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { lookupsRoutes } from "./lookups";
import { airportsRoutes } from "./airports";
import { locationsRoutes } from "./locations";
import { speciesRoutes } from "./species";
import { movementsRoutes } from "./movements";
import { sightingsRoutes } from "./sightings";
import { strikesRoutes } from "./strikes";
import { controlActionsRoutes } from "./controlActions";
import { attractorsRoutes } from "./attractors";
import { kpisRoutes } from "./kpis";
import { reportsRoutes } from "./reports";
import { teamsRoutes } from "./teams";
import { authRoutes } from "./auth";
import { complianceRoutes } from "./compliance";
import { analyticsRoutes } from "./analytics";
import { usersRoutes } from "./users";
import { quadrantsRoutes } from "./quadrants";
import { aircraftModelsRoutes } from "./aircraftModels";

async function routes(app: FastifyInstance) {
  await app.register(fp(authRoutes, { name: "authRoutes" }));

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/auth") || request.url === "/status") {
      return;
    }
    await app.authenticate(request, reply);
  });

  const protectedRoutes = [
    { name: "lookupsRoutes", handler: lookupsRoutes },
    { name: "quadrantsRoutes", handler: quadrantsRoutes },
    { name: "airportsRoutes", handler: airportsRoutes },
    { name: "locationsRoutes", handler: locationsRoutes },
    { name: "teamsRoutes", handler: teamsRoutes },
    { name: "speciesRoutes", handler: speciesRoutes },
    { name: "aircraftModelsRoutes", handler: aircraftModelsRoutes },
    { name: "movementsRoutes", handler: movementsRoutes },
    { name: "sightingsRoutes", handler: sightingsRoutes },
    { name: "strikesRoutes", handler: strikesRoutes },
    { name: "controlActionsRoutes", handler: controlActionsRoutes },
    { name: "attractorsRoutes", handler: attractorsRoutes },
    { name: "kpisRoutes", handler: kpisRoutes },
    { name: "reportsRoutes", handler: reportsRoutes },
    { name: "complianceRoutes", handler: complianceRoutes },
    { name: "analyticsRoutes", handler: analyticsRoutes },
    { name: "usersRoutes", handler: usersRoutes },
  ];

  const displaySymbol = Symbol.for("fastify.display-name");
  for (const route of protectedRoutes) {
    if (!route.handler[displaySymbol]) {
      Object.defineProperty(route.handler, displaySymbol, {
        value: route.name,
        enumerable: false,
        configurable: true,
      });
    }

    await app.register(
      fp(route.handler, {
        name: route.name,
        dependencies: ["authRoutes"],
      })
    );
  }
}

export const registerRoutes = fp(routes, { name: "registerRoutes" });
