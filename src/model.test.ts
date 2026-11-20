import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  cdf,
  dateAt,
  differenceInterval,
  powerAt,
  quantile,
  sampleSize,
  validate,
  wilson,
  type Inputs,
} from './model';
import {
  emptyDraft,
  exampleDraft,
  exportCsv,
  parseDraft,
  restoreScenario,
  scenarioUrl,
  switchVolumeMode,
} from './scenario';
import { forecastData } from './ForecastChart';

const inputs: Inputs = {
  baseline: 10,
  effect: 10,
  effectMode: 'relative',
  power: 80,
  confidence: 95,
  volumeMode: 'total',
  dailyLoans: 500,
  treatmentShare: 50,
  labelLagDays: 97,
  coverage: 100,
  startDate: '2026-11-19',
  outcome: '30+ DPD within 90 days',
};

describe('statistical reference checks', () => {
  it('matches standard normal reference values', () => {
    expect(quantile(0.975)).toBeCloseTo(1.959963984540054, 8);
    expect(cdf(1.959963984540054)).toBeCloseTo(0.975, 10);
  });

  // Independently generated with SciPy norm.cdf/ppf and scipy.optimize.brentq.
  it.each([
    [1, 13495, 13495],
    [0.25, 34110, 8528],
    [4, 8338, 33352],
  ])('matches SciPy sample sizes for ratio %s', (ratio, nC, nT) => {
    const sample = sampleSize(0.1, 0.09, 0.8, 0.05, ratio);
    expect(sample.nC).toBe(nC);
    expect(sample.nT).toBe(nT);
    expect(sample.power).toBeGreaterThanOrEqual(0.8);
  });

  it('matches Wilson reference limits, including all-good and all-bad outcomes', () => {
    expect(wilson(0, 10, 0.95)[0]).toBeCloseTo(0, 12);
    expect(wilson(0, 10, 0.95)[1]).toBeCloseTo(0.2775327998628892, 9);
    expect(wilson(5, 10, 0.95)[0]).toBeCloseTo(0.236593090512564, 9);
    expect(wilson(10, 10, 0.95)[1]).toBeCloseTo(1, 12);
    expect(wilson(10, 10, 0.95)[0]).toBeCloseTo(1 - 0.2775327998628892, 9);
  });

  it('reverses difference-interval bounds when arms are reversed', () => {
    const a = differenceInterval(90, 1000, 70, 1000, 0.95);
    const b = differenceInterval(70, 1000, 90, 1000, 0.95);
    expect(a[0]).toBeCloseTo(-b[1], 12);
    expect(a[1]).toBeCloseTo(-b[0], 12);
    expect(a[0]).toBeLessThan(0.02);
    expect(a[1]).toBeGreaterThan(0.02);
    // statsmodels 0.15.0 confint_proportions_2indep(method='newcomb').
    expect(a[0]).toBeCloseTo(-0.0038605883599364746, 10);
    expect(a[1]).toBeCloseTo(0.044008680920584284, 10);
  });

  it('narrows intervals with increasing sample size', () => {
    const small = differenceInterval(10, 100, 9, 100, 0.95);
    const large = differenceInterval(1000, 10000, 900, 10000, 0.95);
    expect(large[1] - large[0]).toBeLessThan(small[1] - small[0]);
  });

  it('requires more samples for higher confidence, higher power, or smaller effects', () => {
    const base = buildPlan(inputs);
    expect(buildPlan({ ...inputs, confidence: 99 }).targetC).toBeGreaterThan(base.targetC);
    expect(buildPlan({ ...inputs, power: 90 }).targetC).toBeGreaterThan(base.targetC);
    expect(buildPlan({ ...inputs, effect: 5 }).targetC).toBeGreaterThan(base.targetC);
  });
});

describe('cohort timing and label coverage', () => {
  it('calculates durations without requiring a start date or outcome description', () => {
    const plan = buildPlan(parseDraft(exampleDraft()));
    expect(plan.targetC).toBe(13495);
    expect(plan.targetT).toBe(13495);
    expect(plan.enrollmentDays).toBe(54);
    expect(plan.finalDay).toBe(151);
    expect(plan.inputs.startDate).toBeUndefined();
    expect(plan.inputs.outcome).toBeUndefined();
    expect(plan.enrollmentDate).toBeUndefined();
    expect(plan.finalDate).toBeUndefined();
    expect(plan.weeks.every((week) => week.date === undefined)).toBe(true);
  });
  it('matches the example milestones and excludes immature outcomes', () => {
    const plan = buildPlan(inputs);
    expect(plan.targetC).toBe(13495);
    expect(plan.enrollmentDays).toBe(54);
    expect(plan.finalDay).toBe(151);
    expect(plan.enrollmentDate).toBe('2027-01-12');
    expect(plan.finalDate).toBe('2027-04-19');
    for (const week of plan.weeks.filter((w) => w.day <= 97)) {
      expect(week.matureC).toBe(0);
      expect(week.expectedDifference).toBeNull();
    }
    const final = plan.weeks.at(-1)!;
    expect(final.matureC).toBe(13500);
    expect(final.matureT).toBe(13500);
    expect(final.pending).toBe(0);
    expect(final.unavailable).toBe(0);
  });

  it('produces equivalent plans for equivalent effect input modes', () => {
    const a = buildPlan(inputs);
    const b = buildPlan({ ...inputs, effectMode: 'absolute', effect: 1 });
    expect(a.targetC).toBe(b.targetC);
    expect(a.targetT).toBe(b.targetT);
    expect(a.finalDay).toBe(b.finalDay);
    expect(a.pT).toBeCloseTo(b.pT, 12);
  });

  it('freezes enrollment while last cohorts finish follow-up', () => {
    const plan = buildPlan(inputs);
    const after = plan.weeks.filter((week) => week.day >= plan.enrollmentDays);
    expect(new Set(after.map((week) => week.enrolledC)).size).toBe(1);
    expect(after.at(-1)!.matureC).toBeGreaterThan(after[0].matureC);
  });

  it('handles zero lag, reporting delay, and UTC date boundaries', () => {
    const noLag = buildPlan({ ...inputs, labelLagDays: 0 });
    expect(noLag.finalDay).toBe(noLag.enrollmentDays);
    for (const week of noLag.weeks) expect(week.matureC).toBe(week.enrolledC);
    expect(buildPlan({ ...inputs, labelLagDays: 104 }).finalDay).toBe(
      buildPlan(inputs).finalDay + 7,
    );
    expect(dateAt('2028-02-28', 2)).toBe('2028-03-01');
  });

  it('increases enrolled requirements for partial coverage without including missing labels', () => {
    const plan = buildPlan({ ...inputs, coverage: 80 });
    const base = buildPlan(inputs);
    const final = plan.weeks.at(-1)!;
    expect(plan.enrollmentDays).toBeGreaterThan(base.enrollmentDays);
    expect(final.matureC).toBeGreaterThanOrEqual(plan.targetC);
    expect(final.matureT).toBeGreaterThanOrEqual(plan.targetT);
    expect(final.pending).toBe(0);
    expect(final.unavailable).toBeGreaterThan(0);
    for (const week of plan.weeks)
      expect(week.enrolledC + week.enrolledT).toBe(
        week.matureC + week.matureT + week.pending + week.unavailable,
      );
  });

  it('slower traffic increases enrollment; longer lag only extends readout', () => {
    const base = buildPlan(inputs);
    expect(buildPlan({ ...inputs, dailyLoans: 250 }).enrollmentDays).toBeGreaterThan(
      base.enrollmentDays,
    );
    expect(buildPlan({ ...inputs, labelLagDays: 187 }).enrollmentDays).toBe(base.enrollmentDays);
  });

  it('handles fractional traffic, low coverage, and unbalanced allocation without missing targets', () => {
    const plan = buildPlan({
      ...inputs,
      dailyLoans: 117.25,
      coverage: 67.3,
      treatmentShare: 23.7,
    });
    expect(plan.weeks.at(-1)!.matureC).toBeGreaterThanOrEqual(plan.targetC);
    expect(plan.weeks.at(-1)!.matureT).toBeGreaterThanOrEqual(plan.targetT);
  });
});

describe('validation and portable scenarios', () => {
  it('defaults power and confidence while keeping scenario assumptions blank', () => {
    const draft = emptyDraft();
    expect(draft.baseline).toBe('');
    expect(draft.effect).toBe('');
    expect(draft.power).toBe('80');
    expect(draft.confidence).toBe('95');
    expect(draft.dailyLoans).toBe('');
    expect(draft.labelLagDays).toBe('');
    expect(draft.treatmentShare).toBe('50');
    expect(draft.coverage).toBe('100');
    expect(validate(parseDraft(draft)).length).toBe(4);
    for (const patch of [
      { effect: 0 },
      { effect: 100 },
      { coverage: 0 },
      { treatmentShare: 100 },
      { startDate: '2026-02-30' },
      { labelLagDays: 0.5 },
      { dailyLoans: Infinity },
    ]) {
      expect(validate({ ...inputs, ...patch }).length).toBeGreaterThan(0);
    }
  });

  it('round trips total-volume inputs in version-3 URLs', () => {
    const original = { ...inputs, outcome: '30+ DPD, observed & complete' };
    const url = scenarioUrl(original, 'https://example.com/?old=true#old');
    expect(new URL(url).searchParams.get('v')).toBe('3');
    expect(url).not.toContain('seed');
    const restored = restoreScenario(new URL(url).search);
    expect(restored.error).toBeNull();
    expect(parseDraft(restored.draft)).toEqual(original);
    expect(restoreScenario('?v=900').error).toContain('unsupported');
    expect(
      validate(parseDraft(restoreScenario('?v=1&baseline=oops').draft)).length,
    ).toBeGreaterThan(0);
  });

  it.each(['relative', 'absolute'])(
    'converts old %s scenario links without changing the calculation',
    (effectMode) => {
      const legacy = new URLSearchParams({
        v: '1',
        baseline: '10',
        effect: effectMode === 'relative' ? '10' : '1',
        effectMode,
        power: '80',
        confidence: '95',
        dailyApplicants: '1000',
        funding: '50',
        treatmentShare: '50',
        observationDays: '90',
        reportingDays: '7',
        coverage: '100',
        startDate: '2026-11-19',
        outcome: '30+ DPD',
        seed: '42',
      });
      const restored = restoreScenario(legacy.toString());
      expect(restored.error).toBeNull();
      expect(restored.draft.dailyLoans).toBe('500');
      expect(restored.draft.labelLagDays).toBe('97');
      expect(restored.draft).not.toHaveProperty('seed');
      const plan = buildPlan(parseDraft(restored.draft));
      expect(plan.targetC).toBe(13495);
      expect(plan.enrollmentDays).toBe(54);
      expect(plan.finalDay).toBe(151);
      expect(plan.finalDate).toBe('2027-04-19');
    },
  );

  it('rejects malformed legacy conversion assumptions instead of silently using defaults', () => {
    for (const funding of ['-10', '101', 'oops', '']) {
      const restored = restoreScenario(
        `?v=1&dailyApplicants=1000&funding=${funding}&observationDays=90&reportingDays=7`,
      );
      expect(restored.error).not.toBeNull();
      expect(restored.draft.dailyLoans).toBe('');
    }
    const restored = restoreScenario('?v=2&dailyLoans=Infinity&baseline=10');
    expect(restored.error).not.toBeNull();
    expect(restored.draft.dailyLoans).toBe('');
  });

  it('exports assumptions and complete weeks without allowing CSV formulas', () => {
    const csv = exportCsv(buildPlan({ ...inputs, outcome: '=HYPERLINK("example")' }));
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv).toContain('forecast_reduction_ci_low');
    expect(csv).toContain('2027-04-19');
    expect(csv).toContain('"13495"');
    expect(csv).toMatch(/"-0\./);
    expect(csv).not.toMatch(/"'-0\./);
    expect(csv).not.toContain('sim_');
    expect(csv).toContain('forecast_detection_power');
    expect(csv).toContain('projected_usable_control');
  });
});


describe('separate daily funded volumes', () => {
  const separate = (controlDailyLoans: number, treatmentDailyLoans: number): Inputs => ({
    baseline: 10, effect: 10, effectMode: 'relative', power: 80, confidence: 95,
    coverage: 100, labelLagDays: 97, volumeMode: 'separate',
    controlDailyLoans, treatmentDailyLoans,
  });

  it.each([50, 20, 80, 23.7])('matches total-volume planning at %s percent treatment', (share) => {
    const total = buildPlan({ ...inputs, treatmentShare: share });
    const split = buildPlan({ ...separate(total.dailyC, total.dailyT), startDate: inputs.startDate, outcome: inputs.outcome });
    expect({ ...split, inputs: total.inputs }).toEqual(total);
  });

  it.each([[300, 100], [100, 400], [89.5, 27.75]])(
    'meets both targets with %s control/day and %s treatment/day and partial coverage',
    (control, treatment) => {
      const plan = buildPlan({ ...separate(control, treatment), coverage: 67.3 });
      const final = plan.weeks.at(-1)!;
      expect(final.matureC).toBeGreaterThanOrEqual(plan.targetC);
      expect(final.matureT).toBeGreaterThanOrEqual(plan.targetT);
      expect(final.enrolledC).toBe(Math.floor(plan.enrollmentDays * control));
      expect(final.enrolledT).toBe(Math.floor(plan.enrollmentDays * treatment));
      expect(final.pending).toBe(0);
      const widthC = final.expectedC![1] - final.expectedC![0];
      const widthT = final.expectedT![1] - final.expectedT![0];
      expect(widthC > widthT).toBe(control < treatment);
      for (const week of plan.weeks) {
        expect(week.enrolledC + week.enrolledT).toBe(week.matureC + week.matureT + week.pending + week.unavailable);
      }
    },
  );

  it('handles immediate labels and never calculates intervals before either arm has labels', () => {
    const plan = buildPlan({ ...separate(300, 100), labelLagDays: 0 });
    expect(plan.finalDay).toBe(plan.enrollmentDays);
    for (const week of plan.weeks) {
      expect(week.matureC).toBe(week.enrolledC);
      expect(week.matureT).toBe(week.enrolledT);
    }
    expect(plan.weeks[0].expectedC).toBeNull();
    expect(plan.weeks[0].expectedT).toBeNull();
  });

  it.each([NaN, 0, -1, Infinity, 1e9 + 1])('rejects invalid per-arm volume %s', (value) => {
    expect(validate(separate(value, 100)).length).toBeGreaterThan(0);
    expect(validate(separate(100, value)).length).toBeGreaterThan(0);
  });

  it('rejects excessive combined volume and missing active inputs', () => {
    expect(validate(separate(6e8, 6e8)).length).toBe(2);
    expect(validate({ ...inputs, dailyLoans: 1e9 + 0.5 }).length).toBeGreaterThan(0);
    const draft = { ...exampleDraft(), volumeMode: 'separate' };
    expect(validate(parseDraft(draft)).length).toBe(2);
  });

  it('ignores inactive fields, preserves valid volumes on switching, and clears invalid destinations', () => {
    const draft = { ...exampleDraft(), treatmentShare: '20', controlDailyLoans: 'bad', treatmentDailyLoans: '' };
    const split = switchVolumeMode(draft, 'separate');
    expect(split.controlDailyLoans).toBe('400');
    expect(split.treatmentDailyLoans).toBe('100');
    const splitWithInvalidHidden = { ...split, dailyLoans: '', treatmentShare: 'bad' };
    expect(validate(parseDraft(splitWithInvalidHidden))).toEqual([]);
    expect(parseDraft(splitWithInvalidHidden)).not.toHaveProperty('dailyLoans');
    const restored = switchVolumeMode(splitWithInvalidHidden, 'total');
    expect(restored.dailyLoans).toBe('500');
    expect(restored.treatmentShare).toBe('20');
    expect(switchVolumeMode({ ...draft, dailyLoans: '' }, 'separate').controlDailyLoans).toBe('');
    expect(switchVolumeMode({ ...split, treatmentDailyLoans: '0' }, 'total').dailyLoans).toBe('');
    expect(switchVolumeMode(emptyDraft(), 'separate').treatmentDailyLoans).toBe('');
  });

  it('round trips separate-volume links and exports the selected mode and resolved volumes', () => {
    const original = separate(300, 100);
    const url = scenarioUrl(original, 'https://example.com');
    expect(new URL(url).searchParams.get('v')).toBe('3');
    expect(new URL(url).searchParams.has('dailyLoans')).toBe(false);
    expect(new URL(url).searchParams.has('treatmentShare')).toBe(false);
    const restored = restoreScenario(new URL(url).search);
    expect(restored.error).toBeNull();
    expect(parseDraft(restored.draft)).toEqual({ ...original, startDate: undefined, outcome: undefined });
    const csv = exportCsv(buildPlan(original));
    expect(csv).toContain('"volumeMode","separate"');
    expect(csv).toContain('"resolved_control_daily_loans","300"');
    expect(csv).toContain('"resolved_treatment_daily_loans","100"');
    expect(csv).toContain('forecast_reduction_ci_low');
  });

  it('restores version-2 inputs unchanged and rejects malformed version-3 modes and active numbers', () => {
    const old = new URL(scenarioUrl(inputs, 'https://example.com'));
    old.searchParams.set('v', '2');
    old.searchParams.delete('volumeMode');
    // New keys in an old URL must not change its original meaning.
    old.searchParams.set('volumeMode', 'separate');
    old.searchParams.set('controlDailyLoans', '100');
    expect(parseDraft(restoreScenario(old.search).draft)).toEqual(inputs);
    for (const mode of ['', 'bogus']) {
      const restored = restoreScenario(`?v=3&volumeMode=${mode}&dailyLoans=500`);
      expect(restored.error).toContain('volume mode');
      expect(restored.draft.dailyLoans).toBe('');
    }
    const bad = restoreScenario('?v=3&volumeMode=separate&controlDailyLoans=Infinity&treatmentDailyLoans=100');
    expect(bad.error).not.toBeNull();
    expect(bad.draft.controlDailyLoans).toBe('');
    expect(restoreScenario('?v=3&volumeMode=separate&dailyLoans=Infinity').error).toBeNull();
  });
});

describe('baseline-percentage forecast chart', () => {
  it('plots 10 percent control and 9 percent treatment, with arm-specific bands and missing-data gaps', () => {
    const plan = buildPlan({ ...inputs, treatmentShare: 20 });
    const data = forecastData(plan);
    expect(data[0].control).toBeNull();
    expect(data[0].treatment).toBeNull();
    for (const row of data.filter((row) => row.day <= plan.lagDays)) {
      expect(row.controlInterval).toBeNull();
      expect(row.treatmentInterval).toBeNull();
    }
    const final = data.at(-1)!;
    expect(final.control).toBe(10);
    expect(final.treatment).toBeCloseTo(9, 12);
    expect(final.controlInterval![0]).toBeLessThan(10);
    expect(final.controlInterval![1]).toBeGreaterThan(10);
    expect(final.treatmentInterval![0]).toBeLessThan(9);
    expect(final.treatmentInterval![1]).toBeGreaterThan(9);
    expect(final.treatmentInterval![1] - final.treatmentInterval![0]).toBeGreaterThan(final.controlInterval![1] - final.controlInterval![0]);
    const first = data.find((row) => row.control !== null)!;
    expect(final.controlInterval![1] - final.controlInterval![0]).toBeLessThan(first.controlInterval![1] - first.controlInterval![0]);
  });
});

describe('goal-based detection power projections', () => {
  // Independently calculated using Python statistics.NormalDist and the documented test formula.
  it.each([
    [50, 100, 2000, 2000, 0.19018175879793875],
    [20, 100, 3200, 800, 0.12885285827717036],
    [20, 80, 2560, 640, 0.11127287679233128],
  ])('matches reference power with %s%% treatment allocation and %s%% coverage', (share, coverage, nC, nT, power) => {
    const plan = buildPlan({ ...inputs, treatmentShare: share, coverage });
    const week = plan.weeks.find((week) => week.day === 105)!;
    expect(week.matureC).toBe(nC);
    expect(week.matureT).toBe(nT);
    expect(week.projectedPower).toBeCloseTo(power, 10);
    for (const delayed of plan.weeks.filter((week) => week.day <= plan.lagDays))
      expect(delayed.projectedPower).toBeNull();
    const final = plan.weeks.at(-1)!;
    expect(final.projectedPower).toBeGreaterThanOrEqual(inputs.power / 100);
    expect(final.projectedPower).toBeCloseTo(
      powerAt(final.matureC, final.matureT, plan.pC, plan.pT, 0.05), 12,
    );
  });

  it('leaves power unavailable if only one arm has usable outcomes', () => {
    const plan = buildPlan({ ...inputs, effect: 50, dailyLoans: 100, treatmentShare: 0.1, labelLagDays: 0 });
    const week = plan.weeks.find((week) => week.day === 7)!;
    expect(week.matureC).toBeGreaterThan(0);
    expect(week.matureT).toBe(0);
    expect(week.projectedPower).toBeNull();
  });

  it('increases power with mature data without changing assumed rates', () => {
    const fast = buildPlan({ ...inputs, labelLagDays: 0 });
    const slow = buildPlan({ ...inputs, labelLagDays: 0, dailyLoans: 250 });
    const fastWeek = fast.weeks.find((week) => week.day === 14)!;
    const slowWeek = slow.weeks.find((week) => week.day === 14)!;
    expect(fastWeek.projectedPower).toBeGreaterThan(slowWeek.projectedPower!);
    expect(fast.pC).toBe(slow.pC);
    expect(fast.pT).toBe(slow.pT);
    const powers = fast.weeks.flatMap((week) => week.projectedPower === null ? [] : [week.projectedPower]);
    for (let i = 1; i < powers.length; i++) expect(powers[i]).toBeGreaterThanOrEqual(powers[i - 1]);
    const smallerEffect = buildPlan({ ...inputs, labelLagDays: 0, effect: 5 });
    expect(smallerEffect.targetC).toBeGreaterThan(fast.targetC);
    expect(smallerEffect.finalDay).toBeGreaterThan(fast.finalDay);
  });

  it('does not gain final power just by waiting longer for the same collected samples', () => {
    const original = buildPlan(inputs);
    const moreDelay = buildPlan({ ...inputs, labelLagDays: inputs.labelLagDays + 7 });
    expect(moreDelay.finalDay).toBe(original.finalDay + 7);
    expect(moreDelay.weeks.at(-1)!.projectedPower).toBe(original.weeks.at(-1)!.projectedPower);
  });

  it('supports a single mature forecast point with no label delay', () => {
    const plan = buildPlan({ ...inputs, dailyLoans: 1e6, labelLagDays: 0 });
    expect(plan.weeks.map((week) => week.day)).toEqual([0, 1]);
    expect(plan.weeks[0].projectedPower).toBeNull();
    expect(plan.weeks[1].projectedPower).toBeGreaterThanOrEqual(0.8);
  });

  it.each(['1', '2', '3'])('preserves explicit settings and missing-assumption errors in version %s links', (version) => {
    const original = { ...inputs, power: 90, confidence: 99 };
    const url = new URL(scenarioUrl(original, 'https://example.com'));
    url.searchParams.set('v', version);
    if (version === '1') {
      for (const [key, value] of Object.entries({ dailyApplicants: '1000', funding: '50', observationDays: '90', reportingDays: '7' }))
        url.searchParams.set(key, value);
    }
    const restored = restoreScenario(url.search);
    expect(parseDraft(restored.draft)).toEqual(original);
    url.searchParams.delete('power');
    url.searchParams.delete('confidence');
    const incomplete = restoreScenario(url.search);
    expect(incomplete.draft.power).toBe('');
    expect(incomplete.draft.confidence).toBe('');
    expect(validate(parseDraft(incomplete.draft))).toHaveLength(2);
    expect(restoreScenario('').draft).toEqual(emptyDraft());
  });

  it('appends power as a fraction in CSV while retaining existing weekly columns and nulls', () => {
    const plan = buildPlan(inputs);
    const lines = exportCsv(plan).split('\r\n');
    const header = lines.findIndex((line) => line.startsWith('"elapsed_day"'));
    expect(lines[header]).toMatch(/"forecast_reduction_ci_high","forecast_detection_power"$/);
    const data = lines.slice(header + 1);
    expect(data).toHaveLength(plan.weeks.length);
    expect(data[0]).toMatch(/,""$/);
    expect(data.at(-1)!.endsWith(`,"${plan.weeks.at(-1)!.projectedPower}"`)).toBe(true);
    expect(lines[1]).toContain('forecast_detection_power use fractions');
  });
});
