import { lazy, Suspense, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Github,
  Info,
  Link2,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';
import { buildPlan, validationErrors, type InputKey, type Interval, type Plan } from './model';
import {
  emptyDraft,
  essentialKeys,
  exampleDraft,
  exportCsv,
  formatDate,
  parseDraft,
  restoreScenario,
  scenarioUrl,
  switchVolumeMode,
  type Draft,
} from './scenario';

const ForecastChart = lazy(() => import('./ForecastChart'));
const PowerChart = lazy(() => import('./PowerChart'));
const count = (value: number) => new Intl.NumberFormat('en').format(value);
const dayUnit = (value: number) => (value === 1 ? 'day' : 'days');
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const points = (value: number) => `${(value * 100).toFixed(2)} pp`;
const interval = (value: Interval | null) =>
  value ? `${(value[0] * 100).toFixed(2)} to ${(value[1] * 100).toFixed(2)}` : '—';
const starter = restoreScenario(window.location.search);

function Field({
  label,
  hint,
  error,
  suffix,
  value,
  onChange,
  onBlur,
  type = 'number',
  step = 'any',
  placeholder,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  type?: string;
  step?: string;
  placeholder?: string;
  optional?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span>optional</span>}
      </label>
      <div className={`input-wrap${suffix ? ' has-suffix' : ''}${children ? ' has-select' : ''}`}>
        <input
          id={id}
          type={type}
          step={type === 'number' ? step : undefined}
          inputMode={type === 'number' ? 'decimal' : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          required={!optional}
          maxLength={type === 'text' ? 200 : undefined}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
        {children}
      </div>
      {(hint || error) && (
        <p className={error ? 'field-error' : 'field-hint'} id={`${id}-description`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  detail,
  featured = false,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  detail: ReactNode;
  featured?: boolean;
  icon: ReactNode;
}) {
  return (
    <section className={`metric${featured ? ' metric-featured' : ''}`}>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-detail">{detail}</div>
    </section>
  );
}

function Methodology() {
  return (
    <details id="methodology" className="methodology">
      <summary>
        <span>
          <ShieldCheck size={17} /> How the calculation works
        </span>
        <ChevronDown size={17} />
      </summary>
      <div className="method-grid">
        <div>
          <h3>Sample size</h3>
          <p>
            The selected one-sided or two-sided z-test for independent bad-loan proportions estimates
            the labeled sample needed at your chosen power and alpha. The calculation uses pooled
            null variance and unpooled alternative variance, solves numerically, and rounds targets up.
          </p>
          <p>
            Positive reduction means control bad rate minus treatment bad rate. Relative percent and
            percentage-point inputs are converted to the same treatment rate.
          </p>
          <p>
            The goal is to detect the assumed improvement versus no difference. Power is the chance
            of detecting a difference if that improvement is real; it does not prove the improvement
            exceeds a minimum threshold. Alpha sets the test significance level; one-sided testing
            checks only for a reduction, while two-sided testing checks for a change in either
            direction.
          </p>
        </div>
        <div>
          <h3>Time until analysis</h3>
          <p>
            Enter a total daily funded volume and allocation, or separate daily volumes for each arm.
            Collection stops once both arms can supply
            their required usable samples. Label coverage adjusts the funded-loan requirement;
            collection is rounded up to whole calendar days.
          </p>
          <p>
            Every loan waits the full label delay, including observation and reporting. Total
            duration is collection days plus label-delay days. The start date is optional; dates use
            elapsed-day calendar arithmetic.
          </p>
        </div>
        <div>
          <h3>Projected confidence intervals</h3>
          <p>
            Weekly usable sample sizes and assumed bad rates generate expected, potentially
            fractional bad counts. Wilson intervals are used for each arm, and Newcombe intervals
            for the reduction. These illustrate expected precision; they are not measured experiment
            results or a guarantee of significance.
          </p>
          <p>
            The final sample is designed for one planned final analysis. Weekly projections do not
            provide an early-stopping rule.
          </p>
          <p>
            Projected detection power uses each week's usable control and treatment samples in the
            same power calculation. More mature data increases power and precision, while the
            assumed bad rates stay fixed. Waiting after all collected samples have matured adds no
            data. Early projections with small samples use a normal approximation and can be imprecise.
          </p>
        </div>
        <div>
          <h3>Assumptions & references</h3>
          <p>
            Assumes independent borrowers with one analyzed loan each, stable daily volume and bad
            rates, and missing labels unrelated to outcomes. Funded volumes may differ between
            control and treatment. Portfolio comparisons do not isolate a score’s effect on the same funded
            borrowers.
          </p>
          <p>
            <a
              href="https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html"
              target="_blank"
              rel="noreferrer"
            >
              Power calculation <ArrowUpRight size={13} />
            </a>{' '}
            ·{' '}
            <a
              href="https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm"
              target="_blank"
              rel="noreferrer"
            >
              Wilson intervals <ArrowUpRight size={13} />
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/proportion.py"
              target="_blank"
              rel="noreferrer"
            >
              Newcombe intervals <ArrowUpRight size={13} />
            </a>
          </p>
          <p>All calculations run in your browser. Share links contain your entered assumptions.</p>
        </div>
      </div>
    </details>
  );
}

function WeeklyTable({ plan }: { plan: Plan }) {
  const [showDelay, setShowDelay] = useState(false);
  const [page, setPage] = useState(0);
  const weeks = plan.weeks.filter((week) => week.day > 0);
  const delayed = weeks.filter((week) => !week.matureC && !week.matureT);
  const rows = showDelay ? weeks : weeks.filter((week) => week.matureC || week.matureT);
  const pages = Math.ceil(rows.length / 12);
  return (
    <section className="panel weekly-panel">
      <div className="section-heading">
        <div>
          <h2>Week-by-week projection</h2>
          <p>
            {plan.inputs.confidence}% two-sided intervals; detection power uses a {plan.inputs.testType}{' '}
            test at {plan.inputs.alpha}% alpha.
          </p>
        </div>
        <span className="small-label">C = control · T = treatment</span>
      </div>
      {delayed.length > 0 && (
        <div className="delay-summary">
          <Clock3 size={16} />
          <span>
            {delayed.length === 1
              ? `Week ${delayed[0].week}`
              : `Weeks ${delayed[0].week}–${delayed.at(-1)!.week}`}
            : no usable labels expected yet.
          </span>
          <button
            aria-pressed={showDelay}
            onClick={() => {
              setShowDelay((value) => !value);
              setPage(0);
            }}
          >
            {showDelay ? 'Hide these weeks' : 'Show these weeks'}
          </button>
        </div>
      )}
      <div
        className="table-scroll"
        role="region"
        aria-label="Projected weekly confidence intervals, detection power, and usable samples"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>
                Usable samples
                <br />
                <small>Control / treatment</small>
              </th>
              <th>
                Control bad rate
                <br />
                <small>{plan.inputs.confidence}% two-sided CI · %</small>
              </th>
              <th>
                Treatment bad rate
                <br />
                <small>{plan.inputs.confidence}% two-sided CI · %</small>
              </th>
              <th>
                Bad-rate reduction
                <br />
                <small>{plan.inputs.confidence}% two-sided CI · pp</small>
              </th>
              <th>
                Detection power
                <br />
                <small>Target {plan.inputs.power}%</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 12, page * 12 + 12).map((week) => (
              <tr key={week.day} className={week.day === plan.finalDay ? 'final-row' : ''}>
                <td>
                  <strong>
                    {week.day === plan.finalDay ? 'Final analysis' : `Week ${week.week}`}
                  </strong>
                  <small>
                    Day {week.day}
                    {week.date && ` · ${formatDate(week.date)}`}
                  </small>
                </td>
                <td>
                  {count(week.matureC)} / {count(week.matureT)}
                </td>
                <td>
                  {week.expectedC ? (
                    <>
                      <strong>{percent(plan.pC)}</strong>
                      <small>{interval(week.expectedC)}</small>
                    </>
                  ) : (
                    <span className="unavailable">Not available yet</span>
                  )}
                </td>
                <td>
                  {week.expectedT ? (
                    <>
                      <strong>{percent(plan.pT)}</strong>
                      <small>{interval(week.expectedT)}</small>
                    </>
                  ) : (
                    <span className="unavailable">Not available yet</span>
                  )}
                </td>
                <td>
                  {week.expectedDifference ? (
                    <>
                      <strong>{points(plan.delta)}</strong>
                      <small>{interval(week.expectedDifference)}</small>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {week.projectedPower === null ? (
                    <span className="unavailable">Not available yet</span>
                  ) : (
                    <strong>{percent(week.projectedPower)}</strong>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>Projected values, not observed outcomes. CSV includes every week.</span>
        {pages > 1 && (
          <div>
            <button onClick={() => setPage((value) => value - 1)} disabled={page === 0}>
              Previous
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button onClick={() => setPage((value) => value + 1)} disabled={page >= pages - 1}>
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [draft, setDraft] = useState<Draft>(starter.draft);
  const [touched, setTouched] = useState<Partial<Record<InputKey, boolean>>>({});
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(
      starter.draft.startDate ||
      starter.draft.outcome ||
      starter.draft.confidence !== '95' ||
      starter.draft.coverage !== '100',
    ),
  );
  const [linkError, setLinkError] = useState(starter.error);
  const [shareLink, setShareLink] = useState('');
  const [notice, setNotice] = useState('');
  const calculation = useMemo(() => {
    const inputs = parseDraft(draft);
    const errors = validationErrors(inputs);
    if (Object.keys(errors).length) return { inputs, errors, plan: null, failure: null };
    try {
      return { inputs, errors, plan: buildPlan(inputs), failure: null };
    } catch (error) {
      return {
        inputs,
        errors,
        plan: null,
        failure: error instanceof Error ? error.message : 'Please check your assumptions.',
      };
    }
  }, [draft]);
  const { plan, errors } = calculation;
  const requiredKeys = essentialKeys(draft);
  const entered = requiredKeys.filter((key) => draft[key].trim()).length;
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const change = (key: keyof Draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setShareLink('');
    setLinkError(null);
  };
  const fieldError = (key: InputKey) =>
    draft[key].trim() || touched[key] ? errors[key] : undefined;
  const field = (
    key: keyof Draft,
    label: string,
    options: {
      hint?: string;
      suffix?: string;
      placeholder?: string;
      type?: string;
      optional?: boolean;
      step?: string;
      children?: ReactNode;
    } = {},
  ) => (
    <Field
      label={label}
      value={draft[key]}
      onChange={(value) => change(key, value)}
      onBlur={() => setTouched((previous) => ({ ...previous, [key]: true }))}
      error={fieldError(key)}
      {...options}
    />
  );
  const reset = () => {
    setDraft(emptyDraft());
    setTouched({});
    setLinkError(null);
    setShareLink('');
    setAdvancedOpen(false);
    window.history.replaceState(null, '', window.location.pathname);
  };
  const loadExample = () => {
    setDraft(exampleDraft());
    setTouched({});
    setLinkError(null);
    setShareLink('');
    setNotice('Illustrative example loaded. Change any value to recalculate.');
  };
  const share = () => {
    if (!plan) return;
    const url = scenarioUrl(plan.inputs, window.location.href);
    setShareLink(url);
    if (navigator.clipboard)
      void navigator.clipboard
        .writeText(url)
        .then(() => setNotice('Calculator link copied. It includes your assumptions.'))
        .catch(() => {});
  };
  const download = () => {
    if (!plan) return;
    const url = URL.createObjectURL(
      new Blob([exportCsv(plan)], { type: 'text/csv;charset=utf-8;' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `creditlab-calculation${plan.inputs.startDate ? `-${plan.inputs.startDate}` : ''}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Assumptions and all weekly projections exported.');
  };
  const target =
    draft.baseline.trim() && draft.effect.trim() && !errors.baseline && !errors.effect
      ? draft.effectMode === 'relative'
        ? Number(draft.baseline) * (1 - Number(draft.effect) / 100)
        : Number(draft.baseline) - Number(draft.effect)
      : null;
  const advancedErrors = Boolean(
    errors.confidence || errors.coverage || errors.startDate || errors.outcome,
  );

  return (
    <>
      <a className="skip-link" href="#calculator">
        Skip to calculator
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href={window.location.pathname} aria-label="CreditLab home">
            <span className="brand-mark">
              <BarChart3 size={22} />
            </span>
            <span>
              Credit<span>Lab</span>
            </span>
            <span className="brand-tag">CALCULATOR</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#methodology">How it works</a>
            <a
              href="https://github.com/argyadiva/credit-ab-planner"
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
            >
              <Github size={18} />
              <span>View source</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="shell" id="calculator">
        <div className="page-heading">
          <div className="eyebrow">CREDIT SCORE A/B TESTING</div>
          <h1>
            How many loans.
            <br className="mobile-break" /> How long to wait.
          </h1>
          <p>
            Enter your assumptions to calculate the sample size, timeline,
            <br className="desktop-break" /> and projected weekly confidence intervals for your
            test.
          </p>
        </div>
        <div className="calculator-grid">
          <section className="panel input-panel" aria-labelledby="inputs-heading">
            <div className="input-heading">
              <h2 id="inputs-heading">
                <Calculator size={18} /> Your assumptions
              </h2>
              <button
                className="icon-button"
                onClick={reset}
                aria-label="Reset all inputs"
                title="Reset all inputs"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <p className="input-intro">
              Results update as you type.
              <br />
              <button className="text-button" onClick={loadExample}>
                Try an example
              </button>{' '}
              to see how it works.
            </p>
            <form onSubmit={(event) => event.preventDefault()} noValidate>
              {field('baseline', 'Baseline bad-loan rate', {
                suffix: '%',
                placeholder: 'e.g. 10',
                hint: 'The current bad-loan rate among funded loans.',
              })}
              {field('effect', 'Improvement to detect', {
                placeholder: draft.effectMode === 'relative' ? 'e.g. 10' : 'e.g. 1',
                hint: 'Assumed reduction in the funded bad-loan rate. More data improves detection power; it does not increase this effect.',
                children: (
                  <>
                    <select
                      aria-label="Reduction input mode"
                      value={draft.effectMode}
                      onChange={(event) => change('effectMode', event.target.value)}
                    >
                      <option value="relative">Relative %</option>
                      <option value="absolute">Points (pp)</option>
                    </select>
                    <ChevronDown className="select-chevron" size={14} />
                  </>
                ),
              })}
              <div className="target-preview">
                <TrendingDown size={16} />
                <span>Expected treatment bad rate</span>
                <strong>{target === null ? '—' : `${target.toFixed(2)}%`}</strong>
              </div>
              <fieldset className="test-type">
                <legend>Test direction</legend>
                <div className="test-type-options">
                  {([
                    ['two-sided', 'Two-sided', 'Detects improvement or harm'],
                    ['one-sided', 'Improvement only', 'Tests whether bad rate is lower'],
                  ] as const).map(([value, title, description]) => (
                    <label
                      key={value}
                      className={draft.testType === value ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name="test-type"
                        value={value}
                        checked={draft.testType === value}
                        aria-label={title}
                        onChange={() => change('testType', value)}
                      />
                      <span className="test-type-copy">
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {errors.testType && (
                <p className="field-error" role="alert">
                  {errors.testType}
                </p>
              )}
              <div className="field-row">
                {field('power', 'Statistical power', {
                  suffix: '%',
                  placeholder: 'e.g. 80',
                  hint: 'Chance of detecting a difference if the assumed improvement is real.',
                })}
                {field('alpha', 'Significance level (alpha)', {
                  suffix: '%',
                  placeholder: 'e.g. 5',
                  hint: 'Choose alpha before reviewing experiment results. For example, one-sided alpha at 5% allows a 5% false-improvement rate; two-sided alpha at 5% allocates about 2.5% to each direction.',
                })}
              </div>
              <fieldset className="volume-mode">
                <legend>Funded-loan volume</legend>
                <div className="volume-options">
                  {(['total', 'separate'] as const).map((mode) => (
                    <label key={mode}>
                      <input
                        type="radio"
                        name="volume-mode"
                        value={mode}
                        checked={draft.volumeMode === mode}
                        onChange={() => {
                          setDraft((previous) => switchVolumeMode(previous, mode));
                          setTouched((previous) => ({ ...previous, dailyLoans: false, treatmentShare: false, controlDailyLoans: false, treatmentDailyLoans: false }));
                          setShareLink('');
                          setLinkError(null);
                        }}
                      />
                      {mode === 'total' ? 'Total + allocation' : 'Separate volumes'}
                    </label>
                  ))}
                </div>
              </fieldset>
              {draft.volumeMode === 'total' ? (
                <>
                  {field('dailyLoans', 'Total funded loans per day', {
                    suffix: '/ day',
                    placeholder: 'e.g. 500',
                    hint: 'Total across control and treatment, per calendar day.',
                  })}
                  {field('treatmentShare', 'Treatment allocation', {
                    suffix: '%',
                    hint: 'Share of funded loans in treatment. Control gets the rest.',
                  })}
                </>
              ) : (
                <>
                  {field('controlDailyLoans', 'Control funded loans per day', {
                    suffix: '/ day',
                    placeholder: 'e.g. 300',
                    hint: 'Expected daily average funded under the control policy.',
                  })}
                  {field('treatmentDailyLoans', 'Treatment funded loans per day', {
                    suffix: '/ day',
                    placeholder: 'e.g. 200',
                    hint: 'Expected daily average funded under the treatment policy.',
                  })}
                </>
              )}
              {field('labelLagDays', 'Total label delay', {
                suffix: 'days',
                placeholder: 'e.g. 97',
                step: '1',
                hint: 'Days from funding to a usable outcome, including observation and reporting. This is not application-to-disbursement time. Enter 0 for immediate labels.',
              })}
              <details
                className="advanced"
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <SlidersHorizontal size={16} /> Advanced settings
                  </span>
                  <span>
                    {advancedErrors ? 'Check inputs' : 'Optional'}
                    <ChevronDown size={15} />
                  </span>
                </summary>
                <div className="advanced-body">
                  {field('confidence', 'Confidence level for displayed intervals', {
                    suffix: '%',
                    placeholder: 'e.g. 95',
                    hint: 'Controls the two-sided forecast intervals only. It is separate from test alpha and does not determine whether the treatment wins.',
                  })}
                  {field('coverage', 'Usable label coverage', {
                    suffix: '%',
                    hint: 'Expected share with a final usable label in each arm.',
                  })}
                  {field('startDate', 'Start date', {
                    type: 'date',
                    optional: true,
                    hint: 'Add a date to see calendar milestones.',
                  })}
                  {field('outcome', 'Bad-outcome description', {
                    type: 'text',
                    optional: true,
                    placeholder: 'e.g. 30+ DPD within 90 days',
                  })}
                </div>
              </details>
            </form>
            <div className="input-footnote">
              <ShieldCheck size={14} />
              <span>Calculated in your browser from your assumptions.</span>
            </div>
          </section>
          <div className="results" aria-label="Calculator results">
            <div className="results-heading">
              <h2>Your calculation</h2>
              <div className="result-actions">
                <button onClick={share} disabled={!plan}>
                  <Link2 size={15} />
                  <span>Share</span>
                </button>
                <button onClick={download} disabled={!plan}>
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
            {linkError && (
              <div className="message warning" role="alert">
                <Info size={17} />
                <span>{linkError}</span>
              </div>
            )}
            {shareLink && (
              <div className="share-box">
                <label htmlFor="share-url">Copy this calculator link</label>
                <input
                  id="share-url"
                  value={shareLink}
                  readOnly
                  onFocus={(event) => event.target.select()}
                />
              </div>
            )}
            <div className="calculation-status" role="status" aria-live="polite">
              <span className={`status-indicator${plan ? ' ready' : ''}`} />
              {plan
                ? `Calculated with a ${draft.testType} test at ${draft.alpha}% alpha and ${draft.power}% power`
                : Object.keys(errors).some((key) => Boolean(draft[key as InputKey].trim())) &&
                    entered === requiredKeys.length
                  ? 'Check the highlighted assumptions to calculate your results.'
                  : `${entered} of ${requiredKeys.length} essential inputs entered`}
            </div>
            {plan ? (
              <>
                <section className="goal-summary" aria-labelledby="goal-heading">
                  <h3 id="goal-heading">Your detection goal</h3>
                  <p>
                    Detect a reduction from <strong>{percent(plan.pC)}</strong> to{' '}
                    <strong>{percent(plan.pT)}</strong> bad rate with{' '}
                    <strong>{plan.inputs.power}% power</strong> using a{' '}
                    <strong>{plan.inputs.testType} test at {plan.inputs.alpha}% alpha</strong>. Displayed
                    intervals use{' '}
                    <strong>{plan.inputs.confidence}% two-sided confidence</strong>.
                  </p>
                  <p className="goal-explanation">
                    More mature outcomes improve detection power and precision. They do not increase
                    the true improvement or guarantee a successful test.
                  </p>
                </section>
                <div className="metrics-grid">
                  <Metric
                    label="Required labeled sample"
                    value={count(plan.targetC + plan.targetT)}
                    unit="loans"
                    detail={
                      <>
                        <strong>{count(plan.targetC)}</strong> control ·{' '}
                        <strong>{count(plan.targetT)}</strong> treatment
                      </>
                    }
                    icon={<Users size={18} />}
                    featured
                  />
                  <Metric
                    label="Sample collection"
                    value={count(plan.enrollmentDays)}
                    unit={dayUnit(plan.enrollmentDays)}
                    detail={
                      plan.enrollmentDate ? (
                        <>Until {formatDate(plan.enrollmentDate)}</>
                      ) : (
                        'To fund the required sample'
                      )
                    }
                    icon={<CalendarDays size={18} />}
                  />
                </div>
                <section className="duration-card">
                  <div className="duration-top">
                    <div>
                      <span className="small-label">TOTAL TIME UNTIL ANALYSIS</span>
                      <h2>
                        {count(plan.finalDay)} <span>{dayUnit(plan.finalDay)}</span>
                      </h2>
                      {plan.finalDate && <p>{formatDate(plan.finalDate)}</p>}
                    </div>
                    <Clock3 size={30} strokeWidth={1.3} />
                  </div>
                  <div
                    className="duration-equation"
                    aria-label={`${plan.enrollmentDays} collection ${dayUnit(plan.enrollmentDays)} plus ${plan.lagDays} label-delay ${dayUnit(plan.lagDays)} equals ${plan.finalDay} total ${dayUnit(plan.finalDay)}`}
                  >
                    <span>
                      <strong>
                        {count(plan.enrollmentDays)} {dayUnit(plan.enrollmentDays)}
                      </strong>
                      sample collection
                    </span>
                    <Plus size={16} />
                    <span>
                      <strong>
                        {count(plan.lagDays)} {dayUnit(plan.lagDays)}
                      </strong>
                      label delay
                    </span>
                    <span className="equals">=</span>
                    <span>
                      <strong>
                        {count(plan.finalDay)} {dayUnit(plan.finalDay)}
                      </strong>
                      total duration
                    </span>
                  </div>
                </section>
                <div className="assumption-strip">
                  <Info size={15} />
                  <p>
                    {count(plan.dailyC)} control and {count(plan.dailyT)} treatment funded loans/day.{' '}
                    Funded split: {((plan.dailyC / (plan.dailyC + plan.dailyT)) * 100).toFixed(1)}% control /{' '}
                    {((plan.dailyT / (plan.dailyC + plan.dailyT)) * 100).toFixed(1)}% treatment.{' '}
                    Assumes {plan.inputs.coverage}% usable labels in each arm.
                    {plan.inputs.coverage < 100 &&
                      ` Funded target: ${count(plan.fundedC)} control / ${count(plan.fundedT)} treatment.`}
                  </p>
                </div>
                {plan.inputs.outcome && (
                  <div className="outcome-description">
                    Outcome: <strong>{plan.inputs.outcome}</strong>
                  </div>
                )}
                <section className="panel chart-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Projected bad-loan rates</h2>
                      <p>Control and treatment rates, with uncertainty as labels mature.</p>
                    </div>
                  </div>
                  <div className="chart-meta">
                    <span>Bad-loan rate · %</span>
                    <div className="chart-legend" aria-label="Chart legend">
                      <span><i className="control-swatch" />Control baseline</span>
                      <span><i className="treatment-swatch" />Expected treatment</span>
                      <span>{plan.inputs.confidence}% two-sided confidence bands</span>
                    </div>
                  </div>
                  <Suspense
                    fallback={<div className="chart-loading">Preparing the projection…</div>}
                  >
                    <ForecastChart plan={plan} />
                  </Suspense>
                  <div className="chart-note">
                    <Info size={15} />
                    <p>
                      Control stays at the assumed baseline of <strong>{percent(plan.pC)}</strong> and
                      treatment at <strong>{percent(plan.pT)}</strong>. Bands narrow as usable samples
                      grow. These are projected rates; actual experiment estimates will vary.
                    </p>
                  </div>
                </section>
                <section className="panel chart-panel power-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Projected detection power over time</h2>
                      <p>Chance of detecting a difference if your assumed improvement is real.</p>
                    </div>
                  </div>
                  <div className="chart-meta">
                    <span>Power · %</span>
                    <div className="chart-legend" aria-label="Power chart legend">
                      <span><i className="power-swatch" />Projected power</span>
                      <span><i className="power-target-swatch" />{plan.inputs.power}% target</span>
                    </div>
                  </div>
                  <Suspense fallback={<div className="chart-loading">Preparing the power projection…</div>}>
                    <PowerChart plan={plan} />
                  </Suspense>
                  <div className="chart-note">
                    <Info size={15} />
                    <p>
                      Plan one final analysis on <strong>day {count(plan.finalDay)}</strong>
                      {plan.finalDate && ` (${formatDate(plan.finalDate)})`}, after both samples have
                      matured. This is a projection, not an early-stopping rule. Power is unavailable
                      until both arms have usable outcomes.
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <section
                className={`panel empty-results${calculation.failure ? ' has-failure' : ''}`}
              >
                <span className="empty-icon">
                  {calculation.failure ? (
                    <Info size={30} />
                  ) : (
                    <Calculator size={30} strokeWidth={1.5} />
                  )}
                </span>
                <h2>
                  {calculation.failure
                    ? 'This scenario needs an adjustment'
                    : entered === requiredKeys.length
                      ? 'Check your assumptions.'
                      : 'A clear answer starts with your assumptions.'}
                </h2>
                <p>
                  {calculation.failure ??
                    (entered === requiredKeys.length
                      ? 'Correct the highlighted assumptions. The sample size and timeline will update automatically.'
                      : 'Enter your baseline, expected reduction, power, confidence, funded-loan volumes, and label delay.')}
                </p>
                {!calculation.failure && (
                  <button className="example-button" onClick={loadExample}>
                    Try an example
                  </button>
                )}
                <div className="empty-outputs">
                  <span>
                    <Users size={17} /> Sample size
                  </span>
                  <span>
                    <Clock3 size={17} /> Total duration
                  </span>
                  <span>
                    <BarChart3 size={17} /> Weekly intervals
                  </span>
                </div>
              </section>
            )}
            {plan?.warnings.map((warning) => (
              <div className="message warning" key={warning}>
                <Info size={17} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </div>
        {plan && (
          <>
            <WeeklyTable key={JSON.stringify(plan.inputs)} plan={plan} />
            <div className="projection-note">
              <Info size={16} />
              <p>
                These are calculated projections from your assumptions. Make one planned final
                decision after the required sample has matured; weekly intervals are not an
                early-stopping rule.
              </p>
            </div>
          </>
        )}
        <Methodology />
        <footer>
          <span>
            <strong>CreditLab</strong> A little more clarity before you test.
          </span>
          <span>Sample size · label delay · projected precision</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
