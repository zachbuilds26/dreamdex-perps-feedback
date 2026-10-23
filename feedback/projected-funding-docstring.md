# `projectedCumulativeFundingPerUnit` does not include the open interval's accrual, contrary to its docstring

Severity: normal
Area: SDK

`PerpStateOnchain.projectedCumulativeFundingPerUnit` is documented in
`@somnia-chain/markets-sdk@0.32.1` as:

> Cumulative funding projected to now (unsettled accrual included)

On the live Hideki BTC pool, the on-chain getter `getProjectedCumulativeFundingPerUnit()`
returns a value **bit-identical** to `getCumulativeFundingPerUnit()` mid-interval and does not
move at all across a 63-second observation while the funding rate is non-zero. The "unsettled
accrual" the docstring promises is not observable; between settlements the field duplicates
the settled value.

## Steps to reproduce

1. Run `funding-proj-repro.js` (raw contract calls, no SDK involved): the script samples
   `getCumulativeFundingPerUnit()` and `getProjectedCumulativeFundingPerUnit()` twice, 60 s
   apart, plus `getFundingRate()`, `getOpenInterest()`, and the window/interval parameters.
2. Compare the two getters within an interval and across the two samples.

## Expected

Mid-interval, the projected getter should exceed the settled cumulative by the accrual of the
open interval (rate prorated over the window, applied to price), i.e. move continuously as
the docstring's "unsettled accrual included" says. A continuous projection would add
`rate / window * dt * price` to the 18-dp-quote-per-base field, i.e.
`1.505...e15 / 28800 * 63 * ~8.15e22 ≈ 2.7e35` over the observed 63 s — a change equal to
about 1e-4 of the field's magnitude, visible in the low digits of the integer.

## Actual

```
t0 ts 1792763827
rate                                 1505869689758955        (0.1506% per 28800s window)
settled     getCumulativeFundingPerUnit()          2986495947308051495397297107101865406250
projected   getProjectedCumulativeFundingPerUnit() 2986495947308051495397297107101865406250
proj==settled: true
openInterest                         33752019000            (non-zero)
window 28800  interval 3600
elapsed since last settlement: 2724 s of 3600 (settlement due in 876 s)

t1 ts 1792763890  dt 63
settled   delta 0
projected delta 0
proj==settled: true
expected proj delta if continuous (rate*dt/window) = 3294089946347   (raw rate units)
```

Observed delta over 63 s: exactly `0`.

## Evidence

- Script: `funding-proj-repro.js` (the output above is from a live run).
- The rate itself and the settlement proration are correct — only the "projected" getter
  never reflects the interval in progress. `FundingUpdated` logs show each hourly settlement
  adds `rate * price / 8` (e.g. `1.5e15 * 8.15e22 / 8 ≈ 1.53e37` per settlement, `dt = 3600 s`,
  `intervalsSettled = 1`), verified independently by `funding-logs3.js` / `funding-verify.js`.
- Re-verified later: mid-interval again `proj == settled` bit-for-bit
  (`3001984723235112375097258269997737906250` at `getPerpState()`), including after the hourly
  settlement and a `pokeFunding` call.

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet, Hideki, chain ID `50383`, RPC `https://api.hideki2.infra.testnet.somnia.network`
- Pool: BTC perp `0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0`
- Read-only reproduction — no wallet or signing needed.

## Impact

Any integrator or UI that renders "funding accrued since your last settlement" from this field
shows zero accrual for the entire interval and a lump at each hourly settlement, despite the
field being documented as including unsettled accrual. Either the docstring should say the
projection covers only completed intervals, or the getter should project the open interval.
