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
      { chave: 'locais_aerodromo', sql: "SELECT aerodrome_location_id AS id, name FROM wildlife.lu_aerodrome_location ORDER BY name" },
      { chave: 'fases_ocorrencia', sql: "SELECT occurrence_phase_id AS id, name FROM wildlife.lu_occurrence_phase ORDER BY name" },
      { chave: 'periodos_dia', sql: "SELECT period_id AS id, name FROM wildlife.lu_time_period ORDER BY id" },
      { chave: 'quadrantes', sql: "SELECT quadrant_id AS id, code, description FROM wildlife.lu_quadrant ORDER BY code" },
      { chave: 'tipos_local_inspecao', sql: "SELECT location_type_id AS id, name, category FROM wildlife.lu_inspection_location_type ORDER BY category, name" },
      { chave: 'periodos_inspecao', sql: "SELECT period_id AS id, name FROM wildlife.lu_inspection_period ORDER BY id" },
      { chave: 'condicoes_clima', sql: "SELECT weather_id AS id, name FROM wildlife.lu_weather_condition ORDER BY id" },
      { chave: 'destinos_carcaca', sql: "SELECT destination_id AS id, name FROM wildlife.lu_carcass_destination ORDER BY name" },
      { chave: 'tecnicas_manejo', sql: "SELECT technique_id AS id, name FROM wildlife.lu_management_technique ORDER BY name" },
      { chave: 'estacoes_ano', sql: "SELECT season_id AS id, name FROM wildlife.lu_year_season ORDER BY season_id" },
      { chave: 'tipos_ocorrencia_cerca', sql: "SELECT occurrence_type_id AS id, name FROM wildlife.lu_fence_occurrence_type ORDER BY occurrence_type_id" },
      { chave: 'tipos_ocorrencia_portao', sql: "SELECT occurrence_type_id AS id, name FROM wildlife.lu_gate_occurrence_type ORDER BY occurrence_type_id" },
      { chave: 'estados_fisicos_residuo', sql: "SELECT state_id AS id, name FROM wildlife.lu_waste_physical_state ORDER BY name" },
      { chave: 'tipos_tratamento_residuo', sql: "SELECT treatment_id AS id, name FROM wildlife.lu_waste_treatment_type ORDER BY name" },
      { chave: 'tipos_registro_area_verde', sql: "SELECT record_type_id AS id, name FROM wildlife.lu_green_area_record_type ORDER BY name" },
      { chave: 'tipos_manejo_area_verde', sql: "SELECT management_type_id AS id, name FROM wildlife.lu_green_area_management_type ORDER BY name" },
      { chave: 'periodos_atividade', sql: "SELECT period_id AS id, name FROM wildlife.lu_activity_period ORDER BY id" },
      { chave: 'tipos_equipamento', sql: "SELECT equipment_id AS id, name FROM wildlife.lu_equipment_type ORDER BY name" },
      { chave: 'tipos_vegetacao', sql: "SELECT vegetation_type_id AS id, name FROM wildlife.lu_vegetation_type ORDER BY name" },
      { chave: 'tipos_acao_mitigacao', sql: "SELECT action_type_id AS id, name, category, description FROM wildlife.lu_mitigation_action_type ORDER BY category, name" }
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
