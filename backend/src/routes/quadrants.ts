import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const GRID_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
const GRID_COLUMNS_TOTAL = 33;

const quadranteSchema = z.object({
  code: z.string().min(1).max(16),
  description: z.string().max(120).optional()
});

const parcialSchema = quadranteSchema.partial().refine((dados) => dados.code || dados.description, {
  message: 'Informe ao menos codigo ou descricao'
});

const resetSchema = z.object({
  confirm: z.string().min(1)
});

const paramsId = z.object({ id: z.coerce.number() });

function extrairGrid(code: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(code);
  if (!match) {
    return { row: null, col: null };
  }
  const [, row, col] = match;
  return { row, col: Number(col) };
}

export async function quadrantsRoutes(app: FastifyInstance) {
  app.get('/quadrantes', async () => {
    const { rows } = await db.query(
      `SELECT quadrant_id AS id,
              code,
              description,
              grid_row,
              grid_col,
              latitude_dec,
              longitude_dec
         FROM wildlife.lu_quadrant
        ORDER BY code`
    );
    return rows;
  });

  app.post('/quadrantes', async (request, reply) => {
    const body = quadranteSchema.parse(request.body);
    const code = body.code.trim().toUpperCase();
    const description = body.description?.trim() || null;
    const grid = extrairGrid(code);
    const { rows } = await db.query(
      `INSERT INTO wildlife.lu_quadrant (code, description, grid_row, grid_col)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code)
       DO UPDATE SET description=EXCLUDED.description,
                     grid_row=EXCLUDED.grid_row,
                     grid_col=EXCLUDED.grid_col,
                     updated_at=now()
       RETURNING quadrant_id AS id`,
      [code, description, grid.row, grid.col]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.post('/quadrantes/reset-grade', async (request, reply) => {
    const body = resetSchema.parse(request.body ?? {});
    if (body.confirm !== 'matriz-33x14') {
      return reply.code(400).send({ mensagem: 'Confirme enviando confirm=matriz-33x14' });
    }
    await db.transaction(async (client) => {
      await client.query('TRUNCATE TABLE wildlife.lu_quadrant RESTART IDENTITY');
      await client.query(
        `INSERT INTO wildlife.lu_quadrant (code, description, grid_row, grid_col)
         SELECT CONCAT(letter, col::text) AS code,
                CONCAT('Linha ', letter, ', coluna ', col)::text AS description,
                letter,
                col
           FROM unnest($1::text[]) AS letter
          CROSS JOIN generate_series(1,$2) AS col
          ORDER BY letter, col`,
        [GRID_ROWS, GRID_COLUMNS_TOTAL]
      );
    });
    return reply.send({ mensagem: 'Grade 33x14 regenerada com sucesso' });
  });

  app.put('/quadrantes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    const body = parcialSchema.parse(request.body ?? {});
    const sets: string[] = [];
    const valores: any[] = [];
    let novoGrid: { row: string | null; col: number | null } | null = null;
    if (body.code !== undefined) {
      const codeNormalizado = body.code.trim().toUpperCase();
      novoGrid = extrairGrid(codeNormalizado);
      sets.push(`code=$${sets.length + 1}`);
      valores.push(codeNormalizado);
      sets.push(`grid_row=$${sets.length + 1}`);
      valores.push(novoGrid.row);
      sets.push(`grid_col=$${sets.length + 1}`);
      valores.push(novoGrid.col);
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

  app.delete('/quadrantes/:id', async (request, reply) => {
    const { id } = paramsId.parse(request.params);
    await db.query('DELETE FROM wildlife.lu_quadrant WHERE quadrant_id=$1', [id]);
    return reply.code(204).send();
  });
}

