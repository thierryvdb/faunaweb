import { FastifyInstance } from 'fastify';
import { db } from '../services/db';

export async function lookupsRoutes(app: FastifyInstance) {
  app.get('/api/lookups', async () => {
    const queries = [
      { chave: 'fases_voo', sql: "SELECT phase_id AS id, name FROM wildlife.lu_phase_of_flight ORDER BY name" },
      { chave: 'classes_dano', sql: "SELECT damage_id AS id, name, severity_weight FROM wildlife.lu_damage_class ORDER BY severity_weight" },
      { chave: 'metodos_deteccao', sql: "SELECT method_id AS id, name FROM wildlife.lu_detection_method ORDER BY name" },
      { chave: 'visibilidade', sql: "SELECT vis_id AS id, name FROM wildlife.lu_weather_visibility ORDER BY id" },
      { chave: 'vento', sql: "SELECT wind_id AS id, name FROM wildlife.lu_weather_wind ORDER BY id" },
      { chave: 'precipitacao', sql: "SELECT precip_id AS id, name FROM wildlife.lu_weather_precip ORDER BY id" },
      { chave: 'efeitos_voo', sql: "SELECT effect_id AS id, name FROM wildlife.lu_effect_on_flight ORDER BY name" },
      { chave: 'partes_aeronave', sql: "SELECT part_id AS id, name FROM wildlife.lu_part_hit ORDER BY name" },
      { chave: 'grupos_taxonomicos', sql: "SELECT group_id AS id, name FROM wildlife.lu_taxon_group ORDER BY name" },
      { chave: 'classes_massa', sql: "SELECT mass_id AS id, name FROM wildlife.lu_mass_class ORDER BY mass_id" },
      { chave: 'tipos_atrativo', sql: "SELECT attractor_type_id AS id, name FROM wildlife.lu_attractor_type ORDER BY name" },
      { chave: 'tipos_acao', sql: "SELECT action_type_id AS id, name FROM wildlife.lu_action_type ORDER BY name" },
      { chave: 'tipos_motor', sql: "SELECT engine_type_id AS id, name FROM wildlife.lu_aircraft_engine_type ORDER BY name" },
      { chave: 'periodos_dia', sql: "SELECT period_id AS id, name FROM wildlife.lu_time_period ORDER BY id" },
      { chave: 'quadrantes', sql: "SELECT quadrant_id AS id, code, description FROM wildlife.lu_quadrant ORDER BY code" }
    ];

    const resultados = await Promise.all(
      queries.map(async (q) => {
        const { rows } = await db.query(q.sql);
        return [q.chave, rows];
      })
    );

    return Object.fromEntries(resultados);
  });
}
