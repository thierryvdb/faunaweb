import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';
import { requireRead, requireCreate, requireUpdate, requireDelete } from '../utils/auth';

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string().optional(),
  location_id: z.coerce.number().optional(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  action_type_id: z.coerce.number().optional(),
  description: z.string().optional(),
  duration_min: z.coerce.number().min(0).optional(),
  result_notes: z.string().optional(),
  efficacy_percent: z.number().min(-100).max(100).optional(),
  lethal_control: z.boolean().optional(),
  weapon_ammo: z.string().optional(),
  post_dispersion_m: z.number().min(0).optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function controlActionsRoutes(app: FastifyInstance) {
  app.get('/api/acoes-controle', { preHandler: [app.authenticate, requireRead] }, async (request) => {
    const querySchema = z.object({
      airportId: z.coerce.number().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      pagina: z.coerce.number().optional().default(1),
      limite: z.coerce.number().optional().default(50)
    });
    const filtros = querySchema.parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.inicio) {
      condicoes.push(`date_utc >= $${condicoes.length + 1}`);
      valores.push(filtros.inicio);
    }
    if (filtros.fim) {
      condicoes.push(`date_utc <= $${condicoes.length + 1}`);
      valores.push(filtros.fim);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const offset = (filtros.pagina - 1) * filtros.limite;
    valores.push(filtros.limite, offset);
    const { rows } = await db.query(
      `SELECT action_id AS id, airport_id, date_utc, time_local, location_id, latitude_dec, longitude_dec, action_type_id,
              description, duration_min, result_notes, efficacy_percent, lethal_control, weapon_ammo, post_dispersion_m
       FROM wildlife.fact_control_action
       ${where}
       ORDER BY date_utc DESC, time_local DESC NULLS LAST
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows;
  });

  app.post('/api/acoes-controle', { preHandler: [app.authenticate, requireCreate] }, async (request, reply) => {
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_control_action (airport_id, date_utc, time_local, location_id, latitude_dec, longitude_dec,
        action_type_id, description, duration_min, result_notes, efficacy_percent, lethal_control, weapon_ammo, post_dispersion_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING action_id AS id`,
      [
        body.airport_id,
        body.date_utc,
        body.time_local ?? null,
        body.location_id ?? null,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.action_type_id ?? null,
        body.description ?? null,
        body.duration_min ?? null,
        body.result_notes ?? null,
        body.efficacy_percent ?? null,
        body.lethal_control ?? null,
        body.weapon_ammo ?? null,
        body.post_dispersion_m ?? null
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/acoes-controle/:id', { preHandler: [app.authenticate, requireUpdate] }, async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_control_action SET ${sets.join(', ')}, updated_at=now() WHERE action_id=$${pares.length + 1}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Acao nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/acoes-controle/:id', { preHandler: [app.authenticate, requireDelete] }, async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_control_action WHERE action_id=$1', [id]);
    return reply.code(204).send();
  });
}
