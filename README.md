# dreamDEX Perps Builder Bounty — Feedback track submission

Six reproducible findings from stress-testing the dreamDEX perps API, SDK, and docs on the
Somnia Tokyo testnets (Hideki `50383` for perps, Shannon `50312` for the app account layer).

Each finding is one Markdown file in [`feedback/`](feedback/), in the bounty's required
format. Every claim was produced by live calls, simulations, or observed transactions — no
speculation. A list of adversarial probes that came back **clean** is kept in
[`feedback/README.md`](feedback/README.md) so the same ground is not re-tested.

## Findings

| # | Severity | Area | Finding |
|---|---|---|---|
| 1 | major | contracts | Documented perp voucher `claim()` always reverts `0x3e31dcc2`; app uses an undocumented privileged `grantTo(address[])`; eligibility still says eligible |
| 2 | major | app | Bot gas top-up settles on Shannon `50312` while perps gas is on Hideki `50383`; 40 STT + 65 USDso stranded |
| 3 | major | app | Trading wallet owners differ per chain: user EOA is an owner on Shannon but not on Hideki, where the position and voucher live |
| 4 | normal | SDK | `getMaxPerpOrderSize` returns `placeable: true` for off-tick prices the pool rejects with `InvalidPrice` |
| 5 | normal | SDK | `projectedCumulativeFundingPerUnit` docstring says "unsettled accrual included", but the getter never moves mid-interval |
| 6 | normal | docs | Docs say "No backstop bidders are registered on testnet"; the LiquidationEngine reports one |

## Layout

- `feedback/` — one report per finding, plus `README.md` (index + probed-clean list)
- `*.js`, `*.mjs` — reproduction scripts (Node.js, ethers v6 / viem)
- `sweep-perp-reads.json`, `chain-compare.js` etc. — supporting evidence outputs

## Running the reproducers

```bash
npm install
```

Read-only reproducers need nothing else:

```bash
node adl-test.js            # finding 6
node funding-proj-repro.js  # finding 5 (two samples, ~60 s apart)
node perp-tick-test.js      # finding 4
node safe-owners.js         # finding 3
node bot-balances.js        # finding 2
node repro-voucher.mjs      # finding 1 (read-only parts)
```

Scripts that sign test transactions use a disposable bot key passed via the environment —
no private keys are committed to this repository:

```powershell
$env:BOT_KEY="0x…"; node test-bot-order.js
```

```bash
BOT_KEY=0x… node test-bot-order.js
```

## Environment

- Hideki (perps): chain `50383`, `https://api.hideki2.infra.testnet.somnia.network`
- Shannon (account layer): chain `50312`, `https://api.infra.testnet.somnia.network`
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`
- SDK: `@somnia-chain/markets-sdk@0.32.1`
- App / docs: `https://app.testnet.dreamdex.io`
