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

  app.get('/api/relatorios/incidentes/export', async (request, reply) => {
    const filtros = periodoSchema
      .extend({
        formato: z.enum(['pdf', 'docx'])
      })
      .parse(request.query ?? {});
    const { inicio, fim } = periodosComDefaults(filtros);
    const dados = await obterAnaliseIncidentes(filtros.airportId ?? null, inicio, fim);
    const possuiDados = Object.values(dados).some((lista) => lista.length);
    if (!possuiDados) {
      return reply.code(404).send({ mensagem: 'Sem dados para o período informado' });
    }
    const nomeArquivoBase = `analise-incidentes-${inicio}-a-${fim}`;
    if (filtros.formato === 'docx') {
      const buffer = await gerarDocxIncidentes(dados, { inicio, fim });
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      reply.header('Content-Disposition', `attachment; filename=${nomeArquivoBase}.docx`);
      return reply.send(buffer);
    }
    const buffer = await gerarPdfIncidentes(dados, { inicio, fim });
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
      doc.destroy();
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
      doc.destroy();
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
