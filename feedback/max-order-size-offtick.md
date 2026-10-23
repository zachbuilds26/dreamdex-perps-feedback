# `getMaxPerpOrderSize` returns `placeable: true` for off-tick prices the pool rejects

Severity: normal
Area: SDK

`getMaxPerpOrderSize` does not validate that the supplied `price` sits on the market's
`tickSize`. For an off-tick price it still returns a size and `placeable: true`, and
`previewPerpOrderMargin` returns `sufficient: true`, while the pool rejects the same order
with `InvalidPrice(price, tickSize)`.

## Steps to reproduce

1. Ask the helper for a size at an off-tick price (e.g. `80,000.05`; tick is `0.1`):

   ```js
   const pool = "0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0";
   const marginBank = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394";
   const account = "0xAa9b198E1D34567c208178591005bF7C520fDB4b";

   const max = await markets.client.getMaxPerpOrderSize({
     pool, marginBank, account, isBid: true,
     price: 80000050000000000000000n,
   });
   // max.placeable === true, max.maxQuantity === 24861000n,
   // max.limitedBy === "initialMargin", max.lockAmount === 528680330425000000000n
   ```

2. Send the same order through the pool:

   ```js
   await poolContract.placeOrderFor.staticCall(
     account, true, 0n, 80000050000000000000000n, 24861000n,
     expiry, 0, 0, ZeroAddress, 0n, { from: bot }
   );
   // reverts InvalidPrice(80000050000000000000000, 100000000000000000)
   // selector 0xaf608abb
   ```

Reproduction scripts: `perp-tick-test.js` (output below), `perp-autopull-test.js` (live
mark-price case).

## Expected

Either the helper validates the price grid (throw `InvalidInputError` or snap to the nearest
valid tick and say so), or `placeable` / `sufficient` are documented as not covering price
validity. The field docs promise more than that today:

> The largest quantity that passes every placement gate, **aligned down to the pool's lot
> grid** — what a Max button should fill in.

and the docs present the helper as the pre-send check:

> `getMaxPerpOrderSize` tells you the largest order the account can place (`maxQuantity`) and
> which limit binds it (`limitedBy`), so check it before sending rather than reading a revert
> afterwards.

An off-tick price means no order can be placed at that price, so the reported size does not
pass every gate; `placeable` is documented as only "whether `maxQuantity` clears the pool's
`minQuantity`", so the helper has no price-validity signal at all.

## Actual

For every off-tick price tested the helper reports `placeable: true` and the pool reverts
`InvalidPrice`:

| Input price | `getMaxPerpOrderSize` | Pool `placeOrderFor` |
|---|---|---|
| `80000.0` (on tick) | `placeable: true`, max `24861000` | accepts |
| `80000.05` (off tick) | `placeable: true`, max `24861000` | reverts `InvalidPrice(80000050000000000000000, 1e17)` |
| `80000.01` (off tick) | `placeable: true`, max `24851000` | reverts `InvalidPrice(80000010000000000000000, 1e17)` |
| `0.05` (below one tick) | `placeable: true`, max `10011644000` | reverts `InvalidPrice(50000000000000000, 1e17)` |
| `0.1` (one tick) | `placeable: true`, max `10011644000` | accepts |

This matters because the natural input for sizing is the **live mark price**, which is not
tick-aligned (`getPerpState().markPrice` was `81400947330452935000000`; `% 1e17 =
47330452935000000`). A bot that sizes at the mark (the common "max at market" pattern) passes
a price the helper accepts and the pool rejects.

## Evidence

- Matrix above; exact `maxQuantity`/`lockAmount` values move with the block and the account's
  equity, but the `placeable: true` + `InvalidPrice` mismatch is stable across blocks (re-ran
  at a later block with the same result).
- `previewPerpOrderMargin` does not validate the tick either: at `80000.05` for the same
  quantity it returned `sufficient: true` (`lockAmount: 528680330425000000000`,
  `imRequirement: 473876458628733843922`), so a UI that gates on `sufficient` also sends the
  doomed order. (`sufficient` tracks margin only and moves with the block; the
  `placeable`/`InvalidPrice` mismatch is the stable part.)
- The docs' snippet uses `parseUnits("100000", 18)`, which happens to be on the tick, so the
  documented example does not catch this.

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet, Hideki, chain ID `50383`, RPC `https://api.hideki2.infra.testnet.somnia.network`
- Market: BTC perp pool `0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0`,
  marginBank `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`
- Pool tick from `getOrderBookParameters()`: `tickSize = 100000000000000000` (0.1)
- Wallet addresses: account `0xAa9b198E1D34567c208178591005bF7C520fDB4b`,
  operator bot `0x0A1105948aA23799d4399ef0db267262b5a431D9`

## Suggested fix

- Validate `price % tickSize === 0` in `getMaxPerpOrderSize` and either throw
  `InvalidInputError` or snap to the nearest valid tick (and say which).
- Mirror that in `previewPerpOrderMargin` so `sufficient` is not `true` for an unplaceable
  price.
- Alternatively, document that `placeable`/`sufficient` do **not** cover price validity and
  that callers must align first; today the `maxQuantity` field doc promises "every placement
  gate".
