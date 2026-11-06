import { describe, expect, it } from "vitest";
import { INITIAL_VALUES } from "../client/src/lib/yakiniku-assumptions";
import { calculateModel, deriveAssumptions } from "../client/src/lib/yakiniku-model";

const near = (actual: number, expected: number, digits = 2) => {
  expect(actual).toBeCloseTo(expected, digits);
};

describe("modelo financeiro Yakiniku", () => {
  it("reproduz premissas derivadas da planilha auditada", () => {
    const derived = deriveAssumptions(INITIAL_VALUES);
    expect(derived.capex).toBe(587500);
    expect(derived.workingCapital).toBe(30000);
    expect(derived.investment).toBe(617500);
    expect(derived.variableRate).toBeCloseTo(0.475, 10);
    expect(derived.contributionRate).toBeCloseTo(0.525, 10);
    near(derived.employeeCost, 2811.959956, 6);
    near(derived.payroll, 36555.479428, 6);
    near(derived.fixedCostYear1, 50914.479428, 6);
  });

  it("reproduz os indicadores-base armazenados na planilha", () => {
    const model = calculateModel(INITIAL_VALUES);
    expect(model.months).toHaveLength(60);
    expect(model.annual).toHaveLength(5);
    expect(model.stableRevenue).toBe(299925);
    near(model.stableEbitda, 82552.145572, 6);
    near(model.breakevenRevenue ?? NaN, 114414.56051236, 6);
    near(Number(model.metrics.find((metric) => metric.id === "breakevenVolume")?.project), 41.00880305, 6);
    near(model.projectNpv, 2748401.06457729, 5);
    near(Math.pow(1 + (model.projectIrrMonthly ?? 0), 12) - 1, 2.2843005667, 7);
    near(Math.pow(1 + (model.projectMirrMonthly ?? 0), 12) - 1, 0.6564368527, 7);
    expect(model.metrics.find((metric) => metric.id === "payback")?.project).toBe(11);
    expect(model.metrics.find((metric) => metric.id === "discountedPayback")?.project).toBe(12);
  });

  it("gera 60 linhas mensais e agrega cinco anos sem perder receita", () => {
    const model = calculateModel(INITIAL_VALUES);
    expect(model.months.map((month) => month.month)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    near(model.annual.reduce((sum, year) => sum + year.revenue, 0), model.months.reduce((sum, month) => sum + month.revenue, 0), 6);
    near(model.annual.reduce((sum, year) => sum + year.ebitda, 0), model.months.reduce((sum, month) => sum + month.ebitda, 0), 6);
  });

  it("calcula a parcela Price e encerra o serviço da dívida no prazo", () => {
    const values = { ...INITIAL_VALUES, p18: 200000, p20: 48, p19: 0.015 };
    const model = calculateModel(values);
    const expected = 200000 * 0.015 / (1 - Math.pow(1.015, -48));
    near(model.derived.financingPayment, expected, 8);
    near(model.months[0].financing, expected, 8);
    near(model.months[47].financing, expected, 8);
    expect(model.months[48].financing).toBe(0);
    expect(model.derived.equity).toBe(417500);
  });

  it("inclui valor residual e recuperação de capital de giro no mês estrutural 60", () => {
    const model = calculateModel({ ...INITIAL_VALUES, p27: 100000, p28: 0.5 });
    near(model.months[59].projectFlow - model.months[59].ebitda, 115000, 8);
    near(model.months[58].projectFlow - model.months[58].ebitda, 0, 8);
    near(model.months[59].ownerFlow - (model.months[59].ebitda - model.months[59].financing), 115000, 8);
  });

  it("não apresenta receita de equilíbrio quando a margem pós-impostos é inviável", () => {
    const model = calculateModel({ ...INITIAL_VALUES, p39: 0.95 });
    expect(model.breakevenRevenue).toBeNull();
    expect(model.breakevenOwnerRevenue).toBeNull();
    expect(model.metrics.find((metric) => metric.id === "breakeven")?.project).toBe("n/d");
  });

  it("mantém o horizonte estrutural da projeção em 60 meses", () => {
    const model = calculateModel({ ...INITIAL_VALUES, p26: 24 });
    expect(model.months).toHaveLength(60);
    expect(model.months[59].month).toBe(60);
  });

  it("aplica progressividade do Simples Nacional quando selecionado", () => {
    const model = calculateModel({ ...INITIAL_VALUES, p45: 2 });
    expect(model.months).toHaveLength(60);
    expect(model.months.every((month) => Number.isFinite(month.taxes) && month.taxes >= 0)).toBe(true);
    expect(model.stableTaxRate).toBeGreaterThan(0.08);
    expect(model.metrics.find((metric) => metric.id === "taxRate")?.note).toContain("Simples Nacional");
    near(model.stableTaxRate, 0.118743935983996, 9);
    near(model.breakevenRevenue ?? NaN, 117319.328775036, 5);
    near(model.projectNpv, 2499496.14508357, 5);
    near(Math.pow(1 + (model.projectIrrMonthly ?? 0), 12) - 1, 1.9959685154883, 7);
    expect(model.metrics.find((metric) => metric.id === "payback")?.project).toBe(12);
    expect(model.metrics.find((metric) => metric.id === "discountedPayback")?.project).toBe(13);
  });
});
