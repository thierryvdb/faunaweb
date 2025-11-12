import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const params = z.object({ airportId: z.coerce.number() });
const paramsWithTeam = z.object({ airportId: z.coerce.number(), teamId: z.coerce.number() });
const bodySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional()
});

export async function teamsRoutes(app: FastifyInstance) {
  app.get('/api/aeroportos/:airportId/equipes', async (request) => {
    const { airportId } = params.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return [];
    }
    const { rows } = await db.query(
      `SELECT team_id AS id, name, description
       FROM wildlife.dim_team WHERE airport_id=$1 ORDER BY name`,
      [airportId]
    );
    return rows;
  });

  app.post('/api/aeroportos/:airportId/equipes', async (request, reply) => {
    const { airportId } = params.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    const body = bodySchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.dim_team (airport_id, name, description)
       VALUES ($1,$2,$3)
       RETURNING team_id AS id, name, description`,
      [airportId, body.name, body.description ?? null]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/aeroportos/:airportId/equipes/:teamId', async (request, reply) => {
    const { airportId, teamId } = paramsWithTeam.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    const body = bodySchema.parse(request.body);
    const { rows } = await db.query(
      `UPDATE wildlife.dim_team SET name=$1, description=$2, updated_at=now()
       WHERE team_id=$3 AND airport_id=$4
       RETURNING team_id AS id, name, description`,
      [body.name, body.description ?? null, teamId, airportId]
    );
    if (!rows[0]) {
      return reply.code(404).send({ mensagem: 'Equipe nao encontrada' });
    }
    return rows[0];
  });

  app.delete('/api/aeroportos/:airportId/equipes/:teamId', async (request, reply) => {
    const { airportId, teamId } = paramsWithTeam.parse(request.params);
    const userAirportId = (request as any).user.airport_id as number;
    if (airportId !== userAirportId) {
      return reply.code(403).send({ mensagem: 'Acesso negado' });
    }
    await db.query('DELETE FROM wildlife.dim_team WHERE team_id=$1 AND airport_id=$2', [teamId, airportId]);
    return reply.code(204).send();
  });
}
