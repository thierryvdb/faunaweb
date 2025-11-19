export interface InspectionTemplateDetail {
  title: string;
  description: string;
}

export interface InspectionTemplate {
  id: string;
  pageTitle: string;
  selectorTitle: string;
  frequency: string;
  purpose: string;
  details?: InspectionTemplateDetail[];
  externalRoute?: string;
}

export const inspectionTemplates: InspectionTemplate[] = [
  {
    id: 'legacy',
    pageTitle: 'Inspeções no sítio e ASA',
    selectorTitle: 'Inspeções diárias (formulário antigo)',
    frequency: 'Registro diário (mapa de grade, clima e achados)',
    purpose: 'Mantenha o cadastro atual de inspeções no sítio ou ASA.'
  },
  {
    id: 'asa',
    pageTitle: 'Monitoramento de Fauna (F1)',
    selectorTitle: 'REQUISITOS DO FORMULÁRIO – MONITORAMENTO DIÁRIO DE FAUNA (F1)',
    frequency: 'Periodicidade: 2 vezes ao dia',
    purpose: 'Registrar presença de fauna, riscos, colisões, ninhos, carcaças e ações de manejo em todo o sítio aeroportuário.',
    details: [
      {
        title: '1. Informações Gerais do Registro',
        description: 'Período da observação, data, hora, colisões, espécie envolvida e clima.'
      },
      {
        title: '2. Área de Movimentação de Aeronaves',
        description: 'Locais da pista, equipamentos e observações detalhadas, inclusive ninhos e ovos.'
      },
      {
        title: '3. Demais Áreas do Sítio',
        description: 'TPS, TECA, hangares, áreas arborizadas, ninhos e atividade de fauna.'
      },
      {
        title: '4. Carcaças Encontradas',
        description: 'Localizações, fotografias, espécie identificada e destinação.'
      },
      {
        title: '5. Manejo Animal',
        description: 'Afugentamento, captura, técnicas utilizadas, espécies envolvidas e destino.'
      }
    ],
    externalRoute: '/inspecoes-asa'
  },
  {
    id: 'f4',
    pageTitle: 'Sistema de Proteção (F4)',
    selectorTitle: 'FORMULÁRIO F4 – SISTEMA DE PROTEÇÃO',
    frequency: 'Periodicidade: 1 vez por semana ou sempre que houver necessidade',
    purpose: 'Abrangência: Todo o sítio aeroportuário',
    details: [
      {
        title: '1. Informações Gerais do Registro',
        description: 'Data do registro, estação do ano e chuva nas últimas 24h.'
      },
      {
        title: '2. Cercas Patrimoniais e Operacionais',
        description: 'Ocorrências, reparos executados, descarte irregular e remoções.'
      },
      {
        title: '3. Portões Operacionais',
        description: 'Falhas, reparos, fotos e observações referentes aos portões.'
      },
      {
        title: '4. Observações Gerais',
        description: 'Notas livres e até cinco fotos anexadas.'
      }
    ],
    externalRoute: '/inspecoes-protecao'
  },
  {
    id: 'lakes',
    pageTitle: 'Inspeção de Lagos e Áreas Alagadiças',
    selectorTitle: 'REQUISITOS DO FORMULÁRIO – INSPEÇÃO DE LAGOS E ÁREAS ALAGADIÇAS',
    frequency: 'Periodicidade: 1 vez por semana ou sob demanda',
    purpose: 'Abrangência: Todo o sítio aeroportuário',
    details: [
      {
        title: '1. Informações Gerais do Registro',
        description: 'Data da inspeção, estação do ano e flag de chuva nas últimas 24h.'
      },
      {
        title: '2. Identificação do Ponto Inspecionado',
        description: 'Pista associada e quadrante da coleta.'
      },
      {
        title: '3. Registro de Fauna Associada à Água',
        description: 'Fauna presente, nome popular/científico e quantidade.'
      },
      {
        title: '4. Análise do Sistema Inspecionado',
        description: 'Sistema (Via Patrimonial ou outro) e inconformidades.'
      },
      {
        title: '5. Registro Visual',
        description: 'Descrição da situação e até cinco fotos da ocorrência.'
      },
      {
        title: '6. Ação Mitigadora',
        description: 'Medidas adotadas (texto livre).'
      },
      {
        title: '7. Observações Gerais',
        description: 'Campo para anotações adicionais.'
      }
    ],
    externalRoute: '/inspecoes-lagos'
  },
  {
    id: 'f2',
    pageTitle: 'Manutenção de Áreas Verdes (F2)',
    selectorTitle: 'FORMULÁRIO F2 – MANUTENÇÃO DE ÁREAS VERDES',
    frequency: 'Obrigatório durante qualquer manejo de vegetação',
    purpose: 'Cobre corte de grama, poda, extração e limpeza associada',
    details: [
      {
        title: '1. Informações Gerais do Registro',
        description: 'Data, tipo de registro e estação do ano.'
      },
      {
        title: '2. Corte de Grama',
        description: 'Equipamento, período da atividade, aparas, quadrantes e fauna atraída.'
      },
      {
        title: '3. Poda ou Extração',
        description: 'Tipo de vegetação, autorização, espécies, aparas e localização.'
      },
      {
        title: '4. Observações Gerais',
        description: 'Campo livre para informações adicionais.'
      }
    ],
    externalRoute: '/inspecoes-areas-verdes'
  },
  {
    id: 'f3',
    pageTitle: 'Monitoramento de Focos de Atração (F3)',
    selectorTitle: 'FORMULÁRIO F3 – MONITORAMENTO DE FOCOS DE ATRAÇÃO',
    frequency: 'Periodicidade: Trimestral',
    purpose: 'Abrangência: Todo o sítio aeroportuário',
    details: [
      {
        title: '1. Informações Gerais do Registro',
        description: 'Data, estação do ano e chuva nas últimas 24h.'
      },
      {
        title: '2. Focos Secundários',
        description: 'Natureza do foco, ações, localização e presença de fauna.'
      },
      {
        title: '3. Áreas Verdes',
        description: 'Dados sobre gramados, árvores, arbustos ou outra vegetação.'
      },
      {
        title: '4. Sistema de Drenagem',
        description: 'Condição das caixas, bocas de lobo, valas, bacias e demais acumulações.'
      },
      {
        title: '5. Descarte Irregular',
        description: 'Tipologia dos resíduos, localização e remoção.'
      },
      {
        title: '6. Observações Gerais',
        description: 'Campo livre para notas adicionais.'
      }
    ],
    externalRoute: '/inspecoes-focos-atracao'
  },
  {
    id: 'f5',
    pageTitle: 'Identificação e Recolhimento de Carcaças (F5)',
    selectorTitle: 'F5 – FORMULÁRIO DE IDENTIFICAÇÃO, RECOLHIMENTO E DESTINAÇÃO DE CARCAÇA',
    frequency: 'Preenchimento toda vez que houver registro de colisão com fauna',
    purpose: 'Abrange registro geral do evento e destinação/controladoria da carcaça',
    details: [
      {
        title: '1. Informações Gerais',
        description: 'Aeroporto, data do registro e responsáveis.'
      },
      {
        title: '2. Localização do Evento',
        description: 'Pista, quadrante e se foi encontrada durante inspeção.'
      },
      {
        title: '3. Informações Sobre a Carcaça',
        description: 'Destinação, nomes popular/científico, número de indivíduos e fotos.'
      },
      {
        title: '4. Observações',
        description: 'Campo livre para detalhes adicionais.'
      }
    ],
    externalRoute: '/coletas-carcaca'
  },
  {
    id: 'residuos',
    pageTitle: 'Resíduos Enviados para Incineração',
    selectorTitle: 'FORMULÁRIO – RESÍDUOS ENVIADOS PARA INCINERAÇÃO',
    frequency: 'Preenchimento conforme geração de resíduos (especialmente voos internacionais)',
    purpose: 'Registro completo dos resíduos encaminhados à incineração.',
    details: [
      {
        title: '1. Identificação Geral',
        description: 'Nome da empresa, data e indicação de voos internacionais.'
      },
      {
        title: '2. Caracterização do Resíduo',
        description: 'Tipo, natureza, origem, codificação e frequência de geração.'
      },
      {
        title: '3. Quantificação',
        description: 'Peso, unidades e volume dos resíduos.'
      },
      {
        title: '4. Tratamento e Destinação',
        description: 'Incinerar, co-processar ou outro destino permitido.'
      },
      {
        title: '5. Registro',
        description: 'Responsável pelo preenchimento.'
      }
    ],
    externalRoute: '/residuos-incineracao'
  }
];
