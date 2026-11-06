import { SIMPLE_TAX_BRACKETS, SIMPLE_TAX_LIMIT } from "./yakiniku-assumptions";

export type Values = Record<string, number>;

export interface MonthProjection {
  month: number;
  calendarMonth: number;
  couponsPerDay: number;
  coupons: number;
  ticket: number;
  revenue: number;
  rbt12: number;
  taxRate: number;
  taxes: number;
  cogs: number;
  royaltiesAndMarketing: number;
  cardFees: number;
  contribution: number;
  payroll: number;
  rent: number;
  otherFixed: number;
  ebitda: number;
  financing: number;
  projectFlow: number;
  ownerFlow: number;
  discountedProjectFlow: number;
  discountedOwnerFlow: number;
  cumulativeProject: number;
  cumulativeOwner: number;
  cumulativeDiscountedProject: number;
  cumulativeDiscountedOwner: number;
}

export interface AnnualDRE {
  year: number;
  revenue: number;
  taxes: number;
  netRevenue: number;
  cogs: number;
  royaltiesAndMarketing: number;
  cardFees: number;
  contribution: number;
  contributionMargin: number;
  payroll: number;
  rent: number;
  otherFixed: number;
  ebitda: number;
  ebitdaMargin: number;
  financing: number;
  ownerCash: number;
  endingCash: number;
  coupons: number;
  averageTicket: number;
}

export interface Metric {
  id: string;
  label: string;
  project: number | string;
  owner: number | string;
  note: string;
  format: "money" | "percent" | "number" | "months" | "coupons" | "text";
}

export interface ScenarioResult {
  revenue: number;
  couponsPerMonth: number;
  couponsPerDay: number;
  couponsPerHour: number;
  variableCosts: number;
  taxes: number;
  taxRate: number;
  fixedCosts: number;
  ebitda: number;
  profitMargin: number;
  returnOnInvestment: number;
  simplePayback: number | string;
}

export interface ModelResult {
  derived: ReturnType<typeof deriveAssumptions>;
  months: MonthProjection[];
  annual: AnnualDRE[];
  metrics: Metric[];
  scenario: ScenarioResult;
  breakevenRevenue: number | null;
  breakevenOwnerRevenue: number | null;
  stableRevenue: number;
  stableEbitda: number;
  stableOwnerCash: number;
  stableTaxRate: number;
  monthlyDiscountRate: number;
  projectNpv: number;
  ownerNpv: number;
  projectIrrMonthly: number | null;
  ownerIrrMonthly: number | null;
  projectMirrMonthly: number | null;
  ownerMirrMonthly: number | null;
  sensitivityTicket: { volumeChange: number; values: number[] }[];
  sensitivityCogs: { volumeChange: number; values: number[] }[];
}

const n = (v: Values, id: number | string) => Number(v[`p${id}`] ?? 0);
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function deriveAssumptions(v: Values) {
  const capex = [4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((s, id) => s + n(v, id), 0);
  const workingCapital = n(v, 14) + n(v, 15);
  const investment = capex + workingCapital;
  const financed = n(v, 18);
  const term = Math.max(0, Math.round(n(v, 20)));
  const monthlyInterest = n(v, 19);
  const financingPayment = financed <= 0 || term <= 0
    ? 0
    : monthlyInterest === 0
      ? financed / term
      : financed * monthlyInterest / (1 - Math.pow(1 + monthlyInterest, -term));
  const equity = investment - financed;
  const waccMonthly = Math.pow(1 + n(v, 24), 1 / 12) - 1;
  const salaryWithBurden = n(v, 48) * (1 + n(v, 53));
  const transportGross = n(v, 51) * n(v, 52);
  const transportNet = Math.max(0, transportGross - Math.min(transportGross, n(v, 48) * n(v, 54)));
  const benefitsPerEmployee = n(v, 49) + n(v, 50) + transportNet;
  const employeeCost = salaryWithBurden + benefitsPerEmployee;
  const payroll = n(v, 47) * employeeCost;
  const otherFixedYear1 = n(v, 60) + [65, 66, 67, 68, 69, 70, 71].reduce((s, id) => s + n(v, id), 0);
  const annualRentSurcharges = n(v, 62) + n(v, 63) + n(v, 64);
  const fixedCostYear1 = payroll + n(v, 61) * (1 + annualRentSurcharges / 12) + otherFixedYear1;
  const variableRate = [39, 40, 41, 42].reduce((s, id) => s + n(v, id), 0);
  const contributionRate = 1 - variableRate;
  return {
    capex, workingCapital, investment, financed, term, monthlyInterest,
    financingPayment, equity, waccMonthly, salaryWithBurden,
    transportNet, benefitsPerEmployee, employeeCost, payroll,
    otherFixedYear1, annualRentSurcharges, fixedCostYear1,
    variableRate, contributionRate,
  };
}

function simpleEffectiveRate(annualRevenue: number) {
  if (annualRevenue <= 0) return 0;
  let bracket: (typeof SIMPLE_TAX_BRACKETS)[number] = SIMPLE_TAX_BRACKETS[0];
  for (const candidate of SIMPLE_TAX_BRACKETS) {
    if (annualRevenue >= candidate.from) bracket = candidate;
    else break;
  }
  return Math.max(0, (annualRevenue * bracket.rate - bracket.deduction) / annualRevenue);
}

function taxRate(v: Values, annualRevenue: number) {
  return Math.round(n(v, 45)) === 1 ? n(v, 46) : simpleEffectiveRate(annualRevenue);
}

export function solveBreakEvenRevenue(v: Values, d: ReturnType<typeof deriveAssumptions>, fixed: number): number | null {
  if (fixed <= 0) return 0;
  if (Math.round(n(v, 45)) === 1) {
    const margin = d.contributionRate - n(v, 46);
    return margin > 0 ? fixed / margin : null;
  }
  for (let index = 0; index < SIMPLE_TAX_BRACKETS.length; index++) {
    const bracket = SIMPLE_TAX_BRACKETS[index];
    const margin = d.contributionRate - bracket.rate;
    if (margin <= 0) continue;
    const revenue = (fixed - bracket.deduction / 12) / margin;
    if (revenue < 0) continue;
    const annualRevenue = revenue * 12;
    const nextBracket = SIMPLE_TAX_BRACKETS[index + 1];
    const upper = nextBracket ? nextBracket.from - 0.01 : Number.POSITIVE_INFINITY;
    if (annualRevenue + 1e-7 >= bracket.from && annualRevenue <= upper + 1e-7) return revenue;
  }
  return null;
}

function firstPayback(flows: number[]) {
  let balance = flows[0] ?? 0;
  if (balance >= 0) return 0;
  for (let i = 1; i < flows.length; i++) {
    balance += flows[i];
    if (balance >= 0) return i;
  }
  return null;
}

function irr(flows: number[]): number | null {
  if (!flows.some((x) => x > 0) || !flows.some((x) => x < 0)) return null;
  const npv = (rate: number) => flows.reduce((sum, flow, period) => sum + flow / Math.pow(1 + rate, period), 0);
  let low = -0.9999;
  let high = 1;
  let lowNpv = npv(low);
  let highNpv = npv(high);
  for (let i = 0; i < 60 && lowNpv * highNpv > 0; i++) {
    high = high * 2 + 1;
    highNpv = npv(high);
    if (!Number.isFinite(highNpv)) break;
  }
  if (!Number.isFinite(lowNpv) || !Number.isFinite(highNpv) || lowNpv * highNpv > 0) return null;
  for (let i = 0; i < 160; i++) {
    const mid = (low + high) / 2;
    const midNpv = npv(mid);
    if (!Number.isFinite(midNpv)) return null;
    if (Math.abs(midNpv) < 1e-7) return mid;
    if (lowNpv * midNpv <= 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }
  return (low + high) / 2;
}

function mirr(flows: number[], rate: number): number | null {
  const lastPeriod = flows.length - 1;
  let pvNegative = 0;
  let fvPositive = 0;
  flows.forEach((flow, period) => {
    if (flow < 0) pvNegative += flow / Math.pow(1 + rate, period);
    if (flow > 0) fvPositive += flow * Math.pow(1 + rate, lastPeriod - period);
  });
  if (pvNegative === 0 || fvPositive <= 0 || lastPeriod <= 0) return null;
  return Math.pow(fvPositive / -pvNegative, 1 / lastPeriod) - 1;
}

function fmtPayback(value: number | null): number | string {
  return value === null ? "> 60 meses" : value;
}

function scenarioForRevenue(v: Values, d: ReturnType<typeof deriveAssumptions>, revenue: number, stableFixed = d.fixedCostYear1): ScenarioResult {
  const tax = taxRate(v, revenue * 12);
  const taxes = revenue * tax;
  const variableCosts = revenue * d.variableRate;
  const ebitda = revenue - variableCosts - taxes - stableFixed;
  const couponsPerMonth = n(v, 30) > 0 ? revenue / n(v, 30) : 0;
  const couponsPerDay = n(v, 32) > 0 ? couponsPerMonth / n(v, 32) : 0;
  const baseInvestment = Math.round(n(v, 23)) === 2 ? d.capex : d.investment;
  return {
    revenue, couponsPerMonth, couponsPerDay,
    couponsPerHour: n(v, 33) > 0 ? couponsPerDay / n(v, 33) : 0,
    variableCosts, taxes, taxRate: tax, fixedCosts: stableFixed,
    ebitda, profitMargin: safeDiv(ebitda, revenue),
    returnOnInvestment: safeDiv(ebitda, baseInvestment),
    simplePayback: ebitda <= 0 ? "Sem retorno" : baseInvestment / ebitda,
  };
}

export function calculateModel(v: Values, scenarioRevenue = 300000): ModelResult {
  const d = deriveAssumptions(v);
  const horizon = 60;
  const terminalMonth = horizon;
  const stabilizationMonth = clamp(Math.round(n(v, 37) || 8), 7, 60);
  const operatingDays = Math.max(0, n(v, 32));
  const startCalendarMonth = clamp(Math.round(n(v, 29) || 1), 1, 12);
  const months: MonthProjection[] = [];
  let cumulativeProject = -d.investment;
  let cumulativeOwner = -d.equity;
  let cumulativeDiscountedProject = -d.investment;
  let cumulativeDiscountedOwner = -d.equity;
  const rows = horizon;

  for (let month = 1; month <= rows; month++) {
    const calendarMonth = ((startCalendarMonth + month - 2) % 12) + 1;
    let couponsPerDay: number;
    if (month === 1) couponsPerDay = n(v, 34);
    else if (month <= 6) couponsPerDay = n(v, 34) + (n(v, 35) - n(v, 34)) * (month - 1) / 5;
    else if (month < stabilizationMonth) couponsPerDay = n(v, 35) + (n(v, 36) - n(v, 35)) * (month - 6) / Math.max(1, stabilizationMonth - 6);
    else couponsPerDay = n(v, 36) * Math.pow(1 + n(v, 38), Math.floor((month - stabilizationMonth) / 12));
    couponsPerDay = Math.max(0, couponsPerDay);
    const coupons = couponsPerDay * operatingDays;
    const ticket = n(v, 30) * Math.pow(1 + n(v, 31), Math.floor((month - 1) / 12));
    const revenue = coupons * ticket;
    const trailingMonths = months.slice(Math.max(0, months.length - 12));
    const rbt12 = month === 1
      ? revenue * 12
      : trailingMonths.reduce((sum, row) => sum + row.revenue, 0) * (trailingMonths.length < 12 ? 12 / Math.max(1, trailingMonths.length) : 1);
    const rate = taxRate(v, rbt12);
    const taxes = revenue * rate;
    const cogs = revenue * n(v, 39);
    const royaltiesAndMarketing = revenue * (n(v, 40) + n(v, 41));
    const cardFees = revenue * n(v, 42);
    const contribution = revenue - taxes - cogs - royaltiesAndMarketing - cardFees;
    const inflationFactor = Math.pow(1 + n(v, 72), Math.floor((month - 1) / 12));
    const payroll = d.payroll * inflationFactor;
    const surcharge = calendarMonth === 5 ? n(v, 62) : calendarMonth === 11 ? n(v, 63) : calendarMonth === 12 ? n(v, 64) : 0;
    const rent = n(v, 61) * (1 + surcharge) * inflationFactor;
    const otherFixed = d.otherFixedYear1 * inflationFactor;
    const ebitda = contribution - payroll - rent - otherFixed;
    const financing = month <= d.term ? d.financingPayment : 0;
    const terminalValue = month === terminalMonth ? n(v, 27) + d.workingCapital * n(v, 28) : 0;
    const projectFlow = ebitda + terminalValue;
    const ownerFlow = ebitda - financing + terminalValue;
    const discountedProjectFlow = projectFlow / Math.pow(1 + d.waccMonthly, month);
    const discountedOwnerFlow = ownerFlow / Math.pow(1 + d.waccMonthly, month);
    cumulativeProject += projectFlow;
    cumulativeOwner += ownerFlow;
    cumulativeDiscountedProject += discountedProjectFlow;
    cumulativeDiscountedOwner += discountedOwnerFlow;
    months.push({
      month, calendarMonth, couponsPerDay, coupons, ticket, revenue, rbt12,
      taxRate: rate, taxes, cogs, royaltiesAndMarketing, cardFees, contribution,
      payroll, rent, otherFixed, ebitda, financing, projectFlow, ownerFlow,
      discountedProjectFlow, discountedOwnerFlow, cumulativeProject,
      cumulativeOwner, cumulativeDiscountedProject, cumulativeDiscountedOwner,
    });
  }

  const annual: AnnualDRE[] = [];
  for (let year = 0; year < Math.ceil(rows / 12); year++) {
    const ms = months.slice(year * 12, (year + 1) * 12);
    const sum = (key: keyof MonthProjection) => ms.reduce((total, m) => total + Number(m[key]), 0);
    const revenue = sum("revenue");
    const coupons = sum("coupons");
    const contribution = sum("contribution");
    const ebitda = sum("ebitda");
    annual.push({
      year: year + 1, revenue, taxes: sum("taxes"), netRevenue: revenue - sum("taxes"),
      cogs: sum("cogs"), royaltiesAndMarketing: sum("royaltiesAndMarketing"),
      cardFees: sum("cardFees"), contribution, contributionMargin: safeDiv(contribution, revenue),
      payroll: sum("payroll"), rent: sum("rent"), otherFixed: sum("otherFixed"),
      ebitda, ebitdaMargin: safeDiv(ebitda, revenue), financing: sum("financing"),
      ownerCash: sum("ownerFlow"), endingCash: ms.at(-1)?.cumulativeOwner ?? -d.equity,
      coupons, averageTicket: safeDiv(revenue, coupons),
    });
  }
  const sumInitial = (key: keyof MonthProjection) => months.reduce((sum, m) => sum + Number(m[key]), 0);
  const projectFlows = [-d.investment, ...months.map((m) => m.projectFlow)];
  const ownerFlows = [-d.equity, ...months.map((m) => m.ownerFlow)];
  const discountedFlows = [-d.investment, ...months.map((m) => m.discountedProjectFlow)];
  const discountedOwnerFlows = [-d.equity, ...months.map((m) => m.discountedOwnerFlow)];
  const projectNpv = -d.investment + sumInitial("discountedProjectFlow");
  const ownerNpv = -d.equity + sumInitial("discountedOwnerFlow");
  const projectIrrMonthly = irr(projectFlows);
  const ownerIrrMonthly = irr(ownerFlows);
  const projectMirrMonthly = mirr(projectFlows, d.waccMonthly);
  const ownerMirrMonthly = mirr(ownerFlows, d.waccMonthly);
  const stableMonth = months[stabilizationMonth - 1] ?? months.at(-1)!;
  const stableRevenue = stableMonth?.revenue ?? 0;
  const stableTaxRate = taxRate(v, stableRevenue * 12);
  const stableFixed = stableMonth ? stableMonth.payroll + stableMonth.rent + stableMonth.otherFixed : d.fixedCostYear1;
  const stableEbitda = stableRevenue * (d.contributionRate - stableTaxRate) - stableFixed;
  const stableOwnerCash = stableEbitda - (stabilizationMonth <= d.term ? d.financingPayment : 0);
  const breakevenRevenue = solveBreakEvenRevenue(v, d, d.fixedCostYear1);
  const breakevenOwnerRevenue = solveBreakEvenRevenue(v, d, d.fixedCostYear1 + d.financingPayment);
  const monthsWithOpening = [{ cumulativeProject: -d.investment, cumulativeOwner: -d.equity, cumulativeDiscountedProject: -d.investment, cumulativeDiscountedOwner: -d.equity }, ...months];
  const minimumProjectCash = Math.min(...monthsWithOpening.map((m) => m.cumulativeProject));
  const minimumOwnerCash = Math.min(...monthsWithOpening.map((m) => m.cumulativeOwner));
  const simpleProjectPayback = firstPayback(projectFlows);
  const simpleOwnerPayback = firstPayback(ownerFlows);
  const discountedProjectPayback = firstPayback(discountedFlows);
  const discountedOwnerPayback = firstPayback(discountedOwnerFlows);
  const maxRbt12 = Math.max(0, ...months.map((m) => m.rbt12));
  const stableVolume = stableMonth?.couponsPerDay ?? n(v, 36);
  const breakEvenDaily = (revenue: number | null) => revenue === null || operatingDays * n(v, 30) === 0 ? "n/d" : revenue / (operatingDays * n(v, 30));

  const annualRate = (monthly: number | null) => monthly === null ? "n/d" : Math.pow(1 + monthly, 12) - 1;
  const metrics: Metric[] = [
    { id: "investment", label: "Investimento total", project: d.investment, owner: d.equity, note: "CAPEX + capital de giro; acionista desconta o valor financiado", format: "money" },
    { id: "stableRevenue", label: "Receita mensal estabilizada", project: stableRevenue, owner: stableRevenue, note: "Mês definido para estabilização", format: "money" },
    { id: "stableVolume", label: "Cupons/dia estabilizados", project: stableVolume, owner: stableVolume, note: "Volume diário no mês de estabilização", format: "coupons" },
    { id: "taxRate", label: "Alíquota efetiva (estabilizada)", project: stableTaxRate, owner: stableTaxRate, note: Math.round(n(v, 45)) === 1 ? "Alíquota média fixa" : "Simples Nacional Anexo I — RBT12 anualizada", format: "percent" },
    { id: "stableEbitda", label: "EBITDA mensal estabilizado", project: stableEbitda, owner: stableOwnerCash, note: "Projeto antes da dívida; acionista após parcela", format: "money" },
    { id: "stableMargin", label: "Margem EBITDA / caixa", project: safeDiv(stableEbitda, stableRevenue), owner: safeDiv(stableOwnerCash, stableRevenue), note: "EBITDA ou caixa livre ÷ receita", format: "percent" },
    { id: "monthlyReturn", label: "Rentabilidade mensal sobre investimento", project: safeDiv(stableEbitda, d.investment), owner: safeDiv(stableOwnerCash, d.equity), note: "Resultado mensal estabilizado ÷ investimento/aporte", format: "percent" },
    { id: "breakeven", label: "Ponto de equilíbrio — receita/mês", project: breakevenRevenue ?? "n/d", owner: breakevenOwnerRevenue ?? "n/d", note: "Custos fixos do Ano 1; acionista inclui a parcela", format: "money" },
    { id: "breakevenVolume", label: "Ponto de equilíbrio — cupons/dia", project: breakEvenDaily(breakevenRevenue), owner: breakEvenDaily(breakevenOwnerRevenue), note: "Receita de equilíbrio ÷ ticket ÷ dias de operação", format: "coupons" },
    { id: "safetyMargin", label: "Margem de segurança", project: stableRevenue ? (stableRevenue - (breakevenRevenue ?? stableRevenue)) / stableRevenue : 0, owner: stableRevenue ? (stableRevenue - (breakevenOwnerRevenue ?? stableRevenue)) / stableRevenue : 0, note: "Queda possível da receita estabilizada até o equilíbrio", format: "percent" },
    { id: "npv", label: "VPL", project: projectNpv, owner: ownerNpv, note: "Fluxos descontados pelo WACC/TMA mensal equivalente", format: "money" },
    { id: "irrMonthly", label: "TIR mensal", project: projectIrrMonthly ?? "n/d", owner: ownerIrrMonthly ?? "n/d", note: "Fluxo mensal incluindo o investimento inicial", format: "percent" },
    { id: "irrAnnual", label: "TIR anual", project: annualRate(projectIrrMonthly), owner: annualRate(ownerIrrMonthly), note: "(1 + TIR mensal)¹² − 1", format: "percent" },
    { id: "mirrMonthly", label: "MTIR mensal", project: projectMirrMonthly ?? "n/d", owner: ownerMirrMonthly ?? "n/d", note: "WACC/TMA como taxa de financiamento e reinvestimento", format: "percent" },
    { id: "mirrAnnual", label: "MTIR anual", project: annualRate(projectMirrMonthly), owner: annualRate(ownerMirrMonthly), note: "(1 + MTIR mensal)¹² − 1", format: "percent" },
    { id: "payback", label: "Payback simples", project: fmtPayback(simpleProjectPayback), owner: fmtPayback(simpleOwnerPayback), note: "Primeiro mês com fluxo de caixa acumulado ≥ 0", format: "months" },
    { id: "discountedPayback", label: "Payback descontado", project: fmtPayback(discountedProjectPayback), owner: fmtPayback(discountedOwnerPayback), note: "Primeiro mês com fluxo descontado acumulado ≥ 0", format: "months" },
    { id: "minCash", label: "Menor caixa acumulado", project: minimumProjectCash, owner: minimumOwnerCash, note: "Necessidade máxima de caixa no horizonte", format: "money" },
    { id: "negativeMonths", label: "Meses com EBITDA / caixa negativo", project: months.filter((m) => m.ebitda < 0).length, owner: months.filter((m) => m.ownerFlow < 0).length, note: "Meses que exigem cobertura de caixa", format: "number" },
    { id: "payroll", label: "Folha mensal inicial", project: d.payroll, owner: d.payroll, note: `${Math.round(n(v, 47))} funcionários`, format: "money" },
    { id: "employeeCost", label: "Custo mensal por funcionário", project: d.employeeCost, owner: d.employeeCost, note: "Salário, encargos e benefícios", format: "money" },
    { id: "maxRbt12", label: "Maior RBT12 do horizonte", project: maxRbt12, owner: maxRbt12, note: maxRbt12 > SIMPLE_TAX_LIMIT ? "Atenção: excede o limite do Simples Nacional — validar com a contabilidade" : "Dentro do limite nominal de R$ 4,8 milhões", format: "money" },
  ];

  const scenario = scenarioForRevenue(v, d, Math.max(0, scenarioRevenue));
  const volumeChanges = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
  const ticketChanges = [-0.1, -0.05, 0, 0.05, 0.1];
  const sensitivityTicket = volumeChanges.map((change) => ({
    volumeChange: change,
    values: ticketChanges.map((ticketChange) => {
      const revenue = stableVolume * (1 + change) * operatingDays * n(v, 30) * (1 + ticketChange);
      const rate = taxRate(v, revenue * 12);
      const variableCost = revenue * d.variableRate;
      return revenue - variableCost - revenue * rate - d.fixedCostYear1;
    }),
  }));
  const cogsCases = [0.36, 0.38, 0.4, 0.42, 0.44];
  const sensitivityCogs = volumeChanges.map((change) => ({
    volumeChange: change,
    values: cogsCases.map((cogsCase) => {
      const revenue = stableVolume * (1 + change) * operatingDays * n(v, 30);
      const adjustedVariableRate = d.variableRate - n(v, 39) + cogsCase;
      return revenue - revenue * adjustedVariableRate - revenue * taxRate(v, revenue * 12) - d.fixedCostYear1;
    }),
  }));

  return {
    derived: d, months, annual, metrics, scenario, breakevenRevenue,
    breakevenOwnerRevenue, stableRevenue, stableEbitda, stableOwnerCash,
    stableTaxRate, monthlyDiscountRate: d.waccMonthly, projectNpv, ownerNpv,
    projectIrrMonthly, ownerIrrMonthly, projectMirrMonthly, ownerMirrMonthly,
    sensitivityTicket, sensitivityCogs,
  };
}

export function getTaxRateForAnnualRevenue(v: Values, annualRevenue: number) {
  return taxRate(v, annualRevenue);
}
