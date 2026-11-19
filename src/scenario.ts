import { validDate, type Inputs, type Plan } from './model';

export type Draft = Record<keyof Inputs, string>;
export const essentialKeys = [
  'baseline',
  'effect',
  'power',
  'confidence',
  'dailyLoans',
  'labelLagDays',
] as const;
export const numericKeys = [...essentialKeys, 'treatmentShare', 'coverage'] as const;

export const emptyDraft = (): Draft => ({
  baseline: '',
  effect: '',
  effectMode: 'relative',
  power: '',
  confidence: '',
  dailyLoans: '',
  labelLagDays: '',
  treatmentShare: '50',
  coverage: '100',
  startDate: '',
  outcome: '',
});

export function parseDraft(draft: Draft): Inputs {
  const parsed = {
    ...draft,
    startDate: draft.startDate.trim() || undefined,
    outcome: draft.outcome.trim() || undefined,
  } as unknown as Inputs;
  for (const key of numericKeys) parsed[key] = draft[key].trim() === '' ? NaN : Number(draft[key]);
  return parsed;
}

export function exampleDraft(): Draft {
  return {
    ...emptyDraft(),
    baseline: '10',
    effect: '10',
    power: '80',
    confidence: '95',
    dailyLoans: '500',
    labelLagDays: '97',
  };
}

export function restoreScenario(search: string): { draft: Draft; error: string | null } {
  const draft = emptyDraft();
  const params = new URLSearchParams(search);
  const version = params.get('v');
  if (!version) return { draft, error: null };
  if (version !== '1' && version !== '2')
    return {
      draft,
      error:
        'This scenario link uses an unsupported version. Enter your assumptions or try the example.',
    };
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (version === '1' && (key === 'dailyLoans' || key === 'labelLagDays')) continue;
    const value = params.get(key);
    if (value !== null) draft[key] = value.slice(0, 220);
  }
  let error: string | null = null;
  if (version === '1') {
    const legacyNumber = (key: string) => {
      const value = params.get(key);
      return value?.trim() ? Number(value) : NaN;
    };
    const applicants = legacyNumber('dailyApplicants');
    const funding = legacyNumber('funding');
    const observation = legacyNumber('observationDays');
    const reporting = legacyNumber('reportingDays');
    if (
      Number.isFinite(applicants) &&
      applicants > 0 &&
      Number.isFinite(funding) &&
      funding > 0 &&
      funding <= 100
    ) {
      draft.dailyLoans = String((applicants * funding) / 100);
    } else
      error =
        'The old link has invalid or missing applicant/funding assumptions. Enter funded loans per day below.';
    if (
      Number.isInteger(observation) &&
      observation >= 0 &&
      observation <= 3650 &&
      Number.isInteger(reporting) &&
      reporting >= 0 &&
      reporting <= 3650
    ) {
      draft.labelLagDays = String(observation + reporting);
    } else
      error =
        'The old link has invalid or missing label delays. Enter the total label delay below.';
  }
  // Keep malformed values out of HTML number controls; never silently calculate them.
  for (const key of numericKeys) {
    if (draft[key].trim() && !Number.isFinite(Number(draft[key]))) {
      draft[key] = '';
      error = 'The shared link contains an invalid number. Correct the missing assumption below.';
    }
  }
  if (!['relative', 'absolute'].includes(draft.effectMode)) {
    draft.effectMode = 'relative';
    draft.effect = '';
    error = 'The shared link has an invalid reduction mode. Choose a reduction below.';
  }
  return { draft, error };
}

export function scenarioUrl(inputs: Inputs, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', '2');
  for (const [key, value] of Object.entries(inputs))
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  return url.toString();
}

export function formatDate(value?: string) {
  if (!value || !validDate(value)) return '—';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(plan: Plan) {
  const rows: unknown[][] = [
    ['CreditLab — calculator projections'],
    [
      'Assumption rates use percent units. Weekly rates and intervals use fractions: multiply by 100 for percent or percentage points.',
    ],
    ['Method', 'Two-sided fixed-horizon planning; projected intervals are not observed results'],
  ];
  for (const [key, value] of Object.entries(plan.inputs))
    if (value !== undefined) rows.push([key, value]);
  rows.push(
    ['required_labels_control', plan.targetC],
    ['required_labels_treatment', plan.targetT],
    ['required_funded_control', plan.fundedC],
    ['required_funded_treatment', plan.fundedT],
    ['collection_days', plan.enrollmentDays],
    ['label_delay_days', plan.lagDays],
    ['total_days', plan.finalDay],
    ['collection_end_date', plan.enrollmentDate],
    ['analysis_date', plan.finalDate],
    [],
    [
      'elapsed_day',
      'week',
      'date',
      'projected_funded_control',
      'projected_funded_treatment',
      'projected_usable_control',
      'projected_usable_treatment',
      'projected_pending',
      'projected_unavailable',
      'forecast_control_rate',
      'forecast_control_ci_low',
      'forecast_control_ci_high',
      'forecast_treatment_rate',
      'forecast_treatment_ci_low',
      'forecast_treatment_ci_high',
      'forecast_reduction',
      'forecast_reduction_ci_low',
      'forecast_reduction_ci_high',
    ],
  );
  for (const week of plan.weeks)
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
    ]);
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
