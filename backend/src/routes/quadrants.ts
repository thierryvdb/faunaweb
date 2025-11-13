import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const quadranteSchema = z.object({
  code: z.string().min(1).max(16),
  description: z.string().max(120).optional()
});

const parcialSchema = quadranteSchema.partial().refine((dados) => dados.code || dados.description, {
  message: 'Informe ao menos c�digo ou descri��o'
});

const paramsId = z.object({ id: z.coerce.number() });

export async function quadrantsRoutes(app: FastifyInstance) {
  app.get('/api/quadrantes', async () => {
    const { rows } = await db.query(
      'SELECT quadrant_id AS id, code, description FROM wildlife.lu_quadrant ORDER BY code'
    );
    return rows;
  });

  app.post('/api/quadrantes', async (request, reply) => {
    const body = quadranteSchema.parse(request.body);
    const code = body.code.trim().toUpperCase();
    const description = body.description?.trim() || null;
    const { rows } = await db.query(
      `INSERT INTO wildlife.lu_quadrant (code, description)
       VALUES ($1,$2)
       ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description, updated_at=now()
       RETURNING quadrant_id AS id`,
      [code, description]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/quadrantes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = parcialSchema.parse(request.body ?? {});
    const sets: string[] = [];
    const valores: any[] = [];
    if (body.code !== undefined) {
      sets.push(`code=$${sets.length + 1}`);
      valores.push(body.code.trim().toUpperCase());
    }
    if (body.description !== undefined) {
      sets.push(`description=$${sets.length + 1}`);
      valores.push(body.description.trim() || null);
    }
    if (!sets.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    sets.push(`updated_at=now()`);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.lu_quadrant SET ${sets.join(', ')} WHERE quadrant_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Quadrante nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/quadrantes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.lu_quadrant WHERE quadrant_id=$1', [id]);
    return reply.code(204).send();
  });
}
