# CreditLab — Credit A/B Test Calculator

[Open the calculator](https://credit-ab-planner.vercel.app).

A browser-only calculator for credit-score A/B test sample sizes, time until analysis, projected weekly confidence intervals, and detection power over time. Enter your assumptions; results update automatically. All results are deterministic projections from those assumptions.

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

Power defaults to **80%**, test type to **two-sided**, test alpha to **5%**, and displayed interval confidence to **95%**. These settings are editable. The baseline, improvement goal, funded volume, and label delay start blank:

- **Baseline bad-loan rate:** expected bad outcomes among funded loans in control.
- **Improvement to detect:** the assumed bad-rate reduction, entered as a relative percent or percentage points, with the implied treatment rate displayed. This is the effect the test is designed to detect versus no difference; it is not a guaranteed result or evidence that improvement exceeds a minimum threshold.
- **Power:** probability of detecting the assumed effect at the final analysis under the model.
- **Test type:** two-sided detects a treatment difference in either direction. One-sided tests only whether treatment lowers the bad-loan rate.
- **Significance level (alpha):** false-positive threshold used for test power and sample size. It is independent of interval confidence. Choose the test direction and alpha before reviewing experiment results.
- **Confidence level for displayed intervals:** confidence for the two-sided forecast intervals only. Changing it does not change test power or sample size.
- **Funded-loan volume:** choose total funded loans/day plus treatment allocation, or enter separate control and treatment daily volumes. Fractional calendar-day averages are supported; the combined daily volume must be above zero and at most 1 billion, with positive volume in each arm.
- **Total label delay:** days from funding to a usable outcome, including the observation window and reporting delay. Zero is supported.

The default volume mode is total plus allocation, with a 50/50 funded split. Switching modes converts valid entered volumes; invalid source volumes leave the destination fields blank. Only fields in the selected mode affect calculations. Advanced settings default to 100% usable labels. Start date and outcome description are optional. Dates appear only when a start date is supplied. **Try an example** explicitly loads illustrative values; **Reset** clears the baseline, improvement, volume, and delay assumptions and restores 80% power, two-sided testing at 5% alpha, 95% interval confidence, and advanced defaults.

There are no uploads, accounts, data connections, database, analytics, random-outcome simulations, or server-side calculations. Share links contain manually entered aggregate assumptions. The application does not send calculation inputs to a backend.

## Results

The calculator shows labeled-sample targets per arm and total, collection days, and **collection days + label delay = total duration**. Label coverage increases the required funded volume when some loans are expected to lack usable final labels. The chart shows two assumed bad-loan rates as percentages: control at the baseline and treatment at the expected rate. Each has its own projected confidence band, using that arm’s usable samples. Assumed rates stay flat while bands narrow; no estimates appear before usable labels exist. A second chart shows **projected detection power over time** from 0–100%, with a line at the selected power target. Its tooltips show the usable samples in each arm and the projected power; a single mature point is drawn with a marker. The accessible weekly table includes the same power estimates and sample counts alongside both arm-rate intervals and the interval for the bad-rate reduction.

Weeks with no usable labels are summarized in the table and can be expanded. CSV export includes every week, including day zero, all assumptions, forecast intervals, and optional dates. Assumption rates use percent units; weekly rates, reduction intervals, and the appended `forecast_detection_power` column are exported as fractions, with the conversion stated in the CSV. Power is blank until both arms have usable outcomes. User-written spreadsheet formulas are escaped as literal text while negative numeric interval bounds remain numeric.

## Statistical methods

Let `pC` and `pT` be the assumed control and treatment bad rates. Positive reduction means `pC - pT`. Relative reduction `r` gives `pT = pC * (1-r)`; an absolute reduction subtracts percentage points from the baseline rate.

Sample size uses a normal approximation to a pooled-null z-test for independent proportions. The selected one-sided test checks only for a reduction (`pC - pT > 0`); the two-sided test checks for a difference in either direction. For proposed sizes `nC` and `nT`:

```text
alpha = selected significance level
pooled = (nC*pC + nT*pT) / (nC+nT)
SE0 = sqrt(pooled*(1-pooled)*(1/nC + 1/nT))
SE1 = sqrt(pC*(1-pC)/nC + pT*(1-pT)/nT)
critical = normal_quantile(1-alpha/2) * SE0  # two-sided
critical = normal_quantile(1-alpha) * SE0    # one-sided
power = Phi((pC-pT-critical)/SE1)             # one-sided improvement tail
power = Phi((pC-pT-critical)/SE1) + Phi((-(pC-pT)-critical)/SE1)  # two-sided
```

Both volume modes resolve to control and treatment funded loans/day. Integer bisection finds the control target for the treatment/control daily-volume ratio. Treatment size is rounded upward and achieved approximate power is checked again after rounding. This is a fixed-horizon superiority design, not an exact binomial or sequential design. A one-sided test at 5% alpha permits a 5% false-positive chance in the improvement direction. The current two-sided 5% test allocates about 2.5% to each direction; a one-sided 2.5% alpha preserves that improvement threshold. Displayed forecast intervals are always two-sided and use their separate confidence setting; they do not determine the test result.

Arm-rate intervals use Wilson's score method. Reduction intervals use Newcombe's hybrid method combining the Wilson intervals. Forecast intervals substitute expected bad counts `n*p`, which may be fractional. These illustrate projected precision and are not observed-data confidence intervals or a guarantee of statistical significance.

### Interpreting power and more data

Weekly detection power uses the same `powerAt` formula with that week's actual projected mature control and treatment counts. It is unavailable until both counts are positive. The final forecast can exceed target power slightly because whole collection days produce more usable loans than the minimum targets.

For example, a 10% baseline and 10% relative improvement imply a 9% treatment bad rate. At 80% power, a two-sided test at 5% alpha estimates the sample needed to detect the assumed difference in either direction. A one-sided test at 5% alpha estimates the sample needed to detect the assumed reduction only. Smaller improvements need more data; more mature observations increase detection power and precision without changing the assumed bad rates. Merely waiting after every collected outcome has matured adds no information. Weekly projections do not authorize early stopping or guarantee a successful test.

### Timing and coverage

Daily funded volumes for each arm, coverage, and bad rates are constant deterministic assumptions. Unequal funded volumes are supported; usable label coverage and delay are shared between arms. For coverage `c`, required funded volume is `ceil(labeled target / c)` in each arm. Collection lasts until both arms can supply their required usable sample, rounded to whole calendar days. This may collect more loans than the minimum target.

The funding-to-outcome label delay is not application-to-disbursement time. For elapsed day `d`, collection spans `min(d, collectionDays)` days. Fully followed cohorts span `max(0, min(d - labelLagDays, collectionDays))` days. Funded counts are floored to integers, then usable counts are floored after coverage is applied. Pending and unavailable labels are excluded from the bad-rate denominator. Even outcomes known early remain excluded until the cohort completes the full delay, avoiding selective inclusion of early bad events.

Collection stops at the funded target; follow-up continues for the final cohorts. Total duration is collection plus label delay. Optional calendar dates use UTC calendar arithmetic to avoid daylight-saving shifts, with the start date representing day zero.

### Reference example

A 10% baseline, 10% relative reduction to 9%, 80% power, two-sided alpha of 5%, and 95% displayed interval confidence require **13,495 labels per arm**. At 500 funded loans per calendar day, split 50/50 with complete labels, sample collection takes **54 days**. A 97-day label delay gives **151 total days** until analysis. Adding November 19, 2026 as the start date gives collection completion on January 12, 2027 and analysis on April 19, 2027.

## Applicability and limits

- Independent borrowers, with one analyzed loan each; repeat-borrower clustering is not modeled.
- Different funded volumes across scoring policies are supported. Portfolio bad-rate comparisons do not isolate a score's causal effect on the same funded borrowers; differences in who gets funded may change the portfolio mix.
- Missing labels are unrelated to outcomes and have the same expected coverage in both arms. Coverage is an expectation, not a guarantee of exact future counts.
- Stable calendar-day volume, population mix, and bad rates. No seasonality, variable maturity curves, survival analysis, or loss modeling.
- One planned final analysis. Weekly projections do not authorize early stopping.
- Normal-approximation power can be unreliable for rare events or small samples. Final expected event counts below ten are flagged; early weekly intervals may still be imprecise.
- Boundary bad rates, zero reduction, nonpositive volume/coverage, more than 10 billion labels per arm, invalid or excessive per-arm/combined volumes, and durations above 100 years are rejected.

## Shared-link compatibility

New links use `v=4` and include the test type, alpha, interval confidence, and either `volumeMode=total` with `dailyLoans`/`treatmentShare`, or `volumeMode=separate` with `controlDailyLoans`/`treatmentDailyLoans`. Only the active volume inputs are serialized, alongside common assumptions and optional `startDate`/`outcome`. CSV assumptions include the test settings and resolved daily volumes for both arms.

Version-2 links remain readable in total-plus-allocation mode without changing their calculations. Version-1 through version-3 links retain their prior two-sided test calculations by deriving alpha as 100% minus the saved confidence.

Version-1 links remain readable. Their daily applicants multiplied by funding percentage become funded loans per day; observation plus reporting days become total label delay. Baseline, reduction mode, power, confidence, allocation, coverage, and optional descriptions/dates are preserved. Legacy random seeds are ignored. Explicit power and confidence values in old link versions are preserved; missing assumptions still prevent calculation rather than silently applying new defaults. Malformed or unsupported scenarios receive an explanation rather than silently calculating invalid inputs.

## Validation and deployment

Tests cover independent statistical references for balanced and unequal allocation, both test directions and alpha settings, Wilson/Newcombe intervals, independent interval confidence, equivalent reduction modes, timing and label coverage, optional dates, zero delay, blank/invalid assumptions, all four link versions, both volume modes and switching, arm-specific chart data, reference detection-power projections, pre-maturity power gaps and single-point forecasts, calculator defaults, and safe forecast CSV export. Browser QA covers automatic updates, keyboard navigation, sharing/export, and desktop/mobile layouts.

The public repository is `argyadiva/credit-ab-planner`, linked to the existing `credit-ab-planner` project in the `argyadivas-projects` Vercel team. Pushes to `main` trigger production deployments; other branches and pull requests receive Vercel previews. GitHub Actions runs tests and the production build for `main` pushes and pull requests. Vercel uses Node.js 24, `npm ci`, `npm run build`, and Vite's `dist` output. No runtime secrets or environment variables are required.

For a manual deployment from an authenticated machine, run `npx vercel deploy --prod` and select the existing project.

## References

- [statsmodels: independent-proportions power](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html)
- [statsmodels: Newcombe difference-interval implementation](https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/proportion.py)
- [NIST: Wilson confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
