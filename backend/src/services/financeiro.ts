import { db } from './db';

export interface FinanceiroResumoItem {
  ano: number;
  categoria: string;
  tipo_incidente: string;
  dano: string;
  eventos: number;
  custo_direto: number;
  custo_indireto: number;
  custo_outros: number;
  custo_total: number;
  severidade_media: number;
}

export interface FinanceiroAgrupamentoItem {
  chave: string;
  eventos: number;
  custo_total: number;
  custo_medio: number;
  severidade_media: number;
  percentual_eventos: number;
  percentual_custos: number;
}

export interface FinanceiroAgrupamentos {
  porTipo: FinanceiroAgrupamentoItem[];
  porCategoria: FinanceiroAgrupamentoItem[];
  porDano: FinanceiroAgrupamentoItem[];
  porSeveridade: FinanceiroAgrupamentoItem[];
}

export interface FinanceiroIncidente {
  id: number;
  data: string;
  hora: string | null;
  aeroporto: string | null;
  tipo_incidente: string;
  categoria: string;
  dano: string;
  severidade_peso: number;
  severidade: string;
  especie: string | null;
  local: string | null;
  custo_direto: number;
  custo_indireto: number;
  custo_outros: number;
  custo_total: number;
  descricao: string;
  notas: string | null;
}

export interface FinanceiroTotais {
  eventos: number;
  custo_total: number;
  custo_direto: number;
  custo_indireto: number;
  custo_outros: number;
}

export interface FinanceiroDataset {
  dados: FinanceiroResumoItem[];
  agrupamentos: FinanceiroAgrupamentos;
  incidentes: FinanceiroIncidente[];
  totais: FinanceiroTotais;
}

interface FinanceiroBaseRow {
  strike_id: number;
  ano: number;
  categoria: string;
  tipo_incidente: string;
  dano: string;
  severity_weight: number;
  severidade: string;
  date_utc: string;
  time_local: string | null;
  aeroporto: string | null;
  especie: string | null;
  local: string | null;
  notes: string | null;
  custo_direto: number;
  custo_indireto: number;
  custo_outros: number;
  custo_total: number;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

export async function gerarFinanceiroDataset(params: {
  airportId?: number | null;
  inicio: string;
  fim: string;
}): Promise<FinanceiroDataset> {
  const { airportId = null, inicio, fim } = params;
  const { rows } = await db.query(
    `SELECT
       s.strike_id,
       s.date_utc,
       s.time_local,
       EXTRACT(YEAR FROM s.date_utc)::int AS ano,
       COALESCE(tg.name, 'Nao classificado') AS categoria,
       COALESCE(s.event_type, 'desconhecido') AS tipo_incidente,
       COALESCE(dc.name, 'Sem dano') AS dano,
       COALESCE(s.severity_weight, 0) AS severity_weight,
       s.notes,
       a.name AS aeroporto,
       COALESCE(sp.common_name, 'Nao identificada') AS especie,
       COALESCE(l.description, l.code, 'Nao informado') AS localizacao,
       COALESCE(cost.cost_direto, 0) AS custo_direto,
       COALESCE(cost.cost_indireto, 0) AS custo_indireto,
       COALESCE(cost.cost_outros, 0) +
         CASE WHEN COALESCE(cost.has_cost, false) THEN 0 ELSE COALESCE(s.cost_brl, 0) END AS custo_outros,
       CASE WHEN COALESCE(cost.has_cost, false)
         THEN COALESCE(cost.cost_total, 0)
         ELSE COALESCE(s.cost_brl, 0)
       END AS custo_total
     FROM wildlife.fact_strike s
     LEFT JOIN wildlife.airport a ON a.airport_id = s.airport_id
     LEFT JOIN wildlife.dim_species sp ON sp.species_id = s.species_id
     LEFT JOIN wildlife.lu_taxon_group tg ON tg.group_id = sp.group_id
     LEFT JOIN wildlife.lu_damage_class dc ON dc.damage_id = s.damage_id
     LEFT JOIN wildlife.dim_location l ON l.location_id = s.location_id
     LEFT JOIN LATERAL (
       SELECT
         SUM(CASE WHEN cost_type = 'direto' THEN amount_brl ELSE 0 END) AS cost_direto,
         SUM(CASE WHEN cost_type = 'indireto' THEN amount_brl ELSE 0 END) AS cost_indireto,
         SUM(CASE WHEN cost_type NOT IN ('direto','indireto') THEN amount_brl ELSE 0 END) AS cost_outros,
         SUM(amount_brl) AS cost_total,
         COUNT(*) > 0 AS has_cost
       FROM wildlife.fact_strike_cost c
       WHERE c.strike_id = s.strike_id
     ) cost ON true
     WHERE s.date_utc BETWEEN $2 AND $3
       AND ($1::bigint IS NULL OR s.airport_id = $1)
     ORDER BY s.date_utc DESC, s.time_local DESC NULLS LAST`,
    [airportId, inicio, fim]
  );

  const baseRows: FinanceiroBaseRow[] = rows.map((row: any) => {
    const peso = Number(row.severity_weight ?? 0);
    return {
      strike_id: Number(row.strike_id),
      ano: Number(row.ano),
      categoria: row.categoria ?? 'Nao classificado',
      tipo_incidente: row.tipo_incidente ?? 'desconhecido',
      dano: row.dano ?? 'Sem dano',
      severity_weight: peso,
      severidade: classificarSeveridade(peso),
      date_utc: formatarDataISO(row.date_utc),
      time_local: formatarHora(row.time_local),
      aeroporto: row.aeroporto ?? null,
      especie: row.especie ?? null,
      local: row.localizacao ?? null,
      notes: row.notes ?? null,
      custo_direto: Number(row.custo_direto ?? 0),
      custo_indireto: Number(row.custo_indireto ?? 0),
      custo_outros: Number(row.custo_outros ?? 0),
      custo_total: Number(row.custo_total ?? 0)
    };
  });

  const totais = calcularTotais(baseRows);

  return {
    dados: gerarResumo(baseRows),
    agrupamentos: {
      porTipo: agruparSimples(baseRows, (row) => row.tipo_incidente, totais),
      porCategoria: agruparSimples(baseRows, (row) => row.categoria, totais),
      porDano: agruparSimples(baseRows, (row) => row.dano, totais),
      porSeveridade: agruparSimples(baseRows, (row) => row.severidade, totais)
    },
    incidentes: montarIncidentes(baseRows),
    totais
  };
}

function calcularTotais(rows: FinanceiroBaseRow[]): FinanceiroTotais {
  return rows.reduce<FinanceiroTotais>(
    (acc, row) => {
      acc.eventos += 1;
      acc.custo_total += row.custo_total;
      acc.custo_direto += row.custo_direto;
      acc.custo_indireto += row.custo_indireto;
      acc.custo_outros += row.custo_outros;
      return acc;
    },
    {
      eventos: 0,
      custo_total: 0,
      custo_direto: 0,
      custo_indireto: 0,
      custo_outros: 0
    }
  );
}

function gerarResumo(rows: FinanceiroBaseRow[]): FinanceiroResumoItem[] {
  const mapa = new Map<string, FinanceiroResumoItem & { somaSeveridade: number }>();

  for (const row of rows) {
    const chave = `${row.ano}|${row.categoria}|${row.tipo_incidente}|${row.dano}`;
    let atual = mapa.get(chave);
    if (!atual) {
      atual = {
        ano: row.ano,
        categoria: row.categoria,
        tipo_incidente: row.tipo_incidente,
        dano: row.dano,
        eventos: 0,
        custo_direto: 0,
        custo_indireto: 0,
        custo_outros: 0,
        custo_total: 0,
        severidade_media: 0,
        somaSeveridade: 0
      };
      mapa.set(chave, atual);
    }
    atual.eventos += 1;
    atual.custo_direto += row.custo_direto;
    atual.custo_indireto += row.custo_indireto;
    atual.custo_outros += row.custo_outros;
    atual.custo_total += row.custo_total;
    atual.somaSeveridade += row.severity_weight;
  }

  return Array.from(mapa.values())
    .map((item) => {
      const severidade = item.eventos ? item.somaSeveridade / item.eventos : 0;
      return {
        ano: item.ano,
        categoria: item.categoria,
        tipo_incidente: item.tipo_incidente,
        dano: item.dano,
        eventos: item.eventos,
        custo_direto: Number(item.custo_direto.toFixed(2)),
        custo_indireto: Number(item.custo_indireto.toFixed(2)),
        custo_outros: Number(item.custo_outros.toFixed(2)),
        custo_total: Number(item.custo_total.toFixed(2)),
        severidade_media: Number(severidade.toFixed(2))
      };
    })
    .sort((a, b) => {
      if (a.ano !== b.ano) {
        return b.ano - a.ano;
      }
      return b.custo_total - a.custo_total;
    });
}

function agruparSimples(
  rows: FinanceiroBaseRow[],
  seletor: (row: FinanceiroBaseRow) => string,
  totais: FinanceiroTotais
): FinanceiroAgrupamentoItem[] {
  if (!rows.length) return [];
  const mapa = new Map<string, { eventos: number; custo: number; somaSeveridade: number }>();

  for (const row of rows) {
    const chave = seletor(row) || 'Nao informado';
    let atual = mapa.get(chave);
    if (!atual) {
      atual = { eventos: 0, custo: 0, somaSeveridade: 0 };
      mapa.set(chave, atual);
    }
    atual.eventos += 1;
    atual.custo += row.custo_total;
    atual.somaSeveridade += row.severity_weight;
  }

  return Array.from(mapa.entries())
    .map(([chave, valores]) => {
      const severidade = valores.eventos ? valores.somaSeveridade / valores.eventos : 0;
      return {
        chave,
        eventos: valores.eventos,
        custo_total: Number(valores.custo.toFixed(2)),
        custo_medio: valores.eventos ? Number((valores.custo / valores.eventos).toFixed(2)) : 0,
        severidade_media: Number(severidade.toFixed(2)),
        percentual_eventos: totais.eventos ? Number(((valores.eventos / totais.eventos) * 100).toFixed(2)) : 0,
        percentual_custos: totais.custo_total ? Number(((valores.custo / totais.custo_total) * 100).toFixed(2)) : 0
      };
    })
    .sort((a, b) => b.custo_total - a.custo_total);
}

function montarIncidentes(rows: FinanceiroBaseRow[]): FinanceiroIncidente[] {
  return rows.map((row) => ({
    id: row.strike_id,
    data: row.date_utc,
    hora: row.time_local,
    aeroporto: row.aeroporto,
    tipo_incidente: row.tipo_incidente,
    categoria: row.categoria,
    dano: row.dano,
    severidade_peso: row.severity_weight,
    severidade: row.severidade,
    especie: row.especie,
    local: row.local,
    custo_direto: row.custo_direto,
    custo_indireto: row.custo_indireto,
    custo_outros: row.custo_outros,
    custo_total: row.custo_total,
    descricao: construirDescricao(row),
    notas: row.notes
  }));
}

function classificarSeveridade(peso: number) {
  if (!peso || peso <= 1) return 'Baixa';
  if (peso <= 2) return 'Moderada';
  if (peso <= 4) return 'Alta';
  return 'Critica';
}

function construirDescricao(row: FinanceiroBaseRow) {
  const data = formatarDataLegivel(row.date_utc);
  const local = row.local ?? 'local nao informado';
  const especie = row.especie ?? 'especie nao identificada';
  const dano = row.dano ?? 'Sem dano';
  const severidade = row.severidade ?? 'Nao classificado';
  const custo = currencyFormatter.format(row.custo_total ?? 0);
  const partes = [
    `${data} - ${row.tipo_incidente} (${row.categoria})`,
    `Local: ${local}`,
    `Especie: ${especie}`,
    `Dano: ${dano}`,
    `Severidade: ${severidade}`,
    `Custo total estimado: ${custo}`
  ];
  if (row.notes) {
    partes.push(`Notas: ${row.notes}`);
  }
  return partes.join('. ');
}

function formatarDataISO(valor: any) {
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

function formatarDataLegivel(valor: string) {
  if (!valor) return 'Data nao informada';
  try {
    return dateFormatter.format(new Date(valor));
  } catch {
    return valor;
  }
}
