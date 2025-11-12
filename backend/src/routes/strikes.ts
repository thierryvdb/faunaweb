import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const corpo = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string(),
  location_id: z.coerce.number(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  phase_id: z.coerce.number().optional(),
  species_id: z.coerce.number().optional(),
  id_confidence: z.enum(['Alta', 'Media', 'Baixa', 'Nao_identificada']).optional(),
  quantity: z.coerce.number().min(1).optional(),
  damage_id: z.coerce.number().optional(),
  ingestion: z.boolean().optional(),
  effect_id: z.coerce.number().optional(),
  part_id: z.coerce.number().optional(),
  time_out_hours: z.coerce.number().min(0).optional(),
  cost_brl: z.coerce.number().min(0).optional(),
  sample_collected: z.boolean().optional(),
  severity_weight: z.coerce.number().optional(),
  source_ref: z.string().optional(),
  notes: z.string().optional()
});

const paramsId = z.object({ id: z.coerce.number() });

export async function strikesRoutes(app: FastifyInstance) {
  app.get('/api/colisoes', async (request) => {
    const querySchema = z.object({
      airportId: z.coerce.number().optional(),
      inicio: z.string().optional(),
      fim: z.string().optional(),
      fase: z.coerce.number().optional(),
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
    if (filtros.fase) {
      condicoes.push(`phase_id=$${condicoes.length + 1}`);
      valores.push(filtros.fase);
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
      `SELECT strike_id AS id, airport_id, date_utc, time_local, location_id, latitude_dec, longitude_dec, phase_id, species_id,
              id_confidence, quantity, damage_id, ingestion, effect_id, part_id, time_out_hours, cost_brl, sample_collected,
              severity_weight, source_ref, notes
       FROM wildlife.fact_strike
       ${where}
       ORDER BY date_utc DESC, time_local DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    return rows;
  });

  app.post('/api/colisoes', async (request, reply) => {
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_strike (airport_id, date_utc, time_local, location_id, latitude_dec, longitude_dec, phase_id, species_id,
        id_confidence, quantity, damage_id, ingestion, effect_id, part_id, time_out_hours, cost_brl, sample_collected,
        severity_weight, source_ref, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING strike_id AS id`,
      [
        body.airport_id,
        body.date_utc,
        body.time_local,
        body.location_id,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.phase_id ?? null,
        body.species_id ?? null,
        body.id_confidence ?? null,
        body.quantity ?? null,
        body.damage_id ?? null,
        body.ingestion ?? null,
        body.effect_id ?? null,
        body.part_id ?? null,
        body.time_out_hours ?? null,
        body.cost_brl ?? null,
        body.sample_collected ?? null,
        body.severity_weight ?? null,
        body.source_ref ?? null,
        body.notes ?? null
      ]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/colisoes/:id', async (request, reply) => {
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
      `UPDATE wildlife.fact_strike SET ${sets.join(', ')}, updated_at=now() WHERE strike_id=$${pares.length + 1}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Colisao nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/colisoes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_strike WHERE strike_id=$1', [id]);
    return reply.code(204).send();
  });
}
