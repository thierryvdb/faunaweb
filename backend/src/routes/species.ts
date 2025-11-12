import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const paramsId = z.object({ id: z.coerce.number() });
const corpo = z.object({
  common_name: z.string().min(3),
  scientific_name: z.string().optional(),
  group_id: z.coerce.number(),
  mass_id: z.coerce.number().optional(),
  mass_grams: z.number().positive().optional(),
  notes: z.string().optional()
});

export async function speciesRoutes(app: FastifyInstance) {
  app.get('/api/especies', async (request) => {
    const querySchema = z.object({ busca: z.string().optional(), grupo: z.coerce.number().optional() });
    const filtros = querySchema.parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.busca) {
      condicoes.push(`(LOWER(common_name) LIKE $${condicoes.length + 1} OR LOWER(scientific_name) LIKE $${condicoes.length + 1})`);
      valores.push(`%${filtros.busca.toLowerCase()}%`);
    }
    if (filtros.grupo) {
      condicoes.push(`group_id=$${condicoes.length + 1}`);
      valores.push(filtros.grupo);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT species_id AS id, common_name, scientific_name, group_id, mass_id, mass_grams, notes
       FROM wildlife.dim_species ${where}
       ORDER BY common_name`,
      valores
    );
    return rows;
  });

  app.post('/api/especies', async (request, reply) => {
    const body = corpo.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.dim_species (common_name, scientific_name, group_id, mass_id, mass_grams, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING species_id AS id, common_name, scientific_name, group_id, mass_id, mass_grams, notes`,
      [body.common_name, body.scientific_name ?? null, body.group_id, body.mass_id ?? null, body.mass_grams ?? null, body.notes ?? null]
    );
    return reply.code(201).send(rows[0]);
  });

  app.put('/api/especies/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = corpo.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Informe dados para atualizar' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rows } = await db.query(
      `UPDATE wildlife.dim_species SET ${sets.join(', ')}, updated_at=now()
       WHERE species_id=$${pares.length + 1}
       RETURNING species_id AS id, common_name, scientific_name, group_id, mass_id, mass_grams, notes`,
      valores
    );
    if (!rows[0]) {
      return reply.code(404).send({ mensagem: 'Especie nao encontrada' });
    }
    return rows[0];
  });

  app.delete('/api/especies/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.dim_species WHERE species_id=$1', [id]);
    return reply.code(204).send();
  });
}
