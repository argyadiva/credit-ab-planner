import type { Inputs, Plan } from './model';
import { validDate } from './model';
import type { Simulation } from './simulation';

export type Draft = { [K in keyof Inputs]: string };
export const emptyDraft = (): Draft => ({
  baseline: '',
  effect: '',
  effectMode: 'relative',
  power: '',
  confidence: '',
  dailyApplicants: '',
  funding: '',
  treatmentShare: '',
  observationDays: '',
  reportingDays: '',
  coverage: '',
  startDate: '',
  outcome: '',
  seed: '42',
});
export const numericKeys = [
  'baseline',
  'effect',
  'power',
  'confidence',
  'dailyApplicants',
  'funding',
  'treatmentShare',
  'observationDays',
  'reportingDays',
  'coverage',
  'seed',
] as const;

export function parseDraft(draft: Draft): Inputs {
  const parsed = { ...draft } as unknown as Inputs;
  for (const key of numericKeys) parsed[key] = draft[key].trim() === '' ? NaN : Number(draft[key]);
  return parsed;
}

export function exampleDraft(): Draft {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    baseline: '10',
    effect: '10',
    effectMode: 'relative',
    power: '80',
    confidence: '95',
    dailyApplicants: '1000',
    funding: '50',
    treatmentShare: '50',
    observationDays: '90',
    reportingDays: '7',
    coverage: '100',
    startDate: localDate,
    outcome: '30+ DPD within 90 days of disbursement',
    seed: '42',
  };
}

export function restoreScenario(search: string): { draft: Draft; error: string | null } {
  const draft = emptyDraft();
  const params = new URLSearchParams(search);
  if (!params.has('v')) return { draft, error: null };
  if (params.get('v') !== '1')
    return {
      draft,
      error: 'This scenario link uses an unsupported version. Enter a new scenario below.',
    };
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    const value = params.get(key);
    if (value !== null) draft[key] = value.slice(0, 220);
  }
  return { draft, error: null };
}

export function scenarioUrl(inputs: Inputs, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', '1');
  for (const [key, value] of Object.entries(inputs)) url.searchParams.set(key, String(value));
  return url.toString();
}

export function formatDate(value: string) {
  if (!validDate(value)) return '—';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  // Treat user-written descriptions as literal spreadsheet text, never formulas.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(plan: Plan, simulation: Simulation | null) {
  const rows: unknown[][] = [
    ['CreditLab — planning assumptions'],
    [
      'Assumption rates use percent units; weekly rates and reductions use fraction units (multiply by 100 for percent or percentage points).',
    ],
    ['Inference', 'Two-sided fixed-horizon; weekly views are descriptive'],
    ['Outcome', plan.inputs.outcome],
  ];
  for (const [key, value] of Object.entries(plan.inputs))
    if (key !== 'outcome') rows.push([key, value]);
  rows.push(
    ['required_labels_control', plan.targetC],
    ['required_labels_treatment', plan.targetT],
    ['required_funded_control', plan.fundedC],
    ['required_funded_treatment', plan.fundedT],
    ['enrollment_end', plan.enrollmentDate],
    ['final_analysis', plan.finalDate],
    ['simulation_runs', simulation?.runs ?? ''],
    [],
    [
      'elapsed_day',
      'week',
      'date',
      'enrolled_control',
      'enrolled_treatment',
      'mature_control',
      'mature_treatment',
      'pending_maturity',
      'unavailable_labels',
      'forecast_control_rate',
      'forecast_control_ci_low',
      'forecast_control_ci_high',
      'forecast_treatment_rate',
      'forecast_treatment_ci_low',
      'forecast_treatment_ci_high',
      'forecast_reduction',
      'forecast_reduction_ci_low',
      'forecast_reduction_ci_high',
      'sim_bad_control',
      'sim_bad_treatment',
      'sim_control_rate',
      'sim_control_ci_low',
      'sim_control_ci_high',
      'sim_treatment_rate',
      'sim_treatment_ci_low',
      'sim_treatment_ci_high',
      'sim_reduction',
      'sim_reduction_ci_low',
      'sim_reduction_ci_high',
      'pointwise_detection',
      'detection_mc95_low',
      'detection_mc95_high',
    ],
  );
  plan.weeks.forEach((week, index) => {
    const sim = simulation?.weeks[index];
    rows.push([
      week.day,
      week.week,
      week.date,
      week.enrolledC,
      week.enrolledT,
      week.matureC,
      week.matureT,
      week.pending,
      week.unavailable,
      week.matureC ? plan.pC : null,
      ...(week.expectedC ?? [null, null]),
      week.matureT ? plan.pT : null,
      ...(week.expectedT ?? [null, null]),
      week.expectedDifference ? plan.delta : null,
      ...(week.expectedDifference ?? [null, null]),
      sim?.countC,
      sim?.countT,
      sim?.rateC,
      ...(sim?.intervalC ?? [null, null]),
      sim?.rateT,
      ...(sim?.intervalT ?? [null, null]),
      sim?.difference,
      ...(sim?.interval ?? [null, null]),
      sim?.detection,
      ...(sim?.detectionInterval ?? [null, null]),
    ]);
  });
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
