import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, ImageRun, Packer, Paragraph } from 'docx';
import sharp from 'sharp';
import { db } from '../services/db';

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
         EXTRACT(YEAR FROM date_utc)::int AS ano,
         EXTRACT(MONTH FROM date_utc)::int AS mes,
         SUM(COALESCE(movements_in_day, 1))::bigint AS total
       FROM wildlife.fact_movement
       WHERE date_utc >= $2::date
         AND date_utc < $3::date
         AND ($1::bigint IS NULL OR airport_id = $1)
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

    const comparativos = {
      anoInicial: montarComparativo(filtros.anoInicial),
      anoFinal: montarComparativo(filtros.anoFinal)
    };

    return {
      periodo: {
        anoInicial: filtros.anoInicial,
        anoFinal: filtros.anoFinal
      },
      meses,
      comparativos
    };
  });

  app.get('/api/relatorios/colisoes-imagens', async (request) => {
    const filtros = periodoSchema.parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dados = await buscarColisoesComImagens(filtros.airportId ?? null, inicio, fim);
    const resposta = dados.map(({ photo_blob, ...resto }) => ({
      ...resto,
      foto_base64: photo_blob ? bufferParaBase64(photo_blob, resto.photo_mime) : null
    }));
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
}

function periodosComDefaults(filtros: { inicio?: string; fim?: string }) {
  const hoje = new Date();
  return {
    inicio: filtros.inicio ?? new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10),
    fim: filtros.fim ?? new Date(hoje.getFullYear(), 11, 31).toISOString().slice(0, 10)
  };
}

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

  return rows.map((row: any) => ({
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
    photo_blob: row.photo_blob ?? null
  }));
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

async function prepararImagemParaRelatorio(item: ColisaoImagem) {
  if (!item.photo_blob) return null;
  const mime = (item.photo_mime ?? '').toLowerCase();
  if (mime.includes('png') || mime.includes('jpeg') || mime.includes('jpg')) {
    return item.photo_blob;
  }
  try {
    return await sharp(item.photo_blob).png().toBuffer();
  } catch {
    return null;
  }
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
    const imagemBuffer = await prepararImagemParaRelatorio(item);
    if (imagemBuffer) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imagemBuffer,
              transformation: { width: 400, height: 260 }
            })
          ]
        })
      );
    } else if (item.photo_url) {
      children.push(new Paragraph(`Foto (URL): ${item.photo_url}`));
    } else {
      children.push(new Paragraph('Sem imagem fornecida.'));
    }
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
        const imagemBuffer = await prepararImagemParaRelatorio(item);
        if (imagemBuffer) {
          try {
            doc.image(imagemBuffer, { fit: [460, 300], align: 'center' });
          } catch {
            doc.text('Nao foi possivel exibir a imagem (formato nao suportado).');
          }
        } else if (item.photo_url) {
          doc.text(`Foto (URL): ${item.photo_url}`);
        } else {
          doc.text('Sem imagem fornecida.');
        }
      }
      doc.end();
    };

    processar().catch((err) => {
      doc.destroy();
      reject(err);
    });
  });
}
