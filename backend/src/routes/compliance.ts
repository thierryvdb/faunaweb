import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../services/db';

const observationSchema = z.object({
  tipo: z.string(),
  descricao: z.string(),
  severidade: z.string().optional(),
  acoes: z.string().optional(),
  location_id: z.coerce.number().optional(),
  quadrant: z.string().optional(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional()
});

const inspectionSchema = z.object({
  airport_id: z.coerce.number(),
  inspection_type: z.enum(['site', 'asa']),
  date_utc: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  team_name: z.string().optional(),
  weather_summary: z.string().optional(),
  route_summary: z.string().optional(),
  grid_refs: z.array(z.string()).optional(),
  reported_by_user_id: z.coerce.number().optional(),
  reported_by_name: z.string().optional(),
  notes: z.string().optional(),
  observations: z.array(observationSchema).optional()
});

const carcassSchema = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  time_local: z.string().optional(),
  location_id: z.coerce.number().optional(),
  quadrant: z.string().optional(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  species_id: z.coerce.number().optional(),
  species_guess: z.string().optional(),
  quantity: z.coerce.number().optional(),
  mass_grams: z.number().optional(),
  photo_url: z.string().url().optional(),
  dna_collected: z.boolean().optional(),
  storage_method: z.string().optional(),
  destination: z.enum(['aterro', 'autoclave', 'incineracao', 'outro']).optional(),
  destination_detail: z.string().optional(),
  handled_by: z.string().optional(),
  bag_tag: z.string().optional(),
  notified_sigra: z.boolean().optional(),
  notes: z.string().optional()
});

const auditSchema = z.object({
  airport_id: z.coerce.number(),
  date_utc: z.string(),
  category: z.enum(['residuos', 'esgoto', 'sistema_protecao', 'foco_secundario', 'outro']),
  area_reference: z.string().optional(),
  status: z.enum(['pendente', 'em_execucao', 'resolvido']).optional(),
  findings: z.string().optional(),
  actions_planned: z.string().optional(),
  responsible_party: z.string().optional(),
  follow_up_date: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional()
});

const asaFocusSchema = z.object({
  airport_id: z.coerce.number(),
  municipality: z.string().optional(),
  focus_type: z.string().optional(),
  description: z.string().optional(),
  latitude_dec: z.number().optional(),
  longitude_dec: z.number().optional(),
  distance_km: z.number().optional(),
  status: z.enum(['monitorado', 'em_gestao', 'mitigado']).optional(),
  responsible_org: z.string().optional(),
  notified_at: z.string().optional(),
  next_follow_up: z.string().optional(),
  protocol_ref: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional()
});

const noticeSchema = z.object({
  airport_id: z.coerce.number(),
  asa_focus_id: z.coerce.number().optional(),
  target_entity: z.string(),
  subject: z.string().optional(),
  protocol_code: z.string().optional(),
  status: z.enum(['enviado', 'em_andamento', 'respondido', 'encerrado']).optional(),
  sent_at: z.string().optional(),
  response_due_at: z.string().optional(),
  response_received_at: z.string().optional(),
  notes: z.string().optional()
});

const participantSchema = z.object({
  nome: z.string(),
  funcao: z.string().optional(),
  organizacao: z.string().optional(),
  email: z.string().optional()
});

const trainingSchema = z.object({
  airport_id: z.coerce.number(),
  title: z.string(),
  audience: z.string().optional(),
  start_date: z.string(),
  end_date: z.string().optional(),
  hours_total: z.number().optional(),
  delivery_mode: z.string().optional(),
  instructor: z.string().optional(),
  topics: z.array(z.string()).optional(),
  participants: z.array(participantSchema).optional(),
  materials_url: z.string().url().optional(),
  notes: z.string().optional()
});

const idParams = z.object({ id: z.coerce.number() });

export async function complianceRoutes(app: FastifyInstance) {
  // Inspeções
  app.get('/api/inspecoes', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        tipo: z.enum(['site', 'asa']).optional(),
        inicio: z.string().optional(),
        fim: z.string().optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`i.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.tipo) {
      condicoes.push(`i.inspection_type=$${condicoes.length + 1}`);
      valores.push(filtros.tipo);
    }
    if (filtros.inicio) {
      condicoes.push(`i.date_utc >= $${condicoes.length + 1}`);
      valores.push(filtros.inicio);
    }
    if (filtros.fim) {
      condicoes.push(`i.date_utc <= $${condicoes.length + 1}`);
      valores.push(filtros.fim);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT i.*, a.icao_code, a.name AS airport_name
       FROM wildlife.fact_inspection i
       JOIN wildlife.airport a ON a.airport_id = i.airport_id
       ${where}
       ORDER BY i.date_utc DESC, i.start_time NULLS LAST
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/inspecoes', async (request, reply) => {
    const body = inspectionSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_inspection
        (airport_id, inspection_type, date_utc, start_time, end_time, team_name, weather_summary,
         route_summary, grid_refs, reported_by_user_id, reported_by_name, notes, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING inspection_id AS id`,
      [
        body.airport_id,
        body.inspection_type,
        body.date_utc,
        body.start_time ?? null,
        body.end_time ?? null,
        body.team_name ?? null,
        body.weather_summary ?? null,
        body.route_summary ?? null,
        body.grid_refs ?? [],
        body.reported_by_user_id ?? null,
        body.reported_by_name ?? null,
        body.notes ?? null,
        JSON.stringify(body.observations ?? [])
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/inspecoes/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = inspectionSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets: string[] = [];
    const valores: any[] = [];
    pares.forEach(([campo, valor], idx) => {
      let useValor: any = valor;
      if (campo === 'grid_refs' || campo === 'topics') {
        useValor = valor ?? [];
      }
      if (campo === 'observations' || campo === 'participants') {
        useValor = JSON.stringify(valor ?? []);
      }
      sets.push(`${campo}=$${idx + 1}`);
      valores.push(useValor);
    });
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_inspection SET ${sets.join(', ')}, updated_at=now() WHERE inspection_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Inspecao nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/inspecoes/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_inspection WHERE inspection_id=$1', [id]);
    return reply.code(204).send();
  });

  // Carcaças
  app.get('/api/carcacas', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        inicio: z.string().optional(),
        fim: z.string().optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`c.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.inicio) {
      condicoes.push(`c.date_utc >= $${condicoes.length + 1}`);
      valores.push(filtros.inicio);
    }
    if (filtros.fim) {
      condicoes.push(`c.date_utc <= $${condicoes.length + 1}`);
      valores.push(filtros.fim);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT c.*, a.icao_code, l.code AS location_code, sp.common_name AS species_name
       FROM wildlife.fact_carcass c
       JOIN wildlife.airport a ON a.airport_id = c.airport_id
       LEFT JOIN wildlife.dim_location l ON l.location_id = c.location_id
       LEFT JOIN wildlife.dim_species sp ON sp.species_id = c.species_id
       ${where}
       ORDER BY c.date_utc DESC, c.time_local DESC NULLS LAST
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/carcacas', async (request, reply) => {
    const body = carcassSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_carcass (
        airport_id, date_utc, time_local, location_id, quadrant, latitude_dec, longitude_dec,
        species_id, species_guess, quantity, mass_grams, photo_url, dna_collected,
        storage_method, destination, destination_detail, handled_by, bag_tag, notified_sigra, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING carcass_id AS id`,
      [
        body.airport_id,
        body.date_utc,
        body.time_local ?? null,
        body.location_id ?? null,
        body.quadrant ?? null,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.species_id ?? null,
        body.species_guess ?? null,
        body.quantity ?? null,
        body.mass_grams ?? null,
        body.photo_url ?? null,
        body.dna_collected ?? null,
        body.storage_method ?? null,
        body.destination ?? null,
        body.destination_detail ?? null,
        body.handled_by ?? null,
        body.bag_tag ?? null,
        body.notified_sigra ?? null,
        body.notes ?? null
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/carcacas/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = carcassSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_carcass SET ${sets.join(', ')}, updated_at=now() WHERE carcass_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Carcaca nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/carcacas/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_carcass WHERE carcass_id=$1', [id]);
    return reply.code(204).send();
  });

  // Auditorias ambientais
  app.get('/api/auditorias-ambientais', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        categoria: z.enum(['residuos', 'esgoto', 'sistema_protecao', 'foco_secundario', 'outro']).optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`ea.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.categoria) {
      condicoes.push(`ea.category=$${condicoes.length + 1}`);
      valores.push(filtros.categoria);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT ea.*, a.icao_code
       FROM wildlife.fact_environment_audit ea
       JOIN wildlife.airport a ON a.airport_id = ea.airport_id
       ${where}
       ORDER BY ea.date_utc DESC
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/auditorias-ambientais', async (request, reply) => {
    const body = auditSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_environment_audit (
        airport_id, date_utc, category, area_reference, status, findings, actions_planned,
        responsible_party, follow_up_date, attachments, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      ) RETURNING audit_id AS id`,
      [
        body.airport_id,
        body.date_utc,
        body.category,
        body.area_reference ?? null,
        body.status ?? null,
        body.findings ?? null,
        body.actions_planned ?? null,
        body.responsible_party ?? null,
        body.follow_up_date ?? null,
        JSON.stringify(body.attachments ?? []),
        body.notes ?? null
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/auditorias-ambientais/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = auditSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets: string[] = [];
    const valores: any[] = [];
    pares.forEach(([campo, valor], idx) => {
      const useValor = campo === 'attachments' ? JSON.stringify(valor ?? []) : valor;
      sets.push(`${campo}=$${idx + 1}`);
      valores.push(useValor);
    });
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_environment_audit SET ${sets.join(', ')}, updated_at=now() WHERE audit_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Auditoria nao encontrada' });
    }
    return { id };
  });

  app.delete('/api/auditorias-ambientais/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_environment_audit WHERE audit_id=$1', [id]);
    return reply.code(204).send();
  });

  // Focos ASA
  app.get('/api/asa-focos', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        status: z.enum(['monitorado', 'em_gestao', 'mitigado']).optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`f.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.status) {
      condicoes.push(`f.status=$${condicoes.length + 1}`);
      valores.push(filtros.status);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT f.*, a.icao_code
       FROM wildlife.fact_asa_focus f
       JOIN wildlife.airport a ON a.airport_id = f.airport_id
       ${where}
       ORDER BY f.updated_at DESC
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/asa-focos', async (request, reply) => {
    const body = asaFocusSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_asa_focus (
        airport_id, municipality, focus_type, description, latitude_dec, longitude_dec,
        distance_km, status, responsible_org, notified_at, next_follow_up, protocol_ref, notes, attachments
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      ) RETURNING asa_focus_id AS id`,
      [
        body.airport_id,
        body.municipality ?? null,
        body.focus_type ?? null,
        body.description ?? null,
        body.latitude_dec ?? null,
        body.longitude_dec ?? null,
        body.distance_km ?? null,
        body.status ?? null,
        body.responsible_org ?? null,
        body.notified_at ?? null,
        body.next_follow_up ?? null,
        body.protocol_ref ?? null,
        body.notes ?? null,
        JSON.stringify(body.attachments ?? [])
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/asa-focos/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = asaFocusSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets: string[] = [];
    const valores: any[] = [];
    pares.forEach(([campo, valor], idx) => {
      const useValor = campo === 'attachments' ? JSON.stringify(valor ?? []) : valor;
      sets.push(`${campo}=$${idx + 1}`);
      valores.push(useValor);
    });
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_asa_focus SET ${sets.join(', ')}, updated_at=now() WHERE asa_focus_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Foco nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/asa-focos/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_asa_focus WHERE asa_focus_id=$1', [id]);
    return reply.code(204).send();
  });

  // Comunicações externas
  app.get('/api/comunicados-externos', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        status: z.enum(['enviado', 'em_andamento', 'respondido', 'encerrado']).optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`n.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    if (filtros.status) {
      condicoes.push(`n.status=$${condicoes.length + 1}`);
      valores.push(filtros.status);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT n.*, f.municipality, a.icao_code
       FROM wildlife.fact_external_notice n
       JOIN wildlife.airport a ON a.airport_id = n.airport_id
       LEFT JOIN wildlife.fact_asa_focus f ON f.asa_focus_id = n.asa_focus_id
       ${where}
       ORDER BY n.sent_at DESC NULLS LAST
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/comunicados-externos', async (request, reply) => {
    const body = noticeSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_external_notice (
        airport_id, asa_focus_id, target_entity, subject, protocol_code, status,
        sent_at, response_due_at, response_received_at, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      ) RETURNING notice_id AS id`,
      [
        body.airport_id,
        body.asa_focus_id ?? null,
        body.target_entity,
        body.subject ?? null,
        body.protocol_code ?? null,
        body.status ?? null,
        body.sent_at ?? null,
        body.response_due_at ?? null,
        body.response_received_at ?? null,
        body.notes ?? null
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/comunicados-externos/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = noticeSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets = pares.map(([campo], idx) => `${campo}=$${idx + 1}`);
    const valores = pares.map(([, valor]) => valor);
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_external_notice SET ${sets.join(', ')}, updated_at=now() WHERE notice_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Comunicado nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/comunicados-externos/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_external_notice WHERE notice_id=$1', [id]);
    return reply.code(204).send();
  });

  // Treinamentos
  app.get('/api/treinamentos-fauna', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional()
      })
      .parse(request.query ?? {});
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (filtros.airportId) {
      condicoes.push(`t.airport_id=$${condicoes.length + 1}`);
      valores.push(filtros.airportId);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT t.*, a.icao_code
       FROM wildlife.fact_training_session t
       JOIN wildlife.airport a ON a.airport_id = t.airport_id
       ${where}
       ORDER BY t.start_date DESC
       LIMIT 200`,
      valores
    );
    return rows;
  });

  app.post('/api/treinamentos-fauna', async (request, reply) => {
    const body = trainingSchema.parse(request.body);
    const { rows } = await db.query(
      `INSERT INTO wildlife.fact_training_session (
        airport_id, title, audience, start_date, end_date, hours_total,
        delivery_mode, instructor, topics, participants, materials_url, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      ) RETURNING training_id AS id`,
      [
        body.airport_id,
        body.title,
        body.audience ?? null,
        body.start_date,
        body.end_date ?? null,
        body.hours_total ?? null,
        body.delivery_mode ?? null,
        body.instructor ?? null,
        body.topics ?? [],
        JSON.stringify(body.participants ?? []),
        body.materials_url ?? null,
        body.notes ?? null
      ]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  app.put('/api/treinamentos-fauna/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = trainingSchema.partial().parse(request.body ?? {});
    const pares = Object.entries(body).filter(([, valor]) => valor !== undefined);
    if (!pares.length) {
      return reply.code(400).send({ mensagem: 'Nenhum campo informado' });
    }
    const sets: string[] = [];
    const valores: any[] = [];
    pares.forEach(([campo, valor], idx) => {
      let useValor: any = valor;
      if (campo === 'topics') {
        useValor = valor ?? [];
      }
      if (campo === 'participants') {
        useValor = JSON.stringify(valor ?? []);
      }
      sets.push(`${campo}=$${idx + 1}`);
      valores.push(useValor);
    });
    valores.push(id);
    const { rowCount } = await db.query(
      `UPDATE wildlife.fact_training_session SET ${sets.join(', ')}, updated_at=now() WHERE training_id=$${valores.length}`,
      valores
    );
    if (!rowCount) {
      return reply.code(404).send({ mensagem: 'Treinamento nao encontrado' });
    }
    return { id };
  });

  app.delete('/api/treinamentos-fauna/:id', async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.query('DELETE FROM wildlife.fact_training_session WHERE training_id=$1', [id]);
    return reply.code(204).send();
  });
}
