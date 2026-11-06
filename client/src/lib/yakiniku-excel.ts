import * as XLSX from "xlsx";
import { ASSUMPTIONS, INITIAL_VALUES, SCENARIO_REVENUE_INITIAL, SIMPLE_TAX_BRACKETS } from "./yakiniku-assumptions";
import { calculateModel, solveBreakEvenRevenue, type ModelResult, type Values } from "./yakiniku-model";
import { applyWorkbookFormulas } from "./yakiniku-formulas";
import type { ScenarioState } from "./yakiniku-storage";

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/R\$|\s/g, "");
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

function validateImported(values: Values) {
  const rules: [string, number, number][] = [
    ["Mês de início da operação", 1, 12],
    ["Mês de estabilização", 7, 60],
    ["Modo de imposto", 1, 2],
    ["Critério do payback", 1, 2],
    ["Prazo do financiamento", 0, 60],
  ];
  const ids = ["p29", "p37", "p45", "p23", "p20"];
  rules.forEach(([name, minimum, maximum], index) => {
    const value = values[ids[index]];
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`${name}: informe um valor entre ${minimum} e ${maximum}.`);
    }
  });
  if (values.p26 !== 60) throw new Error("O horizonte da planilha original é fixo em 60 meses.");
  for (const assumption of ASSUMPTIONS) {
    if (!Number.isFinite(values[assumption.id])) throw new Error(`Valor inválido para “${assumption.label}”.`);
  }
}

export async function importConfiguration(file: File): Promise<ScenarioState> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => normalize(name) === "premissas");
  if (!sheetName) throw new Error("Não encontrei uma aba chamada “Premissas” neste arquivo.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });
  let headerIndex = -1;
  let idColumn = -1;
  let labelColumn = -1;
  let valueColumn = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const headers = rows[r].map(normalize);
    const id = headers.findIndex((header) => header === "id" || header === "identificador");
    const label = headers.findIndex((header) => ["premissa", "campo", "assumption", "nome"].includes(header));
    const val = headers.findIndex((header) => ["valor", "value", "entrada"].includes(header));
    if ((label >= 0 || id >= 0) && val >= 0) {
      headerIndex = r;
      idColumn = id;
      labelColumn = label;
      valueColumn = val;
      break;
    }
  }
  if (headerIndex < 0) throw new Error("A aba Premissas não contém colunas reconhecíveis de premissa e valor.");

  const byLabel = new Map(ASSUMPTIONS.map((item) => [normalize(item.label), item.id]));
  const nextValues = { ...INITIAL_VALUES };
  let scenarioRevenue = SCENARIO_REVENUE_INITIAL;
  let applied = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const id = idColumn >= 0 ? String(row[idColumn] ?? "").trim() : "";
    const label = labelColumn >= 0 ? normalize(row[labelColumn]) : "";
    if (id === "scenarioRevenue" || label === normalize("Receita mensal para simulação")) {
      const parsed = parseNumeric(row[valueColumn]);
      if (parsed !== null && parsed >= 0) scenarioRevenue = parsed;
      continue;
    }
    const assumptionId = /^p\d+$/.test(id) && id in nextValues ? id : byLabel.get(label);
    if (!assumptionId) continue;
    const parsed = parseNumeric(row[valueColumn]);
    if (parsed === null) continue;
    nextValues[assumptionId] = parsed;
    applied++;
  }
  if (applied === 0) throw new Error("Nenhuma premissa reconhecida foi encontrada na aba Premissas.");
  validateImported(nextValues);
  return { values: nextValues, scenarioRevenue };
}

const moneyFormat = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
const percentFormat = '0.0%;[Red](0.0%);-';
const setSheetStyle = (sheet: XLSX.WorkSheet, widths: number[], freezeRows = 1) => {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!freeze"] = { xSplit: 0, ySplit: freezeRows, topLeftCell: `A${freezeRows + 1}`, activePane: "bottomLeft", state: "frozen" };
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, (sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]!).e.r : 0)), c: widths.length - 1 } }) };
};
const addSheet = (wb: XLSX.WorkBook, name: string, rows: unknown[][], widths: number[]) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  setSheetStyle(sheet, widths);
  XLSX.utils.book_append_sheet(wb, sheet, name);
  return sheet;
};
const setNumberFormat = (sheet: XLSX.WorkSheet, col: number, startRow: number, endRow: number, format: string) => {
  for (let row = startRow; row <= endRow; row++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell) cell.z = format;
  }
};
const saveWorkbook = (workbook: XLSX.WorkBook, fileName: string) => {
  workbook.Props = {
    Title: "Simulador Financeiro Yakiniku — S.A. Casa do Sushi",
    Subject: "Premissas, projeções e indicadores financeiros",
    Author: "Simulador Financeiro Yakiniku",
    CreatedDate: new Date(),
  };
  workbook.Workbook = workbook.Workbook ?? {};
  (workbook.Workbook as unknown as Record<string, unknown>).CalcPr = { calcId: 191029, fullCalcOnLoad: true, forceFullCalc: true };
  XLSX.writeFile(workbook, fileName, { compression: true, cellStyles: true });
};

export function exportConfiguration(state: ScenarioState) {
  const rows: unknown[][] = [["ID", "Grupo", "Premissa", "Valor", "Observação / Fonte"]];
  for (const item of ASSUMPTIONS) rows.push([item.id, item.group, item.label, state.values[item.id], item.note]);
  rows.push(["scenarioRevenue", "Simulador de receita", "Receita mensal para simulação", state.scenarioRevenue, "Premissa auxiliar do cenário em regime; não altera o ramp-up mensal"]);
  const workbook = XLSX.utils.book_new();
  const sheet = addSheet(workbook, "Premissas", rows, [12, 22, 54, 18, 70]);
  sheet["!autofilter"] = { ref: `A1:E${rows.length}` };
  for (let i = 1; i <= ASSUMPTIONS.length; i++) {
    const assumption = ASSUMPTIONS[i - 1];
    const cell = sheet[`D${i + 1}`];
    if (assumption.kind === "money") cell.z = moneyFormat;
    if (assumption.kind === "percent") cell.z = percentFormat;
  }
  sheet[`D${ASSUMPTIONS.length + 2}`].z = moneyFormat;
  saveWorkbook(workbook, `Yakiniku_configuracao_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function breakEvenForTarget(v: Values, model: ModelResult, targetMonths?: number, financing = 0) {
  const initialInvestment = Math.round(v.p23) === 2 ? model.derived.capex : model.derived.investment;
  const targetCash = targetMonths ? initialInvestment / targetMonths : 0;
  return solveBreakEvenRevenue(v, model.derived, model.derived.fixedCostYear1 + financing + targetCash) ?? "n/d";
}

export function exportFullWorkbook(state: ScenarioState, model: ModelResult) {
  const v = state.values;
  const wb = XLSX.utils.book_new();

  const dashboardRows: unknown[][] = [
    ["CASA DO SUSHI | YAKINIKU", "Dashboard executivo"],
    ["Cenário calculado no navegador", new Date().toLocaleString("pt-BR")],
    ["Indicador", "Projeto econômico", "Visão do acionista", "Interpretação"],
  ];
  model.metrics.forEach((metric) => dashboardRows.push([metric.label, metric.project, metric.owner, metric.note]));
  const dash = addSheet(wb, "Dashboard", dashboardRows, [40, 22, 22, 62]);
  for (let r = 3; r < dashboardRows.length; r++) {
    const metric = model.metrics[r - 3];
    if (metric.format === "money") { dash[`B${r + 1}`].z = moneyFormat; dash[`C${r + 1}`].z = moneyFormat; }
    if (metric.format === "percent") { dash[`B${r + 1}`].z = percentFormat; dash[`C${r + 1}`].z = percentFormat; }
  }

  const premRows: unknown[][] = [["ID", "Grupo", "Premissa / cálculo", "Valor", "Observação / Fonte"]];
  for (const item of ASSUMPTIONS) premRows.push([item.id, item.group, item.label, v[item.id], item.note]);
  premRows.push(["scenarioRevenue", "Simulador de receita", "Receita mensal para simulação", state.scenarioRevenue, "Cenário em regime; não altera o ramp-up mensal"]);
  const derivedRows: unknown[][] = [
    ["", "Calculado", "CAPEX total (implantação + taxa)", model.derived.capex, "Soma das premissas de investimento C4:C12"],
    ["", "Calculado", "Capital de giro total", model.derived.workingCapital, "Estoque inicial + caixa mínimo"],
    ["", "Calculado", "Investimento total", model.derived.investment, "CAPEX + capital de giro"],
    ["", "Calculado", "Parcela mensal do financiamento", model.derived.financingPayment, "Tabela Price; fora do EBITDA"],
    ["", "Calculado", "Aporte próprio (equity)", model.derived.equity, "Investimento total − valor financiado"],
    ["", "Calculado", "WACC / TMA mensal", model.derived.waccMonthly, "Taxa mensal equivalente ao WACC anual"],
    ["", "Calculado", "Custos variáveis totais (sem impostos)", model.derived.variableRate, "CMV + royalties + marketing + cartão"],
    ["", "Calculado", "Margem de contribuição antes dos impostos", model.derived.contributionRate, "1 − custos variáveis totais"],
    ["", "Calculado", "Salário mensal com encargos por funcionário", model.derived.salaryWithBurden, "Salário-base × (1 + encargos)"],
    ["", "Calculado", "VT líquido por funcionário", model.derived.transportNet, "VT bruto limitado ao desconto do empregado"],
    ["", "Calculado", "Benefícios líquidos por funcionário", model.derived.benefitsPerEmployee, "Alimentação + seguro + VT líquido"],
    ["", "Calculado", "Custo mensal por funcionário", model.derived.employeeCost, "Salário com encargos + benefícios líquidos"],
    ["", "Calculado", "Folha mensal total", model.derived.payroll, "Funcionários × custo mensal por funcionário"],
    ["", "Calculado", "Demais custos fixos Ano 1", model.derived.otherFixedYear1, "Pró-labore + energia/água, gás, telefone, PDV, banco, contador e outros"],
    ["", "Calculado", "Custos fixos totais Ano 1 (mês médio)", model.derived.fixedCostYear1, "Equipe + aluguel médio com adicionais + demais fixos"],
  ];
  const taxRows: unknown[][] = [[], ["", "Simples Nacional — Anexo I", "", "", ""], ["", "Faixa", "RBT12 inicial", "Alíquota nominal", "Parcela a deduzir"]];
  SIMPLE_TAX_BRACKETS.forEach((band, index) => taxRows.push(["", `Faixa ${index + 1}`, band.from, band.rate, band.deduction]));
  const premSheet = addSheet(wb, "Premissas", [...premRows, ...derivedRows, ...taxRows], [16, 26, 56, 20, 74]);
  for (let i = 1; i <= ASSUMPTIONS.length; i++) {
    const assumption = ASSUMPTIONS[i - 1];
    if (assumption.kind === "money") premSheet[`D${i + 1}`].z = moneyFormat;
    if (assumption.kind === "percent") premSheet[`D${i + 1}`].z = percentFormat;
  }
  for (let i = 0; i < derivedRows.length; i++) premSheet[`D${ASSUMPTIONS.length + 3 + i}`].z = [5, 6, 7].includes(i) ? percentFormat : moneyFormat;
  premSheet[`D${ASSUMPTIONS.length + 2}`].z = moneyFormat;
  const firstTaxBandRow = ASSUMPTIONS.length + 2 + derivedRows.length + 4;
  for (let i = 0; i < SIMPLE_TAX_BRACKETS.length; i++) {
    const row = firstTaxBandRow + i;
    premSheet[`C${row}`].z = moneyFormat;
    premSheet[`D${row}`].z = percentFormat;
    premSheet[`E${row}`].z = moneyFormat;
  }

  const monthRows: unknown[][] = [[
    "Mês", "Mês calendário", "Cupons/dia", "Cupons no mês", "Ticket médio", "Receita bruta",
    "RBT12", "Alíquota efetiva", "Impostos", "Matéria-prima", "Royalties + fundo",
    "Taxas de cartão", "Margem de contribuição", "Equipe", "Aluguel", "Demais fixos",
    "EBITDA", "Parcela financiamento", "Fluxo do projeto", "Caixa livre acionista",
    "VP fluxo projeto", "VP fluxo acionista", "Caixa acumulado projeto",
    "Caixa acumulado acionista", "VP acumulado projeto", "VP acumulado acionista",
  ]];
  monthRows.push([0, "Investimento inicial", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -model.derived.investment, -model.derived.equity, -model.derived.investment, -model.derived.equity, -model.derived.investment, -model.derived.equity, -model.derived.investment, -model.derived.equity]);
  for (const m of model.months) monthRows.push([
    m.month, m.calendarMonth, m.couponsPerDay, m.coupons, m.ticket, m.revenue,
    m.rbt12, m.taxRate, m.taxes, m.cogs, m.royaltiesAndMarketing, m.cardFees,
    m.contribution, m.payroll, m.rent, m.otherFixed, m.ebitda, m.financing,
    m.projectFlow, m.ownerFlow, m.discountedProjectFlow, m.discountedOwnerFlow,
    m.cumulativeProject, m.cumulativeOwner, m.cumulativeDiscountedProject,
    m.cumulativeDiscountedOwner,
  ]);
  const proj = addSheet(wb, "Projecao_Mensal", monthRows, [10, 20, 13, 15, 16, 18, 18, 16, 17, 17, 18, 17, 20, 16, 16, 16, 17, 18, 20, 20, 18, 18, 21, 21, 21, 21]);
  for (let r = 2; r < monthRows.length; r++) {
    for (const c of [4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) proj[XLSX.utils.encode_cell({ r, c })].z = moneyFormat;
    proj[XLSX.utils.encode_cell({ r, c: 7 })].z = percentFormat;
  }

  const dreRows: unknown[][] = [["Conta", ...model.annual.map((a) => `Ano ${a.year}`), "Total 5 anos"]];
  const dreSpecs: [string, (a: typeof model.annual[number]) => number][] = [
    ["Receita bruta", (a) => a.revenue], ["(-) Impostos sobre vendas", (a) => a.taxes], ["Receita líquida", (a) => a.netRevenue],
    ["(-) Matéria-prima", (a) => a.cogs], ["(-) Royalties e fundo de propaganda", (a) => a.royaltiesAndMarketing], ["(-) Taxas de cartão", (a) => a.cardFees],
    ["Margem de contribuição", (a) => a.contribution], ["Margem de contribuição %", (a) => a.contributionMargin],
    ["(-) Equipe", (a) => a.payroll], ["(-) Aluguel", (a) => a.rent], ["(-) Demais fixos", (a) => a.otherFixed],
    ["EBITDA / Resultado operacional", (a) => a.ebitda], ["Margem EBITDA %", (a) => a.ebitdaMargin],
    ["(-) Parcelas do financiamento", (a) => a.financing], ["Caixa livre do acionista", (a) => a.ownerCash],
    ["Caixa acumulado — fim do ano", (a) => a.endingCash], ["Cupons atendidos no ano", (a) => a.coupons], ["Ticket médio do ano", (a) => a.averageTicket],
  ];
  dreSpecs.forEach(([label, value], index) => {
    const values = model.annual.map(value);
    const isRatio = label.endsWith("%");
    const total = isRatio ? (index === 7 ? model.annual.reduce((s, a) => s + a.contribution, 0) / Math.max(1, model.annual.reduce((s, a) => s + a.revenue, 0)) : model.annual.reduce((s, a) => s + a.ebitda, 0) / Math.max(1, model.annual.reduce((s, a) => s + a.revenue, 0))) : label.includes("acumulado") ? model.annual.at(-1)?.endingCash ?? 0 : values.reduce((s, x) => s + x, 0);
    dreRows.push([label, ...values, total]);
  });
  const dreSheet = addSheet(wb, "DRE_Anual", dreRows, [38, 18, 18, 18, 18, 18, 20]);
  for (let r = 1; r < dreRows.length; r++) {
    const isPercent = String(dreRows[r][0]).endsWith("%");
    for (let c = 1; c < dreRows[r].length; c++) dreSheet[XLSX.utils.encode_cell({ r, c })].z = isPercent ? percentFormat : moneyFormat;
  }

  const indicatorRows: unknown[][] = [["Indicador", "Projeto econômico", "Visão do acionista (após financiamento)", "Interpretação"]];
  model.metrics.forEach((metric) => indicatorRows.push([metric.label, metric.project, metric.owner, metric.note]));
  const indicatorSheet = addSheet(wb, "Indicadores", indicatorRows, [42, 23, 34, 72]);
  model.metrics.forEach((metric, i) => {
    if (metric.format === "money") { indicatorSheet[`B${i + 2}`].z = moneyFormat; indicatorSheet[`C${i + 2}`].z = moneyFormat; }
    if (metric.format === "percent") { indicatorSheet[`B${i + 2}`].z = percentFormat; indicatorSheet[`C${i + 2}`].z = percentFormat; }
  });

  const s = model.scenario;
  const scenarioRows: unknown[][] = [
    ["Simulador de receita — valores em regime (sem ramp-up), custos fixos do Ano 1"],
    ["Indicador", "Resultado", "Observação"],
    ["Receita simulada mensal", s.revenue, "Premissa auxiliar editável na página"],
    ["Cupons no mês", s.couponsPerMonth, "Receita ÷ ticket médio"], ["Cupons por dia", s.couponsPerDay, "Cupons no mês ÷ dias de operação"],
    ["Cupons por hora", s.couponsPerHour, "Cupons por dia ÷ horas de atendimento"], ["Custos variáveis (sem impostos)", s.variableCosts, "Receita × taxa variável total"],
    ["Impostos", s.taxes, "Regime de imposto selecionado"], ["Alíquota efetiva", s.taxRate, "Fixa ou Simples Nacional Anexo I"],
    ["Custos fixos (Ano 1)", s.fixedCosts, "Equipe + aluguel médio com adicionais + demais fixos"],
    ["Resultado mensal (EBITDA)", s.ebitda, "Receita − custos variáveis − impostos − custos fixos"],
    ["Lucratividade sobre faturamento", s.profitMargin, "EBITDA ÷ receita"], ["Rentabilidade mensal sobre investimento", s.returnOnInvestment, "EBITDA ÷ base do payback selecionada"],
    ["Payback simples (meses)", s.simplePayback, "Base do payback ÷ EBITDA; sem retorno quando EBITDA ≤ 0"],
    ["Ponto de equilíbrio — receita mensal", model.breakevenRevenue ?? "n/d", "Ponto de equilíbrio com impostos"],
    ["Receita necessária — payback 24 meses", breakEvenForTarget(v, model, 24), "Receita necessária para EBITDA atingir o custo fixo + investimento/24"],
    ["Receita necessária — payback 12 meses", breakEvenForTarget(v, model, 12), "Receita necessária para EBITDA atingir o custo fixo + investimento/12"],
    ["Receita necessária do acionista (+ parcela)", breakEvenForTarget(v, model, undefined, model.derived.financingPayment), "Equilíbrio mensal do acionista incluindo a parcela"],
  ];
  const simSheet = addSheet(wb, "Simulador_Receita", scenarioRows, [48, 23, 70]);
  for (const r of [3, 8, 10, 11, 15, 16, 17, 18]) simSheet[`B${r}`].z = moneyFormat;
  for (const r of [9, 12, 13]) simSheet[`B${r}`].z = percentFormat;

  const ticketChanges = [-0.1, -0.05, 0, 0.05, 0.1];
  const cogsCases = [0.36, 0.38, 0.4, 0.42, 0.44];
  const sensitivityRows: unknown[][] = [["Sensibilidade do EBITDA mensal estabilizado — valores em R$"], ["Variação do volume", "Cupons/dia", ...ticketChanges.map((change) => `Ticket ${change >= 0 ? "+" : ""}${(change * 100).toFixed(0)}%`)]];
  const stableCouponsPerDay = model.months[Math.round(v.p37) - 1]?.couponsPerDay ?? v.p36;
  model.sensitivityTicket.forEach((row) => sensitivityRows.push([row.volumeChange, stableCouponsPerDay * (1 + row.volumeChange), ...row.values]));
  sensitivityRows.push([], ["Variação do volume", "Cupons/dia", ...cogsCases.map((cogs) => `CMV ${(cogs * 100).toFixed(0)}%`)]);
  model.sensitivityCogs.forEach((row) => sensitivityRows.push([row.volumeChange, stableCouponsPerDay * (1 + row.volumeChange), ...row.values]));
  const sensSheet = addSheet(wb, "Sensibilidade", sensitivityRows, [25, 17, 19, 19, 19, 19, 19]);
  for (let r = 2; r < sensitivityRows.length; r++) for (let c = 2; c <= 6; c++) if (sensSheet[XLSX.utils.encode_cell({ r, c })]) sensSheet[XLSX.utils.encode_cell({ r, c })].z = moneyFormat;

  addSheet(wb, "Leia_me", [
    ["Tema", "Descrição"], ["Objetivo", "Simulador financeiro da unidade Yakiniku da S.A. Casa do Sushi."],
    ["Fonte", "Premissas e estrutura transpostas de BP_Simulador_Yakiniku_SA_Casa_do_Sushi_v2_auditado.xlsx."],
    ["Base dos cálculos", "Valores calculados na página no momento da exportação; a aba Projecao_Mensal detalha a projeção de 60 meses."],
    ["Impostos", "Modo 1 usa alíquota média fixa. Modo 2 estima Simples Nacional Anexo I pela receita bruta acumulada em 12 meses."],
    ["Financiamento", "A prestação calculada pela Tabela Price é subtraída após EBITDA na visão do acionista."],
    ["Limitações herdadas", "Não considera depreciação, reinvestimentos (CAPEX de manutenção), sazonalidade de vendas, nem prazos de recebimento de cartão."],
    ["Aviso", "Projeções são estimativas e não garantem resultados. Validar premissas fiscais, trabalhistas e operacionais com os responsáveis."],
  ], [26, 110]);

  applyWorkbookFormulas(wb, state, model);
  saveWorkbook(wb, `Yakiniku_simulador_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
