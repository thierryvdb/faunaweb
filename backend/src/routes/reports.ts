import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, ImageRun, Packer, Paragraph } from 'docx';
import sharp from 'sharp';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { db } from '../services/db';
import {
  FinanceiroDataset,
  FinanceiroAgrupamentoItem,
  FinanceiroAgrupamentos,
  gerarFinanceiroDataset
} from '../services/financeiro';

const periodoSchema = z.object({
  airportId: z.coerce.number().optional(),
  inicio: z.string().optional(),
  fim: z.string().optional()
});

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export async function reportsRoutes(app: FastifyInstance) {
  app.get('/api/relatorios/pareto-especies', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, COALESCE(ds.common_name, 'Nao identificada') AS especie, COUNT(*)::bigint AS strikes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.dim_species ds ON ds.species_id = s.species_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, especie
       ORDER BY strikes DESC`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return { periodo: { inicio, fim }, dados: rows };
  });

  app.get('/api/relatorios/fases-voo', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, pf.name AS fase_voo, COUNT(*)::bigint AS strikes
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.lu_phase_of_flight pf ON pf.phase_id = s.phase_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, pf.name
       ORDER BY strikes DESC`,
      [filtros.airportId ?? null, inicio, fim]
    );
    return { periodo: { inicio, fim }, dados: rows };
  });

  app.get('/api/relatorios/partes-dano', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const { rows } = await db.query(
      `SELECT s.airport_id, ph.name AS parte,
              COUNT(*) FILTER (WHERE d.name IS DISTINCT FROM 'Sem dano')::bigint AS eventos_com_dano,
              COUNT(*)::bigint AS eventos_total
       FROM wildlife.fact_strike s
       LEFT JOIN wildlife.lu_part_hit ph ON ph.part_id = s.part_id
       LEFT JOIN wildlife.lu_damage_class d ON d.damage_id = s.damage_id
       WHERE s.date_utc BETWEEN $2 AND $3 AND ($1::bigint IS NULL OR s.airport_id=$1)
       GROUP BY s.airport_id, ph.name
       ORDER BY eventos_com_dano DESC NULLS LAST`,
      [filtros.airportId ?? null, inicio, fim]
    );
    const dados = rows.map((row) => {
      const total = Number(row.eventos_total ?? 0);
      const comDano = Number(row.eventos_com_dano ?? 0);
      return {
        ...row,
        pct_com_dano: total > 0 ? Number((comDano / total) * 100).toFixed(2) : null
      };
    });
    return { periodo: { inicio, fim }, dados };
  });

  app.get('/api/relatorios/ba-janela', async (request) => {
    const filtros = z.object({ airportId: z.coerce.number().optional() }).parse(request.query ?? {});
    const { rows } = await db.query(
      `SELECT * FROM wildlife_kpi.kpi_ba_sr_tah WHERE $1::bigint IS NULL OR airport_id=$1 ORDER BY action_id DESC`,
      [filtros.airportId ?? null]
    );
    return { janela_padrao_dias: 30, dados: rows };
  });

  app.get('/api/relatorios/movimentos-periodo', async (request) => {
    const filtros = z
      .object({
        airportId: z.coerce.number().optional(),
        anoInicial: z.coerce.number().int().min(2000),
        anoFinal: z.coerce.number().int().min(2000)
      })
      .refine((dados) => dados.anoInicial <= dados.anoFinal, {
        message: 'anoInicial deve ser menor ou igual a anoFinal',
        path: ['anoInicial']
      })
      .parse(request.query ?? {});

    const inicioConsulta = `${filtros.anoInicial - 1}-01-01`;
    const fimConsulta = `${filtros.anoFinal + 1}-01-01`;

    const { rows } = await db.query(
      `SELECT
         EXTRACT(YEAR FROM m.day)::int AS ano,
         EXTRACT(MONTH FROM m.day)::int AS mes,
         SUM(m.movements)::bigint AS total
       FROM wildlife_kpi.v_movements_daily m
       WHERE m.day >= $2::date
         AND m.day < $3::date
         AND ($1::bigint IS NULL OR m.airport_id = $1)
       GROUP BY 1, 2`,
      [filtros.airportId ?? null, inicioConsulta, fimConsulta]
    );

    const totaisPorMes = new Map<string, number>();
    for (const row of rows) {
      const chave = `${row.ano}-${row.mes}`;
      totaisPorMes.set(chave, Number(row.total ?? 0));
    }

    const meses: Array<{ ano: number; mes: number; mes_nome: string; total: number }> = [];
    for (let ano = filtros.anoInicial; ano <= filtros.anoFinal; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        const chave = `${ano}-${mes}`;
        meses.push({
          ano,
          mes,
          mes_nome: NOMES_MESES[mes - 1],
          total: totaisPorMes.get(chave) ?? 0
        });
      }
    }

    const calcularVariacao = (atual: number, anterior: number) => {
      if (anterior === 0) {
        return null;
      }
      return Number((((atual - anterior) / anterior) * 100).toFixed(2));
    };

    const montarComparativo = (anoBase: number) => {
      const anoReferencia = anoBase - 1;
      const mesesComparativo = [];
      for (let mes = 1; mes <= 12; mes++) {
        const atual = totaisPorMes.get(`${anoBase}-${mes}`) ?? 0;
        const referencia = totaisPorMes.get(`${anoReferencia}-${mes}`) ?? 0;
        mesesComparativo.push({
          mes,
          mes_nome: NOMES_MESES[mes - 1],
          total_atual: atual,
          total_referencia: referencia,
          variacao_pct: calcularVariacao(atual, referencia)
        });
      }
      return {
        ano: anoBase,
        ano_referencia: anoReferencia,
        meses: mesesComparativo
      };
    };

    const comparativos = [];
    for (let ano = filtros.anoInicial; ano <= filtros.anoFinal; ano++) {
      comparativos.push(montarComparativo(ano));
    }

    return {
      periodo: {
        anoInicial: filtros.anoInicial,
        anoFinal: filtros.anoFinal
      },
      meses,
      comparativos
    };
  });

  app.get('/api/relatorios/financeiro/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dataset = await gerarFinanceiroDataset({
      airportId: filtros.airportId ?? null,
      inicio,
      fim
    });
    const nomeBase = `relatorio-financeiro-${inicio}-a-${fim}`;
    if (filtros.formato === 'pdf') {
      const buffer = await gerarPdfFinanceiroRelatorio(dataset, { inicio, fim });
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${nomeBase}.pdf"`);
      return reply.send(buffer);
    }
    const buffer = await gerarDocxFinanceiroRelatorio(dataset, { inicio, fim });
    reply.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    reply.header('Content-Disposition', `attachment; filename="${nomeBase}.docx"`);
    return reply.send(buffer);
  });

  app.get('/api/relatorios/colisoes-imagens', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dados = await buscarColisoesComImagens(filtros.airportId ?? null, inicio, fim);
    const resposta = dados.map((item) => {
      const { photo_blob, fotos, ...resto } = item;
      const fotosBase64 = fotos.map((foto) => bufferParaBase64(foto.blob, foto.mime));
      return {
        ...resto,
        foto_base64: fotosBase64[0] ?? (photo_blob ? bufferParaBase64(photo_blob, item.photo_mime) : null),
        fotos_base64: fotosBase64
      };
    });
    return {
      periodo: { inicio, fim },
      total: resposta.length,
      dados: resposta
    };
  });

  app.get('/api/relatorios/colisoes-imagens/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dados = await buscarColisoesComImagens(filtros.airportId ?? null, inicio, fim);
    if (!dados.length) {
      return reply.code(404).send({ mensagem: 'Nenhuma colisao encontrada para o periodo informado' });
    }
    const nomeArquivoBase = `relatorio-colisoes-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxColisoes(dados, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }
    const buffer = await gerarPdfColisoes(dados, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });

  // TODO: Implement incident export functions (obterAnaliseIncidentes, gerarDocxIncidentes, gerarPdfIncidentes)
  // app.get('/api/relatorios/incidentes/export', async (request, reply) => {
  //   const filtros = periodoSchema
  //     .extend({
  //       formato: z.enum(['pdf', 'docx'])
  //     })
  //     .parse(request.query ?? {});
  //   const { inicio, fim } = periodosComDefaults(filtros);
  //   const dados = await obterAnaliseIncidentes(filtros.airportId ?? null, inicio, fim);
  //   const possuiDados = Object.values(dados).some((lista) => lista.length);
  //   if (!possuiDados) {
  //     return reply.code(404).send({ mensagem: 'Sem dados para o período informado' });
  //   }
  //   const nomeArquivoBase = `analise-incidentes-${inicio}-a-${fim}`;
  //   if (filtros.formato === 'docx') {
  //     const buffer = await gerarDocxIncidentes(dados, { inicio, fim });
  //     reply.header(
  //       'Content-Type',
  //       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  //     );
  //     reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
  //     return reply.send(buffer);
  //   }
  //   const buffer = await gerarPdfIncidentes(dados, { inicio, fim });
  //   reply.header('Content-Type', 'application/pdf');
  //   reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
  //   return reply.send(buffer);
  // });

  // Exportação PDF de Inspeções Diárias
  app.get('/api/relatorios/inspecoes-diarias/export', async (request, reply) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    // Buscar inspeções do período
    let whereClause = 'WHERE i.inspection_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND i.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             p.name AS period_name,
             w.name AS weather_name,
             (SELECT json_agg(json_build_object(
               'location_type_name', lt.name,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_code', q.code,
               'notes', obs.notes
             ))
             FROM wildlife.fact_daily_inspection_aerodrome_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS aerodrome_observations,

             (SELECT json_agg(json_build_object(
               'location_type_name', lt.name,
               'species_name', s.common_name,
               'species_text', obs.species_text,
               'quantity', obs.quantity,
               'quadrant_code', q.code
             ))
             FROM wildlife.fact_daily_inspection_site_area obs
             LEFT JOIN wildlife.lu_inspection_location_type lt ON lt.location_type_id = obs.location_type_id
             LEFT JOIN wildlife.dim_species s ON s.species_id = obs.species_id
             LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = obs.quadrant_id
             WHERE obs.inspection_id = i.inspection_id) AS site_observations,

             (SELECT json_agg(json_build_object(
               'location_text', n.location_text,
               'area_type', n.area_type,
               'has_eggs', n.has_eggs,
               'egg_count', n.egg_count
             ))
             FROM wildlife.fact_daily_inspection_nest n
             WHERE n.inspection_id = i.inspection_id) AS nests,

             (SELECT json_agg(json_build_object(
               'location_text', c.location_text,
               'species_name', s.common_name,
               'species_text', c.species_text,
               'photographed', c.photographed,
               'destination_name', d.name
             ))
             FROM wildlife.fact_daily_inspection_carcass c
             LEFT JOIN wildlife.dim_species s ON s.species_id = c.species_id
             LEFT JOIN wildlife.lu_carcass_destination d ON d.destination_id = c.destination_id
             WHERE c.inspection_id = i.inspection_id) AS carcasses,

             (SELECT json_build_object(
               'dispersal_performed', m.dispersal_performed,
               'capture_performed', m.capture_performed,
               'species_involved', m.species_involved,
               'techniques', (
                 SELECT string_agg(t.name, ', ')
                 FROM wildlife.fact_daily_inspection_management_technique mt
                 JOIN wildlife.lu_management_technique t ON t.technique_id = mt.technique_id
                 WHERE mt.management_id = m.management_id
               )
             )
             FROM wildlife.fact_daily_inspection_management m
             WHERE m.inspection_id = i.inspection_id) AS management

      FROM wildlife.fact_daily_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_inspection_period p ON p.period_id = i.period_id
      LEFT JOIN wildlife.lu_weather_condition w ON w.weather_id = i.weather_id
      ${whereClause}
      ORDER BY i.inspection_date DESC, i.inspection_time DESC
    `;

    const result = await db.query(query, params);
    const inspecoes = result.rows;

    if (!inspecoes.length) {
      return reply.code(404).send({ mensagem: 'Nenhuma inspeção encontrada para o período informado' });
    }

    const buffer = await gerarPdfInspecoesDiarias(inspecoes, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=inspecoes-diarias-${inicio}-a-${fim}.pdf`);
    return reply.send(buffer);
  });

  // Exportação PDF/DOCX de Inspeções de Proteção (F4)
  app.get('/api/relatorios/inspecoes-protecao/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    let whereClause = 'WHERE i.inspection_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND i.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             s.name AS season_name,
             (SELECT json_agg(json_build_object(
               'location_text', fo.location_text,
               'repair_performed', fo.repair_performed,
               'repair_date', fo.repair_date,
               'irregular_waste_present', fo.irregular_waste_present,
               'waste_removed', fo.waste_removed,
               'notes', fo.notes,
               'occurrence_types', (
                 SELECT string_agg(ft.name, ', ')
                 FROM wildlife.fact_protection_fence_occurrence_type fot
                 JOIN wildlife.lu_fence_occurrence_type ft ON ft.occurrence_type_id = fot.occurrence_type_id
                 WHERE fot.occurrence_id = fo.occurrence_id
               )
             ))
             FROM wildlife.fact_protection_fence_occurrence fo
             WHERE fo.inspection_id = i.inspection_id) AS fence_occurrences,

             (SELECT json_agg(json_build_object(
               'location_text', go.location_text,
               'other_occurrence', go.other_occurrence,
               'repair_performed', go.repair_performed,
               'repair_date', go.repair_date,
               'irregular_waste_present', go.irregular_waste_present,
               'waste_removed', go.waste_removed,
               'notes', go.notes,
               'occurrence_types', (
                 SELECT string_agg(gt.name, ', ')
                 FROM wildlife.fact_protection_gate_occurrence_type got
                 JOIN wildlife.lu_gate_occurrence_type gt ON gt.occurrence_type_id = got.occurrence_type_id
                 WHERE got.occurrence_id = go.occurrence_id
               )
             ))
             FROM wildlife.fact_protection_gate_occurrence go
             WHERE go.inspection_id = i.inspection_id) AS gate_occurrences

      FROM wildlife.fact_protection_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      ${whereClause}
      ORDER BY i.inspection_date DESC
    `;

    const result = await db.query(query, params);
    const inspecoes = result.rows;

    if (!inspecoes.length) {
      return reply.code(404).send({ mensagem: 'Nenhuma inspeção encontrada para o período informado' });
    }

    const nomeArquivoBase = `inspecoes-protecao-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxInspecoesProtecao(inspecoes, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }

    const buffer = await gerarPdfInspecoesProtecao(inspecoes, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });

  // Exportação PDF/DOCX de Coletas de Carcaça (F5)
  app.get('/api/relatorios/coletas-carcaca/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    let whereClause = 'WHERE c.collection_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND c.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT c.*,
             a.icao_code,
             a.name AS airport_name,
             q.code AS quadrant_code
      FROM wildlife.fact_carcass_collection c
      LEFT JOIN wildlife.airport a ON a.airport_id = c.airport_id
      LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = c.quadrant_id
      ${whereClause}
      ORDER BY c.collection_date DESC
    `;

    const result = await db.query(query, params);
    const coletas = result.rows;

    if (!coletas.length) {
      return reply.code(404).send({ mensagem: 'Nenhuma coleta encontrada para o período informado' });
    }

    const nomeArquivoBase = `coletas-carcaca-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxColetasCarcaca(coletas, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }

    const buffer = await gerarPdfColetasCarcaca(coletas, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });

  // Exportação PDF/DOCX de Inspeções de Lagos
  app.get('/api/relatorios/inspecoes-lagos/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    let whereClause = 'WHERE i.inspection_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND i.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             s.name as season_name,
             q.code as quadrant_code,
             (SELECT COUNT(*) FROM wildlife.fact_lake_inspection_photo p WHERE p.inspection_id = i.inspection_id) as photo_count
      FROM wildlife.fact_lake_inspection i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      LEFT JOIN wildlife.lu_quadrant q ON q.quadrant_id = i.quadrant_id
      ${whereClause}
      ORDER BY i.inspection_date DESC
    `;

    const result = await db.query(query, params);
    const inspecoes = result.rows;

    if (!inspecoes.length) {
      return reply.code(404).send({ mensagem: 'Nenhuma inspeção encontrada para o período informado' });
    }

    const nomeArquivoBase = `inspecoes-lagos-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxInspecoesLagos(inspecoes, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }

    const buffer = await gerarPdfInspecoesLagos(inspecoes, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });

  // Exportação PDF/DOCX de Manutenção de Áreas Verdes (F2)
  app.get('/api/relatorios/inspecoes-areas-verdes/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    let whereClause = 'WHERE i.record_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND i.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT i.*,
             a.icao_code,
             a.name AS airport_name,
             s.name as season_name
      FROM wildlife.fact_green_area_maintenance i
      LEFT JOIN wildlife.airport a ON a.airport_id = i.airport_id
      LEFT JOIN wildlife.lu_year_season s ON s.season_id = i.season_id
      ${whereClause}
      ORDER BY i.record_date DESC
    `;

    const result = await db.query(query, params);
    const inspecoes = result.rows;

    if (!inspecoes.length) {
      return reply.code(404).send({ mensagem: 'Nenhum registro encontrado para o período informado' });
    }

    const nomeArquivoBase = `manutencao-areas-verdes-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxInspecoesAreasVerdes(inspecoes, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }

    const buffer = await gerarPdfInspecoesAreasVerdes(inspecoes, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });

  // Exportação PDF/DOCX de Resíduos para Incineração
  app.get('/api/relatorios/residuos-incineracao/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);

    let whereClause = 'WHERE w.record_date BETWEEN $1 AND $2';
    const params: any[] = [inicio, fim];

    if (filtros.airportId) {
      whereClause += ' AND w.airport_id = $3';
      params.push(filtros.airportId);
    }

    const query = `
      SELECT w.*,
             a.icao_code,
             a.name AS airport_name,
             ps.name AS physical_state_name,
             tr.name AS treatment_name
      FROM wildlife.fact_incineration_waste w
      LEFT JOIN wildlife.airport a ON a.airport_id = w.airport_id
      LEFT JOIN wildlife.lu_waste_physical_state ps ON ps.state_id = w.physical_state_id
      LEFT JOIN wildlife.lu_waste_treatment_type tr ON tr.treatment_id = w.treatment_id
      ${whereClause}
      ORDER BY w.record_date DESC
    `;

    const result = await db.query(query, params);
    const residuos = result.rows;

    if (!residuos.length) {
      return reply.code(404).send({ mensagem: 'Nenhum resíduo encontrado para o período informado' });
    }

    const nomeArquivoBase = `residuos-incineracao-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxResiduosIncineracao(residuos, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }

    const buffer = await gerarPdfResiduosIncineracao(residuos, { inicio, fim });
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.pdf`);
    return reply.send(buffer);
  });
}

function periodosComDefaults(filtros: { inicio?: string; fim?: string }) {
  const hoje = new Date();
  return {
    inicio: filtros.inicio ?? new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10),
    fim: filtros.fim ?? new Date(hoje.getFullYear(), 11, 31).toISOString().slice(0, 10)
  };
}

type FotoRelatorio = {
  blob: Buffer;
  mime: string | null;
  filename: string | null;
};

type ColisaoImagem = {
  id: number;
  date_utc: string;
  time_local: string | null;
  event_type: string | null;
  airport_id: number;
  aeroporto: string | null;
  location_id: number;
  location_nome: string | null;
  especie: string | null;
  dano: string | null;
  notes: string | null;
  photo_url: string | null;
  photo_filename: string | null;
  photo_mime: string | null;
  photo_blob: Buffer | null;
  fotos: FotoRelatorio[];
};

async function buscarColisoesComImagens(airportId: number | null, inicio: string, fim: string): Promise<ColisaoImagem[]> {
  const { rows } = await db.query(
    `SELECT s.strike_id,
            s.date_utc,
            s.time_local,
            s.event_type,
            s.airport_id,
            a.name AS aeroporto,
            s.location_id,
            COALESCE(l.code, CONCAT('ID ', s.location_id::text)) AS location_nome,
            ds.common_name AS especie,
            d.name AS dano,
            s.notes,
            s.photo_url,
            s.photo_filename,
            s.photo_mime,
            s.photo_blob
     FROM wildlife.fact_strike s
     LEFT JOIN wildlife.airport a ON a.airport_id = s.airport_id
     LEFT JOIN wildlife.dim_location l ON l.location_id = s.location_id
     LEFT JOIN wildlife.dim_species ds ON ds.species_id = s.species_id
     LEFT JOIN wildlife.lu_damage_class d ON d.damage_id = s.damage_id
     WHERE s.date_utc BETWEEN $2 AND $3
       AND ($1::bigint IS NULL OR s.airport_id = $1)
     ORDER BY s.date_utc DESC, s.time_local DESC NULLS LAST
     LIMIT 400`,
    [airportId ?? null, inicio, fim]
  );

  const itens = rows.map((row: any) => ({
    id: Number(row.strike_id),
    date_utc: formatarData(row.date_utc),
    time_local: formatarHora(row.time_local),
    event_type: row.event_type,
    airport_id: Number(row.airport_id),
    aeroporto: row.aeroporto ?? null,
    location_id: Number(row.location_id),
    location_nome: row.location_nome ?? null,
    especie: row.especie ?? null,
    dano: row.dano ?? null,
    notes: row.notes ?? null,
    photo_url: row.photo_url ?? null,
    photo_filename: row.photo_filename ?? null,
    photo_mime: row.photo_mime ?? null,
    photo_blob: row.photo_blob ?? null,
    fotos: [] as FotoRelatorio[]
  }));

  if (!itens.length) {
    return itens;
  }

  const ids = itens.map((item) => item.id);
  const mapa = new Map<number, ColisaoImagem>();
  itens.forEach((item) => mapa.set(item.id, item));

  const { rows: fotosExtra } = await db.query(
    `SELECT strike_id, foto_idx, photo_blob, photo_filename, photo_mime
     FROM wildlife.fact_strike_foto
     WHERE strike_id = ANY($1::bigint[])
     ORDER BY strike_id, foto_idx`,
    [ids]
  );

  for (const foto of fotosExtra) {
    if (!foto.photo_blob) continue;
    const alvo = mapa.get(Number(foto.strike_id));
    if (!alvo) continue;
    alvo.fotos.push({
      blob: foto.photo_blob,
      filename: foto.photo_filename ?? null,
      mime: foto.photo_mime ?? null
    });
  }

  for (const item of itens) {
    if (!item.fotos.length && item.photo_blob) {
      item.fotos.push({
        blob: item.photo_blob,
        filename: item.photo_filename ?? null,
        mime: item.photo_mime ?? null
      });
    }
  }

  return itens;
}

function formatarData(valor: any) {
  if (!valor) return '';
  if (typeof valor === 'string') return valor.slice(0, 10);
  return new Date(valor).toISOString().slice(0, 10);
}

function formatarHora(valor: any) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.slice(0, 8);
  if (valor instanceof Date) {
    return valor.toISOString().slice(11, 19);
  }
  return null;
}

function bufferParaBase64(buffer: Buffer, mime?: string | null) {
  const tipo = mime || 'image/jpeg';
  return `data:${tipo};base64,${buffer.toString('base64')}`;
}

const REPORT_IMAGE_WIDTH = 800;
const REPORT_IMAGE_HEIGHT = 600;
const REPORT_CHART_WIDTH = 800;
const REPORT_CHART_HEIGHT = 400;

const graficoColisoesRenderer = new ChartJSNodeCanvas({
  width: REPORT_CHART_WIDTH,
  height: REPORT_CHART_HEIGHT,
  backgroundColour: 'white'
});

async function prepararImagemParaRelatorio(foto: FotoRelatorio) {
  if (!foto?.blob) return null;
  try {
    return await sharp(foto.blob)
      .resize(REPORT_IMAGE_WIDTH, REPORT_IMAGE_HEIGHT, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();
  } catch {
    return foto.blob;
  }
}

function gerarSerieColisoesPorDia(colisoes: ColisaoImagem[]) {
  const mapa = new Map<string, number>();
  for (const item of colisoes) {
    if (!item.date_utc) continue;
    mapa.set(item.date_utc, (mapa.get(item.date_utc) ?? 0) + 1);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, total]) => ({ data, total }));
}

async function gerarGraficoColisoes(colisoes: ColisaoImagem[]) {
  const serie = gerarSerieColisoesPorDia(colisoes);
  if (!serie.length) return null;
  const labels = serie.map((p) => p.data);
  const valores = serie.map((p) => p.total);
  const configuracao: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Colisões',
          data: valores,
          backgroundColor: '#0ea5e9'
        }
      ]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: {
        x: {
          ticks: { font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  };
  return graficoColisoesRenderer.renderToBuffer(configuracao);
}

async function gerarDocxColisoes(colisoes: ColisaoImagem[], periodo: { inicio: string; fim: string }) {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Relatorio de colisoes com imagens',
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph(`Periodo: ${periodo.inicio} a ${periodo.fim}`),
    new Paragraph(' ')
  ];
  const graficoBuffer = await gerarGraficoColisoes(colisoes);

  for (const item of colisoes) {
    children.push(
      new Paragraph({
        text: `Colisao #${item.id}`,
        heading: HeadingLevel.HEADING_2
      })
    );
    children.push(new Paragraph(`Data/Hora: ${item.date_utc} ${item.time_local ?? ''}`));
    children.push(new Paragraph(`Aeroporto: ${item.aeroporto ?? item.airport_id}`));
    children.push(new Paragraph(`Local: ${item.location_nome ?? item.location_id}`));
    children.push(new Paragraph(`Evento: ${item.event_type ?? 'n/d'}`));
    children.push(new Paragraph(`Especie: ${item.especie ?? 'Nao informada'}`));
    children.push(new Paragraph(`Dano: ${item.dano ?? 'Nao informado'}`));
    if (item.notes) {
      children.push(new Paragraph(`Notas: ${item.notes}`));
    }
    const fotosParaRenderizar = item.fotos.length
      ? item.fotos
      : item.photo_blob
      ? [
          {
            blob: item.photo_blob,
            mime: item.photo_mime ?? null,
            filename: item.photo_filename ?? null
          }
        ]
      : [];

    if (fotosParaRenderizar.length) {
      for (const foto of fotosParaRenderizar) {
        const imagemBuffer = await prepararImagemParaRelatorio(foto);
        if (!imagemBuffer) continue;
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imagemBuffer,
                transformation: { width: REPORT_IMAGE_WIDTH, height: REPORT_IMAGE_HEIGHT }
              })
            ]
          })
        );
      }
    } else if (item.photo_url) {
      children.push(new Paragraph(`Foto (URL): ${item.photo_url}`));
    } else {
      children.push(new Paragraph('Sem imagem fornecida.'));
    }
    children.push(new Paragraph(' '));
  }

  if (graficoBuffer) {
    children.push(
      new Paragraph({
        text: 'Gráfico de colisões por dia',
        heading: HeadingLevel.HEADING_2
      })
    );
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: graficoBuffer,
            transformation: { width: REPORT_CHART_WIDTH, height: REPORT_CHART_HEIGHT }
          })
        ]
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

async function gerarPdfColisoes(colisoes: ColisaoImagem[], periodo: { inicio: string; fim: string }) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      doc.fontSize(18).text('Relatorio de colisoes com imagens', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Periodo: ${periodo.inicio} a ${periodo.fim}`);
      const graficoBuffer = await gerarGraficoColisoes(colisoes);

      for (let index = 0; index < colisoes.length; index++) {
        const item = colisoes[index];
        if (index > 0) {
          doc.addPage();
        } else {
          doc.moveDown();
        }
        doc.fontSize(14).text(`Colisao #${item.id}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Data/Hora: ${item.date_utc} ${item.time_local ?? ''}`);
        doc.text(`Aeroporto: ${item.aeroporto ?? item.airport_id}`);
        doc.text(`Local: ${item.location_nome ?? item.location_id}`);
        doc.text(`Evento: ${item.event_type ?? 'n/d'}`);
        doc.text(`Especie: ${item.especie ?? 'Nao informada'}`);
        doc.text(`Dano: ${item.dano ?? 'Nao informado'}`);
        if (item.notes) {
          doc.text(`Notas: ${item.notes}`);
        }
        doc.moveDown(0.5);
        const fotosParaRenderizar = item.fotos.length
          ? item.fotos
          : item.photo_blob
          ? [
              {
                blob: item.photo_blob,
                mime: item.photo_mime ?? null,
                filename: item.photo_filename ?? null
              }
            ]
          : [];

        if (fotosParaRenderizar.length) {
          for (const foto of fotosParaRenderizar) {
            const imagemBuffer = await prepararImagemParaRelatorio(foto);
            if (!imagemBuffer) continue;
            try {
              doc.image(imagemBuffer, { fit: [REPORT_IMAGE_WIDTH, REPORT_IMAGE_HEIGHT], align: 'center' });
            } catch {
              doc.text('Nao foi possivel exibir a imagem (formato nao suportado).');
            }
            doc.moveDown(0.5);
          }
        } else if (item.photo_url) {
          doc.text(`Foto (URL): ${item.photo_url}`);
        } else {
          doc.text('Sem imagem fornecida.');
        }
      }
      if (graficoBuffer) {
        doc.addPage();
        doc.fontSize(14).text('Gráfico de colisões por dia', { underline: true });
        doc.moveDown();
        try {
          doc.image(graficoBuffer, { fit: [REPORT_CHART_WIDTH, REPORT_CHART_HEIGHT], align: 'center' });
        } catch {
          doc.text('Nao foi possivel exibir o grafico.');
        }
      }
      doc.end();
    };

    processar().catch((err) => {
      reject(err);
    });
  });
}

async function gerarPdfFinanceiroRelatorio(
  dataset: FinanceiroDataset,
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      doc.fontSize(18).text('Indicadores financeiros de colisoes', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Periodo analisado: ${periodo.inicio} a ${periodo.fim}`);
      doc.moveDown();

      doc.fontSize(11);
      doc.text(`Eventos analisados: ${dataset.totais.eventos}`);
      doc.text(`Custo total estimado: ${formatarMoedaBR(dataset.totais.custo_total)}`);
      doc.text(`Custos diretos: ${formatarMoedaBR(dataset.totais.custo_direto)}`);
      doc.text(`Custos indiretos: ${formatarMoedaBR(dataset.totais.custo_indireto)}`);
      doc.text(`Outros custos: ${formatarMoedaBR(dataset.totais.custo_outros)}`);
      doc.moveDown();

      doc.fontSize(14).text('Resumo por ano/categoria/tipo/dano', { underline: true });
      doc.moveDown(0.3);
      if (!dataset.dados.length) {
        doc.fontSize(11).text('Sem registros financeiros no periodo informado.');
      } else {
        doc.fontSize(11);
        for (const linha of dataset.dados.slice(0, 30)) {
          doc.text(
            `${linha.ano} | ${linha.categoria} | ${linha.tipo_incidente} | ${linha.dano} -> Eventos: ${
              linha.eventos
            } | Custo: ${formatarMoedaBR(linha.custo_total)} | Severidade media: ${linha.severidade_media}`
          );
        }
      }

      doc.addPage();
      doc.fontSize(14).text('Distribuicoes financeiras', { underline: true });
      doc.moveDown();
      renderizarAgrupamentoPdf(doc, 'Por tipo de incidente', dataset.agrupamentos.porTipo);
      renderizarAgrupamentoPdf(doc, 'Por categoria taxonomica', dataset.agrupamentos.porCategoria);
      renderizarAgrupamentoPdf(doc, 'Por dano reportado', dataset.agrupamentos.porDano);
      renderizarAgrupamentoPdf(doc, 'Por severidade', dataset.agrupamentos.porSeveridade);

      const graficos = await gerarGraficosFinanceiro(dataset.agrupamentos);
      if (graficos.porTipo || graficos.porCategoria || graficos.porSeveridade) {
        doc.addPage();
        doc.fontSize(14).text('Graficos', { underline: true });
        doc.moveDown();
        if (graficos.porTipo) {
          doc.fontSize(12).text('Custo total por tipo de incidente');
          doc.moveDown(0.3);
          doc.image(graficos.porTipo, { fit: [REPORT_CHART_WIDTH, REPORT_CHART_HEIGHT], align: 'center' });
          doc.moveDown();
        }
        if (graficos.porCategoria) {
          doc.fontSize(12).text('Custo total por categoria taxonomica');
          doc.moveDown(0.3);
          doc.image(graficos.porCategoria, {
            fit: [REPORT_CHART_WIDTH, REPORT_CHART_HEIGHT],
            align: 'center'
          });
          doc.moveDown();
        }
        if (graficos.porSeveridade) {
          doc.fontSize(12).text('Distribuicao por severidade');
          doc.moveDown(0.3);
          doc.image(graficos.porSeveridade, {
            fit: [REPORT_CHART_WIDTH, REPORT_CHART_HEIGHT],
            align: 'center'
          });
          doc.moveDown();
        }
      }

      doc.addPage();
      doc.fontSize(14).text('Incidentes detalhados', { underline: true });
      doc.moveDown();
      if (!dataset.incidentes.length) {
        doc.fontSize(11).text('Nao ha incidentes registrados no periodo informado.');
      } else {
        doc.fontSize(11);
        for (const incidente of dataset.incidentes.slice(0, 40)) {
          doc.text(
            `${incidente.data} ${incidente.hora ?? ''} | ${incidente.tipo_incidente} | ${incidente.dano} | ` +
              `Severidade ${incidente.severidade} | ${formatarMoedaBR(incidente.custo_total)}`
          );
          doc.text(`Descricao: ${incidente.descricao}`);
          doc.moveDown(0.6);
        }
      }

      doc.end();
    };

    processar().catch((err) => {
      reject(err);
    });
  });
}

async function gerarDocxFinanceiroRelatorio(
  dataset: FinanceiroDataset,
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      text: 'Indicadores financeiros de colisoes',
      heading: HeadingLevel.HEADING_1
    })
  );
  children.push(new Paragraph(`Periodo analisado: ${periodo.inicio} a ${periodo.fim}`));
  children.push(new Paragraph(' '));
  children.push(new Paragraph(`Eventos analisados: ${dataset.totais.eventos}`));
  children.push(new Paragraph(`Custo total estimado: ${formatarMoedaBR(dataset.totais.custo_total)}`));
  children.push(new Paragraph(`Custos diretos: ${formatarMoedaBR(dataset.totais.custo_direto)}`));
  children.push(new Paragraph(`Custos indiretos: ${formatarMoedaBR(dataset.totais.custo_indireto)}`));
  children.push(new Paragraph(`Outros custos: ${formatarMoedaBR(dataset.totais.custo_outros)}`));
  children.push(new Paragraph(' '));

  children.push(
    new Paragraph({
      text: 'Resumo por combinacao',
      heading: HeadingLevel.HEADING_2
    })
  );
  if (!dataset.dados.length) {
    children.push(new Paragraph('Sem registros financeiros no periodo.'));
  } else {
    for (const linha of dataset.dados.slice(0, 40)) {
      children.push(
        new Paragraph(
          `${linha.ano} | ${linha.categoria} | ${linha.tipo_incidente} | ${linha.dano} -> Eventos: ${
            linha.eventos
          } | Custo: ${formatarMoedaBR(linha.custo_total)} | Severidade media: ${linha.severidade_media}`
        )
      );
    }
  }
  children.push(new Paragraph(' '));

  children.push(
    new Paragraph({
      text: 'Distribuicoes financeiras',
      heading: HeadingLevel.HEADING_2
    })
  );
  adicionarAgrupamentoDocx(children, 'Por tipo de incidente', dataset.agrupamentos.porTipo);
  adicionarAgrupamentoDocx(children, 'Por categoria taxonomica', dataset.agrupamentos.porCategoria);
  adicionarAgrupamentoDocx(children, 'Por dano reportado', dataset.agrupamentos.porDano);
  adicionarAgrupamentoDocx(children, 'Por severidade', dataset.agrupamentos.porSeveridade);

  const graficos = await gerarGraficosFinanceiro(dataset.agrupamentos);
  if (graficos.porTipo || graficos.porCategoria || graficos.porSeveridade) {
    children.push(new Paragraph(' '));
    children.push(
      new Paragraph({
        text: 'Graficos',
        heading: HeadingLevel.HEADING_2
      })
    );
    if (graficos.porTipo) {
      children.push(new Paragraph('Custo total por tipo de incidente'));
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: graficos.porTipo,
              transformation: { width: REPORT_CHART_WIDTH, height: REPORT_CHART_HEIGHT }
            })
          ]
        })
      );
    }
    if (graficos.porCategoria) {
      children.push(new Paragraph('Custo total por categoria'));
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: graficos.porCategoria,
              transformation: { width: REPORT_CHART_WIDTH, height: REPORT_CHART_HEIGHT }
            })
          ]
        })
      );
    }
    if (graficos.porSeveridade) {
      children.push(new Paragraph('Distribuicao por severidade'));
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: graficos.porSeveridade,
              transformation: { width: REPORT_CHART_WIDTH, height: REPORT_CHART_HEIGHT }
            })
          ]
        })
      );
    }
  }

  children.push(new Paragraph(' '));
  children.push(
    new Paragraph({
      text: 'Incidentes detalhados',
      heading: HeadingLevel.HEADING_2
    })
  );
  if (!dataset.incidentes.length) {
    children.push(new Paragraph('Nao ha incidentes registrados no periodo selecionado.'));
  } else {
    for (const incidente of dataset.incidentes.slice(0, 60)) {
      children.push(
        new Paragraph(
          `${incidente.data} ${incidente.hora ?? ''} | ${incidente.tipo_incidente} | ${incidente.dano} | ` +
            `Severidade ${incidente.severidade} | ${formatarMoedaBR(incidente.custo_total)}`
        )
      );
      children.push(new Paragraph(`Descricao: ${incidente.descricao}`));
      children.push(new Paragraph(' '));
    }
  }

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

function renderizarAgrupamentoPdf(
  doc: PDFKit.PDFDocument,
  titulo: string,
  itens: FinanceiroAgrupamentoItem[]
) {
  doc.fontSize(13).text(titulo, { underline: true });
  doc.moveDown(0.2);
  if (!itens.length) {
    doc.fontSize(11).text('Sem dados suficientes.');
    doc.moveDown();
    return;
  }
  doc.fontSize(11);
  for (const item of itens.slice(0, 8)) {
    doc.text(
      `${item.chave}: Eventos ${item.eventos} (${item.percentual_eventos}%) | Custo ${formatarMoedaBR(
        item.custo_total
      )} (${item.percentual_custos}%) | Severidade media ${item.severidade_media}`
    );
  }
  doc.moveDown();
}

function adicionarAgrupamentoDocx(
  children: Paragraph[],
  titulo: string,
  itens: FinanceiroAgrupamentoItem[]
) {
  children.push(
    new Paragraph({
      text: titulo,
      heading: HeadingLevel.HEADING_3
    })
  );
  if (!itens.length) {
    children.push(new Paragraph('Sem dados suficientes.'));
    return;
  }
  for (const item of itens.slice(0, 8)) {
    children.push(
      new Paragraph(
        `${item.chave}: Eventos ${item.eventos} (${item.percentual_eventos}%) | Custo ${formatarMoedaBR(
          item.custo_total
        )} (${item.percentual_custos}%) | Severidade media ${item.severidade_media}`
      )
    );
  }
}

async function gerarGraficosFinanceiro(agrupamentos: FinanceiroAgrupamentos) {
  const buffers: {
    porTipo: Buffer | null;
    porCategoria: Buffer | null;
    porSeveridade: Buffer | null;
  } = {
    porTipo: null,
    porCategoria: null,
    porSeveridade: null
  };

  if (agrupamentos.porTipo.length) {
    const itens = agrupamentos.porTipo.slice(0, 8);
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: itens.map((i) => i.chave),
        datasets: [
          {
            label: 'Custo total (R$)',
            data: itens.map((i) => i.custo_total),
            backgroundColor: '#2563eb'
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };
    buffers.porTipo = await graficoColisoesRenderer.renderToBuffer(config);
  }

  if (agrupamentos.porCategoria.length) {
    const itens = agrupamentos.porCategoria.slice(0, 8);
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: itens.map((i) => i.chave),
        datasets: [
          {
            label: 'Custo total (R$)',
            data: itens.map((i) => i.custo_total),
            backgroundColor: '#7c3aed'
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };
    buffers.porCategoria = await graficoColisoesRenderer.renderToBuffer(config);
  }

  if (agrupamentos.porSeveridade.length) {
    const itens = agrupamentos.porSeveridade.slice(0, 6);
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: itens.map((i) => i.chave),
        datasets: [
          {
            label: 'Eventos (%)',
            data: itens.map((i) => i.percentual_eventos),
            backgroundColor: ['#22c55e', '#f97316', '#a855f7', '#ef4444', '#0ea5e9', '#facc15']
          }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom' } }
      }
    };
    buffers.porSeveridade = await graficoColisoesRenderer.renderToBuffer(config);
  }

  return buffers;
}

const currencyFormatterBR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function formatarMoedaBR(valor: number) {
  return currencyFormatterBR.format(Number(valor ?? 0));
}

// Função de geração de PDF para Inspeções Diárias
async function gerarPdfInspecoesDiarias(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      // Título e cabeçalho
      doc.fontSize(18).text('Relatório de Inspeções Diárias - Monitoramento de Fauna (F1)', {
        align: 'center'
      });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
      doc.fontSize(10).text(`Total de inspeções: ${inspecoes.length}`, { align: 'center' });
      doc.moveDown(1.5);

      // Processa cada inspeção
      for (let index = 0; index < inspecoes.length; index++) {
        const insp = inspecoes[index];

        if (index > 0) {
          doc.addPage();
        }

        // Cabeçalho da inspeção
        doc.fontSize(14).fillColor('#2c3e50').text(`Inspeção #${insp.inspection_id}`, { underline: true });
        doc.moveDown(0.5);

        // Informações Gerais
        doc.fontSize(11).fillColor('#000000');
        doc.text(`Aeroporto: ${insp.airport_name} (${insp.icao_code})`);
        doc.text(`Data: ${formatarData(insp.inspection_date)} | Horário: ${insp.inspection_time}`);
        doc.text(`Período: ${insp.period_name || insp.period_text || 'N/A'}`);
        doc.text(`Clima: ${insp.weather_name || 'N/A'}`);
        doc.text(`Inspetor: ${insp.inspector_name || 'N/A'} | Equipe: ${insp.inspector_team || 'N/A'}`);

        if (insp.collision_occurred) {
          doc.fillColor('#e74c3c')
            .text(`⚠️  COLISÃO OCORRIDA - Espécie: ${insp.collision_species || 'Não informada'}`, {
              continued: false
            })
            .fillColor('#000000');
        }

        if (insp.mandatory_report) {
          doc.fillColor('#f39c12').text('📋 Reporte Mandatório').fillColor('#000000');
        }

        if (insp.notes) {
          doc.moveDown(0.3);
          doc.fontSize(10).text(`Notas: ${insp.notes}`);
          doc.fontSize(11);
        }

        doc.moveDown();

        // Área de Movimentação de Aeronaves
        if (insp.aerodrome_observations && insp.aerodrome_observations.length > 0) {
          doc.fontSize(12).fillColor('#3498db').text('2. Área de Movimentação de Aeronaves').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const obs of insp.aerodrome_observations) {
            const especie = obs.species_name || obs.species_text || 'Não especificada';
            const local = obs.location_type_name || 'N/A';
            const quantidade = obs.quantity !== null && obs.quantity !== undefined ? obs.quantity : '?';
            const quadrante = obs.quadrant_code || '-';

            doc.text(`• ${local}: ${especie} (Qtd: ${quantidade}, Quadrante: ${quadrante})`);
            if (obs.notes) {
              doc.fontSize(9).text(`  Notas: ${obs.notes}`).fontSize(10);
            }
          }
          doc.moveDown();
        }

        // Demais Áreas do Sítio
        if (insp.site_observations && insp.site_observations.length > 0) {
          doc.fontSize(12).fillColor('#3498db').text('3. Demais Áreas do Sítio').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const obs of insp.site_observations) {
            const especie = obs.species_name || obs.species_text || 'Não especificada';
            const local = obs.location_type_name || 'N/A';
            const quantidade = obs.quantity !== null && obs.quantity !== undefined ? obs.quantity : '?';
            const quadrante = obs.quadrant_code || '-';

            doc.text(`• ${local}: ${especie} (Qtd: ${quantidade}, Quadrante: ${quadrante})`);
          }
          doc.moveDown();
        }

        // Ninhos Encontrados
        if (insp.nests && insp.nests.length > 0) {
          doc.fontSize(12).fillColor('#3498db').text('Ninhos Encontrados').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const ninho of insp.nests) {
            const areaLabel = ninho.area_type === 'aerodrome' ? 'Área de Movimento' : 'Demais Áreas';
            const ovos = ninho.has_eggs ? `com ${ninho.egg_count || '?'} ovos` : 'sem ovos';
            doc.text(`• ${ninho.location_text} (${areaLabel}) - ${ovos}`);
          }
          doc.moveDown();
        }

        // Carcaças Encontradas
        if (insp.carcasses && insp.carcasses.length > 0) {
          doc.fontSize(12).fillColor('#3498db').text('4. Carcaças Encontradas').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const carcaca of insp.carcasses) {
            const especie = carcaca.species_name || carcaca.species_text || 'Não identificada';
            const foto = carcaca.photographed ? 'Fotografada' : 'Não fotografada';
            const destino = carcaca.destination_name || 'Sem destinação registrada';
            doc.text(`• Local: ${carcaca.location_text} | Espécie: ${especie}`);
            doc.fontSize(9).text(`  ${foto} | Destinação: ${destino}`).fontSize(10);
          }
          doc.moveDown();
        }

        // Manejo Animal
        if (insp.management) {
          const mgmt = insp.management;
          if (mgmt.dispersal_performed || mgmt.capture_performed) {
            doc.fontSize(12).fillColor('#3498db').text('5. Manejo Animal - Ações Realizadas').fillColor('#000000');
            doc.fontSize(10);
            doc.moveDown(0.3);

            if (mgmt.dispersal_performed) {
              doc.text('✓ Afugentamento realizado');
            }
            if (mgmt.capture_performed) {
              doc.text('✓ Captura realizada');
            }
            if (mgmt.techniques) {
              doc.text(`Técnicas: ${mgmt.techniques}`);
            }
            if (mgmt.species_involved) {
              doc.text(`Espécies envolvidas: ${mgmt.species_involved}`);
            }
            doc.moveDown();
          }
        }

        // Linha separadora para próxima inspeção
        if (index < inspecoes.length - 1) {
          doc.fontSize(8).fillColor('#95a5a6').text('─'.repeat(80), { align: 'center' }).fillColor('#000000');
        }
      }

      doc.end();
    };

    processar().catch((err) => {
      reject(err);
    });
  });
}

// Função de geração de DOCX para Inspeções de Proteção (F4)
async function gerarDocxInspecoesProtecao(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Relatório de Inspeções de Proteção (F4)',
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph({
      text: `Período: ${periodo.inicio} a ${periodo.fim}`
    }),
    new Paragraph({
      text: `Total de inspeções: ${inspecoes.length}`
    }),
    new Paragraph(' ')
  ];

  for (const insp of inspecoes) {
    // Cabeçalho da inspeção
    children.push(
      new Paragraph({
        text: `Inspeção F4 #${insp.inspection_id}`,
        heading: HeadingLevel.HEADING_2
      })
    );

    // Informações Gerais
    children.push(new Paragraph(`Aeroporto: ${insp.airport_name} (${insp.icao_code})`));
    children.push(new Paragraph(`Data: ${formatarData(insp.inspection_date)}`));
    children.push(new Paragraph(`Período do Ano: ${insp.season_name || 'N/A'}`));
    children.push(new Paragraph(`Chuva nas últimas 24h: ${insp.rained_last_24h ? 'Sim' : 'Não'}`));
    children.push(new Paragraph(' '));

    // Cercas Patrimoniais e Operacionais
    if (insp.fence_occurrences && insp.fence_occurrences.length > 0) {
      children.push(
        new Paragraph({
          text: '2. Cercas Patrimoniais e Operacionais',
          heading: HeadingLevel.HEADING_3
        })
      );

      for (const fence of insp.fence_occurrences) {
        children.push(new Paragraph(`• Local: ${fence.location_text}`));
        if (fence.occurrence_types) {
          children.push(new Paragraph(`  Tipos de ocorrência: ${fence.occurrence_types}`));
        }
        if (fence.repair_performed) {
          const repairDate = fence.repair_date ? ` em ${formatarData(fence.repair_date)}` : '';
          children.push(new Paragraph(`  ✓ Reparo realizado${repairDate}`));
        }
        if (fence.irregular_waste_present) {
          children.push(new Paragraph(`  ⚠️ Descarte irregular de resíduos presente`));
          if (fence.waste_removed) {
            children.push(new Paragraph(`     ✓ Remoção realizada`));
          }
        }
        if (fence.notes) {
          children.push(new Paragraph(`  Notas: ${fence.notes}`));
        }
      }
      children.push(new Paragraph(' '));
    }

    // Portões Operacionais
    if (insp.gate_occurrences && insp.gate_occurrences.length > 0) {
      children.push(
        new Paragraph({
          text: '3. Portões Operacionais',
          heading: HeadingLevel.HEADING_3
        })
      );

      for (const gate of insp.gate_occurrences) {
        children.push(new Paragraph(`• Local: ${gate.location_text}`));
        if (gate.occurrence_types) {
          children.push(new Paragraph(`  Tipos de ocorrência: ${gate.occurrence_types}`));
        }
        if (gate.other_occurrence) {
          children.push(new Paragraph(`  Outros: ${gate.other_occurrence}`));
        }
        if (gate.repair_performed) {
          const repairDate = gate.repair_date ? ` em ${formatarData(gate.repair_date)}` : '';
          children.push(new Paragraph(`  ✓ Reparo realizado${repairDate}`));
        }
        if (gate.irregular_waste_present) {
          children.push(new Paragraph(`  ⚠️ Descarte irregular de resíduos presente`));
          if (gate.waste_removed) {
            children.push(new Paragraph(`     ✓ Remoção realizada`));
          }
        }
        if (gate.notes) {
          children.push(new Paragraph(`  Notas: ${gate.notes}`));
        }
      }
      children.push(new Paragraph(' '));
    }

    // Observações Gerais
    if (insp.general_notes) {
      children.push(
        new Paragraph({
          text: '4. Observações Gerais',
          heading: HeadingLevel.HEADING_3
        })
      );
      children.push(new Paragraph(insp.general_notes));
      children.push(new Paragraph(' '));
    }

    // Separador entre inspeções
    children.push(new Paragraph('─'.repeat(80)));
    children.push(new Paragraph(' '));
  }

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

// Função de geração de PDF para Inspeções de Proteção (F4)
async function gerarPdfInspecoesProtecao(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      // Título e cabeçalho
      doc.fontSize(18).text('Relatório de Inspeções de Proteção (F4)', {
        align: 'center'
      });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
      doc.fontSize(10).text(`Total de inspeções: ${inspecoes.length}`, { align: 'center' });
      doc.moveDown(1.5);

      // Processa cada inspeção
      for (let index = 0; index < inspecoes.length; index++) {
        const insp = inspecoes[index];

        if (index > 0) {
          doc.addPage();
        }

        // Cabeçalho da inspeção
        doc.fontSize(14).fillColor('#27ae60').text(`Inspeção F4 #${insp.inspection_id}`, { underline: true });
        doc.moveDown(0.5);

        // Informações Gerais
        doc.fontSize(11).fillColor('#000000');
        doc.text(`Aeroporto: ${insp.airport_name} (${insp.icao_code})`);
        doc.text(`Data: ${formatarData(insp.inspection_date)}`);
        doc.text(`Período do Ano: ${insp.season_name || 'N/A'}`);
        doc.text(`Chuva nas últimas 24h: ${insp.rained_last_24h ? 'Sim' : 'Não'}`);

        doc.moveDown();

        // Cercas Patrimoniais e Operacionais
        if (insp.fence_occurrences && insp.fence_occurrences.length > 0) {
          doc.fontSize(12).fillColor('#27ae60').text('2. Cercas Patrimoniais e Operacionais').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const fence of insp.fence_occurrences) {
            doc.text(`• Local: ${fence.location_text}`);
            if (fence.occurrence_types) {
              doc.fontSize(9).text(`  Tipos de ocorrência: ${fence.occurrence_types}`).fontSize(10);
            }
            if (fence.repair_performed) {
              const repairDate = fence.repair_date ? ` em ${formatarData(fence.repair_date)}` : '';
              doc.text(`  ✓ Reparo realizado${repairDate}`);
            }
            if (fence.irregular_waste_present) {
              doc.text(`  ⚠️ Descarte irregular de resíduos presente`);
              if (fence.waste_removed) {
                doc.text(`     ✓ Remoção realizada`);
              }
            }
            if (fence.notes) {
              doc.fontSize(9).text(`  Notas: ${fence.notes}`).fontSize(10);
            }
            doc.moveDown(0.5);
          }
          doc.moveDown();
        }

        // Portões Operacionais
        if (insp.gate_occurrences && insp.gate_occurrences.length > 0) {
          doc.fontSize(12).fillColor('#27ae60').text('3. Portões Operacionais').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);

          for (const gate of insp.gate_occurrences) {
            doc.text(`• Local: ${gate.location_text}`);
            if (gate.occurrence_types) {
              doc.fontSize(9).text(`  Tipos de ocorrência: ${gate.occurrence_types}`).fontSize(10);
            }
            if (gate.other_occurrence) {
              doc.fontSize(9).text(`  Outros: ${gate.other_occurrence}`).fontSize(10);
            }
            if (gate.repair_performed) {
              const repairDate = gate.repair_date ? ` em ${formatarData(gate.repair_date)}` : '';
              doc.text(`  ✓ Reparo realizado${repairDate}`);
            }
            if (gate.irregular_waste_present) {
              doc.text(`  ⚠️ Descarte irregular de resíduos presente`);
              if (gate.waste_removed) {
                doc.text(`     ✓ Remoção realizada`);
              }
            }
            if (gate.notes) {
              doc.fontSize(9).text(`  Notas: ${gate.notes}`).fontSize(10);
            }
            doc.moveDown(0.5);
          }
          doc.moveDown();
        }

        // Observações Gerais
        if (insp.general_notes) {
          doc.fontSize(12).fillColor('#27ae60').text('4. Observações Gerais').fillColor('#000000');
          doc.fontSize(10);
          doc.moveDown(0.3);
          doc.text(insp.general_notes);
          doc.moveDown();
        }

        // Linha separadora para próxima inspeção
        if (index < inspecoes.length - 1) {
          doc.fontSize(8).fillColor('#95a5a6').text('─'.repeat(80), { align: 'center' }).fillColor('#000000');
        }
      }

      doc.end();
    };

    processar().catch((err) => {
      reject(err);
    });
  });
}

// Função de geração de DOCX para Coletas de Carcaça (F5)
async function gerarDocxColetasCarcaca(
  coletas: any[],
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Relatório de Coletas de Carcaça (F5)',
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph({
      text: `Período: ${periodo.inicio} a ${periodo.fim}`
    }),
    new Paragraph({
      text: `Total de coletas: ${coletas.length}`
    }),
    new Paragraph(' ')
  ];

  for (const coleta of coletas) {
    children.push(
      new Paragraph({
        text: `Coleta #${coleta.collection_id}`,
        heading: HeadingLevel.HEADING_2
      })
    );

    children.push(new Paragraph(`Aeroporto: ${coleta.airport_name} (${coleta.icao_code})`));
    children.push(new Paragraph(`Data: ${formatarData(coleta.collection_date)}`));
    if (coleta.filled_by) children.push(new Paragraph(`Preenchido por: ${coleta.filled_by}`));
    if (coleta.delivered_by) children.push(new Paragraph(`Entregue por: ${coleta.delivered_by}`));
    children.push(new Paragraph(`Pista: ${coleta.runway_ref || 'N/A'}`));
    if (coleta.quadrant_code) children.push(new Paragraph(`Quadrante: ${coleta.quadrant_code}`));
    children.push(new Paragraph(`Encontrada durante inspeção: ${coleta.found_during_inspection ? 'Sim' : 'Não'}`));
    if (coleta.destination_text) children.push(new Paragraph(`Destinação: ${coleta.destination_text}`));
    if (coleta.common_name) children.push(new Paragraph(`Nome popular: ${coleta.common_name}`));
    if (coleta.scientific_name) children.push(new Paragraph(`Nome científico: ${coleta.scientific_name}`));
    if (coleta.individual_count) children.push(new Paragraph(`Número de indivíduos: ${coleta.individual_count}`));
    children.push(new Paragraph(`Possui fotos: ${coleta.has_photos ? 'Sim' : 'Não'}`));
    if (coleta.observations) {
      children.push(new Paragraph(`Observações: ${coleta.observations}`));
    }

    children.push(new Paragraph('─'.repeat(80)));
    children.push(new Paragraph(' '));
  }

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

// Função de geração de PDF para Coletas de Carcaça (F5)
async function gerarPdfColetasCarcaca(
  coletas: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      doc.fontSize(18).text('Relatório de Coletas de Carcaça (F5)', {
        align: 'center'
      });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
      doc.fontSize(10).text(`Total de coletas: ${coletas.length}`, { align: 'center' });
      doc.moveDown(1.5);

      for (let index = 0; index < coletas.length; index++) {
        const coleta = coletas[index];

        if (index > 0) {
          doc.addPage();
        }

        doc.fontSize(14).fillColor('#e74c3c').text(`Coleta #${coleta.collection_id}`, { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(11).fillColor('#000000');
        doc.text(`Aeroporto: ${coleta.airport_name} (${coleta.icao_code})`);
        doc.text(`Data: ${formatarData(coleta.collection_date)}`);
        if (coleta.filled_by) doc.text(`Preenchido por: ${coleta.filled_by}`);
        if (coleta.delivered_by) doc.text(`Entregue por: ${coleta.delivered_by}`);

        doc.moveDown();
        doc.fontSize(12).fillColor('#e74c3c').text('Localização').fillColor('#000000');
        doc.fontSize(10);
        doc.text(`Pista: ${coleta.runway_ref || 'N/A'}`);
        if (coleta.quadrant_code) doc.text(`Quadrante: ${coleta.quadrant_code}`);
        doc.text(`Encontrada durante inspeção: ${coleta.found_during_inspection ? 'Sim' : 'Não'}`);

        doc.moveDown();
        doc.fontSize(12).fillColor('#e74c3c').text('Informações sobre a Carcaça').fillColor('#000000');
        doc.fontSize(10);
        if (coleta.destination_text) doc.text(`Destinação: ${coleta.destination_text}`);
        if (coleta.common_name) doc.text(`Nome popular: ${coleta.common_name}`);
        if (coleta.scientific_name) doc.text(`Nome científico: ${coleta.scientific_name}`);
        if (coleta.individual_count) doc.text(`Número de indivíduos: ${coleta.individual_count}`);
        doc.text(`Possui fotos: ${coleta.has_photos ? 'Sim' : 'Não'}`);

        if (coleta.observations) {
          doc.moveDown();
          doc.fontSize(12).fillColor('#e74c3c').text('Observações').fillColor('#000000');
          doc.fontSize(10);
          doc.text(coleta.observations);
        }

        if (index < coletas.length - 1) {
          doc.fontSize(8).fillColor('#95a5a6').text('─'.repeat(80), { align: 'center' }).fillColor('#000000');
        }
      }

      doc.end();
    };

    processar().catch((err) => {
      reject(err);
    });
  });
}

// Função de geração de DOCX para Inspeções de Lagos
async function gerarDocxInspecoesLagos(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Relatório de Inspeção de Lagos e Áreas Alagadiças', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Período: ${periodo.inicio} a ${periodo.fim}`),
    new Paragraph(`Total de inspeções: ${inspecoes.length}`),
    new Paragraph(' ')
  ];

  for (const insp of inspecoes) {
    children.push(new Paragraph({ text: `Inspeção #${insp.inspection_id}`, heading: HeadingLevel.HEADING_2 }));

    children.push(new Paragraph(`Data: ${formatarData(insp.inspection_date)}`));
    children.push(new Paragraph(`Aeroporto: ${insp.airport_name} (${insp.icao_code})`));
    children.push(new Paragraph(`Período do Ano: ${insp.season_name || 'N/A'}`));
    children.push(new Paragraph(`Chuva nas últimas 24h: ${insp.rained_last_24h ? 'Sim' : 'Não'}`));
    children.push(new Paragraph(' '));

    children.push(new Paragraph({ text: 'Ponto Inspecionado', heading: HeadingLevel.HEADING_3 }));
    children.push(new Paragraph(`Pista Associada: ${insp.runway_ref || 'N/A'}`));
    children.push(new Paragraph(`Quadrante: ${insp.quadrant_code || 'N/A'}`));
    children.push(new Paragraph(' '));

    if (insp.fauna_present) {
      children.push(new Paragraph({ text: 'Fauna Associada', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(`Nome Popular: ${insp.species_popular_name || 'N/A'}`));
      children.push(new Paragraph(`Nome Científico: ${insp.species_scientific_name || 'N/A'}`));
      children.push(new Paragraph(`Número de Indivíduos: ${insp.individual_count || 'N/A'}`));
      children.push(new Paragraph(' '));
    }

    children.push(new Paragraph({ text: 'Análise do Sistema', heading: HeadingLevel.HEADING_3 }));
    children.push(new Paragraph(`Sistema Inspecionado: ${insp.inspected_system || 'N/A'}`));
    children.push(new Paragraph(`Apresenta Inconformidade: ${insp.has_non_conformity ? 'Sim' : 'Não'}`));
    children.push(new Paragraph(' '));

    if (insp.situation_description) {
      children.push(new Paragraph({ text: 'Registro Visual', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(`Descrição: ${insp.situation_description}`));
      children.push(new Paragraph(`Fotos: ${insp.photo_count > 0 ? `Sim (${insp.photo_count})` : 'Não'}`));
      children.push(new Paragraph(' '));
    }

    if (insp.mitigation_action) {
      children.push(new Paragraph({ text: 'Ação Mitigadora', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(insp.mitigation_action));
      children.push(new Paragraph(' '));
    }

    if (insp.general_observations) {
      children.push(new Paragraph({ text: 'Observações Gerais', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(insp.general_observations));
    }

    children.push(new Paragraph('─'.repeat(80)));
    children.push(new Paragraph(' '));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Função de geração de PDF para Inspeções de Lagos
async function gerarPdfInspecoesLagos(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    doc.fontSize(16).text('Relatório de Inspeção de Lagos e Áreas Alagadiças', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
    doc.moveDown(1.5);

    inspecoes.forEach((insp, index) => {
      if (index > 0) doc.addPage();

      doc.fontSize(14).fillColor('#16a085').text(`Inspeção #${insp.inspection_id}`, { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(11).fillColor('#000');
      doc.text(`Data: ${formatarData(insp.inspection_date)} | Aeroporto: ${insp.airport_name}`);
      doc.text(`Período do Ano: ${insp.season_name || 'N/A'} | Chuva 24h: ${insp.rained_last_24h ? 'Sim' : 'Não'}`);
      doc.text(`Pista: ${insp.runway_ref || 'N/A'} | Quadrante: ${insp.quadrant_code || 'N/A'}`);
      if (insp.fauna_present) {
        doc.text(`Fauna: ${insp.species_popular_name || 'N/A'} (Qtd: ${insp.individual_count || '?'})`);
      }
      if (insp.situation_description) doc.text(`Descrição: ${insp.situation_description}`);
      if (insp.mitigation_action) doc.text(`Ação: ${insp.mitigation_action}`);
      if (insp.general_observations) doc.text(`Obs: ${insp.general_observations}`);
      doc.moveDown();
    });

    doc.end();
  });
}

// Função de geração de DOCX para Manutenção de Áreas Verdes (F2)
async function gerarDocxInspecoesAreasVerdes(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Relatório F2 – Manutenção de Áreas Verdes', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Período: ${periodo.inicio} a ${periodo.fim}`),
    new Paragraph(`Total de registros: ${inspecoes.length}`),
    new Paragraph(' ')
  ];

  for (const insp of inspecoes) {
    children.push(new Paragraph({ text: `Registro #${insp.maintenance_id}`, heading: HeadingLevel.HEADING_2 }));

    children.push(new Paragraph(`Data: ${formatarData(insp.record_date)}`));
    children.push(new Paragraph(`Tipo: ${insp.record_type}`));
    children.push(new Paragraph(`Período do Ano: ${insp.season_name || 'N/A'}`));
    children.push(new Paragraph(' '));

    if (insp.record_type === 'corte' && insp.grass_cutting) {
      const corte = insp.grass_cutting;
      children.push(new Paragraph({ text: 'Corte de Grama', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(`Período da Atividade: ${corte.activity_period || 'N/A'}`));
      children.push(new Paragraph(`Equipamento: ${corte.equipment || 'N/A'}`));
      children.push(new Paragraph(`Recolhimento de Aparas: ${corte.cuttings_collected ? 'Sim' : 'Não'}`));
      if (corte.cuttings_destination) children.push(new Paragraph(`Destino: ${corte.cuttings_destination}`));
      if (corte.cut_areas) children.push(new Paragraph(`Áreas Cortadas: ${corte.cut_areas}`));
      children.push(new Paragraph(`Atração de Animais: ${corte.animal_attraction ? 'Sim' : 'Não'}`));
      if (corte.attracted_species) children.push(new Paragraph(`Espécies Atraídas: ${corte.attracted_species}`));
      children.push(new Paragraph(`Limpeza de Canaletas: ${corte.gutter_cleaned ? 'Sim' : 'Não'}`));
      children.push(new Paragraph(' '));
    }

    if ((insp.record_type === 'poda' || insp.record_type === 'extracao') && insp.pruning_extraction) {
      const poda = insp.pruning_extraction;
      children.push(new Paragraph({ text: 'Poda ou Extração', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(`Tipo de Vegetação: ${poda.vegetation_type || 'N/A'}`));
      children.push(new Paragraph(`Possui Autorização Ambiental: ${poda.has_environmental_authorization ? 'Sim' : 'Não'}`));
      if (poda.managed_species) children.push(new Paragraph(`Espécies Manejadas: ${poda.managed_species}`));
      children.push(new Paragraph(`Recolhimento de Aparas: ${poda.cuttings_collected ? 'Sim' : 'Não'}`));
      if (poda.cuttings_destination) children.push(new Paragraph(`Destino: ${poda.cuttings_destination}`));
      if (poda.vegetation_location) children.push(new Paragraph(`Localização: ${poda.vegetation_location}`));
      children.push(new Paragraph(`Atração de Animais: ${poda.animal_attraction ? 'Sim' : 'Não'}`));
      if (poda.observed_species) children.push(new Paragraph(`Espécies Observadas: ${poda.observed_species}`));
      children.push(new Paragraph(' '));
    }

    if (insp.general_observations) {
      children.push(new Paragraph({ text: 'Observações Gerais', heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph(insp.general_observations));
    }

    children.push(new Paragraph('─'.repeat(80)));
    children.push(new Paragraph(' '));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Função de geração de PDF para Manutenção de Áreas Verdes (F2)
async function gerarPdfInspecoesAreasVerdes(
  inspecoes: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    doc.fontSize(16).text('Relatório F2 – Manutenção de Áreas Verdes', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
    doc.moveDown(1.5);

    inspecoes.forEach((insp, index) => {
      if (index > 0) doc.addPage();

      doc.fontSize(14).fillColor('#27ae60').text(`Registro #${insp.maintenance_id}`, { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(11).fillColor('#000');
      doc.text(`Data: ${formatarData(insp.record_date)} | Tipo: ${insp.record_type} | Aeroporto: ${insp.icao_code}`);
      if (insp.general_observations) doc.text(`Observações: ${insp.general_observations}`);
      // Adicionar mais detalhes se necessário
      doc.moveDown();
    });

    doc.end();
  });
}

// Função de geração de DOCX para Resíduos de Incineração
async function gerarDocxResiduosIncineracao(
  residuos: any[],
  periodo: { inicio: string; fim: string }
) {
  const children: Paragraph[] = [
    new Paragraph({ text: 'Relatório de Resíduos Enviados para Incineração', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Período: ${periodo.inicio} a ${periodo.fim}`),
    new Paragraph(`Total de registros: ${residuos.length}`),
    new Paragraph(' ')
  ];

  for (const residuo of residuos) {
    children.push(new Paragraph({ text: `Registro #${residuo.waste_id}`, heading: HeadingLevel.HEADING_2 }));

    children.push(new Paragraph(`Aeroporto: ${residuo.airport_name} (${residuo.icao_code})`));
    children.push(new Paragraph(`Empresa: ${residuo.company_name}`));
    children.push(new Paragraph(`Data: ${formatarData(residuo.record_date)}`));
    children.push(new Paragraph(`Voos internacionais: ${residuo.international_flights ? 'Sim' : 'Não'}`));
    if (residuo.waste_type) children.push(new Paragraph(`Tipo de resíduo: ${residuo.waste_type}`));
    if (residuo.physical_state_name) children.push(new Paragraph(`Estado físico: ${residuo.physical_state_name}`));
    if (residuo.origin) children.push(new Paragraph(`Origem: ${residuo.origin}`));
    if (residuo.codification) children.push(new Paragraph(`Codificação (NBR): ${residuo.codification}`));
    if (residuo.generation_frequency) children.push(new Paragraph(`Frequência de geração: ${residuo.generation_frequency}`));
    if (residuo.weight_kg) children.push(new Paragraph(`Peso: ${residuo.weight_kg} kg`));
    if (residuo.unit_quantity) children.push(new Paragraph(`Quantidade (unidades): ${residuo.unit_quantity}`));
    if (residuo.volume_value) {
      const volUnit = residuo.volume_unit || 'L';
      children.push(new Paragraph(`Volume: ${residuo.volume_value} ${volUnit}`));
    }
    if (residuo.treatment_name) {
      children.push(new Paragraph(`Tratamento: ${residuo.treatment_name}`));
    }
    if (residuo.treatment_other) {
      children.push(new Paragraph(`Outro tratamento: ${residuo.treatment_other}`));
    }
    if (residuo.filled_by) children.push(new Paragraph(`Preenchido por: ${residuo.filled_by}`));

    children.push(new Paragraph('─'.repeat(80)));
    children.push(new Paragraph(' '));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Função de geração de PDF para Resíduos de Incineração
async function gerarPdfResiduosIncineracao(
  residuos: any[],
  periodo: { inicio: string; fim: string }
) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const processar = async () => {
      doc.fontSize(18).text('Relatório de Resíduos Enviados para Incineração', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${periodo.inicio} a ${periodo.fim}`, { align: 'center' });
      doc.fontSize(10).text(`Total de registros: ${residuos.length}`, { align: 'center' });
      doc.moveDown(1.5);

      for (let index = 0; index < residuos.length; index++) {
        const residuo = residuos[index];

        if (index > 0) doc.addPage();

        doc.fontSize(14).fillColor('#f39c12').text(`Registro #${residuo.waste_id}`, { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(11).fillColor('#000000');
        doc.text(`Aeroporto: ${residuo.airport_name} (${residuo.icao_code})`);
        doc.text(`Empresa: ${residuo.company_name}`);
        doc.text(`Data: ${formatarData(residuo.record_date)}`);
        doc.text(`Voos internacionais: ${residuo.international_flights ? 'Sim' : 'Não'}`);

        doc.moveDown();
        doc.fontSize(12).fillColor('#f39c12').text('Caracterização do Resíduo').fillColor('#000000');
        doc.fontSize(10);
        if (residuo.waste_type) doc.text(`Tipo de resíduo: ${residuo.waste_type}`);
        if (residuo.physical_state_name) doc.text(`Estado físico: ${residuo.physical_state_name}`);
        if (residuo.origin) doc.text(`Origem: ${residuo.origin}`);

        doc.moveDown();
        doc.fontSize(12).fillColor('#f39c12').text('Quantificação').fillColor('#000000');
        doc.fontSize(10);
        if (residuo.weight_kg) doc.text(`Peso: ${residuo.weight_kg} kg`);
        if (residuo.unit_quantity) doc.text(`Quantidade (unidades): ${residuo.unit_quantity}`);

        if (index < residuos.length - 1) {
          doc.fontSize(8).fillColor('#95a5a6').text('─'.repeat(80), { align: 'center' }).fillColor('#000000');
        }
      }

      doc.end();
    };

    processar().catch(reject);
  });
}