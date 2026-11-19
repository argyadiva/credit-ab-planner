import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FlaskConical,
  Github,
  Info,
  Layers3,
  Link2,
  LoaderCircle,
  PanelLeft,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildPlan, validate, type Interval, type Plan } from './model';
import {
  emptyDraft,
  exampleDraft,
  exportCsv,
  formatDate,
  parseDraft,
  restoreScenario,
  scenarioUrl,
  type Draft,
} from './scenario';
import type { Simulation } from './simulation';

const number = (n: number) => new Intl.NumberFormat('en').format(n);
const pct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const pp = (n: number, digits = 2) => `${(n * 100).toFixed(digits)} pp`;
const intervalText = (ci: Interval | null | undefined, difference = false) =>
  ci
    ? `${(ci[0] * 100).toFixed(2)} to ${(ci[1] * 100).toFixed(2)} ${difference ? 'pp' : '%'}`
    : 'No mature labels';

function Field({
  label,
  suffix,
  help,
  children,
}: {
  label: string;
  suffix?: string;
  help?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {help && (
          <span className="field-help" title={help}>
            <CircleHelp size={13} aria-label={help} />
          </span>
        )}
      </label>
      <div className="input-wrap">
        {children(id)}
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
      {help && (
        <span className="sr-only" id={`${id}-help`}>
          {help}
        </span>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  suffix,
  detail,
  icon,
  tone = '',
}: {
  title: string;
  value: string;
  suffix?: string;
  detail: ReactNode;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <section className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="stat-detail">{detail}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="empty-chart">
      <svg viewBox="0 0 800 230" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <linearGradient id="empty-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7e9e4" stopOpacity=".6" />
            <stop offset="100%" stopColor="#eaf2ef" stopOpacity=".15" />
          </linearGradient>
        </defs>
        {[40, 90, 140, 190].map((y) => (
          <line key={y} x1="15" x2="785" y1={y} y2={y} stroke="#e9eeec" strokeDasharray="4 5" />
        ))}
        <path
          d="M20 30 C130 60 130 75 230 81 S430 94 780 100 L780 133 C430 143 330 153 230 163 S130 185 20 215Z"
          fill="url(#empty-gradient)"
        />
        <path d="M20 122 L780 116" stroke="#bccfc7" strokeWidth="2" strokeDasharray="5 6" />
      </svg>
      <div className="empty-chart-message">
        <span className="empty-symbol">
          <TrendingUp size={23} />
        </span>
        <strong>Your experiment, week by week</strong>
        <p>
          Enter your assumptions to see how precision
          <br />
          improves as credit outcomes mature.
        </p>
      </div>
      <div className="empty-chart-axis">
        <span>Experiment starts</span>
        <span>Final readout</span>
      </div>
    </div>
  );
}

function Methodology() {
  return (
    <details id="methodology" className="methodology">
      <summary>
        <span>
          <ShieldCheck size={17} /> Assumptions & methodology
        </span>
        <ChevronDown size={17} />
      </summary>
      <div className="method-content">
        <div>
          <h3>A fixed final decision</h3>
          <p>
            Sample size uses an approximate two-sided z-test for independent proportions, with
            pooled variance under the null and unpooled variance under the alternative. Power is
            solved numerically and sample targets are rounded up.
          </p>
          <p>
            Individual bad-rate intervals use Wilson’s method; reduction intervals use Newcombe’s
            method. Forecast intervals use expected, possibly fractional, bad counts. They
            illustrate precision and are not observed results.
          </p>
        </div>
        <div>
          <h3>Credit outcomes need time</h3>
          <p>
            Each funded cohort waits for the entire observation window plus reporting delay, even if
            a bad event is known earlier. Coverage is the expected share with usable labels;
            missingness must be unrelated to outcomes.
          </p>
          <p>
            Assumes independent borrowers with one analyzed loan each, stable traffic and bad rates,
            and the same funding rate in both arms. This compares portfolio bad rates at fixed
            lending volume; it does not isolate a score’s effect on the same funded borrowers.
          </p>
        </div>
        <div>
          <h3>Simulations are hypothetical</h3>
          <p>
            Traffic, funding, and coverage are deterministic expectations. One thousand seeded
            binomial experiments simulate bad outcomes on new mature cohorts. Detection is a
            two-sided z-test rejection in the beneficial direction at that week, not the chance of
            having detected an effect at any earlier week.
          </p>
          <p>
            Detection uncertainty is a 95% Wilson interval across simulation runs. It is Monte Carlo
            error, separate from the experiment’s confidence interval. Early small samples and rare
            events need extra care.
          </p>
        </div>
        <div>
          <h3>Reference methods</h3>
          <p>
            <a
              href="https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html"
              target="_blank"
              rel="noreferrer"
            >
              Independent-proportions power <ArrowUpRight size={13} />
            </a>
            <br />
            <a
              href="https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm"
              target="_blank"
              rel="noreferrer"
            >
              Wilson confidence intervals <ArrowUpRight size={13} />
            </a>
            <br />
            <a
              href="https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/proportion.py"
              target="_blank"
              rel="noreferrer"
            >
              Newcombe difference intervals <ArrowUpRight size={13} />
            </a>
          </p>
          <p>
            Calculations run in your browser. No borrower records, accounts, or server-side storage
            are used. Shared links include the assumptions you enter.
          </p>
        </div>
      </div>
    </details>
  );
}

export default function App() {
  const initial = useRef(restoreScenario(window.location.search));
  const [draft, setDraft] = useState<Draft>(initial.current.draft);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [errors, setErrors] = useState<string[]>(
    initial.current.error ? [initial.current.error] : [],
  );
  const [simError, setSimError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [mode, setMode] = useState<'forecast' | 'simulation'>('forecast');
  const [tablePage, setTablePage] = useState(0);
  const [notice, setNotice] = useState('');
  const [shareFallback, setShareFallback] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const calculate = (values: Draft, focus = true) => {
    try {
      const inputs = parseDraft(values);
      const issues = validate(inputs);
      if (issues.length) throw new Error(issues.join('\n'));
      setPlan(buildPlan(inputs));
      setErrors([]);
      setMode('forecast');
      setTablePage(0);
      setShareFallback('');
    } catch (error) {
      setPlan(null);
      setSimulation(null);
      setErrors((error instanceof Error ? error.message : 'Please check the inputs.').split('\n'));
      if (focus) setTimeout(() => errorRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('v') === '1')
      calculate(initial.current.draft, false);
    // Restore a shared scenario only on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSimulation(null);
    setSimError('');
    if (!plan) {
      setSimulating(false);
      return;
    }
    setSimulating(true);
    let worker: Worker;
    try {
      worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setSimError(
        'The simulation worker could not start. Your planning forecast is still available.',
      );
      setSimulating(false);
      return;
    }
    workerRef.current = worker;
    const fail = () => {
      setSimError(
        'The simulation could not finish. Try running it again. Your planning forecast is still available.',
      );
      setSimulating(false);
      worker.terminate();
    };
    const timeout = window.setTimeout(fail, 60_000);
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data.ok) setSimulation(event.data.result);
      else setSimError(event.data.error);
      setSimulating(false);
      worker.terminate();
    };
    worker.onerror = fail;
    worker.postMessage(plan);
    return () => {
      clearTimeout(timeout);
      worker.terminate();
      workerRef.current = null;
    };
  }, [plan]);

  useEffect(() => {
    if (notice) {
      const timeout = setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(timeout);
    }
  }, [notice]);

  const change = (key: keyof Draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setPlan(null);
    setSimulation(null);
    setErrors([]);
    setShareFallback('');
  };
  const input = (
    key: keyof Draft,
    placeholder: string,
    suffix?: string,
    help?: string,
    label?: string,
    step = 'any',
  ) => (
    <Field label={label ?? key} suffix={suffix} help={help}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          placeholder={placeholder}
          value={draft[key]}
          onChange={(event) => change(key, event.target.value)}
          aria-describedby={help ? `${id}-help` : undefined}
          required
        />
      )}
    </Field>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    calculate(draft);
  };
  const loadExample = () => {
    const example = exampleDraft();
    setDraft(example);
    calculate(example, false);
    setNotice('Illustrative example loaded. Every assumption is editable.');
  };
  const reset = () => {
    setDraft(emptyDraft());
    setPlan(null);
    setSimulation(null);
    setErrors([]);
    setShareFallback('');
    window.history.replaceState(null, '', window.location.pathname);
  };
  const share = async () => {
    if (!plan) return;
    const url = scenarioUrl(plan.inputs, window.location.href);
    setShareFallback(url);
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Scenario link copied. It includes your assumptions.');
    } catch {
      setShareFallback(url);
    }
  };
  const download = () => {
    if (!plan) return;
    const url = URL.createObjectURL(
      new Blob([exportCsv(plan, simulation)], { type: 'text/csv;charset=utf-8;' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `creditlab-plan-${plan.inputs.startDate}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      simulation
        ? 'Weekly results and assumptions exported.'
        : 'Forecast exported. Simulated results were not available.',
    );
  };
  const rerun = () => {
    if (!plan) return;
    const seed = (plan.inputs.seed + 1) >>> 0;
    setDraft((previous) => ({ ...previous, seed: String(seed) }));
    setPlan({ ...plan, inputs: { ...plan.inputs, seed } });
  };
  const impliedRate =
    draft.baseline && draft.effect
      ? draft.effectMode === 'relative'
        ? Number(draft.baseline) * (1 - Number(draft.effect) / 100)
        : Number(draft.baseline) - Number(draft.effect)
      : null;
  const chartData = plan?.weeks.map((week, index) => {
    const sim = simulation?.weeks[index];
    const ci = mode === 'forecast' ? week.expectedDifference : sim?.interval;
    return {
      day: week.day,
      effect: ci ? (mode === 'forecast' ? plan.delta : (sim?.difference ?? 0)) * 100 : null,
      band: ci ? [ci[0] * 100, ci[1] * 100] : null,
      mature: week.matureC + week.matureT,
      enrolled: week.enrolledC + week.enrolledT,
      pending: week.pending,
      detection:
        sim?.detection === null || sim?.detection === undefined ? null : sim.detection * 100,
    };
  });
  const finalSim = simulation?.weeks.at(-1);
  const displayWeeks = plan?.weeks.slice(tablePage * 12, tablePage * 12 + 12) ?? [];
  const totalPages = Math.ceil((plan?.weeks.length ?? 0) / 12);

  return (
    <>
      <a className="skip-link" href="#planner">
        Skip to planner
      </a>
      <header className="header">
        <div className="header-inner">
          <a className="brand" href={window.location.pathname} aria-label="CreditLab home">
            <span className="brand-mark">
              <BarChart3 size={22} strokeWidth={2.6} />
            </span>
            <span>
              Credit<span className="brand-light">Lab</span>
            </span>
            <span className="brand-beta">PLANNER</span>
          </a>
          <nav aria-label="Main navigation">
            <a className="nav-active" href="#planner">
              Experiment planner
            </a>
            <a href="#methodology">Methodology</a>
          </nav>
          <a
            className="github-link"
            href="https://github.com/argyadiva/credit-ab-planner"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            <span>View source</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main id="planner" className="shell">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span>/</span>
          <span>Experiment design</span>
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> BUILT FOR CREDIT EXPERIMENTS
            </div>
            <h1>A better plan for your next A/B test.</h1>
            <p>Size your experiment. Account for label lag. Know when you can decide.</p>
          </div>
          <div className="heading-note">
            <ShieldCheck size={17} />
            <span>
              Two-sided test
              <br />
              <strong>One planned final decision</strong>
            </span>
          </div>
        </div>
        <div className="workspace-grid">
          <aside className="assumptions-panel">
            <form onSubmit={submit} noValidate>
              <div className="panel-heading">
                <div>
                  <SlidersIcon />
                  <h2>Experiment setup</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={reset}
                  title="Reset all inputs"
                  aria-label="Reset all inputs"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <div className="setup-intro">
                Start with your assumptions, or{' '}
                <button type="button" onClick={loadExample}>
                  try an example
                </button>
                .
              </div>
              <section className="form-section">
                <h3>
                  <FlaskConical size={15} /> Outcome & effect
                </h3>
                {input(
                  'baseline',
                  'e.g. 10',
                  '%',
                  'Bad outcomes divided by all mature, usable funded loans in the control arm.',
                  'Baseline bad-loan rate',
                )}
                <Field label="Expected reduction">
                  {(id) => (
                    <>
                      <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder={draft.effectMode === 'relative' ? 'e.g. 10' : 'e.g. 1'}
                        value={draft.effect}
                        onChange={(event) => change('effect', event.target.value)}
                        required
                      />
                      <select
                        aria-label="Reduction input mode"
                        value={draft.effectMode}
                        onChange={(event) => change('effectMode', event.target.value)}
                      >
                        <option value="relative">Relative %</option>
                        <option value="absolute">Points (pp)</option>
                      </select>
                      <ChevronDown className="select-chevron" size={13} />
                    </>
                  )}
                </Field>
                <div
                  className={`implied-rate ${impliedRate !== null && (impliedRate <= 0 || impliedRate >= Number(draft.baseline)) ? 'invalid' : ''}`}
                >
                  <TrendingUp size={14} />
                  <span>Expected treatment rate</span>
                  <strong>
                    {impliedRate !== null && Number.isFinite(impliedRate)
                      ? `${impliedRate.toFixed(2)}%`
                      : '—'}
                  </strong>
                </div>
                <div className="field-row">
                  {input(
                    'power',
                    'e.g. 80',
                    '%',
                    'Probability of detecting the assumed effect at the final analysis, under this model.',
                    'Statistical power',
                  )}
                  {input(
                    'confidence',
                    'e.g. 95',
                    '%',
                    'Two-sided confidence level. Significance level is 100% minus this value.',
                    'Confidence level',
                  )}
                </div>
              </section>
              <section className="form-section">
                <h3>
                  <Users size={15} /> Traffic & allocation
                </h3>
                {input(
                  'dailyApplicants',
                  'e.g. 1,000',
                  '/ day',
                  'Eligible unique applicants entering the experiment across both arms, averaged over calendar days.',
                  'Daily eligible applicants',
                )}
                <div className="field-row">
                  {input(
                    'funding',
                    'e.g. 50',
                    '%',
                    'Share of eligible applicants who receive a funded loan. The same rate applies to both arms.',
                    'Funding rate',
                  )}
                  {input(
                    'treatmentShare',
                    'e.g. 50',
                    '%',
                    'Share of applicants assigned to treatment. The remainder enters control.',
                    'Treatment allocation',
                  )}
                </div>
                <div className="allocation-note">
                  <span className="key-dot control" /> Control{' '}
                  {draft.treatmentShare &&
                  Number(draft.treatmentShare) > 0 &&
                  Number(draft.treatmentShare) < 100
                    ? `${100 - Number(draft.treatmentShare)}%`
                    : '—'}
                  <span className="key-dot treatment" /> Treatment{' '}
                  {draft.treatmentShare ? `${draft.treatmentShare}%` : '—'}
                </div>
              </section>
              <section className="form-section">
                <h3>
                  <Clock3 size={15} /> Delayed outcomes <span className="tiny-tag">CREDIT</span>
                </h3>
                <div className="field-row">
                  {input(
                    'observationDays',
                    'e.g. 90',
                    'days',
                    'Full observation window from disbursement, before a loan can be classified as good or bad.',
                    'Observation window',
                    '1',
                  )}
                  {input(
                    'reportingDays',
                    'e.g. 7',
                    'days',
                    'Additional delay after the observation window before the final label is available.',
                    'Reporting delay',
                    '1',
                  )}
                </div>
                {input(
                  'coverage',
                  'e.g. 100',
                  '%',
                  'Expected fraction of funded loans with usable final labels. Assumes outcome-independent missingness.',
                  'Eventual label coverage',
                )}
                <div className="lag-note">
                  <Info size={15} />
                  <span>
                    A loan counts toward your sample only after its full observation window and
                    reporting delay.
                  </span>
                </div>
              </section>
              <section className="form-section last-section">
                <h3>
                  <CalendarDays size={15} /> Plan details
                </h3>
                <Field label="Experiment start date">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => change('startDate', event.target.value)}
                      required
                    />
                  )}
                </Field>
                <Field
                  label="Bad-outcome definition"
                  help="Keep the description consistent with the observation window above."
                >
                  {(id) => (
                    <textarea
                      id={id}
                      rows={2}
                      maxLength={200}
                      placeholder="e.g. 30+ DPD within 90 days"
                      value={draft.outcome}
                      onChange={(event) => change('outcome', event.target.value)}
                      required
                    />
                  )}
                </Field>
                <details className="advanced">
                  <summary>
                    Simulation settings <ChevronDown size={13} />
                  </summary>
                  {input(
                    'seed',
                    '42',
                    undefined,
                    'The same inputs and seed reproduce the same 1,000 simulated experiments.',
                    'Random seed',
                    '1',
                  )}
                </details>
              </section>
              {errors.length > 0 && (
                <div className="errors" role="alert" tabIndex={-1} ref={errorRef}>
                  <strong>Check your assumptions</strong>
                  <ul>
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="calculate-wrap">
                <button type="submit" className="primary-button">
                  <FlaskConical size={17} /> Calculate experiment
                </button>
                <span>
                  <ShieldCheck size={12} /> Calculated privately in your browser
                </span>
              </div>
            </form>
          </aside>
          <div className="results" aria-live="polite" aria-busy={simulating}>
            <div className="results-heading">
              <div>
                <h2>Your experiment plan</h2>
                <span>
                  {plan
                    ? `${plan.inputs.confidence}% confidence · ${plan.inputs.power}% target power`
                    : 'Your results will appear here'}
                </span>
              </div>
              <div className="actions">
                <button onClick={share} disabled={!plan} className="secondary-button">
                  <Link2 size={15} />
                  <span>Share</span>
                </button>
                <button onClick={download} disabled={!plan} className="secondary-button">
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
            {shareFallback && (
              <div className="share-fallback">
                <label htmlFor="share-url">Copy this scenario link</label>
                <input
                  id="share-url"
                  readOnly
                  value={shareFallback}
                  onFocus={(event) => event.target.select()}
                />
              </div>
            )}
            <div className="stats-grid">
              <StatCard
                title="Required labeled sample"
                value={plan ? number(plan.targetC + plan.targetT) : '—'}
                suffix={plan ? 'loans' : ''}
                detail={
                  plan ? (
                    <>
                      {number(plan.targetC)} control · {number(plan.targetT)} treatment
                    </>
                  ) : (
                    'Mature, usable outcomes across both arms'
                  )
                }
                icon={<Users size={17} />}
              />
              <StatCard
                title="Enrollment duration"
                value={plan ? number(plan.enrollmentDays) : '—'}
                suffix={plan ? 'days' : ''}
                detail={
                  plan ? (
                    <>Enrollment ends {formatDate(plan.enrollmentDate)}</>
                  ) : (
                    'Time to enroll enough funded loans'
                  )
                }
                icon={<CalendarDays size={17} />}
              />
              <StatCard
                title="Time to final readout"
                value={plan ? number(plan.finalDay) : '—'}
                suffix={plan ? 'days' : ''}
                detail={
                  plan ? (
                    <>
                      {formatDate(plan.finalDate)} · includes {plan.lagDays}d lag
                    </>
                  ) : (
                    'Enrollment + outcome maturity + reporting'
                  )
                }
                icon={<Clock3 size={17} />}
                tone="featured"
              />
            </div>
            <section className="card confidence-card">
              <div className="card-heading">
                <div>
                  <h2>Precision, as your experiment matures</h2>
                  <p>
                    {plan
                      ? `${plan.inputs.confidence}% confidence interval for the bad-rate reduction`
                      : 'See how the confidence interval changes each week'}
                  </p>
                </div>
                <span className="card-label">
                  <Activity size={13} /> WEEKLY OUTLOOK
                </span>
              </div>
              <div className="chart-controls">
                <div className="segmented" role="group" aria-label="Confidence interval view">
                  <button aria-pressed={mode === 'forecast'} onClick={() => setMode('forecast')}>
                    Expected forecast
                  </button>
                  <button
                    aria-pressed={mode === 'simulation'}
                    onClick={() => setMode('simulation')}
                    disabled={!simulation}
                  >
                    Simulated path
                  </button>
                </div>
                <span className="chart-key">
                  <span className="key-dot treatment" />
                  {plan ? `${plan.inputs.confidence}% interval` : 'Confidence interval'}
                </span>
              </div>
              {plan ? (
                <>
                  <div className="chart-axis-label">
                    Bad-rate reduction (percentage points) · positive is better
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 12, right: 22, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="interval-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#42a98e" stopOpacity={0.26} />
                            <stop offset="100%" stopColor="#42a98e" stopOpacity={0.07} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e5ece9" />
                        <XAxis
                          dataKey="day"
                          type="number"
                          domain={[0, plan.finalDay]}
                          tickFormatter={(day) => `${Math.round(day / 7)}w`}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: '#76867f' }}
                          minTickGap={30}
                        />
                        <YAxis
                          tickFormatter={(value) => `${Number(value).toFixed(1)}`}
                          tickLine={false}
                          axisLine={false}
                          width={47}
                          tick={{ fontSize: 12, fill: '#76867f' }}
                        />
                        <Tooltip
                          labelFormatter={(day) =>
                            `Day ${day} · Week ${(Number(day) / 7).toFixed(1)}`
                          }
                          formatter={(value, name) =>
                            name === 'band'
                              ? [
                                  Array.isArray(value)
                                    ? `${Number(value[0]).toFixed(2)} to ${Number(value[1]).toFixed(2)} pp`
                                    : value,
                                  'Confidence interval',
                                ]
                              : [`${Number(value).toFixed(2)} pp`, 'Bad-rate reduction']
                          }
                          contentStyle={{
                            borderRadius: 10,
                            border: '1px solid #dbe5df',
                            fontSize: 13,
                          }}
                        />
                        <ReferenceLine y={0} stroke="#95a69d" strokeDasharray="5 4" />
                        <ReferenceLine
                          x={plan.enrollmentDays}
                          stroke="#b4c3bc"
                          strokeDasharray="3 4"
                        />
                        <Area
                          dataKey="band"
                          type="linear"
                          stroke="none"
                          fill="url(#interval-fill)"
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                        <Line
                          dataKey="effect"
                          type="linear"
                          stroke={mode === 'forecast' ? '#24876e' : '#7561b0'}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footnote">
                    <Info size={14} />
                    <span>
                      {mode === 'forecast'
                        ? 'Illustrative precision centered on your assumed effect; actual estimates will vary.'
                        : `One hypothetical experiment · seed ${plan.inputs.seed}. Re-run to see another path.`}
                    </span>
                    {mode === 'simulation' && (
                      <button onClick={rerun} className="text-button" disabled={simulating}>
                        <RefreshCw size={13} /> Re-run
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <EmptyChart />
              )}
            </section>
            <div className="context-note">
              <Info size={17} />
              <p>
                <strong>A weekly view, one final decision.</strong> Confidence intervals show
                expected precision, not permission to stop early. Make your planned decision after
                the required sample has matured.
              </p>
            </div>
            {plan && (
              <div className="scenario-summary">
                <span className="summary-icon">
                  <FlaskConical size={17} />
                </span>
                <div>
                  <strong>{plan.inputs.outcome}</strong>
                  <p>
                    {pct(plan.pC)} control → {pct(plan.pT)} treatment · {pp(plan.delta)} expected
                    reduction
                  </p>
                </div>
                <span className="scenario-badge">PLANNING SCENARIO</span>
              </div>
            )}
            <div className="lower-grid">
              <section className="card volume-card">
                <div className="card-heading">
                  <div>
                    <h2>Enrolled ≠ ready to analyze</h2>
                    <p>Follow the gap created by delayed labels</p>
                  </div>
                  <Layers3 size={18} className="muted" />
                </div>
                {plan ? (
                  <>
                    <div className="volume-legend">
                      <span>
                        <i className="key-dot control" /> Enrolled
                      </span>
                      <span>
                        <i className="key-dot treatment" /> Mature & usable
                      </span>
                    </div>
                    <div className="small-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#e5ece9" />
                          <XAxis
                            dataKey="day"
                            type="number"
                            domain={[0, plan.finalDay]}
                            tickFormatter={(day) => `${Math.round(day / 7)}w`}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={25}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            width={45}
                            tickFormatter={(value) =>
                              value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
                            }
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            labelFormatter={(day) => `Day ${day}`}
                            formatter={(value, name) => [
                              number(Number(value)),
                              name === 'enrolled' ? 'Enrolled' : 'Mature & usable',
                            ]}
                            contentStyle={{ borderRadius: 10, fontSize: 13 }}
                          />
                          <Area
                            type="linear"
                            dataKey="enrolled"
                            stroke="#8499a1"
                            fill="#eef2f4"
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                          <Area
                            type="linear"
                            dataKey="mature"
                            stroke="#24876e"
                            fill="#daf0e6"
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="card-bottom">
                      Funded target: {number(plan.fundedC)} control / {number(plan.fundedT)}{' '}
                      treatment.
                      <br />
                      {number(plan.weeks.at(-1)!.enrolledC + plan.weeks.at(-1)!.enrolledT)} enrolled
                      after whole-day rounding · {plan.inputs.coverage}% usable labels.
                    </p>
                  </>
                ) : (
                  <div className="small-empty">
                    <div className="cohort-illustration">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <strong>Enrollment is only the first step</strong>
                    <p>
                      Loans must mature before their outcomes
                      <br />
                      can contribute to your analysis.
                    </p>
                  </div>
                )}
              </section>
              <section className="card timeline-card">
                <div className="card-heading">
                  <div>
                    <h2>Your path to a decision</h2>
                    <p>Three milestones to plan around</p>
                  </div>
                  <CalendarDays size={18} className="muted" />
                </div>
                <ol className="timeline">
                  <li>
                    <span className="timeline-dot">
                      <span />
                    </span>
                    <div>
                      <span>Experiment begins</span>
                      <strong>{plan ? formatDate(plan.inputs.startDate) : 'Start date'}</strong>
                      <small>Random assignment to control and treatment</small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot">
                      <span />
                    </span>
                    <div>
                      <span>Enrollment closes</span>
                      <strong>
                        {plan ? formatDate(plan.enrollmentDate) : 'After sample collection'}
                      </strong>
                      <small>
                        {plan
                          ? `${number(plan.enrollmentDays)} days of funded cohorts`
                          : 'Both arms reach their enrollment target'}
                      </small>
                    </div>
                  </li>
                  <li>
                    <span className="timeline-dot final">
                      <Check size={11} />
                    </span>
                    <div>
                      <span>Final analysis</span>
                      <strong>{plan ? formatDate(plan.finalDate) : 'After labels mature'}</strong>
                      <small>
                        {plan
                          ? `${plan.lagDays} additional days after enrollment`
                          : 'Full observation window + reporting delay'}
                      </small>
                    </div>
                  </li>
                </ol>
              </section>
            </div>
            <section className="card simulation-card">
              <div className="simulation-copy">
                <span className="simulation-icon">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2>A thousand ways it could play out.</h2>
                  <p>
                    {plan
                      ? 'Detection at the final readout, across 1,000 hypothetical experiments.'
                      : 'Simulate random outcomes to see how often your planned effect is detected.'}
                  </p>
                </div>
              </div>
              {simulating ? (
                <div className="simulation-status">
                  <LoaderCircle size={17} className="spin" /> Simulating 1,000 experiments…
                </div>
              ) : finalSim?.detection !== null && finalSim?.detection !== undefined ? (
                <div className="detection-result">
                  <strong>{pct(finalSim.detection, 1)}</strong>
                  <span>
                    detect an improvement
                    <br />
                    <small>
                      95% Monte Carlo interval: {intervalText(finalSim.detectionInterval)}
                    </small>
                  </span>
                  <button
                    className="icon-button"
                    onClick={rerun}
                    title="Run with the next seed"
                    aria-label="Run simulations with the next seed"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              ) : (
                <span className="simulation-placeholder">
                  {simError ? 'Simulation unavailable' : 'Ready when you are'}
                </span>
              )}
            </section>
            {simError && (
              <div className="warning" role="alert">
                <Info size={16} />
                <span>
                  {simError}{' '}
                  <button className="text-button" onClick={() => plan && setPlan({ ...plan })}>
                    Retry simulations
                  </button>
                </span>
              </div>
            )}
            {plan?.warnings.map((warning) => (
              <div className="warning" key={warning}>
                <Info size={16} />
                <span>{warning}</span>
              </div>
            ))}
            <section className="card weekly-card">
              <div className="card-heading">
                <div>
                  <h2>Weekly readout</h2>
                  <p>
                    {plan
                      ? `${mode === 'forecast' ? 'Expected forecast' : 'Selected simulated path'} · rates and intervals use mature labels only`
                      : 'Sample maturity and confidence intervals, together'}
                  </p>
                </div>
                <span className="card-label">
                  <PanelLeft size={13} /> DETAIL VIEW
                </span>
              </div>
              {plan ? (
                <>
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Weekly experiment results"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Week / date</th>
                          <th>
                            Enrolled
                            <br />
                            <small>C / T</small>
                          </th>
                          <th>
                            Mature usable
                            <br />
                            <small>C / T</small>
                          </th>
                          <th>
                            Pending /<br />
                            unavailable
                          </th>
                          <th>
                            Bad rates
                            <br />
                            <small>C / T, with CI</small>
                          </th>
                          <th>
                            Reduction
                            <br />
                            <small>{plan.inputs.confidence}% CI · pp</small>
                          </th>
                          <th>
                            Detection
                            <br />
                            <small>95% MC interval</small>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayWeeks.map((week, index) => {
                          const sim = simulation?.weeks[tablePage * 12 + index];
                          const ci = mode === 'forecast' ? week.expectedDifference : sim?.interval;
                          const rateC =
                            mode === 'forecast' ? (week.matureC ? plan.pC : null) : sim?.rateC;
                          const rateT =
                            mode === 'forecast' ? (week.matureT ? plan.pT : null) : sim?.rateT;
                          const ciC = mode === 'forecast' ? week.expectedC : sim?.intervalC;
                          const ciT = mode === 'forecast' ? week.expectedT : sim?.intervalT;
                          return (
                            <tr
                              key={week.day}
                              className={week.day === plan.finalDay ? 'final-row' : ''}
                            >
                              <td>
                                <strong>
                                  {week.day === plan.finalDay
                                    ? 'Final readout'
                                    : `Week ${week.day / 7}`}
                                </strong>
                                <small>{formatDate(week.date)}</small>
                              </td>
                              <td>
                                {number(week.enrolledC)} / {number(week.enrolledT)}
                              </td>
                              <td>
                                {number(week.matureC)} / {number(week.matureT)}
                              </td>
                              <td>
                                {number(week.pending)} / {number(week.unavailable)}
                              </td>
                              <td>
                                {rateC !== null && rateC !== undefined ? (
                                  <>
                                    <span>
                                      C: {pct(rateC)} <small>{intervalText(ciC)}</small>
                                    </span>
                                    <span>
                                      T:{' '}
                                      {rateT !== null && rateT !== undefined
                                        ? pct(rateT)
                                        : 'No mature labels'}{' '}
                                      <small>{intervalText(ciT)}</small>
                                    </span>
                                  </>
                                ) : (
                                  <span className="muted">No mature labels</span>
                                )}
                              </td>
                              <td>
                                {ci ? (
                                  <>
                                    <strong>
                                      {pp(
                                        mode === 'forecast' ? plan.delta : (sim?.difference ?? 0),
                                      )}
                                    </strong>
                                    <small>{intervalText(ci, true)}</small>
                                  </>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td>
                                {sim?.detection !== null && sim?.detection !== undefined ? (
                                  <>
                                    {pct(sim.detection, 1)}
                                    <small>{intervalText(sim.detectionInterval)}</small>
                                  </>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">
                    <span>Days are elapsed since start · C = control · T = treatment</span>
                    <div>
                      <button
                        onClick={() => setTablePage((page) => page - 1)}
                        disabled={tablePage === 0}
                      >
                        Previous
                      </button>
                      <span>
                        {tablePage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setTablePage((page) => page + 1)}
                        disabled={tablePage >= totalPages - 1}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="table-empty">
                  <BarChart3 size={21} />
                  <p>Your weekly breakdown will appear after you calculate a plan.</p>
                </div>
              )}
            </section>
          </div>
        </div>
        <Methodology />
        <footer className="footer">
          <span>
            <span className="footer-brand">CreditLab</span> Thoughtful experiments. Clearer
            decisions.
          </span>
          <span>A planning tool, with transparent assumptions.</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}

function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect
        x="6"
        y="2.5"
        width="3"
        height="5"
        rx="1"
        fill="white"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="10"
        y="10.5"
        width="3"
        height="5"
        rx="1"
        fill="white"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
