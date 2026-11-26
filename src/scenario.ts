import {
  dailyVolumes,
  validationErrors,
  validDate,
  type InputKey,
  type Inputs,
  type Plan,
  type VolumeMode,
} from './model';

export type Draft = Record<InputKey, string>;
const commonEssentialKeys = [
  'baseline',
  'effect',
  'power',
  'alpha',
  'confidence',
  'labelLagDays',
] as const;
export const essentialKeys = (draft: Draft): InputKey[] => [
  ...commonEssentialKeys,
  'testType',
  ...(draft.volumeMode === 'separate' ? ['controlDailyLoans', 'treatmentDailyLoans'] as const : ['dailyLoans'] as const),
];
export const numericKeys = [...commonEssentialKeys, 'dailyLoans', 'treatmentShare', 'controlDailyLoans', 'treatmentDailyLoans', 'coverage'] as const;

export const emptyDraft = (): Draft => ({
  baseline: '',
  effect: '',
  effectMode: 'relative',
  power: '80',
  testType: 'two-sided',
  alpha: '5',
  confidence: '95',
  volumeMode: 'total',
  dailyLoans: '',
  controlDailyLoans: '',
  treatmentDailyLoans: '',
  labelLagDays: '',
  treatmentShare: '50',
  coverage: '100',
  startDate: '',
  outcome: '',
});

export function parseDraft(draft: Draft): Inputs {
  const number = (key: InputKey) => draft[key].trim() === '' ? NaN : Number(draft[key]);
  const common = {
    baseline: number('baseline'),
    effect: number('effect'),
    effectMode: draft.effectMode as Inputs['effectMode'],
    power: number('power'),
    testType: draft.testType as Inputs['testType'],
    alpha: number('alpha'),
    confidence: number('confidence'),
    labelLagDays: number('labelLagDays'),
    coverage: number('coverage'),
    startDate: draft.startDate.trim() || undefined,
    outcome: draft.outcome.trim() || undefined,
  };
  return draft.volumeMode === 'separate'
    ? { ...common, volumeMode: 'separate', controlDailyLoans: number('controlDailyLoans'), treatmentDailyLoans: number('treatmentDailyLoans') }
    : { ...common, volumeMode: draft.volumeMode as 'total', dailyLoans: number('dailyLoans'), treatmentShare: number('treatmentShare') };
}

export function switchVolumeMode(draft: Draft, mode: VolumeMode): Draft {
  if (mode === draft.volumeMode) return draft;
  const inputs = parseDraft(draft);
  const errors = validationErrors(inputs);
  const invalidVolume = ['volumeMode', 'dailyLoans', 'treatmentShare', 'controlDailyLoans', 'treatmentDailyLoans']
    .some((key) => errors[key as InputKey]);
  const { dailyC, dailyT } = dailyVolumes(inputs);
  if (mode === 'separate') return {
    ...draft, volumeMode: mode,
    controlDailyLoans: invalidVolume ? '' : String(dailyC),
    treatmentDailyLoans: invalidVolume ? '' : String(dailyT),
  };
  return {
    ...draft, volumeMode: mode,
    dailyLoans: invalidVolume ? '' : String(dailyC + dailyT),
    treatmentShare: invalidVolume ? '' : String((dailyT / (dailyC + dailyT)) * 100),
  };
}

export function exampleDraft(): Draft {
  return {
    ...emptyDraft(),
    baseline: '10',
    effect: '10',
    power: '80',
    testType: 'two-sided',
    alpha: '5',
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
  if (!['1', '2', '3', '4'].includes(version))
    return {
      draft,
      error:
        'This scenario link uses an unsupported version. Enter your assumptions or try the example.',
    };
  // Incomplete saved scenarios must still ask for their missing assumptions.
  // The new defaults apply to a fresh calculator, not to previously invalid links.
  draft.power = '';
  draft.testType = '';
  draft.alpha = '';
  draft.confidence = '';
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (!['3', '4'].includes(version) && ['volumeMode', 'controlDailyLoans', 'treatmentDailyLoans'].includes(key)) continue;
    if (version === '1' && (key === 'dailyLoans' || key === 'labelLagDays')) continue;
    if (version !== '4' && ['testType', 'alpha'].includes(key)) continue;
    const value = params.get(key);
    if (value !== null) draft[key] = value.slice(0, 220);
  }
  let error: string | null = null;
  if (['3', '4'].includes(version) && !['total', 'separate'].includes(params.get('volumeMode') ?? '')) {
    draft.volumeMode = 'total';
    draft.dailyLoans = '';
    error = 'The shared link has an invalid or missing volume mode. Enter your funded-loan assumptions below.';
  }
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
  if (version !== '4') {
    draft.testType = 'two-sided';
    draft.alpha = draft.confidence.trim() && Number.isFinite(Number(draft.confidence))
      ? String(100 - Number(draft.confidence))
      : '';
  }
  // Keep malformed values out of HTML number controls; never silently calculate them.
  for (const key of numericKeys) {
    if (draft[key].trim() && !Number.isFinite(Number(draft[key]))) {
      draft[key] = '';
      if (essentialKeys(draft).includes(key) || key === 'coverage' ||
        (key === 'treatmentShare' && draft.volumeMode === 'total'))
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
  url.searchParams.set('v', '4');
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
      'Assumption rates use percent units. Weekly rates, intervals, and forecast_detection_power use fractions: multiply by 100 for percent or percentage points.',
    ],
    [
      'Method',
      `${plan.inputs.testType} fixed-horizon planning at alpha ${plan.inputs.alpha}%; projected intervals are not observed results`,
    ],
  ];
  for (const [key, value] of Object.entries(plan.inputs))
    if (value !== undefined) rows.push([key, value]);
  rows.push(
    ['resolved_control_daily_loans', plan.dailyC],
    ['resolved_treatment_daily_loans', plan.dailyT],
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
      'forecast_detection_power',
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
      week.projectedPower,
    ]);
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
