import { jStat } from 'jstat';

interface CommonInputs {
  baseline: number;
  effect: number;
  effectMode: 'relative' | 'absolute';
  power: number;
  testType: TestType;
  alpha: number;
  confidence: number;
  labelLagDays: number;
  coverage: number;
  startDate?: string;
  outcome?: string;
}

export type VolumeMode = 'total' | 'separate';
export type TestType = 'one-sided' | 'two-sided';
export type Inputs = CommonInputs &
  (
    | { volumeMode: 'total'; dailyLoans: number; treatmentShare: number }
    | { volumeMode: 'separate'; controlDailyLoans: number; treatmentDailyLoans: number }
  );
export type InputKey = keyof CommonInputs | 'volumeMode' | 'dailyLoans' | 'treatmentShare'
  | 'controlDailyLoans' | 'treatmentDailyLoans';

/** Resolve the active input mode once; all projections use these arm-specific volumes. */
export function dailyVolumes(inputs: Inputs) {
  if (inputs.volumeMode === 'separate')
    return { dailyC: inputs.controlDailyLoans, dailyT: inputs.treatmentDailyLoans };
  const share = inputs.treatmentShare / 100;
  return { dailyC: inputs.dailyLoans * (1 - share), dailyT: inputs.dailyLoans * share };
}

export type Interval = [number, number];
export interface Week {
  day: number;
  week: number;
  date?: string;
  enrolledC: number;
  enrolledT: number;
  matureC: number;
  matureT: number;
  pending: number;
  unavailable: number;
  expectedC: Interval | null;
  expectedT: Interval | null;
  expectedDifference: Interval | null;
  projectedPower: number | null;
}
export interface Plan {
  inputs: Inputs;
  dailyC: number;
  dailyT: number;
  pC: number;
  pT: number;
  delta: number;
  targetC: number;
  targetT: number;
  fundedC: number;
  fundedT: number;
  achievedPower: number;
  enrollmentDays: number;
  lagDays: number;
  finalDay: number;
  enrollmentDate?: string;
  finalDate?: string;
  weeks: Week[];
  warnings: string[];
}

export const cdf = (x: number) => jStat.normal.cdf(x, 0, 1);
export const quantile = (p: number) => jStat.normal.inv(p, 0, 1);

export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function validationErrors(input: Inputs): Partial<Record<InputKey, string>> {
  const errors: Partial<Record<InputKey, string>> = {};
  const between = (value: number, min: number, max: number) =>
    Number.isFinite(value) && value > min && value < max;
  if (!between(input.baseline, 0, 100))
    errors.baseline = 'Enter a bad rate above 0% and below 100%.';
  if (!['relative', 'absolute'].includes(input.effectMode))
    errors.effectMode = 'Select relative percent or percentage points.';
  if (!Number.isFinite(input.effect) || input.effect <= 0)
    errors.effect = 'Enter a reduction greater than zero.';
  const target =
    input.effectMode === 'relative'
      ? input.baseline * (1 - input.effect / 100)
      : input.baseline - input.effect;
  if (!errors.baseline && !errors.effect && !between(target, 0, input.baseline))
    errors.effect = 'The target bad rate must stay above 0% and below the baseline.';
  if (!between(input.power, 50, 100)) errors.power = 'Enter power above 50% and below 100%.';
  if (!['one-sided', 'two-sided'].includes(input.testType))
    errors.testType = 'Select one-sided or two-sided testing.';
  if (
    !between(input.alpha, 0, 50) ||
    !(input.alpha / 100 > 0) ||
    !Number.isFinite(quantile(1 - input.alpha / 100))
  )
    errors.alpha = 'Enter alpha above 0% and below 50% that produces a finite critical value.';
  if (!between(input.confidence, 50, 100))
    errors.confidence = 'Enter confidence above 50% and below 100%.';
  const validVolume = (value: number) => Number.isFinite(value) && value > 0 && value <= 1e9;
  if (input.volumeMode === 'total') {
    if (!validVolume(input.dailyLoans))
      errors.dailyLoans = 'Enter funded loans per day above 0 and at most 1 billion.';
    if (!between(input.treatmentShare, 0, 100))
      errors.treatmentShare = 'Treatment allocation must be above 0% and below 100%.';
  } else if (input.volumeMode === 'separate') {
    if (!validVolume(input.controlDailyLoans))
      errors.controlDailyLoans = 'Enter control funded loans per day above 0 and at most 1 billion.';
    if (!validVolume(input.treatmentDailyLoans))
      errors.treatmentDailyLoans = 'Enter treatment funded loans per day above 0 and at most 1 billion.';
    if (!errors.controlDailyLoans && !errors.treatmentDailyLoans &&
      input.controlDailyLoans + input.treatmentDailyLoans > 1e9) {
      errors.controlDailyLoans = errors.treatmentDailyLoans =
        'Combined funded loans per day must be at most 1 billion.';
    }
  } else errors.volumeMode = 'Select total plus allocation or separate daily volumes.';
  if (!Number.isFinite(input.coverage) || input.coverage <= 0 || input.coverage > 100)
    errors.coverage = 'Label coverage must be above 0% and at most 100%.';
  if (!Number.isInteger(input.labelLagDays) || input.labelLagDays < 0 || input.labelLagDays > 7300)
    errors.labelLagDays = 'Enter a whole number of days from 0 to 7,300.';
  if (input.startDate && !validDate(input.startDate))
    errors.startDate = 'Enter a valid start date or leave it blank.';
  if (input.outcome && input.outcome.length > 200)
    errors.outcome = 'Keep the description to 200 characters or fewer.';
  return errors;
}

export function validate(input: Inputs): string[] {
  return Object.values(validationErrors(input));
}

/** Power of a pooled-null z test; unpooled alternative variance. */
export function powerAt(
  nC: number,
  nT: number,
  pC: number,
  pT: number,
  alpha: number,
  testType: TestType,
) {
  const pooled = (nC * pC + nT * pT) / (nC + nT);
  const nullSE = Math.sqrt(pooled * (1 - pooled) * (1 / nC + 1 / nT));
  const altSE = Math.sqrt((pC * (1 - pC)) / nC + (pT * (1 - pT)) / nT);
  const threshold = quantile(testType === 'two-sided' ? 1 - alpha / 2 : 1 - alpha) * nullSE;
  const improvementPower = cdf((pC - pT - threshold) / altSE);
  return testType === 'one-sided'
    ? improvementPower
    : improvementPower + cdf((-(pC - pT) - threshold) / altSE);
}

export function sampleSize(
  pC: number,
  pT: number,
  desiredPower: number,
  alpha: number,
  ratio: number,
  testType: TestType,
) {
  let low = 1;
  let high = 2;
  const enough = (n: number) =>
    powerAt(n, n * ratio, pC, pT, alpha, testType) >= desiredPower;
  while (!enough(high)) {
    high *= 2;
    if (high > 1e10 || high * ratio > 1e10)
      throw new Error(
        'This effect requires more than 10 billion labels per arm. Try a larger detectable reduction.',
      );
  }
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (enough(mid)) high = mid;
    else low = mid;
  }
  let nC = enough(1) ? 1 : high;
  let nT = Math.max(1, Math.ceil(nC * ratio));
  // Integer allocation can very slightly change power; never round below target.
  while (powerAt(nC, nT, pC, pT, alpha, testType) < desiredPower) {
    nC++;
    nT = Math.max(1, Math.ceil(nC * ratio));
  }
  if (nC > 1e10 || nT > 1e10)
    throw new Error(
      'This allocation requires more than 10 billion labels in an arm. Use a more balanced allocation or a larger reduction.',
    );
  return { nC, nT, power: powerAt(nC, nT, pC, pT, alpha, testType) };
}

/** Fractional expected counts are supported only for the labeled precision forecast. */
export function wilson(count: number, n: number, confidence: number): Interval {
  if (n <= 0 || count < 0 || count > n)
    throw new Error('A confidence interval needs a valid, nonempty sample.');
  const p = count / n;
  const z = quantile(0.5 + confidence / 2);
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function differenceInterval(
  xC: number,
  nC: number,
  xT: number,
  nT: number,
  confidence: number,
): Interval {
  const pC = xC / nC;
  const pT = xT / nT;
  const [lC, uC] = wilson(xC, nC, confidence);
  const [lT, uT] = wilson(xT, nT, confidence);
  return [pC - pT - Math.hypot(pC - lC, uT - pT), pC - pT + Math.hypot(uC - pC, pT - lT)];
}

export function dateAt(start: string, elapsedDays: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + elapsedDays);
  const iso = date.toISOString();
  if (!/^\d{4}-/.test(iso))
    throw new Error(
      'The projected date exceeds the supported calendar range. Choose an earlier start date.',
    );
  return iso.slice(0, 10);
}

export function buildPlan(inputs: Inputs): Plan {
  const errors = validate(inputs);
  if (errors.length) throw new Error(errors.join(' '));
  const pC = inputs.baseline / 100;
  const pT =
    inputs.effectMode === 'relative' ? pC * (1 - inputs.effect / 100) : pC - inputs.effect / 100;
  const { dailyC, dailyT } = dailyVolumes(inputs);
  const alpha = inputs.alpha / 100;
  const sample = sampleSize(
    pC,
    pT,
    inputs.power / 100,
    alpha,
    dailyT / dailyC,
    inputs.testType,
  );
  const coverage = inputs.coverage / 100;
  const fundedC = Math.ceil(sample.nC / coverage);
  const fundedT = Math.ceil(sample.nT / coverage);
  let enrollmentDays = Math.ceil(Math.max(fundedC / dailyC, fundedT / dailyT));
  if (!Number.isFinite(enrollmentDays) || enrollmentDays > 36525)
    throw new Error(
      'This scenario takes more than 100 years. Increase daily volume or the detectable reduction.',
    );
  // Protect exact cohort boundaries from floating point underflow.
  while (
    Math.floor(Math.floor(enrollmentDays * dailyC) * coverage) < sample.nC ||
    Math.floor(Math.floor(enrollmentDays * dailyT) * coverage) < sample.nT
  )
    enrollmentDays++;
  const lagDays = inputs.labelLagDays;
  const finalDay = enrollmentDays + lagDays;
  if (finalDay > 36525)
    throw new Error(
      'This scenario takes more than 100 years. Increase daily volume or the detectable reduction.',
    );
  const elapsedDays = [0];
  for (let day = 7; day < finalDay; day += 7) elapsedDays.push(day);
  elapsedDays.push(finalDay);
  const confidence = inputs.confidence / 100;
  const weeks: Week[] = elapsedDays.map((day) => {
    const enrolledDays = Math.min(day, enrollmentDays);
    const completeDays = Math.max(0, Math.min(day - lagDays, enrollmentDays));
    const enrolledC = Math.floor(enrolledDays * dailyC);
    const enrolledT = Math.floor(enrolledDays * dailyT);
    const completeC = Math.floor(completeDays * dailyC);
    const completeT = Math.floor(completeDays * dailyT);
    const matureC = Math.floor(completeC * coverage);
    const matureT = Math.floor(completeT * coverage);
    return {
      day,
      week: day / 7,
      date: inputs.startDate ? dateAt(inputs.startDate, day) : undefined,
      enrolledC,
      enrolledT,
      matureC,
      matureT,
      pending: enrolledC + enrolledT - completeC - completeT,
      unavailable: completeC + completeT - matureC - matureT,
      expectedC: matureC ? wilson(matureC * pC, matureC, confidence) : null,
      expectedT: matureT ? wilson(matureT * pT, matureT, confidence) : null,
      expectedDifference:
        matureC && matureT
          ? differenceInterval(matureC * pC, matureC, matureT * pT, matureT, confidence)
          : null,
      projectedPower:
        matureC && matureT
          ? powerAt(matureC, matureT, pC, pT, alpha, inputs.testType)
          : null,
    };
  });
  const warnings: string[] = [];
  if (Math.min(sample.nC * pC, sample.nT * pT, sample.nC * (1 - pC), sample.nT * (1 - pT)) < 10)
    warnings.push(
      'Fewer than 10 expected bad or good outcomes in an arm at the target sample. Normal-approximation power may be unreliable; validate this scenario with a specialist method.',
    );
  if (inputs.coverage < 100)
    warnings.push(
      'Label coverage is an expected usable fraction. This assumes unavailable labels are unrelated to outcomes in both arms.',
    );
  if (finalDay > 730)
    warnings.push(
      'This plan spans more than two years. Changes in portfolio mix, traffic, or bad rates may make the forecast less reliable.',
    );
  return {
    inputs,
    dailyC,
    dailyT,
    pC,
    pT,
    delta: pC - pT,
    targetC: sample.nC,
    targetT: sample.nT,
    fundedC,
    fundedT,
    achievedPower: sample.power,
    enrollmentDays,
    lagDays,
    finalDay,
    enrollmentDate: inputs.startDate ? dateAt(inputs.startDate, enrollmentDays) : undefined,
    finalDate: inputs.startDate ? dateAt(inputs.startDate, finalDay) : undefined,
    weeks,
    warnings,
  };
}
