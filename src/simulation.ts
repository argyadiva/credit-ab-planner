import binomial from '@stdlib/random-base-binomial';
import { differenceInterval, quantile, wilson, type Interval, type Plan } from './model';

export interface SimWeek {
  day: number;
  countC: number;
  countT: number;
  rateC: number | null;
  rateT: number | null;
  intervalC: Interval | null;
  intervalT: Interval | null;
  difference: number | null;
  interval: Interval | null;
  detection: number | null;
  detectionInterval: Interval | null;
}
export interface Simulation {
  runs: number;
  seed: number;
  weeks: SimWeek[];
}

export function simulate(plan: Plan, runs = 1000, overrideRates?: [number, number]): Simulation {
  const random = binomial.factory({ seed: plan.inputs.seed });
  const [pC, pT] = overrideRates ?? [plan.pC, plan.pT];
  const detected = new Uint32Array(plan.weeks.length);
  const example: SimWeek[] = [];
  const threshold = quantile(0.5 + plan.inputs.confidence / 200);
  for (let run = 0; run < runs; run++) {
    let previousC = 0;
    let previousT = 0;
    let xC = 0;
    let xT = 0;
    plan.weeks.forEach((week, index) => {
      const incC = week.matureC - previousC;
      const incT = week.matureT - previousT;
      // Draw only new cohorts: previous outcomes stay fixed across weekly looks.
      if (incC) xC += random(incC, pC);
      if (incT) xT += random(incT, pT);
      previousC = week.matureC;
      previousT = week.matureT;
      const available = previousC > 0 && previousT > 0;
      const rateC = previousC ? xC / previousC : null;
      const rateT = previousT ? xT / previousT : null;
      const difference = available ? rateC! - rateT! : null;
      if (available) {
        const pooled = (xC + xT) / (previousC + previousT);
        const se = Math.sqrt(pooled * (1 - pooled) * (1 / previousC + 1 / previousT));
        // Two-sided rejection, in the planned beneficial direction.
        if (se > 0 && difference! / se > threshold) detected[index]++;
      }
      if (run === 0)
        example.push({
          day: week.day,
          countC: xC,
          countT: xT,
          rateC,
          rateT,
          intervalC: previousC ? wilson(xC, previousC, plan.inputs.confidence / 100) : null,
          intervalT: previousT ? wilson(xT, previousT, plan.inputs.confidence / 100) : null,
          difference,
          interval: available
            ? differenceInterval(xC, previousC, xT, previousT, plan.inputs.confidence / 100)
            : null,
          detection: null,
          detectionInterval: null,
        });
    });
  }
  return {
    runs,
    seed: plan.inputs.seed,
    weeks: example.map((week, index) => ({
      ...week,
      detection: week.difference === null ? null : detected[index] / runs,
      detectionInterval: week.difference === null ? null : wilson(detected[index], runs, 0.95),
    })),
  };
}
