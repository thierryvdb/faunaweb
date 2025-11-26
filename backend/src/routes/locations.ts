import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const paramsAero = z.object({ airportId: z.coerce.number() });
const paramsLoc = z.object({ airportId: z.coerce.number(), locationId: z.coerce.number() });
const corpo = z.object({
  code: z.string().min(2),
  runway_ref: z.string().optional(),
  description: z.string().optional()
});

export async function locationsRoutes(app: FastifyInstance) {
  app.get('/aeroportos/:airportId/locais', async (request, reply) => {
    const { airportId } = paramsAero.parse(request.params);
    const user = (request as any).user as { sub: number; airport_id: number };
    // Permite acessar se o aeroporto for o do token OU se o usuário tiver permissão explícita em app_user_airport
    if (airportId !== user.airport_id) {
      const ok = await db.query(
        `SELECT 1 FROM wildlife.app_user_airport WHERE user_id=$1 AND airport_id=$2`,
        [user.sub, airportId]
      );
      if (!ok.rows[0]) {
        return reply.code(403).send({ mensagem: 'Acesso negado' });
      }
    }
    const { rows } = await db.query(
      `SELECT location_id AS id, code, runway_ref, description
       FROM wildlife.dim_location
       WHERE airport_id=$1
       ORDER BY code`,
      [airportId]
    );
    return rows;
  });

  app.post('/aeroportos/:airportId/locais', async (request, reply) => {
    const { airportId } = paramsAero.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.dim_location (airport_id, code, runway_ref, description)
       VALUES ($1,$2,$3,$4)
       RETURNING location_id AS id, code, runway_ref, description`,
      [airportId, body.code, body.runway_ref ?? null, body.description ?? null]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/aeroportos/:airportId/locais/:locationId', async (request, reply) => {
    const { airportId, locationId } = paramsLoc.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores: any[] = pares.map(([, valor]) => valor);
    valores.push(locationId, airportId);
    const { rows } = await db.query(
      `UPDATE wildlife.dim_location SET ${sets.join(', ')}, updated_at=now()
       WHERE location_id=$${pares.length + 1} AND airport_id=$${pares.length + 2}
       RETURNING location_id AS id, code, runway_ref, description`,
      valores
    );
    if (!rows[0]) {
      return reply.code(404).send({ mensagem: 'Local nao encontrado' });
    }
    return rows[0];
  });

  app.delete('/aeroportos/:airportId/locais/:locationId', async (request, reply) => {
    const { airportId, locationId } = paramsLoc.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    await db.query('DELETE FROM wildlife.dim_location WHERE location_id=$1 AND airport_id=$2', [locationId, airportId]);
    return reply.code(204).send();
  });
}
