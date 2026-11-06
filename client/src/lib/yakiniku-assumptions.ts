export type AssumptionKind = "money" | "percent" | "integer" | "number";
export interface Assumption { id: string; row: number; group: string; label: string; value: number; note: string; kind: AssumptionKind; choices?: { value: number; label: string }[] }
export const ASSUMPTIONS: Assumption[] = [
  {
    "id": "p4",
    "row": 4,
    "group": "Investimento",
    "label": "Taxa de franquia",
    "value": 50000,
    "note": "Projeção Yakiniku = R$ 50 mil. A COF indica R$ 60 mil para o Yakiniku – validar",
    "kind": "money"
  },
  {
    "id": "p5",
    "row": 5,
    "group": "Investimento",
    "label": "Equipamentos, utensílios e decoração",
    "value": 250000,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p6",
    "row": 6,
    "group": "Investimento",
    "label": "Buffet padrão + móveis",
    "value": 140000,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p7",
    "row": 7,
    "group": "Investimento",
    "label": "Embalagens, uniformes, comandas etc.",
    "value": 10000,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p8",
    "row": 8,
    "group": "Investimento",
    "label": "Fachada (identidade visual)",
    "value": 25000,
    "note": "Variável conforme ponto",
    "kind": "money"
  },
  {
    "id": "p9",
    "row": 9,
    "group": "Investimento",
    "label": "Reforma do ponto",
    "value": 100000,
    "note": "Variável conforme ponto",
    "kind": "money"
  },
  {
    "id": "p10",
    "row": 10,
    "group": "Investimento",
    "label": "Abertura de CNPJ",
    "value": 1500,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p11",
    "row": 11,
    "group": "Investimento",
    "label": "Alvarás e afins",
    "value": 1000,
    "note": "Variável conforme município",
    "kind": "money"
  },
  {
    "id": "p12",
    "row": 12,
    "group": "Investimento",
    "label": "Arquiteto",
    "value": 10000,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p14",
    "row": 14,
    "group": "Investimento",
    "label": "Estoque inicial",
    "value": 30000,
    "note": "Projeção de Investimentos Yakiniku",
    "kind": "money"
  },
  {
    "id": "p15",
    "row": 15,
    "group": "Investimento",
    "label": "Capital de giro adicional (caixa mínimo)",
    "value": 0,
    "note": "Reserva para cobrir o ramp-up – recomendável avaliar",
    "kind": "money"
  },
  {
    "id": "p18",
    "row": 18,
    "group": "Financiamento",
    "label": "Valor financiado",
    "value": 0,
    "note": "Informar o principal, se houver",
    "kind": "money"
  },
  {
    "id": "p19",
    "row": 19,
    "group": "Financiamento",
    "label": "Taxa de juros mensal do financiamento",
    "value": 0.015,
    "note": "Usar o CET mensal da proposta",
    "kind": "percent"
  },
  {
    "id": "p20",
    "row": 20,
    "group": "Financiamento",
    "label": "Prazo do financiamento (meses)",
    "value": 48,
    "note": "Meses com pagamento (1 a 60)",
    "kind": "integer"
  },
  {
    "id": "p23",
    "row": 23,
    "group": "Avaliação",
    "label": "Base do payback no Simulador_Receita (1 ou 2)",
    "value": 1,
    "note": "1 = investimento total (CAPEX + giro, recomendado) | 2 = só CAPEX (critério da Projeção original)",
    "kind": "number",
    "choices": [
      {
        "value": 1,
        "label": "Investimento total (recomendado)"
      },
      {
        "value": 2,
        "label": "Somente CAPEX"
      }
    ]
  },
  {
    "id": "p24",
    "row": 24,
    "group": "Avaliação",
    "label": "WACC / TMA anual",
    "value": 0.18,
    "note": "Taxa de desconto do projeto",
    "kind": "percent"
  },
  {
    "id": "p26",
    "row": 26,
    "group": "Avaliação",
    "label": "Horizonte da análise (meses)",
    "value": 60,
    "note": "Estrutura fixa de 60 meses; premissa não editável",
    "kind": "integer"
  },
  {
    "id": "p27",
    "row": 27,
    "group": "Avaliação",
    "label": "Valor residual no final (mês 60)",
    "value": 0,
    "note": "Premissa conservadora",
    "kind": "money"
  },
  {
    "id": "p28",
    "row": 28,
    "group": "Avaliação",
    "label": "Recuperação do capital de giro no mês 60",
    "value": 0,
    "note": "% do capital de giro recuperado",
    "kind": "percent"
  },
  {
    "id": "p29",
    "row": 29,
    "group": "Avaliação",
    "label": "Mês calendário de início da operação (1–12)",
    "value": 1,
    "note": "1 = janeiro … 12 = dezembro; usado nos adicionais de aluguel",
    "kind": "integer"
  },
  {
    "id": "p30",
    "row": 30,
    "group": "Receita",
    "label": "Ticket médio",
    "value": 93,
    "note": "Projeção Yakiniku (ticket médio 2023)",
    "kind": "money"
  },
  {
    "id": "p31",
    "row": 31,
    "group": "Receita",
    "label": "Reajuste anual do ticket médio",
    "value": 0.045,
    "note": "Aplicado a cada 12 meses de operação",
    "kind": "percent"
  },
  {
    "id": "p32",
    "row": 32,
    "group": "Receita",
    "label": "Dias de operação/mês",
    "value": 30,
    "note": "Projeção: 3.225,8 cupons/mês ÷ 107,5/dia",
    "kind": "integer"
  },
  {
    "id": "p33",
    "row": 33,
    "group": "Receita",
    "label": "Horas de atendimento/dia",
    "value": 6,
    "note": "Projeção: 107,5 cupons/dia ÷ 17,9/hora",
    "kind": "integer"
  },
  {
    "id": "p34",
    "row": 34,
    "group": "Receita",
    "label": "Cupons/dia no M1",
    "value": 60,
    "note": "Ramp-up – premissa a validar com a rede",
    "kind": "integer"
  },
  {
    "id": "p35",
    "row": 35,
    "group": "Receita",
    "label": "Cupons/dia no M6",
    "value": 90,
    "note": "Ramp-up – premissa a validar com a rede",
    "kind": "integer"
  },
  {
    "id": "p36",
    "row": 36,
    "group": "Receita",
    "label": "Cupons/dia estabilizado",
    "value": 107.5,
    "note": "Equivale a R$ 300 mil/mês da Projeção",
    "kind": "number"
  },
  {
    "id": "p37",
    "row": 37,
    "group": "Receita",
    "label": "Mês de estabilização (7 a 60)",
    "value": 8,
    "note": "Interpolação linear entre M6 e a estabilização",
    "kind": "integer"
  },
  {
    "id": "p38",
    "row": 38,
    "group": "Receita",
    "label": "Crescimento anual de volume após estabilização",
    "value": 0,
    "note": "Aplicado a cada 12 meses após a estabilização",
    "kind": "percent"
  },
  {
    "id": "p39",
    "row": 39,
    "group": "Custos variáveis",
    "label": "Matéria-prima (CMV)",
    "value": 0.4,
    "note": "Projeção Yakiniku",
    "kind": "percent"
  },
  {
    "id": "p40",
    "row": 40,
    "group": "Custos variáveis",
    "label": "Royalties",
    "value": 0.05,
    "note": "COF – 5% do faturamento",
    "kind": "percent"
  },
  {
    "id": "p41",
    "row": 41,
    "group": "Custos variáveis",
    "label": "Fundo de propaganda",
    "value": 0.01,
    "note": "COF – 1% do faturamento",
    "kind": "percent"
  },
  {
    "id": "p42",
    "row": 42,
    "group": "Custos variáveis",
    "label": "Taxas de cartão crédito/débito",
    "value": 0.015,
    "note": "Projeção: R$ 4.500 sobre R$ 300 mil",
    "kind": "percent"
  },
  {
    "id": "p45",
    "row": 45,
    "group": "Impostos",
    "label": "Modo de cálculo do imposto (1 ou 2)",
    "value": 1,
    "note": "1 = alíquota média fixa (Projeção) | 2 = Simples Nacional Anexo I efetivo (RBT12)",
    "kind": "number",
    "choices": [
      {
        "value": 1,
        "label": "Alíquota média fixa"
      },
      {
        "value": 2,
        "label": "Simples Nacional — Anexo I"
      }
    ]
  },
  {
    "id": "p46",
    "row": 46,
    "group": "Impostos",
    "label": "Alíquota média fixa (modo 1)",
    "value": 0.08,
    "note": "Projeção: média de 8%",
    "kind": "percent"
  },
  {
    "id": "p47",
    "row": 47,
    "group": "Equipe",
    "label": "Quantidade de funcionários",
    "value": 13,
    "note": "Projeção = 13; a COF indica 18 posições no Yakiniku (incl. proprietário)",
    "kind": "integer"
  },
  {
    "id": "p48",
    "row": 48,
    "group": "Equipe",
    "label": "Salário-base por funcionário",
    "value": 1880,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p49",
    "row": 49,
    "group": "Equipe",
    "label": "Auxílio refeição/alimentação e plano por funcionário",
    "value": 180,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p50",
    "row": 50,
    "group": "Equipe",
    "label": "Seguro mensal por funcionário",
    "value": 0,
    "note": "Não previsto na Projeção",
    "kind": "money"
  },
  {
    "id": "p51",
    "row": 51,
    "group": "Equipe",
    "label": "Vale-transporte por dia",
    "value": 0,
    "note": "Não detalhado na Projeção",
    "kind": "money"
  },
  {
    "id": "p52",
    "row": 52,
    "group": "Equipe",
    "label": "Dias de VT por funcionário",
    "value": 26,
    "note": "Por funcionário",
    "kind": "integer"
  },
  {
    "id": "p53",
    "row": 53,
    "group": "Equipe",
    "label": "Encargos e provisões sobre salário",
    "value": 0.3999787,
    "note": "Projeção: FGTS 8%, férias, 1/3, 13º, aviso, multa = R$ 751,96 s/ R$ 1.880 (39,998%)",
    "kind": "percent"
  },
  {
    "id": "p54",
    "row": 54,
    "group": "Equipe",
    "label": "Desconto do funcionário no VT",
    "value": 0.06,
    "note": "% do salário, limitado ao custo do VT",
    "kind": "percent"
  },
  {
    "id": "p60",
    "row": 60,
    "group": "Fixos",
    "label": "Pró-labore mensal",
    "value": 0,
    "note": "Não previsto na Projeção – recomendável considerar",
    "kind": "money"
  },
  {
    "id": "p61",
    "row": 61,
    "group": "Fixos",
    "label": "Aluguel mensal base",
    "value": 7200,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p62",
    "row": 62,
    "group": "Fixos",
    "label": "Adicional de aluguel em maio",
    "value": 0,
    "note": "% sobre o aluguel (ex.: shopping)",
    "kind": "percent"
  },
  {
    "id": "p63",
    "row": 63,
    "group": "Fixos",
    "label": "Adicional de aluguel em novembro",
    "value": 0,
    "note": "% sobre o aluguel",
    "kind": "percent"
  },
  {
    "id": "p64",
    "row": 64,
    "group": "Fixos",
    "label": "Adicional de aluguel em dezembro",
    "value": 0,
    "note": "% sobre o aluguel (13º aluguel)",
    "kind": "percent"
  },
  {
    "id": "p65",
    "row": 65,
    "group": "Fixos",
    "label": "Energia + água",
    "value": 4000,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p66",
    "row": 66,
    "group": "Fixos",
    "label": "Gás",
    "value": 800,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p67",
    "row": 67,
    "group": "Fixos",
    "label": "Telefone/internet",
    "value": 400,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p68",
    "row": 68,
    "group": "Fixos",
    "label": "Sistema PDV",
    "value": 330,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p69",
    "row": 69,
    "group": "Fixos",
    "label": "Manutenção bancária (conta, maquininha)",
    "value": 129,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p70",
    "row": 70,
    "group": "Fixos",
    "label": "Contador",
    "value": 1500,
    "note": "Projeção Yakiniku",
    "kind": "money"
  },
  {
    "id": "p71",
    "row": 71,
    "group": "Fixos",
    "label": "Manutenção e outros fixos",
    "value": 0,
    "note": "Não previsto na Projeção",
    "kind": "money"
  },
  {
    "id": "p72",
    "row": 72,
    "group": "Fixos",
    "label": "Reajuste anual dos custos fixos",
    "value": 0.045,
    "note": "Aplicado à equipe, aluguel e demais fixos",
    "kind": "percent"
  }
];
export const INITIAL_VALUES: Record<string, number> = Object.fromEntries(ASSUMPTIONS.map((item) => [item.id, item.value]));
export const SIMPLE_TAX_BRACKETS = [{"from": 0, "rate": 0.04, "deduction": 0}, {"from": 180000.01, "rate": 0.073, "deduction": 5940}, {"from": 360000.01, "rate": 0.095, "deduction": 13860}, {"from": 720000.01, "rate": 0.107, "deduction": 22500}, {"from": 1800000.01, "rate": 0.143, "deduction": 87300}, {"from": 3600000.01, "rate": 0.19, "deduction": 378000}] as const;
export const SIMPLE_TAX_LIMIT = 4800000;
export const SCENARIO_REVENUE_INITIAL = 300000;
