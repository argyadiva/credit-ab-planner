# CreditLab — Credit A/B Test Planner

A browser-only planner for randomized credit-score experiments with delayed bad-loan labels. Calculate sample requirements, distinguish enrollment from outcome maturity, and explore weekly confidence intervals and seeded hypothetical experiments.

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

The application starts with blank assumptions. **Try an example** loads an explicitly illustrative scenario. Inputs are not sent to a backend. Shared URLs contain the entered aggregate assumptions, outcome description, and random seed. There is no borrower upload, account system, analytics, or database.

## Inputs and outputs

Enter the control bad-loan rate, expected reduction (relative percent or percentage points), statistical power, two-sided confidence level, calendar-day eligible unique applicants, shared funding rate, treatment allocation, full observation window, reporting delay, eventual usable-label coverage, start date, and bad-outcome definition.

Results include labeled-sample targets per arm, funded-loan targets adjusted for coverage, whole-day enrollment and final-readout milestones, weekly enrollment and label states, forecast and simulated bad-rate/reduction intervals, and weekly pointwise detection frequencies from 1,000 simulations. CSV export includes all weeks, inputs, forecast arm intervals, simulated counts and intervals, and Monte Carlo uncertainty.

## Statistical methods

Let `pC` and `pT` be the assumed control and treatment bad rates. Positive reduction means `pC - pT`. Relative reduction `r` gives `pT = pC × (1-r)`; absolute reduction subtracts percentage points from the control rate.

The sample-size calculation is the normal approximation to a two-sided pooled-null z-test for independent proportions. For proposed arm sizes `nC` and `nT`:

```text
alpha = 1 - confidence
pooled = (nC*pC + nT*pT) / (nC+nT)
SE0 = sqrt(pooled*(1-pooled)*(1/nC + 1/nT))
SE1 = sqrt(pC*(1-pC)/nC + pT*(1-pT)/nT)
critical = normal_quantile(1-alpha/2) * SE0
power = Phi((pC-pT-critical)/SE1) + Phi((-(pC-pT)-critical)/SE1)
```

Integer bisection finds the control sample target using the configured treatment/control ratio. Treatment sample size is rounded up, and achieved approximate power is rechecked after rounding. This is an approximate, fixed-horizon superiority design, not an exact binomial or sequential design.

Arm-rate intervals use Wilson's score method. Reduction intervals use the Newcombe hybrid method combining the arm Wilson intervals. Expected forecast intervals substitute expected bad counts `n*p`, including fractional counts; these are illustrations of precision, not observed-data confidence intervals. Simulated intervals use actual integer binomial counts. The pooled z-test used for detection and Newcombe interval are distinct methods and need not give exactly matching finite-sample decisions.

### Cohort timing

Traffic, funding, allocation, and label coverage are deterministic planning expectations. Let `c` be usable-label coverage. Required funded volume is `ceil(labeled target / c)` in each arm. Whole-day enrollment continues until both arms can supply their target usable labels, then stops. Whole-day rounding may enroll a few extra loans.

For elapsed day `d`, enrollment lasts `min(d, enrollmentDays)` days. Completed follow-up covers `max(0, min(d - observationDays - reportingDays, enrollmentDays))` days. Funded counts are floored to integers, followed by flooring usable-label counts after applying coverage. Pending loans have not finished follow-up; unavailable labels have finished follow-up but are excluded by the coverage assumption. Their sum with mature usable loans always equals total enrolled loans.

Date labels use elapsed days from midnight at the selected start date, with UTC calendar arithmetic to avoid daylight-saving shifts. For example, a 54-day enrollment period starting November 19, 2026 ends January 12, 2027. A further 97-day label lag gives an April 19, 2027 readout. Outcomes known early are still excluded until their cohort completes the full window, avoiding selective early inclusion of bad events.

### Simulations

A Web Worker generates 1,000 experiments using the seeded `@stdlib/random-base-binomial` generator. New bad-outcome counts are drawn only for new mature cohorts; past outcomes remain fixed across weekly looks. The selected path is the first experiment for that seed. Re-run increments the seed; scenario links preserve it.

Pointwise detection is the proportion of runs rejecting the two-sided pooled z-test **in the beneficial direction at that week**. Under no effect, this directional rejection rate is approximately `alpha/2`; the total two-sided false-positive rate is approximately `alpha`. Detection is not cumulative “ever significant” probability and does not permit early stopping. A 95% Wilson interval across runs reports Monte Carlo uncertainty, independently of the experiment confidence setting.

## Applicability and limits

- Independent borrowers, with one analyzed loan per borrower; repeated-borrower clustering is not modeled.
- Both policies use the same funding rate. Portfolio bad-rate comparisons at fixed lending volume do not isolate a causal score effect on a common set of funded borrowers.
- Missing labels are unrelated to outcomes and have the same expected coverage in both arms. Coverage is an expectation, not a guarantee of an exact future label count.
- Stable traffic, funding, population mix, and outcome rates; no seasonal traffic, changing maturity curve, competing risks, or survival analysis.
- No borrower-level monitoring, sequential testing, early-stopping boundaries, loss modeling, or approval-rate optimization.
- Sample-size power is a normal approximation. Small expected bad/good counts are flagged; early weekly approximations can be unreliable even if final samples are adequate.
- Boundary bad rates, zero reductions, and nonpositive traffic/coverage are rejected. Scenarios above 10 billion labels per arm or 100 years are rejected to preserve numerical and browser usability limits.

## Validation

The test suite covers SciPy reference sample sizes for balanced and unequal allocation, statsmodels/Newcombe and Wilson reference intervals, equivalent reduction modes, cohort accounting and delayed labels, coverage adjustments, date boundaries, invalid/shared inputs, safe CSV cells, seeded reproducibility, and Monte Carlo detection behavior under the alternative and the null.

Example: 10% control bad rate, 10% relative reduction to 9%, 80% power, and 95% confidence require 13,495 labeled loans per arm. With 1,000 daily applicants, 50% funding, 50/50 allocation, and complete coverage, enrollment takes 54 days. A 90-day observation window plus 7-day reporting delay gives a 151-day final readout.

## Deployment

The public source repository is `argyadiva/credit-ab-planner`. Vercel builds the uploaded source from the same tested GitHub commit and serves the Vite `dist` output using `vercel.json`. GitHub Actions runs `npm ci`, `npm test`, and `npm run build` for pushes and pull requests. No runtime secrets or environment variables are required.

The initial deployment uses direct source upload because the Vercel account does not have its GitHub integration installed. Future pushes run GitHub checks but do not automatically deploy. To enable automatic production deployments from `main` and pull-request previews, install the Vercel GitHub integration and connect this repository in the Vercel project's Git settings. This requires account-owner interaction; no credentials are stored in the repository.

For a manual deployment from an authenticated development machine, run `npx vercel deploy --prod` from this checkout and select the existing `credit-ab-planner` project in the `argyadivas-projects` team.

## References

- [statsmodels: independent-proportions power](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html)
- [statsmodels: Newcombe difference-interval implementation](https://github.com/statsmodels/statsmodels/blob/main/statsmodels/stats/proportion.py)
- [NIST: Wilson confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
- [Design-Based Confidence Sequences: repeated-peeking implications](https://arxiv.org/abs/2210.08639)
- [stdlib: binomial generator](https://github.com/stdlib-js/random-base-binomial)
