import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, BarChart3, Check, ChevronRight, CircleAlert,
  FileSpreadsheet, Printer, RotateCcw, Save, SlidersHorizontal, Table2,
} from "lucide-react";
import { ASSUMPTIONS, SIMPLE_TAX_LIMIT } from "@/lib/yakiniku-assumptions";
import { calculateModel, solveBreakEvenRevenue, type Metric, type Values } from "@/lib/yakiniku-model";
import { loadScenario, restoreScenario, saveScenario, type ScenarioState } from "@/lib/yakiniku-storage";

type SectionId = "overview" | "premissas" | "projecao" | "dre" | "indicadores" | "receita" | "sensibilidade";
const sections: { id: SectionId; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Visão geral", icon: BarChart3 },
  { id: "premissas", label: "Premissas", icon: SlidersHorizontal },
  { id: "projecao", label: "Projeção mensal", icon: Table2 },
  { id: "dre", label: "DRE anual", icon: FileSpreadsheet },
  { id: "indicadores", label: "Indicadores", icon: BarChart3 },
  { id: "receita", label: "Simulador de receita", icon: SlidersHorizontal },
  { id: "sensibilidade", label: "Sensibilidade", icon: Table2 },
];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const formatMoney = (value: number | string, precise = false) => typeof value !== "number" || !Number.isFinite(value) ? String(value) : value === 0 ? "—" : (precise ? money2 : money).format(value);
const formatNumber = (value: number | string, digits = 1) => typeof value !== "number" || !Number.isFinite(value) ? String(value) : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
const formatPercent = (value: number | string) => typeof value !== "number" || !Number.isFinite(value) ? String(value) : percent.format(value);
const pct = (v: Values, row: number) => Number(v[`p${row}`] ?? 0);
const monthName = (month: number) => new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(2026, month - 1, 1)).replace(".", "");

function MetricValue({ metric, value }: { metric: Metric; value: number | string }) {
  if (typeof value !== "number") return <>{value}</>;
  if (metric.format === "money") return <>{formatMoney(value)}</>;
  if (metric.format === "percent") return <>{formatPercent(value)}</>;
  if (metric.format === "months") return <>{formatNumber(value)} {Number(value) === 1 ? "mês" : "meses"}</>;
  if (metric.format === "coupons") return <>{formatNumber(value)} cupons/dia</>;
  return <>{formatNumber(value, 0)}</>;
}

function CashflowBars({ model }: { model: ReturnType<typeof calculateModel> }) {
  const data = model.months;
  const maxValue = Math.max(...data.map((m) => Math.max(m.revenue, Math.abs(m.ebitda))), 1);
  const height = 180;
  const chartWidth = 960;
  const gap = 3;
  const barWidth = Math.max(4, chartWidth / data.length - gap);
  return (
    <div className="chart-wrap" role="img" aria-label="Gráfico de receita bruta e EBITDA mensal ao longo de 60 meses">
      <div className="chart-legend"><span><i className="legend-revenue" /> Receita bruta</span><span><i className="legend-ebitda" /> EBITDA</span></div>
      <svg className="cashflow-chart" viewBox={`0 0 ${chartWidth} ${height + 34}`} preserveAspectRatio="none">
        <line x1="0" y1={height - 1} x2={chartWidth} y2={height - 1} stroke="#dfe7e2" />
        {data.map((m, index) => {
          const x = index * (chartWidth / data.length) + gap / 2;
          const revenueHeight = Math.max(1, (m.revenue / maxValue) * (height - 12));
          const ebitdaHeight = Math.abs(m.ebitda) / maxValue * (height - 12);
          const y = height - revenueHeight;
          const ebY = m.ebitda >= 0 ? height - ebitdaHeight : height;
          return <g key={m.month}>
            <rect x={x} y={y} width={barWidth} height={revenueHeight} rx="2" fill="#dce9e2" />
            <rect x={x} y={ebY} width={barWidth} height={Math.max(1, ebitdaHeight)} rx="2" fill={m.ebitda < 0 ? "#d66b5d" : "#15734e"} />
            {(m.month === 1 || m.month % 6 === 0) && <text x={x + barWidth / 2} y={height + 20} textAnchor="middle">M{m.month}</text>}
          </g>;
        })}
      </svg>
      <p className="chart-caption">Receita (barras claras) e EBITDA (barras verdes; prejuízo em vermelho). A altura é proporcional dentro do cenário.</p>
    </div>
  );
}

function InputField({
  item, value, onChange,
}: {
  item: (typeof ASSUMPTIONS)[number]; value: number; onChange: (id: string, value: number) => void;
}) {
  const isPercent = item.kind === "percent";
  const displayed = isPercent ? value * 100 : value;
  const printDisplay = item.choices?.find((choice) => choice.value === value)?.label
    ?? (item.kind === "percent" ? formatPercent(value) : item.kind === "money" ? formatMoney(value, true) : formatNumber(value));
  return (
    <label className="assumption-field" htmlFor={`field-${item.id}`}>
      <span className="field-label">{item.label}</span>
      {item.choices ? (
        <>
          <select id={`field-${item.id}`} value={value} onChange={(event) => onChange(item.id, Number(event.target.value))}>
            {item.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
          <span className="print-value">{printDisplay}</span>
        </>
      ) : (
        <span className={`number-entry ${item.kind === "money" ? "with-prefix" : ""} ${item.id === "p26" ? "fixed-input" : ""}`}>
          {item.kind === "money" && <span className="currency-prefix">R$</span>}
          <input
            id={`field-${item.id}`}
            type="number"
            step={isPercent ? "0.1" : item.kind === "integer" ? "1" : item.kind === "money" ? "100" : "0.01"}
            disabled={item.id === "p26"}
            value={Number.isFinite(displayed) ? Number(displayed.toFixed(7)) : 0}
            onChange={(event) => {
              const next = event.currentTarget.value === "" ? 0 : Number(event.currentTarget.value);
              onChange(item.id, isPercent ? next / 100 : next);
            }}
            aria-label={`${item.label}${isPercent ? " em percentual" : ""}${item.id === "p26" ? ", fixo em 60 meses" : ""}`}
          />
          {isPercent && <span className="field-suffix">%</span>}
          {item.kind === "integer" && <span className="field-suffix">{item.row === 52 ? "dias/mês" : [20, 26, 37].includes(item.row) ? "meses" : ""}</span>}
        </span>
      )}
      {!item.choices && <span className="print-value">{printDisplay}</span>}
      {item.note && <span className="field-note">{item.note}</span>}
    </label>
  );
}

function ScrollTable({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table>{children}</table></div>;
}

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioState>(() => loadScenario());
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [savedState, setSavedState] = useState<"saved" | "saving" | "error">("saved");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [calculationRevision, setCalculationRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const model = useMemo(() => calculateModel(scenario.values, scenario.scenarioRevenue), [scenario, calculationRevision]);
  const grouped = useMemo(() => ASSUMPTIONS.reduce<Record<string, typeof ASSUMPTIONS>>((result, item) => {
    (result[item.group] ??= []).push(item);
    return result;
  }, {}), []);

  useEffect(() => {
    setSavedState("saving");
    const timer = window.setTimeout(() => setSavedState(saveScenario(scenario) ? "saved" : "error"), 260);
    return () => window.clearTimeout(timer);
  }, [scenario]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const announce = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 5200);
  };
  const updateValue = (id: string, value: number) => {
    if (!Number.isFinite(value)) return;
    setScenario((current) => ({ ...current, values: { ...current.values, [id]: value } }));
    setLastUpdated(new Date());
  };
  const goTo = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const recalculate = () => {
    setIsRecalculating(true);
    window.requestAnimationFrame(() => {
      setCalculationRevision((revision) => revision + 1);
      setLastUpdated(new Date());
      setIsRecalculating(false);
      announce("Cálculos atualizados com as premissas atuais.");
    });
  };
  const restore = () => {
    setScenario(restoreScenario());
    setLastUpdated(new Date());
    announce("Cenário inicial da planilha restaurado e recalculado.");
  };
  const exportConfig = async () => {
    try { const { exportConfiguration } = await import("@/lib/yakiniku-excel"); exportConfiguration(scenario); announce("Arquivo Excel de configuração baixado."); }
    catch { announce("Não foi possível gerar o arquivo Excel de configuração."); }
  };
  const exportComplete = async () => {
    try { const { exportFullWorkbook } = await import("@/lib/yakiniku-excel"); exportFullWorkbook(scenario, model); announce("Workbook Excel completo baixado."); }
    catch { announce("Não foi possível gerar o workbook Excel completo."); }
  };
  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const { importConfiguration } = await import("@/lib/yakiniku-excel");
      const imported = await importConfiguration(file);
      setScenario(imported);
      setLastUpdated(new Date());
      announce("Configuração importada. Todas as projeções e indicadores foram recalculados.");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível importar esse arquivo.");
    }
  };

  const highlights = [
    { label: "Investimento total", value: formatMoney(model.derived.investment), note: "CAPEX + capital de giro", color: "dark" },
    { label: "Receita estabilizada", value: formatMoney(model.stableRevenue), note: `${formatNumber(model.months[Math.round(pct(scenario.values, 37)) - 1]?.couponsPerDay ?? 0)} cupons/dia`, color: "" },
    { label: "EBITDA estabilizado", value: formatMoney(model.stableEbitda), note: "Antes do serviço da dívida", color: "" },
    { label: "Caixa do acionista", value: formatMoney(model.stableOwnerCash), note: "Após parcela do financiamento", color: "" },
    { label: "Ponto de equilíbrio", value: typeof model.metrics.find((m) => m.id === "breakevenVolume")?.project === "number" ? `${formatNumber(model.metrics.find((m) => m.id === "breakevenVolume")?.project as number)} cupons/dia` : "n/d", note: "Com impostos", color: "" },
    { label: "VPL do projeto", value: formatMoney(model.projectNpv), note: `WACC de ${formatPercent(pct(scenario.values, 24))}`, color: "" },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-copy">
            <a className="topbar-brand" href="#overview" onClick={(event) => { event.preventDefault(); goTo("overview"); }} aria-label="Ir para resumo executivo">CASA DO SUSHI <span>·</span> YAKINIKU</a>
            <h1>Simulador de negócios</h1>
            <p className="topbar-description">Modelo financeiro operacional de 60 meses, com premissas editáveis, fluxo de caixa, DRE, sensibilidade e indicadores de retorno.</p>
          </div>
          <div className="topbar-right"><span className="version-tag">BUSINESS PLAN <b>·</b> 60 MESES</span><span className={`save-state ${savedState}`}><i />{savedState === "saved" ? "Salvo neste navegador" : savedState === "saving" ? "Salvando…" : "Armazenamento indisponível"}</span></div>
        </div>
        <div className="topbar-rule" />
      </header>

      <main className="page-content">
        {notice && <div className="notice" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <section className="section-block assumptions-section" id="premissas">
              <div className="section-heading premise-heading"><div><p className="eyebrow">ENTRADAS DO MODELO</p><h2>Premissas editáveis</h2><p>Edite as entradas; resultados e indicadores serão atualizados automaticamente e salvos neste navegador.</p></div><span className="editable-hint"><span /> Horizonte fixo · 60 meses</span></div>
              <div className="assumption-layout">
                <div className="panel assumption-groups">{Object.entries(grouped).map(([group, items], index) => <article className="assumption-panel" key={group}><div className="group-heading"><span className="group-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{group}</h3><p>{groupDescription(group)}</p></div></div><div className="field-grid">{items.map((item) => <InputField key={item.id} item={item} value={scenario.values[item.id]} onChange={updateValue} />)}</div></article>)}</div>
                <aside className="derived-panel panel"><div className="panel-heading"><div><h3>Calculados automaticamente</h3><p>Derivados das premissas</p></div></div><DerivedLine label="CAPEX total" value={formatMoney(model.derived.capex)} /><DerivedLine label="Capital de giro" value={formatMoney(model.derived.workingCapital)} /><DerivedLine label="Investimento total" value={formatMoney(model.derived.investment)} strong /><DerivedLine label="Parcela mensal (Price)" value={formatMoney(model.derived.financingPayment)} /><DerivedLine label="Aporte próprio" value={formatMoney(model.derived.equity)} strong /><DerivedLine label="WACC / TMA mensal" value={formatPercent(model.monthlyDiscountRate)} /><DerivedLine label="Margem antes dos impostos" value={formatPercent(model.derived.contributionRate)} /><DerivedLine label="Custo mensal por funcionário" value={formatMoney(model.derived.employeeCost)} /><DerivedLine label="Folha mensal total" value={formatMoney(model.derived.payroll)} /><DerivedLine label="Fixos mensais (Ano 1)" value={formatMoney(model.derived.fixedCostYear1)} strong /><div className="autosave-note"><Save size={16} /><span>Salvamento automático ativo<br /><b>Armazenado somente neste navegador.</b></span></div></aside>
              </div>
            </section>

            <section className="panel action-panel" aria-labelledby="actions-heading">
              <div className="action-heading"><p className="eyebrow">FERRAMENTAS DO CENÁRIO</p><h3 id="actions-heading">Ações</h3></div>
              <div className="action-bar" aria-label="Ações do simulador">
                <div className="action-left"><button className="button button-primary" onClick={recalculate}><Save size={16} />{isRecalculating ? "Recalculando…" : "Recalcular"}</button><button className="button button-secondary" onClick={restore}><RotateCcw size={16} />Restaurar cenário inicial</button></div>
                <div className="action-right"><button className="button button-quiet" onClick={exportConfig}><ArrowDownToLine size={16} />Exportar configuração</button><button className="button button-quiet" onClick={exportComplete}><FileSpreadsheet size={16} />Exportar completo</button><button className="button button-quiet" onClick={() => fileInput.current?.click()}><ArrowUpFromLine size={16} />Importar configuração</button><button className="button button-quiet print-button" onClick={() => window.print()}><Printer size={16} />Imprimir / PDF</button><input ref={fileInput} type="file" accept=".xlsx,.xls,.xlsm" className="visually-hidden" onChange={onImportFile} aria-label="Selecionar arquivo de configuração Excel" /></div>
              </div>
            </section>
          </aside>

          <div className="workspace-main">
            <nav className="section-nav" aria-label="Atalhos das seções financeiras">{sections.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => goTo(id)} className={activeSection === id ? "active" : ""}><Icon size={15} />{label}</button>)}</nav>
            <section className="section-block overview-section" id="overview">
              <div className="overview-summary panel"><div className="section-heading"><div><p className="eyebrow">RESUMO EXECUTIVO</p><h2>Resumo do cenário</h2><p>Projeções para {model.months.length} meses, com margem de contribuição pré-impostos de {formatPercent(model.derived.contributionRate)} e estabilização no mês {Math.round(pct(scenario.values, 37))}.</p></div><div className="overview-badges"><span className="scenario-label"><span className="status-dot" /> Cenário Yakiniku<small>Dados locais · sem envio externo</small></span><span className="updated-label"><Save size={14} /> Atualizado {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div></div><div className="kpi-grid">{highlights.map((item) => <article className={`kpi-card ${item.color}`} key={item.label}><span className="kpi-label">{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</div></div>
              <div className="overview-lower">
                <article className="panel chart-panel"><div className="panel-heading"><div><h3>Trajetória mensal</h3><p>Receita e EBITDA ao longo do período projetado</p></div><span className="panel-mark">PROJEÇÃO</span></div><CashflowBars model={model} /></article>
                <article className="panel validation-panel"><div className="panel-heading"><div><h3>Leitura econômica</h3><p>Sinalização a partir das premissas atuais</p></div></div><ValidationItem good={model.projectNpv > 0} label="VPL do projeto" detail={formatMoney(model.projectNpv)} /><ValidationItem good={model.projectIrrMonthly !== null && Math.pow(1 + model.projectIrrMonthly, 12) - 1 > pct(scenario.values, 24)} label="TIR vs. WACC" detail={`${model.projectIrrMonthly === null ? "n/d" : formatPercent(Math.pow(1 + model.projectIrrMonthly, 12) - 1)} anual · WACC ${formatPercent(pct(scenario.values, 24))}`} /><ValidationItem good={typeof model.metrics.find((m) => m.id === "breakevenVolume")?.project === "number" && (model.metrics.find((m) => m.id === "breakevenVolume")?.project as number) < (model.months[Math.round(pct(scenario.values, 37)) - 1]?.couponsPerDay ?? 0)} label="Volume de equilíbrio" detail={`${formatNumber(Number(model.metrics.find((m) => m.id === "breakevenVolume")?.project))} cupons/dia vs. ${formatNumber(model.months[Math.round(pct(scenario.values, 37)) - 1]?.couponsPerDay ?? 0)} estabilizados`} /><ValidationItem good={model.derived.variableRate <= 0.5} warn label="Custos variáveis" detail={`${formatPercent(model.derived.variableRate)} da receita · margem pré-impostos de ${formatPercent(model.derived.contributionRate)}`} />{model.metrics.find((m) => m.id === "maxRbt12")?.note.startsWith("Atenção") && <div className="tax-warning"><CircleAlert size={16} />A receita projetada ultrapassa o limite nominal do Simples Nacional de {formatMoney(SIMPLE_TAX_LIMIT)}. Valide o enquadramento com a contabilidade.</div>}</article>
              </div>
            </section>

            <section className="section-block" id="projecao"><SectionTitle eyebrow="PROJEÇÃO · 60 MESES" title="Fluxo mensal" description="Projeção do ramp-up à estabilização, com custos, EBITDA, dívida e fluxos do projeto e do acionista. Deslize horizontalmente para ver todas as colunas." /><ScrollTable label="Projeção financeira mensal de 60 meses"><thead><tr><th>Mês</th><th>Cal.</th><th>Cupons/dia</th><th>Ticket</th><th>Receita bruta</th><th>RBT12</th><th>Impostos</th><th>Margem contrib.</th><th>Equipe</th><th>Aluguel</th><th>Outros fixos</th><th>EBITDA</th><th>Financ.</th><th>Fluxo projeto</th><th>Caixa acionista</th><th>Caixa proj. acum.</th><th>Caixa acion. acum.</th></tr></thead><tbody>{model.months.map((m) => <tr key={m.month}><td className="sticky-col">{String(m.month).padStart(2, "0")}</td><td>{monthName(m.calendarMonth)}</td><td>{formatNumber(m.couponsPerDay)}</td><td>{formatMoney(m.ticket, true)}</td><td>{formatMoney(m.revenue)}</td><td>{formatMoney(m.rbt12)}</td><td>{formatMoney(m.taxes)}</td><td>{formatMoney(m.contribution)}</td><td>{formatMoney(m.payroll)}</td><td>{formatMoney(m.rent)}</td><td>{formatMoney(m.otherFixed)}</td><td className={m.ebitda < 0 ? "negative" : "positive"}>{formatMoney(m.ebitda)}</td><td>{formatMoney(m.financing)}</td><td className={m.projectFlow < 0 ? "negative" : ""}>{formatMoney(m.projectFlow)}</td><td className={m.ownerFlow < 0 ? "negative" : ""}>{formatMoney(m.ownerFlow)}</td><td className={m.cumulativeProject < 0 ? "negative" : ""}>{formatMoney(m.cumulativeProject)}</td><td className={m.cumulativeOwner < 0 ? "negative" : ""}>{formatMoney(m.cumulativeOwner)}</td></tr>)}</tbody></ScrollTable><p className="table-footnote">A linha “RBT12” acompanha a receita bruta de 12 meses para estimar a alíquota do Simples Nacional. O fluxo do projeto não inclui a dívida; a coluna “Caixa acionista” inclui a parcela do financiamento.</p></section>

            <section className="section-block" id="dre"><SectionTitle eyebrow="DEMONSTRAÇÃO ANUAL" title="DRE e caixa por ano" description="Valores nominais por ano operacional. A última coluna totaliza o horizonte projetado; margens percentuais usam a receita como base." /><ScrollTable label="DRE e fluxo de caixa por ano"><thead><tr><th>Conta</th>{model.annual.map((year) => <th key={year.year}>Ano {year.year}</th>)}<th>Total</th></tr></thead><tbody>{dreRows(model).map((row) => <tr key={row.label} className={row.emphasis ? "emphasis-row" : ""}><td className="row-label">{row.label}</td>{row.values.map((value, index) => <td key={index} className={typeof value === "number" && value < 0 ? "negative" : ""}>{row.format === "percent" ? formatPercent(Number(value)) : row.format === "number" ? formatNumber(Number(value), 0) : formatMoney(value)}</td>)}</tr>)}</tbody></ScrollTable><p className="table-footnote">No modelo do Simples Nacional, tributos como IRPJ/CSLL estão incluídos na linha de impostos estimados. O EBITDA aparece antes das parcelas do financiamento.</p></section>

            <section className="section-block" id="indicadores"><SectionTitle eyebrow="RETORNO E SOLVÊNCIA" title="Indicadores financeiros" description="Compare a viabilidade econômica do projeto com o caixa após financiamento na perspectiva do acionista." /><ScrollTable label="Indicadores financeiros do projeto e do acionista"><thead><tr><th>Indicador</th><th>Projeto econômico</th><th>Visão do acionista</th><th>Leitura</th></tr></thead><tbody>{model.metrics.map((metric) => <tr key={metric.id}><td className="row-label">{metric.label}</td><td className={typeof metric.project === "number" && metric.project < 0 ? "negative" : ""}><MetricValue metric={metric} value={metric.project} /></td><td className={typeof metric.owner === "number" && metric.owner < 0 ? "negative" : ""}><MetricValue metric={metric} value={metric.owner} /></td><td className="note-cell">{metric.note}</td></tr>)}</tbody></ScrollTable><div className="method-grid"><div className="method-card"><span>VPL</span><p>Fluxos futuros descontados pela taxa mensal equivalente ao WACC/TMA anual informado.</p></div><div className="method-card"><span>TIR / MTIR</span><p>Taxas mensais anualizadas por capitalização; MTIR usa o WACC como taxa de financiamento e reinvestimento.</p></div><div className="method-card"><span>Payback</span><p>Primeiro mês em que o fluxo acumulado, nominal ou descontado, recupera o investimento inicial.</p></div></div></section>

            <section className="section-block" id="receita"><SectionTitle eyebrow="CENÁRIO EM REGIME" title="Simulador de receita" description="Teste uma receita mensal sem ramp-up usando custos fixos do Ano 1 e a regra tributária selecionada." /><div className="scenario-input panel"><label htmlFor="revenue-scenario"><span>Receita mensal para simulação</span><small>Valor auxiliar — não altera as premissas do ramp-up</small></label><div><span>R$</span><input id="revenue-scenario" type="number" min="0" step="1000" value={scenario.scenarioRevenue} onChange={(event) => { setScenario((current) => ({ ...current, scenarioRevenue: Math.max(0, Number(event.target.value) || 0) })); setLastUpdated(new Date()); }} /></div></div><div className="scenario-table panel"><div className="panel-heading"><div><h3>Resultado em regime</h3><p>Custos fixos médios do Ano 1</p></div><span className={`scenario-result ${model.scenario.ebitda >= 0 ? "good" : "bad"}`}>{model.scenario.ebitda >= 0 ? "EBITDA positivo" : "EBITDA negativo"}</span></div><div className="scenario-grid">{[["Receita simulada", formatMoney(model.scenario.revenue)], ["Cupons/mês", formatNumber(model.scenario.couponsPerMonth)], ["Cupons/dia", formatNumber(model.scenario.couponsPerDay)], ["Cupons/hora", formatNumber(model.scenario.couponsPerHour)], ["Custos variáveis", formatMoney(model.scenario.variableCosts)], ["Impostos", formatMoney(model.scenario.taxes)], ["Alíquota efetiva", formatPercent(model.scenario.taxRate)], ["Custos fixos", formatMoney(model.scenario.fixedCosts)], ["EBITDA mensal", formatMoney(model.scenario.ebitda)], ["Margem sobre faturamento", formatPercent(model.scenario.profitMargin)], ["Retorno mensal s/ investimento", formatPercent(model.scenario.returnOnInvestment)], ["Payback simples", typeof model.scenario.simplePayback === "number" ? `${formatNumber(model.scenario.simplePayback)} meses` : model.scenario.simplePayback]].map(([label, value]) => <div className="scenario-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div><div className="scenario-targets panel"><div className="panel-heading"><div><h3>Receita mensal necessária</h3><p>Calculada por faixa tributária; “n/d” indica que não há receita de equilíbrio com as margens informadas</p></div></div><div className="target-grid"><TargetCard label="Ponto de equilíbrio do projeto" value={model.breakevenRevenue === null ? "n/d" : formatMoney(model.breakevenRevenue)} detail="EBITDA mensal igual a zero" /><TargetCard label="Payback simples em 24 meses" value={formatMoney(requiredRevenue(scenario.values, model, 24))} detail="EBITDA mensal cobre o investimento ÷ 24" /><TargetCard label="Payback simples em 12 meses" value={formatMoney(requiredRevenue(scenario.values, model, 12))} detail="EBITDA mensal cobre o investimento ÷ 12" /><TargetCard label="Equilíbrio do acionista" value={model.breakevenOwnerRevenue === null ? "n/d" : formatMoney(model.breakevenOwnerRevenue)} detail="Inclui a parcela mensal do financiamento" /></div></div></section>

            <section className="section-block" id="sensibilidade"><SectionTitle eyebrow="CENÁRIOS DE ESTRESSE" title="Sensibilidade do EBITDA" description="EBITDA mensal estabilizado com variações de volume, ticket médio e CMV. Os demais percentuais de custo e os fixos ficam constantes." /><article className="panel sensitivity-panel"><div className="panel-heading"><div><h3>Cupons/dia × ticket médio</h3><p>Variação de volume nas linhas; variação de ticket nas colunas</p></div><span className="panel-mark">R$ / MÊS</span></div><SensitivityTable rows={model.sensitivityTicket} columns={[-10, -5, 0, 5, 10].map((x) => `Ticket ${x > 0 ? "+" : ""}${x}%`)} baseVolume={pct(scenario.values, 36)} /></article><article className="panel sensitivity-panel"><div className="panel-heading"><div><h3>Cupons/dia × custo de matéria-prima</h3><p>CMV substitui a premissa base; outros custos variáveis ficam constantes</p></div><span className="panel-mark">R$ / MÊS</span></div><SensitivityTable rows={model.sensitivityCogs} columns={[36, 38, 40, 42, 44].map((x) => `CMV ${x}%`)} baseVolume={pct(scenario.values, 36)} /></article><div className="limitation-note"><CircleAlert size={16} /><p><b>Limites conhecidos do modelo original:</b> não considera depreciação, CAPEX de manutenção, sazonalidade de vendas nem prazos de recebimento de cartão. As estimativas tributárias e trabalhistas devem ser validadas com a contabilidade e a convenção coletiva aplicável.</p></div></section>

            <footer className="page-footer"><div><strong>CASA DO SUSHI <span>·</span> YAKINIKU</strong><small>Ferramenta de planejamento financeiro · Não constitui garantia de resultado</small></div><a href="#overview" onClick={(event) => { event.preventDefault(); goTo("overview"); }}>Voltar ao início <ChevronRight size={15} /></a></footer>
          </div>
        </div>
      </main>
    </div>
  );
}

function groupDescription(group: string) {
  const descriptions: Record<string, string> = {
    Investimento: "Taxa de franquia, implantação e capital de giro.",
    Financiamento: "Condições de crédito e participação de capital próprio.",
    Avaliação: "Taxa de desconto, horizonte e recuperação do investimento.",
    Receita: "Ticket, dias de operação, volume e curva de maturação.",
    "Custos variáveis": "CMV, royalties, fundo de propaganda e taxas de pagamento.",
    Impostos: "Regime fixo ou alíquota efetiva estimada do Simples Nacional.",
    Equipe: "Quadro, salários, encargos legais e benefícios.",
    Fixos: "Pró-labore, aluguel, utilidades e reajuste anual.",
  };
  return descriptions[group] ?? "Premissas operacionais editáveis.";
}

function ValidationItem({ good, warn = false, label, detail }: { good: boolean; warn?: boolean; label: string; detail: string }) {
  const status = warn ? "warn" : good ? "good" : "bad";
  return <div className="validation-item"><span className={`validation-pill ${status}`}>{warn ? "Premissa" : good ? "Favorável" : "Atenção"}</span><div><strong>{label}</strong><small>{detail}</small></div></div>;
}
function DerivedLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`derived-line ${strong ? "strong" : ""}`}><span>{label}</span><b>{value}</b></div>;
}
function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>;
}
function TargetCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="target-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function requiredRevenue(v: Values, model: ReturnType<typeof calculateModel>, months: number) {
  const investment = Math.round(v.p23) === 2 ? model.derived.capex : model.derived.investment;
  const fixed = model.derived.fixedCostYear1 + investment / months;
  return solveBreakEvenRevenue(v, model.derived, fixed) ?? "n/d";
}

function dreRows(model: ReturnType<typeof calculateModel>) {
  const columns: { label: string; values: number[]; format?: "percent" | "number"; emphasis?: boolean }[] = [
    { label: "Receita bruta", values: model.annual.map((a) => a.revenue), emphasis: true },
    { label: "(−) Impostos sobre vendas", values: model.annual.map((a) => a.taxes) },
    { label: "Receita líquida", values: model.annual.map((a) => a.netRevenue), emphasis: true },
    { label: "(−) Matéria-prima", values: model.annual.map((a) => a.cogs) },
    { label: "(−) Royalties e fundo de propaganda", values: model.annual.map((a) => a.royaltiesAndMarketing) },
    { label: "(−) Taxas de cartão", values: model.annual.map((a) => a.cardFees) },
    { label: "Margem de contribuição", values: model.annual.map((a) => a.contribution), emphasis: true },
    { label: "Margem de contribuição %", values: model.annual.map((a) => a.contributionMargin), format: "percent" },
    { label: "(−) Equipe", values: model.annual.map((a) => a.payroll) },
    { label: "(−) Aluguel", values: model.annual.map((a) => a.rent) },
    { label: "(−) Demais fixos", values: model.annual.map((a) => a.otherFixed) },
    { label: "EBITDA / Resultado operacional", values: model.annual.map((a) => a.ebitda), emphasis: true },
    { label: "Margem EBITDA %", values: model.annual.map((a) => a.ebitdaMargin), format: "percent" },
    { label: "(−) Parcelas do financiamento", values: model.annual.map((a) => a.financing) },
    { label: "Caixa livre do acionista", values: model.annual.map((a) => a.ownerCash), emphasis: true },
    { label: "Caixa acumulado — fim do ano", values: model.annual.map((a) => a.endingCash), emphasis: true },
    { label: "Cupons atendidos no ano", values: model.annual.map((a) => a.coupons), format: "number" },
    { label: "Ticket médio do ano", values: model.annual.map((a) => a.averageTicket) },
  ];
  return columns.map((row) => {
    const isPercent = row.format === "percent";
    const total = isPercent
      ? row.label.startsWith("Margem de contribuição")
        ? model.annual.reduce((s, a) => s + a.contribution, 0) / Math.max(1, model.annual.reduce((s, a) => s + a.revenue, 0))
        : model.annual.reduce((s, a) => s + a.ebitda, 0) / Math.max(1, model.annual.reduce((s, a) => s + a.revenue, 0))
      : row.label.startsWith("Caixa acumulado") ? model.annual.at(-1)?.endingCash ?? 0
        : row.label.startsWith("Ticket médio") ? model.annual.reduce((s, a) => s + a.revenue, 0) / Math.max(1, model.annual.reduce((s, a) => s + a.coupons, 0))
          : row.values.reduce((s, value) => s + value, 0);
    return { ...row, values: [...row.values, total] };
  });
}

function SensitivityTable({ rows, columns, baseVolume }: { rows: { volumeChange: number; values: number[] }[]; columns: string[]; baseVolume: number }) {
  const maxAbs = Math.max(...rows.flatMap((row) => row.values.map(Math.abs)), 1);
  return <ScrollTable label="Tabela de sensibilidade do EBITDA"><thead><tr><th>Variação volume</th><th>Cupons/dia</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.volumeChange}><td className="row-label">{row.volumeChange > 0 ? "+" : ""}{formatPercent(row.volumeChange)}</td><td>{formatNumber(baseVolume * (1 + row.volumeChange))}</td>{row.values.map((value, index) => <td key={index} className={`heat-cell ${value >= 0 ? "heat-positive" : "heat-negative"}`} style={{ "--heat": Math.min(0.78, Math.abs(value) / maxAbs * 0.78) } as React.CSSProperties}>{formatMoney(value)}</td>)}</tr>)}</tbody></ScrollTable>;
}
