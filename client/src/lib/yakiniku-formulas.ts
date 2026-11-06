import type { WorkBook, WorkSheet } from "xlsx";
import { ASSUMPTIONS, SIMPLE_TAX_BRACKETS } from "./yakiniku-assumptions";
import { solveBreakEvenRevenue, type ModelResult, type Values } from "./yakiniku-model";
import type { ScenarioState } from "./yakiniku-storage";

type Cached = number | string;
const moneyFmt = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
const pctFmt = "0.0%;[Red](0.0%);-";
const putFormula = (sheet: WorkSheet, address: string, formula: string, cached: Cached, format?: string) => {
  const prior = sheet[address] ?? {};
  sheet[address] = {
    ...prior,
    t: typeof cached === "number" ? "n" : "str",
    f: formula.replace(/^=/, ""),
    v: cached,
    ...(format ? { z: format } : {}),
  };
};

export function applyWorkbookFormulas(workbook: WorkBook, state: ScenarioState, model: ModelResult) {
  const v = state.values;
  const premises = workbook.Sheets.Premissas;
  const projection = workbook.Sheets.Projecao_Mensal;
  const dre = workbook.Sheets.DRE_Anual;
  const indicators = workbook.Sheets.Indicadores;
  const dashboard = workbook.Sheets.Dashboard;
  const scenario = workbook.Sheets.Simulador_Receita;
  const sensitivity = workbook.Sheets.Sensibilidade;
  if (!premises || !projection || !dre || !indicators || !dashboard || !scenario || !sensitivity) return;

  const inputRow = new Map(ASSUMPTIONS.map((item, index) => [item.id, index + 2]));
  const p = (id: number) => `'Premissas'!$D$${inputRow.get(`p${id}`) ?? 2}`;
  const scenarioInputRow = ASSUMPTIONS.length + 2;
  const scenarioRevenue = `'Premissas'!$D$${scenarioInputRow}`;
  const derivedStart = ASSUMPTIONS.length + 3;
  const derivedName = ["capex", "workingCapital", "investment", "financingPayment", "equity", "waccMonthly", "variableRate", "contributionRate", "salaryWithBurden", "transportNet", "benefitsPerEmployee", "employeeCost", "payroll", "otherFixedYear1", "fixedCostYear1"];
  const d = Object.fromEntries(derivedName.map((name, index) => [name, `'Premissas'!$D$${derivedStart + index}`])) as Record<string, string>;
  const bandStart = derivedStart + derivedName.length + 3;
  const bandRef = (column: "C" | "D" | "E") => `'Premissas'!$${column}$${bandStart}:$${column}$${bandStart + SIMPLE_TAX_BRACKETS.length - 1}`;

  const annualTaxExpr = (annualRevenue: string) => {
    const limits = bandRef("C");
    const rates = bandRef("D");
    const deductions = bandRef("E");
    return `IF(${p(45)}=1,${p(46)},IF(${annualRevenue}<=0,0,MAX(0,(${annualRevenue}*LOOKUP(${annualRevenue},${limits},${rates})-LOOKUP(${annualRevenue},${limits},${deductions}))/${annualRevenue})))`;
  };
  const breakevenExpr = (fixedCost: string) => {
    const contribution = d.contributionRate;
    const fixedMode = `IF(${contribution}-${p(46)}>0,${fixedCost}/(${contribution}-${p(46)}),"n/d")`;
    let progressive = `"n/d"`;
    for (let index = SIMPLE_TAX_BRACKETS.length - 1; index >= 0; index--) {
      const band = SIMPLE_TAX_BRACKETS[index];
      const lowerMonthly = band.from / 12;
      const upperMonthly = index + 1 < SIMPLE_TAX_BRACKETS.length
        ? (SIMPLE_TAX_BRACKETS[index + 1].from - 0.01) / 12
        : Number.POSITIVE_INFINITY;
      const denominator = `(${contribution}-'Premissas'!$D$${bandStart + index})`;
      const candidate = `IF(${denominator}>0,(${fixedCost}-'Premissas'!$E$${bandStart + index}/12)/${denominator},1E+99)`;
      const inBand = index + 1 < SIMPLE_TAX_BRACKETS.length
        ? `AND(${candidate}>=${lowerMonthly},${candidate}<=${upperMonthly})`
        : `${candidate}>=${lowerMonthly}`;
      progressive = `IF(AND(${denominator}>0,${inBand}),${candidate},${progressive})`;
    }
    return `IF(${fixedCost}<=0,0,IF(${p(45)}=1,${fixedMode},IF(${contribution}<=0,"n/d",${progressive})))`;
  };
  const formula = (sheet: WorkSheet, address: string, expression: string, value: Cached, fmt?: string) => putFormula(sheet, address, expression, value, fmt);

  formula(premises, `D${inputRow.get("p26")}`, "60", 60, "0");

  // Calculation rows in the Premissas tab: formula-linked to the editable inputs above.
  const capexFormula = `SUM(${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},${p(11)},${p(12)})`;
  const fixedFormulas = [
    capexFormula,
    `${p(14)}+${p(15)}`,
    `${d.capex}+${d.workingCapital}`,
    `IF(${p(18)}<=0,0,IF(${p(20)}<=0,0,IF(${p(19)}=0,${p(18)}/${p(20)},-PMT(${p(19)},${p(20)},${p(18)}))))`,
    `${d.investment}-${p(18)}`,
    `(1+${p(24)})^(1/12)-1`,
    `SUM(${p(39)},${p(40)},${p(41)},${p(42)})`,
    `1-${d.variableRate}`,
    `${p(48)}*(1+${p(53)})`,
    `MAX(0,${p(51)}*${p(52)}-MIN(${p(51)}*${p(52)},${p(48)}*${p(54)}))`,
    `${p(49)}+${p(50)}+${d.transportNet}`,
    `${d.salaryWithBurden}+${d.benefitsPerEmployee}`,
    `${p(47)}*${d.employeeCost}`,
    `${p(60)}+SUM(${p(65)},${p(66)},${p(67)},${p(68)},${p(69)},${p(70)},${p(71)})`,
    `${d.payroll}+${p(61)}*(1+SUM(${p(62)},${p(63)},${p(64)})/12)+${d.otherFixedYear1}`,
  ];
  const derivedValues = [model.derived.capex, model.derived.workingCapital, model.derived.investment, model.derived.financingPayment, model.derived.equity, model.derived.waccMonthly, model.derived.variableRate, model.derived.contributionRate, model.derived.salaryWithBurden, model.derived.transportNet, model.derived.benefitsPerEmployee, model.derived.employeeCost, model.derived.payroll, model.derived.otherFixedYear1, model.derived.fixedCostYear1];
  fixedFormulas.forEach((expression, index) => formula(premises, `D${derivedStart + index}`, expression, derivedValues[index], [5, 6, 7].includes(index) ? pctFmt : moneyFmt));

  // Transparent Anexo I table, used by the Excel formulas for RBT12 taxation.
  SIMPLE_TAX_BRACKETS.forEach((band, index) => {
    const row = bandStart + index;
    premises[`C${row}`] = { t: "n", v: band.from, z: moneyFmt };
    premises[`D${row}`] = { t: "n", v: band.rate, z: pctFmt };
    premises[`E${row}`] = { t: "n", v: band.deduction, z: moneyFmt };
  });

  // 60-month projection. Row 2 is the month-zero investment; months 1–60 occupy rows 3–62.
  formula(projection, "A2", "0", 0, "0");
  formula(projection, "S2", `-${d.investment}`, -model.derived.investment, moneyFmt);
  formula(projection, "T2", `-${d.equity}`, -model.derived.equity, moneyFmt);
  formula(projection, "U2", `-${d.investment}`, -model.derived.investment, moneyFmt);
  formula(projection, "V2", `-${d.equity}`, -model.derived.equity, moneyFmt);
  formula(projection, "W2", `-${d.investment}`, -model.derived.investment, moneyFmt);
  formula(projection, "X2", `-${d.equity}`, -model.derived.equity, moneyFmt);
  formula(projection, "Y2", `-${d.investment}`, -model.derived.investment, moneyFmt);
  formula(projection, "Z2", `-${d.equity}`, -model.derived.equity, moneyFmt);
  model.months.forEach((month, index) => {
    const row = index + 3;
    const previous = row - 1;
    formula(projection, `A${row}`, `ROW()-2`, month.month, "0");
    formula(projection, `B${row}`, `MOD(${p(29)}+A${row}-2,12)+1`, month.calendarMonth, "0");
    const couponFormula = `MAX(0,IF(A${row}=1,${p(34)},IF(A${row}<=6,${p(34)}+(${p(35)}-${p(34)})*(A${row}-1)/5,IF(A${row}<${p(37)},${p(35)}+(${p(36)}-${p(35)})*(A${row}-6)/MAX(1,${p(37)}-6),${p(36)}*(1+${p(38)})^INT((A${row}-${p(37)})/12))))`;
    formula(projection, `C${row}`, couponFormula, month.couponsPerDay, "0.0");
    formula(projection, `D${row}`, `C${row}*${p(32)}`, month.coupons, "0.0");
    formula(projection, `E${row}`, `${p(30)}*(1+${p(31)})^INT((A${row}-1)/12)`, month.ticket, moneyFmt);
    formula(projection, `F${row}`, `D${row}*E${row}`, month.revenue, moneyFmt);
    const rbt = month.month === 1
      ? `F${row}*12`
      : month.month <= 12
        ? `SUM($F$3:F${previous})*12/${month.month - 1}`
        : `SUM(F${row - 12}:F${previous})`;
    formula(projection, `G${row}`, rbt, month.rbt12, moneyFmt);
    formula(projection, `H${row}`, annualTaxExpr(`G${row}`), month.taxRate, pctFmt);
    formula(projection, `I${row}`, `F${row}*H${row}`, month.taxes, moneyFmt);
    formula(projection, `J${row}`, `F${row}*${p(39)}`, month.cogs, moneyFmt);
    formula(projection, `K${row}`, `F${row}*(${p(40)}+${p(41)})`, month.royaltiesAndMarketing, moneyFmt);
    formula(projection, `L${row}`, `F${row}*${p(42)}`, month.cardFees, moneyFmt);
    formula(projection, `M${row}`, `F${row}-I${row}-J${row}-K${row}-L${row}`, month.contribution, moneyFmt);
    const inflation = `(1+${p(72)})^INT((A${row}-1)/12)`;
    formula(projection, `N${row}`, `${d.payroll}*${inflation}`, month.payroll, moneyFmt);
    formula(projection, `O${row}`, `${p(61)}*(1+IF(B${row}=5,${p(62)},IF(B${row}=11,${p(63)},IF(B${row}=12,${p(64)},0))))*${inflation}`, month.rent, moneyFmt);
    formula(projection, `P${row}`, `${d.otherFixedYear1}*${inflation}`, month.otherFixed, moneyFmt);
    formula(projection, `Q${row}`, `M${row}-N${row}-O${row}-P${row}`, month.ebitda, moneyFmt);
    formula(projection, `R${row}`, `IF(A${row}<='Premissas'!$D$${inputRow.get("p20")},${d.financingPayment},0)`, month.financing, moneyFmt);
    const residual = `IF(A${row}=${p(26)},${p(27)}+${d.workingCapital}*${p(28)},0)`;
    formula(projection, `S${row}`, `Q${row}+${residual}`, month.projectFlow, moneyFmt);
    formula(projection, `T${row}`, `Q${row}-R${row}+${residual}`, month.ownerFlow, moneyFmt);
    formula(projection, `U${row}`, `S${row}/(1+${d.waccMonthly})^A${row}`, month.discountedProjectFlow, moneyFmt);
    formula(projection, `V${row}`, `T${row}/(1+${d.waccMonthly})^A${row}`, month.discountedOwnerFlow, moneyFmt);
    formula(projection, `W${row}`, `W${previous}+S${row}`, month.cumulativeProject, moneyFmt);
    formula(projection, `X${row}`, `X${previous}+T${row}`, month.cumulativeOwner, moneyFmt);
    formula(projection, `Y${row}`, `Y${previous}+U${row}`, month.cumulativeDiscountedProject, moneyFmt);
    formula(projection, `Z${row}`, `Z${previous}+V${row}`, month.cumulativeDiscountedOwner, moneyFmt);
  });

  // DRE: formula-linked yearly totals and weighted margins.
  const projectionColumn: Record<string, string> = { revenue: "F", taxes: "I", cogs: "J", royaltiesAndMarketing: "K", cardFees: "L", contribution: "M", payroll: "N", rent: "O", otherFixed: "P", ebitda: "Q", financing: "R", ownerCash: "T", endingCash: "X", coupons: "D" };
  const dreSpecs: { key: keyof ModelResult["annual"][number]; col: string; ratio?: "contribution" | "ebitda"; average?: boolean; finalCash?: boolean }[] = [
    { key: "revenue", col: "F" }, { key: "taxes", col: "I" }, { key: "netRevenue", col: "F" },
    { key: "cogs", col: "J" }, { key: "royaltiesAndMarketing", col: "K" }, { key: "cardFees", col: "L" },
    { key: "contribution", col: "M" }, { key: "contributionMargin", col: "M", ratio: "contribution" },
    { key: "payroll", col: "N" }, { key: "rent", col: "O" }, { key: "otherFixed", col: "P" },
    { key: "ebitda", col: "Q" }, { key: "ebitdaMargin", col: "Q", ratio: "ebitda" },
    { key: "financing", col: "R" }, { key: "ownerCash", col: "T" },
    { key: "endingCash", col: "X", finalCash: true }, { key: "coupons", col: "D" }, { key: "averageTicket", col: "F", average: true },
  ];
  dreSpecs.forEach((spec, specIndex) => {
    const excelRow = specIndex + 2;
    model.annual.forEach((annual, yearIndex) => {
      const first = 3 + yearIndex * 12;
      const last = first + 11;
      let expression = `SUM('Projecao_Mensal'!${spec.col}${first}:${spec.col}${last})`;
      if (spec.key === "netRevenue") expression = `SUM('Projecao_Mensal'!F${first}:F${last})-SUM('Projecao_Mensal'!I${first}:I${last})`;
      if (spec.ratio === "contribution") expression = `IF(SUM('Projecao_Mensal'!F${first}:F${last})=0,0,SUM('Projecao_Mensal'!M${first}:M${last})/SUM('Projecao_Mensal'!F${first}:F${last}))`;
      if (spec.ratio === "ebitda") expression = `IF(SUM('Projecao_Mensal'!F${first}:F${last})=0,0,SUM('Projecao_Mensal'!Q${first}:Q${last})/SUM('Projecao_Mensal'!F${first}:F${last}))`;
      if (spec.finalCash) expression = `'Projecao_Mensal'!X${last}`;
      if (spec.average) expression = `IF(SUM('Projecao_Mensal'!D${first}:D${last})=0,0,SUM('Projecao_Mensal'!F${first}:F${last})/SUM('Projecao_Mensal'!D${first}:D${last}))`;
      formula(dre, `${String.fromCharCode(66 + yearIndex)}${excelRow}`, expression, annual[spec.key] as number, spec.ratio ? pctFmt : moneyFmt);
    });
    const totalCell = `G${excelRow}`;
    let expression = `SUM(B${excelRow}:F${excelRow})`;
    let cached = model.annual.reduce((sum, year) => sum + Number(year[spec.key]), 0);
    if (spec.ratio === "contribution") { expression = `IF(SUM(B2:F2)=0,0,SUM(B8:F8)/SUM(B2:F2))`; cached = model.annual.reduce((sum, year) => sum + year.contribution, 0) / Math.max(1, model.annual.reduce((sum, year) => sum + year.revenue, 0)); }
    if (spec.ratio === "ebitda") { expression = `IF(SUM(B2:F2)=0,0,SUM(B13:F13)/SUM(B2:F2))`; cached = model.annual.reduce((sum, year) => sum + year.ebitda, 0) / Math.max(1, model.annual.reduce((sum, year) => sum + year.revenue, 0)); }
    if (spec.finalCash) { expression = `F${excelRow}`; cached = model.annual.at(-1)?.endingCash ?? 0; }
    if (spec.average) { expression = `IF(SUM(B18:F18)=0,0,SUM(B2:F2)/SUM(B18:F18))`; cached = model.annual.reduce((sum, year) => sum + year.revenue, 0) / Math.max(1, model.annual.reduce((sum, year) => sum + year.coupons, 0)); }
    formula(dre, totalCell, expression, cached, spec.ratio ? pctFmt : moneyFmt);
  });

  // Indicators: use the monthly cash-flow schedule for discounting, returns and recovery dates.
  const monthAtStabilization = Math.max(1, Math.min(60, Math.round(v.p37)));
  const stableRow = monthAtStabilization + 2;
  const metricRows: { id: string; project: string; owner: string; projectCached: Cached; ownerCached: Cached; format: string }[] = [
    { id: "investment", project: d.investment, owner: d.equity, projectCached: model.derived.investment, ownerCached: model.derived.equity, format: moneyFmt },
    { id: "stableRevenue", project: `'Projecao_Mensal'!F${stableRow}`, owner: `'Projecao_Mensal'!F${stableRow}`, projectCached: model.stableRevenue, ownerCached: model.stableRevenue, format: moneyFmt },
    { id: "stableVolume", project: `'Projecao_Mensal'!C${stableRow}`, owner: `'Projecao_Mensal'!C${stableRow}`, projectCached: model.metrics[2].project as number, ownerCached: model.metrics[2].owner as number, format: "0.0" },
    { id: "taxRate", project: annualTaxExpr(`'Projecao_Mensal'!F${stableRow}*12`), owner: annualTaxExpr(`'Projecao_Mensal'!F${stableRow}*12`), projectCached: model.stableTaxRate, ownerCached: model.stableTaxRate, format: pctFmt },
    { id: "stableEbitda", project: `'Projecao_Mensal'!Q${stableRow}`, owner: `'Projecao_Mensal'!Q${stableRow}-'Projecao_Mensal'!R${stableRow}`, projectCached: model.stableEbitda, ownerCached: model.stableOwnerCash, format: moneyFmt },
    { id: "stableMargin", project: `IF('Projecao_Mensal'!F${stableRow}=0,0,'Projecao_Mensal'!Q${stableRow}/'Projecao_Mensal'!F${stableRow})`, owner: `IF('Projecao_Mensal'!F${stableRow}=0,0,('Projecao_Mensal'!Q${stableRow}-'Projecao_Mensal'!R${stableRow})/'Projecao_Mensal'!F${stableRow})`, projectCached: model.metrics[5].project as number, ownerCached: model.metrics[5].owner as number, format: pctFmt },
    { id: "monthlyReturn", project: `IF(${d.investment}=0,0,'Projecao_Mensal'!Q${stableRow}/${d.investment})`, owner: `IF(${d.equity}=0,0,('Projecao_Mensal'!Q${stableRow}-'Projecao_Mensal'!R${stableRow})/${d.equity})`, projectCached: model.metrics[6].project as number, ownerCached: model.metrics[6].owner as number, format: pctFmt },
    { id: "breakeven", project: breakevenExpr(d.fixedCostYear1), owner: breakevenExpr(`(${d.fixedCostYear1}+${d.financingPayment})`), projectCached: model.breakevenRevenue ?? "n/d", ownerCached: model.breakevenOwnerRevenue ?? "n/d", format: moneyFmt },
    { id: "breakevenVolume", project: `IFERROR(B9/(${p(32)}*${p(30)}),"n/d")`, owner: `IFERROR(C9/(${p(32)}*${p(30)}),"n/d")`, projectCached: model.metrics[8].project as Cached, ownerCached: model.metrics[8].owner as Cached, format: "0.0" },
    { id: "safetyMargin", project: `IF(B3=0,0,(B3-B9)/B3)`, owner: `IF(B3=0,0,(B3-C9)/B3)`, projectCached: model.metrics[9].project as number, ownerCached: model.metrics[9].owner as number, format: pctFmt },
    { id: "npv", project: `-(${d.investment})+SUM('Projecao_Mensal'!U3:U62)`, owner: `-(${d.equity})+SUM('Projecao_Mensal'!V3:V62)`, projectCached: model.projectNpv, ownerCached: model.ownerNpv, format: moneyFmt },
    { id: "irrMonthly", project: `IFERROR(IRR('Projecao_Mensal'!S2:S62),"n/d")`, owner: `IFERROR(IRR('Projecao_Mensal'!T2:T62),"n/d")`, projectCached: model.projectIrrMonthly ?? "n/d", ownerCached: model.ownerIrrMonthly ?? "n/d", format: pctFmt },
    { id: "irrAnnual", project: `IF(ISNUMBER(B13),(1+B13)^12-1,"n/d")`, owner: `IF(ISNUMBER(C13),(1+C13)^12-1,"n/d")`, projectCached: model.metrics[12].project as Cached, ownerCached: model.metrics[12].owner as Cached, format: pctFmt },
    { id: "mirrMonthly", project: `IFERROR(MIRR('Projecao_Mensal'!S2:S62,${d.waccMonthly},${d.waccMonthly}),"n/d")`, owner: `IFERROR(MIRR('Projecao_Mensal'!T2:T62,${d.waccMonthly},${d.waccMonthly}),"n/d")`, projectCached: model.projectMirrMonthly ?? "n/d", ownerCached: model.ownerMirrMonthly ?? "n/d", format: pctFmt },
    { id: "mirrAnnual", project: `IF(ISNUMBER(B15),(1+B15)^12-1,"n/d")`, owner: `IF(ISNUMBER(C15),(1+C15)^12-1,"n/d")`, projectCached: model.metrics[14].project as Cached, ownerCached: model.metrics[14].owner as Cached, format: pctFmt },
    { id: "payback", project: `IFERROR(MATCH(TRUE,INDEX('Projecao_Mensal'!W2:W62>=0,0),0)-1,"> 60 meses")`, owner: `IFERROR(MATCH(TRUE,INDEX('Projecao_Mensal'!X2:X62>=0,0),0)-1,"> 60 meses")`, projectCached: model.metrics[15].project as Cached, ownerCached: model.metrics[15].owner as Cached, format: "0" },
    { id: "discountedPayback", project: `IFERROR(MATCH(TRUE,INDEX('Projecao_Mensal'!Y2:Y62>=0,0),0)-1,"> 60 meses")`, owner: `IFERROR(MATCH(TRUE,INDEX('Projecao_Mensal'!Z2:Z62>=0,0),0)-1,"> 60 meses")`, projectCached: model.metrics[16].project as Cached, ownerCached: model.metrics[16].owner as Cached, format: "0" },
    { id: "minCash", project: `MIN('Projecao_Mensal'!W2:W62)`, owner: `MIN('Projecao_Mensal'!X2:X62)`, projectCached: model.metrics[17].project as number, ownerCached: model.metrics[17].owner as number, format: moneyFmt },
    { id: "negativeMonths", project: `COUNTIF('Projecao_Mensal'!Q3:Q62,"<0")`, owner: `COUNTIF('Projecao_Mensal'!T3:T62,"<0")`, projectCached: model.metrics[18].project as number, ownerCached: model.metrics[18].owner as number, format: "0" },
    { id: "payroll", project: d.payroll, owner: d.payroll, projectCached: model.derived.payroll, ownerCached: model.derived.payroll, format: moneyFmt },
    { id: "employeeCost", project: d.employeeCost, owner: d.employeeCost, projectCached: model.derived.employeeCost, ownerCached: model.derived.employeeCost, format: moneyFmt },
    { id: "maxRbt12", project: `MAX('Projecao_Mensal'!G3:G62)`, owner: `MAX('Projecao_Mensal'!G3:G62)`, projectCached: model.metrics[21].project as number, ownerCached: model.metrics[21].owner as number, format: moneyFmt },
  ];
  metricRows.forEach((item, rowIndex) => {
    const addressRow = rowIndex + 2;
    formula(indicators, `B${addressRow}`, item.project, item.projectCached, item.format);
    formula(indicators, `C${addressRow}`, item.owner, item.ownerCached, item.format);
  });

  // Revenue simulator formulas, scenario input is part of the exported configuration.
  const scenarioExpressions: [string, Cached, string?][] = [
    [scenarioRevenue, state.scenarioRevenue, moneyFmt],
    [`IF(${p(30)}=0,0,${scenarioRevenue}/${p(30)})`, model.scenario.couponsPerMonth, "0.0"],
    [`IF(${p(32)}=0,0,B4/${p(32)})`, model.scenario.couponsPerDay, "0.0"],
    [`IF(${p(33)}=0,0,B5/${p(33)})`, model.scenario.couponsPerHour, "0.0"],
    [`${scenarioRevenue}*${d.variableRate}`, model.scenario.variableCosts, moneyFmt],
    [`${scenarioRevenue}*${annualTaxExpr(`${scenarioRevenue}*12`)}`, model.scenario.taxes, moneyFmt],
    [annualTaxExpr(`${scenarioRevenue}*12`), model.scenario.taxRate, pctFmt],
    [d.fixedCostYear1, model.scenario.fixedCosts, moneyFmt],
    [`${scenarioRevenue}-B7-B8-B10`, model.scenario.ebitda, moneyFmt],
    [`IF(${scenarioRevenue}=0,0,B11/${scenarioRevenue})`, model.scenario.profitMargin, pctFmt],
    [`IF(${Math.round(v.p23) === 2 ? d.capex : d.investment}=0,0,B11/${Math.round(v.p23) === 2 ? d.capex : d.investment})`, model.scenario.returnOnInvestment, pctFmt],
    [`IF(B11<=0,"Sem retorno",IFERROR(${Math.round(v.p23) === 2 ? d.capex : d.investment}/B11,"n/d"))`, model.scenario.simplePayback, "0.0"],
    [breakevenExpr(d.fixedCostYear1), model.breakevenRevenue ?? "n/d", moneyFmt],
    [breakevenExpr(`(${d.fixedCostYear1}+${Math.round(v.p23) === 2 ? d.capex : d.investment}/24)`), requiredRevenue(v, model, 24), moneyFmt],
    [breakevenExpr(`(${d.fixedCostYear1}+${Math.round(v.p23) === 2 ? d.capex : d.investment}/12)`), requiredRevenue(v, model, 12), moneyFmt],
    [breakevenExpr(`(${d.fixedCostYear1}+${d.financingPayment})`), model.breakevenOwnerRevenue ?? "n/d", moneyFmt],
  ];
  const scenarioRows = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  scenarioExpressions.forEach(([expression, cached, fmt], index) => formula(scenario, `B${scenarioRows[index]}`, expression, cached, fmt));

  // Dashboard is a linked executive summary of the indicator worksheet.
  model.metrics.forEach((metric, index) => {
    const sourceRow = index + 2;
    const targetRow = index + 4;
    formula(dashboard, `B${targetRow}`, `'Indicadores'!B${sourceRow}`, metric.project, metric.format === "percent" ? pctFmt : metric.format === "money" ? moneyFmt : undefined);
    formula(dashboard, `C${targetRow}`, `'Indicadores'!C${sourceRow}`, metric.owner, metric.format === "percent" ? pctFmt : metric.format === "money" ? moneyFmt : undefined);
  });

  // Both sensitivity matrices reuse the stabilized operating month, changing only their stated drivers.
  const stableVolumeExpr = `'Projecao_Mensal'!C${stableRow}`;
  const volumeShocks = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
  const ticketShocks = [-0.1, -0.05, 0, 0.05, 0.1];
  volumeShocks.forEach((volumeChange, rowIndex) => {
    const excelRow = rowIndex + 3;
    formula(sensitivity, `B${excelRow}`, `${stableVolumeExpr}*(1+A${excelRow})`, model.months[monthAtStabilization - 1].couponsPerDay * (1 + volumeChange), "0.0");
    ticketShocks.forEach((ticketChange, columnIndex) => {
      const cell = `${String.fromCharCode(67 + columnIndex)}${excelRow}`;
      const revenue = `${stableVolumeExpr}*(1+A${excelRow})*${p(32)}*${p(30)}*(1+${ticketChange})`;
      const expression = `${revenue}*(1-${d.variableRate}-${annualTaxExpr(`${revenue}*12`)})-${d.fixedCostYear1}`;
      formula(sensitivity, cell, expression, model.sensitivityTicket[rowIndex].values[columnIndex], moneyFmt);
    });
  });
  volumeShocks.forEach((volumeChange, rowIndex) => {
    const excelRow = rowIndex + 12;
    formula(sensitivity, `B${excelRow}`, `${stableVolumeExpr}*(1+A${excelRow})`, model.months[monthAtStabilization - 1].couponsPerDay * (1 + volumeChange), "0.0");
    [0.36, 0.38, 0.4, 0.42, 0.44].forEach((cogs, columnIndex) => {
      const cell = `${String.fromCharCode(67 + columnIndex)}${excelRow}`;
      const revenue = `${stableVolumeExpr}*(1+A${excelRow})*${p(32)}*${p(30)}`;
      const adjustedRate = `${d.variableRate}-${p(39)}+${cogs}`;
      const expression = `${revenue}*(1-${adjustedRate}-${annualTaxExpr(`${revenue}*12`)})-${d.fixedCostYear1}`;
      formula(sensitivity, cell, expression, model.sensitivityCogs[rowIndex].values[columnIndex], moneyFmt);
    });
  });
}

function requiredRevenue(v: Values, model: ModelResult, months: number) {
  const investment = Math.round(v.p23) === 2 ? model.derived.capex : model.derived.investment;
  return solveBreakEvenRevenue(v, model.derived, model.derived.fixedCostYear1 + investment / months) ?? "n/d";
}
