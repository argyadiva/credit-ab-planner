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
import { simulate } from './simulation';
import { emptyDraft, exportCsv, parseDraft, restoreScenario, scenarioUrl } from './scenario';

const inputs: Inputs = {
  baseline: 10,
  effect: 10,
  effectMode: 'relative',
  power: 80,
  confidence: 95,
  dailyApplicants: 1000,
  funding: 50,
  treatmentShare: 50,
  observationDays: 90,
  reportingDays: 7,
  coverage: 100,
  startDate: '2026-11-19',
  outcome: '30+ DPD within 90 days',
  seed: 42,
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
    const noLag = buildPlan({ ...inputs, observationDays: 0, reportingDays: 0 });
    expect(noLag.finalDay).toBe(noLag.enrollmentDays);
    for (const week of noLag.weeks) expect(week.matureC).toBe(week.enrolledC);
    expect(buildPlan({ ...inputs, reportingDays: 14 }).finalDay).toBe(
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
    expect(buildPlan({ ...inputs, dailyApplicants: 500 }).enrollmentDays).toBeGreaterThan(
      base.enrollmentDays,
    );
    expect(buildPlan({ ...inputs, observationDays: 180 }).enrollmentDays).toBe(base.enrollmentDays);
  });

  it('handles fractional traffic, low coverage, and unbalanced allocation without missing targets', () => {
    const plan = buildPlan({
      ...inputs,
      dailyApplicants: 234.5,
      coverage: 67.3,
      treatmentShare: 23.7,
    });
    expect(plan.weeks.at(-1)!.matureC).toBeGreaterThanOrEqual(plan.targetC);
    expect(plan.weeks.at(-1)!.matureT).toBeGreaterThanOrEqual(plan.targetT);
  });
});

describe('validation and portable scenarios', () => {
  it('keeps assumptions blank and rejects missing or invalid values', () => {
    const draft = emptyDraft();
    expect(draft.baseline).toBe('');
    expect(draft.power).toBe('');
    expect(validate(parseDraft(draft)).length).toBeGreaterThan(5);
    for (const patch of [
      { effect: 0 },
      { effect: 100 },
      { coverage: 0 },
      { treatmentShare: 100 },
      { startDate: '2026-02-30' },
      { reportingDays: 0.5 },
      { funding: Infinity },
    ]) {
      expect(validate({ ...inputs, ...patch }).length).toBeGreaterThan(0);
    }
  });

  it('round trips inputs and seed in versioned URLs', () => {
    const original = { ...inputs, outcome: '30+ DPD, observed & complete' };
    const url = scenarioUrl(original, 'https://example.com/?old=true#old');
    const restored = restoreScenario(new URL(url).search);
    expect(restored.error).toBeNull();
    expect(parseDraft(restored.draft)).toEqual(original);
    expect(restoreScenario('?v=900').error).toContain('unsupported');
    expect(
      validate(parseDraft(restoreScenario('?v=1&baseline=oops').draft)).length,
    ).toBeGreaterThan(0);
  });

  it('exports assumptions and complete weeks without allowing CSV formulas', () => {
    const csv = exportCsv(buildPlan({ ...inputs, outcome: '=HYPERLINK("example")' }), null);
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
    expect(csv).toContain('forecast_reduction_ci_low');
    expect(csv).toContain('2027-04-19');
    expect(csv).toContain('"13495"');
    expect(csv).toMatch(/"-0\./);
    expect(csv).not.toMatch(/"'-0\./);
  });
});

describe('seeded binomial experiments', () => {
  it('is repeatable and accumulates cohorts without redrawing prior outcomes', () => {
    const plan = buildPlan(inputs);
    const first = simulate(plan, 100);
    expect(simulate(plan, 100)).toEqual(first);
    let lastC = 0;
    let lastT = 0;
    first.weeks.forEach((week, index) => {
      expect(week.countC).toBeGreaterThanOrEqual(lastC);
      expect(week.countT).toBeGreaterThanOrEqual(lastT);
      expect(week.countC).toBeLessThanOrEqual(plan.weeks[index].matureC);
      if (index && plan.weeks[index].matureC === plan.weeks[index - 1].matureC)
        expect(week.countC).toBe(lastC);
      lastC = week.countC;
      lastT = week.countT;
    });
    expect(first.weeks[0].interval).toBeNull();
  });

  it('achieves expected final detection probability within Monte Carlo error', () => {
    const plan = buildPlan(inputs);
    const simulation = simulate(plan, 5000);
    const probability = simulation.weeks.at(-1)!.detection!;
    const final = plan.weeks.at(-1)!;
    const expected = powerAt(final.matureC, final.matureT, plan.pC, plan.pT, 0.05);
    expect(Math.abs(probability - expected)).toBeLessThan(0.025);
    const mc = simulation.weeks.at(-1)!.detectionInterval!;
    expect(mc[1] - mc[0]).toBeLessThan(0.04);
  });

  it('has about alpha/2 beneficial rejections under no effect', () => {
    const plan = buildPlan(inputs);
    const result = simulate(plan, 5000, [0.1, 0.1]);
    expect(result.weeks.at(-1)!.detection).toBeGreaterThan(0.012);
    expect(result.weeks.at(-1)!.detection).toBeLessThan(0.04);
  });
});
