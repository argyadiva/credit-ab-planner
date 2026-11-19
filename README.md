# CreditLab — Credit A/B Test Calculator

[Open the calculator](https://credit-ab-planner.vercel.app).

A browser-only calculator for credit-score A/B test sample sizes, time until analysis, and projected weekly confidence intervals. Enter six assumptions; results update automatically. All results are deterministic projections from those assumptions.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Calculator inputs

The six essential inputs start blank:

- **Baseline bad-loan rate:** expected bad outcomes among funded loans in control.
- **Expected reduction:** relative percent or percentage points, with the implied treatment rate displayed.
- **Power:** probability of detecting the assumed effect at the final analysis under the model.
- **Confidence level:** two-sided confidence level; alpha is one minus confidence.
- **Funded loans per day:** total across both arms, averaged over calendar days.
- **Total label delay:** days from funding to a usable outcome, including the observation window and reporting delay. Zero is supported.

Advanced settings default to 50/50 control/treatment allocation and 100% usable labels. Start date and outcome description are optional. Dates appear only when a start date is supplied. **Try an example** explicitly loads illustrative values; **Reset** clears essential inputs and restores advanced defaults.

There are no uploads, accounts, data connections, database, analytics, random-outcome simulations, or server-side calculations. Share links contain manually entered aggregate assumptions. The application does not send calculation inputs to a backend.

## Results

The calculator shows labeled-sample targets per arm and total, collection days, and **collection days + label delay = total duration**. Label coverage increases the required funded volume when some loans are expected to lack usable final labels. A chart and accessible weekly table show projected usable samples, arm bad-rate confidence intervals, and the interval for the bad-rate reduction.

Weeks with no usable labels are summarized in the table and can be expanded. CSV export includes every week, including day zero, all assumptions, forecast intervals, and optional dates. Assumption rates use percent units; weekly rates and reduction intervals are exported as fractions, with the conversion stated in the CSV. User-written spreadsheet formulas are escaped as literal text while negative numeric interval bounds remain numeric.

## Statistical methods

Let `pC` and `pT` be the assumed control and treatment bad rates. Positive reduction means `pC - pT`. Relative reduction `r` gives `pT = pC * (1-r)`; an absolute reduction subtracts percentage points from the baseline rate.

Sample size uses the normal approximation to a two-sided pooled-null z-test for independent proportions. For proposed sizes `nC` and `nT`:

```text
alpha = 1 - confidence
pooled = (nC*pC + nT*pT) / (nC+nT)
SE0 = sqrt(pooled*(1-pooled)*(1/nC + 1/nT))
SE1 = sqrt(pC*(1-pC)/nC + pT*(1-pT)/nT)
critical = normal_quantile(1-alpha/2) * SE0
power = Phi((pC-pT-critical)/SE1) + Phi((-(pC-pT)-critical)/SE1)
```

Integer bisection finds the control target for the chosen treatment/control ratio. Treatment size is rounded upward and achieved approximate power is checked again after rounding. This is a fixed-horizon superiority design, not an exact binomial or sequential design.

Arm-rate intervals use Wilson's score method. Reduction intervals use Newcombe's hybrid method combining the Wilson intervals. Forecast intervals substitute expected bad counts `n*p`, which may be fractional. These illustrate projected precision and are not observed-data confidence intervals or a guarantee of statistical significance.

### Timing and coverage

Daily funded volume, allocation, coverage, and bad rates are constant deterministic assumptions. For coverage `c`, required funded volume is `ceil(labeled target / c)` in each arm. Collection lasts until both arms can supply their required usable sample, rounded to whole calendar days. This may collect more loans than the minimum target.

For elapsed day `d`, collection spans `min(d, collectionDays)` days. Fully followed cohorts span `max(0, min(d - labelLagDays, collectionDays))` days. Funded counts are floored to integers, then usable counts are floored after coverage is applied. Pending and unavailable labels are excluded from the bad-rate denominator. Even outcomes known early remain excluded until the cohort completes the full delay, avoiding selective inclusion of early bad events.

Collection stops at the funded target; follow-up continues for the final cohorts. Total duration is collection plus label delay. Optional calendar dates use UTC calendar arithmetic to avoid daylight-saving shifts, with the start date representing day zero.

### Reference example

A 10% baseline, 10% relative reduction to 9%, 80% power, and 95% confidence require **13,495 labels per arm**. At 500 funded loans per calendar day, split 50/50 with complete labels, sample collection takes **54 days**. A 97-day label delay gives **151 total days** until analysis. Adding November 19, 2026 as the start date gives collection completion on January 12, 2027 and analysis on April 19, 2027.

## Applicability and limits

- Independent borrowers, with one analyzed loan each; repeat-borrower clustering is not modeled.
- Comparable funding rates across scoring policies. Portfolio bad-rate comparisons do not isolate a score's causal effect on the same funded borrowers.
- Missing labels are unrelated to outcomes and have the same expected coverage in both arms. Coverage is an expectation, not a guarantee of exact future counts.
- Stable calendar-day volume, population mix, and bad rates. No seasonality, variable maturity curves, survival analysis, or loss modeling.
- One planned final analysis. Weekly projections do not authorize early stopping.
- Normal-approximation power can be unreliable for rare events or small samples. Final expected event counts below ten are flagged; early weekly intervals may still be imprecise.
- Boundary bad rates, zero reduction, nonpositive volume/coverage, more than 10 billion labels per arm, and durations above 100 years are rejected.

## Shared-link compatibility

New links use `v=2`, with `dailyLoans` and `labelLagDays`, and optional `startDate`/`outcome`.

Version-1 links remain readable. Their daily applicants multiplied by funding percentage become funded loans per day; observation plus reporting days become total label delay. Baseline, reduction mode, power, confidence, allocation, coverage, and optional descriptions/dates are preserved. Legacy random seeds are ignored. Malformed or unsupported scenarios receive an explanation rather than silently calculating invalid inputs.

## Validation and deployment

Tests cover independent statistical references for balanced and unequal allocation, Wilson/Newcombe intervals, equivalent reduction modes, timing and label coverage, optional dates, zero delay, blank/invalid assumptions, both link versions, and safe forecast CSV export. Browser QA covers automatic updates, keyboard navigation, sharing/export, and desktop/mobile layouts.

The public repository is `argyadiva/credit-ab-planner`, linked to the existing `credit-ab-planner` project in the `argyadivas-projects` Vercel team. Pushes to `main` trigger production deployments; other branches and pull requests receive Vercel previews. GitHub Actions runs tests and the production build for `main` pushes and pull requests. Vercel uses Node.js 24, `npm ci`, `npm run build`, and Vite's `dist` output. No runtime secrets or environment variables are required.

For a manual deployment from an authenticated machine, run `npx vercel deploy --prod` and select the existing project.

## References

- [statsmodels: independent-proportions power](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html)
- [statsmodels: Newcombe difference-interval implementation](https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/proportion.py)
- [NIST: Wilson confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
