# dreamDEX Perps Bounty — Feedback Track findings

Six reproducible findings against the live Hideki testnet deployment and
`@somnia-chain/markets-sdk@0.32.1`. Each file has the exact calls, outputs, and tx hashes.

| # | Severity | Finding | Report |
|---|---|---|---|
| 1 | Major | Documented perp voucher `claim()` always reverts `0x3e31dcc2`; the app uses an undocumented privileged `grantTo(address[])` instead; `getPerpVoucherEligibility` still says eligible | [voucher-claim-broken.md](voucher-claim-broken.md) |
| 2 | Major | Bot gas top-up (`Send it ... for gas` / `Top up`) settles on Shannon `50312`, but perps gas is on Hideki `50383`; 40 STT + 65 USDso stranded on the wrong chain | [wrong-chain-bot-topup.md](wrong-chain-bot-topup.md) |
| 3 | Major | Trading wallet `0xAa9b...DB4b` has different owners per chain: the user's EOA is an owner on Shannon but not on Hideki, where the position and voucher live and an app EOA is the sole owner | [hideki-wallet-owner-mismatch.md](hideki-wallet-owner-mismatch.md) |
| 4 | Normal | `getMaxPerpOrderSize` returns `placeable: true` for off-tick prices (including the live mark) that the pool rejects with `InvalidPrice` | [max-order-size-offtick.md](max-order-size-offtick.md) |
| 5 | Normal | `projectedCumulativeFundingPerUnit` docstring says "unsettled accrual included", but the getter equals the settled cumulative mid-interval and never moves | [projected-funding-docstring.md](projected-funding-docstring.md) |
| 6 | Normal | Docs say "No backstop bidders are registered on testnet"; the LiquidationEngine reports one (`getBidderCount() = 1`) | [backstop-bidder-docs-mismatch.md](backstop-bidder-docs-mismatch.md) |

## Environment

- Hideki: chain `50383`, `https://api.hideki2.infra.testnet.somnia.network`
- Shannon: chain `50312`, `https://api.infra.testnet.somnia.network`
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`
- SDK: `@somnia-chain/markets-sdk@0.32.1`
- App: `https://app.testnet.dreamdex.io`
- Docs: `https://app.testnet.dreamdex.io/docs/developers/perps-testnet`,
  `https://app.testnet.dreamdex.io/docs/trading/common/link-a-bot`

## Reproducers

- `perp-tick-test.js` — off-tick `getMaxPerpOrderSize` vs `placeOrderFor` (finding 4)
- `perp-autopull-test.js` — mark-price sizing and `autoPull` (finding 4)
- `bot-balances.js` — bot balances on both chains (finding 2)
- `safe-owners.js` — `getOwners()` / `getThreshold()` on both chains (finding 3)
- `find-wrongchain-tx*.js`, `chain-compare.js` — funding trail (findings 2 and 3)
- `voucher-blocked.js`, `voucher-allowlist.js`, `max-consistency.js` — voucher allowlist and
  max/preview consistency checks (supporting evidence)
- `funding-proj-repro.js` — raw `getProjectedCumulativeFundingPerUnit` vs `getCumulativeFundingPerUnit`
  samples (finding 5); `funding-logs3.js`, `funding-verify.js` — hourly `FundingUpdated` settlement math
- `builder-fee-test.js`, `stop-auth-test.js`, `grantto-test.js`, `liq-test.js`, `funding-test.js` —
  adversarial probes that came back clean (see below)
- `batch-test.js` — `placeOrdersFor` per-item `successes[]` semantics (docs claim verified)
- `adl-test.js` — LiquidationEngine config, bidder list, and crafted `IAdlRanker.rank` inputs (finding 6)
- `final-sweep.js` — linked-wallet reads, indexer position vs chain, funding payments, margin events

## Probed and verified clean (no finding)

- Builder fees cannot be hijacked through the operator path: an operator placing with
  `builder = itself` and a fee reverts `BuilderFeeExceedsApproval()` (`0x528c953f`) when the
  owner has not approved that builder; perps cap `getMaxBuilderFeeBpsTimes1k() = 10000` (0.1%).
- Liquidation price kernel is exact: the SDK's `getLiquidationPrice` matches the contract's
  `equity == mmReq` identity (`p = mark + (equity - mmReq) * 1e4 / (|size| * (1e4 + mmBps))`).
- `VoucherDistributor.grantTo` is permissioned (reverts `0xdeeb0ebb` from non-owner callers).
- Perp stop creation is gated: unauthorized callers revert (empty data), and an authorized
  operator reverts `RegistryNotApprovedByOwner()` (`0x28e0a7ba`) unless the owner has approved
  the registry itself; `somiPaymentPerOrder() = 0.15e18` (native) per leg.
- Funding settlement math is correct: each hourly settlement adds `rate * price / 8`
  (`rate` per 28800 s window, 3600 s interval), verified against `FundingUpdated` logs.
- `SDK.pokeFunding` builds the permissionless `updateFunding()` call correctly (simulation accepted).
- `placeOrdersFor` batch semantics match the docs: refused requests flag `successes[i] = false`
  without reverting, hard validation errors (`InvalidPrice`) revert the whole batch, empty
  batch reverts `EmptyBatch`.
- Linked-wallet rail reads are consistent (registry `0x5b3C...3aFb`, no linkage/children/main
  funding for the account); indexer position row equals the chain read (size, entry price,
  funding index) and margin events match the known txs (voucher `grantTo`, order lock/unlock).
- ADL ranker orders candidates by profit / equity (descending); zero- and negative-equity
  candidates rank first, zero-size last; empty set returns `[]`; `markPrice = 0` reverts
  with a guard.

## Notes

- Findings 1 and 2 are Major because they break a documented onboarding/funding path and
  misdirect user funds; finding 3 is a custody/transparency gap in the docs.
- The docs' `limitedBy: "voucherBlocked"` case is currently unreachable: all 21 live markets
  return `isVoucherMarketAllowed(pool) = true`, so the docs' "Paper USDso blocks some markets"
  is stale for this campaign. Kept as supporting evidence, not a separate finding.
