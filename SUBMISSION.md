# DoraHacks Build — paste-ready submission text

## Title

dreamDEX Perps testnet — 6 reproducible API/SDK/docs findings (Feedback track)

## Description

Six reproducible findings from adversarial testing of the dreamDEX perps API, SDK
(`@somnia-chain/markets-sdk@0.32.1`), contracts, and docs on Somnia Tokyo testnet
(Hideki 50383 / Shannon 50312). Every item has exact calls, live outputs, and transaction
hashes; one Markdown file per issue in the repo's `feedback/` folder. A "probed and verified
clean" list is included so the same ground is not re-tested.

Major:
1. Perp voucher claim() always reverts with undocumented error 0x3e31dcc2 for every caller,
   while getPerpVoucherEligibility still reports eligible: true; the only working path is an
   undocumented, role-gated grantTo(address[]) used by the app backend.
2. Bot gas top-up ("Send it ... for gas" / "Top up") settles on Shannon 50312, but perps gas
   is on Hideki 50383 — a followed-the-docs user ends up with 40 STT + 65 USDso stranded on
   the wrong chain, silently.
3. The perps trading wallet's owners differ by chain: the user's login is an owner on Shannon
   but not on Hideki, where the position and the 1,000 USDso voucher live; the docs never
   state the Hideki wallet is app-custodied.

Normal:
4. getMaxPerpOrderSize returns placeable: true for off-tick prices (including the live mark
   price) that the pool rejects with InvalidPrice.
5. projectedCumulativeFundingPerUnit is documented as including unsettled accrual, but the
   getter is bit-identical to the settled cumulative mid-interval and never moves.
6. Docs state "No backstop bidders are registered on testnet", but the LiquidationEngine
   reports one (getBidderCount() == 1).

Environment: Somnia Tokyo testnet, Hideki 50383 (perps) and Shannon 50312 (account layer);
SDK @somnia-chain/markets-sdk@0.32.1.

How to reproduce: clone the repo, `npm install`, and run the per-finding scripts listed in
each report (read-only unless noted; a disposable bot key is supplied via the BOT_KEY env
variable for the few scripts that sign test transactions — no keys are committed).

## Repo

GitHub link: _(fill in after publishing)_
