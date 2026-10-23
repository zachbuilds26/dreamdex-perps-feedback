# Docs say no backstop bidders are registered on testnet; the live LiquidationEngine has one

Severity: normal
Area: docs

The perps docs page
[`trading/perps-testnet/margin-and-liquidations`](https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations)
states:

> No backstop bidders are registered on testnet, so the later stages come in sooner.

The LiquidationEngine the same page lists in its contract table
(`0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`) reports one registered bidder on the live
Hideki deployment.

## Steps to reproduce

1. Read the engine's bidder registry on Hideki (raw `eth_call`, no wallet):

   ```
   LiquidationEngine 0xA66d3C24Ad4a389d863846905D8173e1017e9F4D (chain 50383)

   getBidderCount() -> 1
   getBidders()     -> [0xAF327764345c2f54C1F2bc3322D28E4f633793b9]
   ```

2. Confirm the bidder is a deployed contract:
   `eth_getCode(0xAF327764345c2f54C1F2bc3322D28E4f633793b9)` → 176 bytes.

Reproduction script: `adl-test.js` (prints the engine config, bidder list, and crafted
`IAdlRanker.rank` inputs).

## Expected

Either no registered bidders (matching the docs sentence), or the docs sentence reflecting the
live engine state.

## Actual

One bidder is registered: `getBidderCount() = 1`, `getBidders() = [0xAF32…93b9]` — a deployed
contract, not a placeholder. The docs sentence is contradicted by the same deployment the page
documents.

For contrast, the same page's other liquidation claims check out against the same reads:
`getLiquidationPenaltyBps() = 100` ("a fee of up to 1%"), `getAdlRanker()` is armed
(`0x3d7466A217e375635386d3c5da30a82959DdB789`), and `getMaxAdlScanPerCall() = 500`.

## Evidence

```
getBidderCount()  -> 1
getBidders()      -> ["0xAF327764345c2f54C1F2bc3322D28E4f633793b9"]
getCode(bidder)   -> 176 bytes (deployed contract)
getLiquidationPenaltyBps() -> 100
getAdlRanker()    -> 0x3d7466A217e375635386d3c5da30a82959DdB789
getMaxAdlScanPerCall() -> 500
```

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet, Hideki, chain ID `50383`, RPC `https://api.hideki2.infra.testnet.somnia.network`
- Contract: LiquidationEngine `0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`
- Read-only reproduction — no wallet or signing needed.
- Docs: `https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations`

## Impact

A reader of the docs concludes stage-4 backstop takeover cannot happen on testnet and that the
waterfall drops through to the Insurance Fund and ADL sooner. With a bidder registered on the
engine, the takeover stage has an eligible participant, so the waterfall's behavior on testnet
no longer matches what the docs describe. The sentence should be removed or re-verified
against `getBidderCount()` before publishing.
