# Trading wallet owners differ by chain: the user EOA is an owner on Shannon but not on Hideki, where the position and voucher live

Severity: major
Area: app

The app's trading wallet `0xAa9b198E1D34567c208178591005bF7C520fDB4b` is a Safe 1.5.0 deployed
at the same address on both Somnia testnets, but the two deployments have different owner
sets. On Hideki — the chain that holds the user's perps position and the 1,000 USDso paper
voucher — the only owner is an app-held EOA, so the user's login key cannot act on the wallet.
The docs never state this.

## Steps to reproduce

1. Read `getOwners()` / `getThreshold()` / `VERSION()` of `0xAa9b198E1D34567c208178591005bF7C520fDB4b`
   on both chains:

   ```js
   const safe = "0xAa9b198E1D34567c208178591005bF7C520fDB4b";
   const abi = [
     "function getOwners() view returns (address[])",
     "function getThreshold() view returns (uint256)",
     "function VERSION() view returns (string)",
   ];

   // Shannon: https://api.infra.testnet.somnia.network (50312)
   //   VERSION 1.5.0, threshold 1
   //   owners: 0x351F...F5D5 (user), 0x6D6e...92Ea
   // Hideki:  https://api.hideki2.infra.testnet.somnia.network (50383)
   //   VERSION 1.5.0, threshold 1
   //   owners: 0x6D6e...92Ea only
   ```

2. Check the app EOA: `eth_getCode(0x6D6e98d553a927ae18F5FfF3453226a2cE0B92Ea)` → `0x` on
   both chains (plain EOA; nonce 4 on Hideki, 0 on Shannon).
3. Trace the owner-add on Shannon: tx
   `0xa4a3e4af83e9956944cfd37a1a28f7a35202b1bc0c9928068ef62e486d357c9e`
   (2026-10-22 23:11:47 UTC) calls `addOwnerWithThreshold(0x351F…F5D5, 1)`. No equivalent
   transaction exists on Hideki.

Reproduction script: `safe-owners.js` (both chains).

## Expected

The docs' "Link a Bot" page presents the wallet as the user's own ("Let your own bot trade
one of your wallets without handing it your funds", "Fills, cancels and reduces always pay out
to your wallet") and never states that the perps wallet itself is owned by an app key on
Hideki, nor that the user's login is an owner only on Shannon. A reader reasonably concludes
the login controls the trading wallet on the chain where the money is; either that should hold
(owner sync on setup), or the custody model should be documented.

## Actual

| Chain | Threshold | Owners | User EOA `0x351F…F5D5` an owner? |
|---|---|---|---|
| Shannon `50312` | 1 | `0x351FEF8d75aF1625C9cfB696d433646D6114F5D5` (user), `0x6D6e98d553a927ae18F5FfF3453226a2cE0B92Ea` | **yes** |
| Hideki `50383` | 1 | `0x6D6e98d553a927ae18F5FfF3453226a2cE0B92Ea` only | **no** |

The Hideki deployment is the one that matters: it holds the user's position (short `0.11644`
BTC on pool `0x4181…94C0`), the linked bot's permissions, and the voucher (`getPerpVoucher`
reports `floor = 1000e18`, `claimed = true`). The user's login key cannot sign for that Safe,
so the user cannot withdraw, transfer, or act on the Hideki wallet without the app. The
Shannon ownership gives a false sense of self-custody — the two deployments' storage is
independent even though the address is identical, which also makes the mismatch easy to miss
in a block explorer.

## Evidence

- `safe-owners.js` output on both chains (table above).
- Owner-add tx (Shannon only): `0xa4a3e4af83e9956944cfd37a1a28f7a35202b1bc0c9928068ef62e486d357c9e`.
- Bot funding on Shannon (same app session): `0x7963c0ff…`, `0x51e5b3cf…` (see the
  wrong-chain top-up report; this asymmetry is the same root cause — the app's account layer
  lives on Shannon, while the Hideki deployment is left under the app key).
- Nonces: app EOA `0x6D6e…92Ea` nonce 4 on Hideki, 0 on Shannon.

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet — Shannon `50312` and Hideki `50383`
- Wallet addresses: trading wallet `0xAa9b198E1D34567c208178591005bF7C520fDB4b`,
  user EOA `0x351FEF8d75aF1625C9cfB696d433646D6114F5D5`,
  app EOA `0x6D6e98d553a927ae18F5FfF3453226a2cE0B92Ea`
- App: `https://app.testnet.dreamdex.io`
- Docs: `https://app.testnet.dreamdex.io/docs/trading/common/link-a-bot`

## Suggested fix

1. **If unintentional:** add the user's login address as an owner of the Hideki Safe (owner
   sync on account setup), so the two deployments match.
2. **If intentional (app-custodied session key):** document it explicitly on the Link a Bot
   and Perps pages — who owns the Hideki wallet, what the app key can do, and how a user
   recovers funds if the app is unavailable.
3. Show the owner set / custody model in the wallet UI, next to the address.

## Impact

The user cannot independently close the position, withdraw the USDso credit, or move funds
from the Hideki wallet; if the app key is lost or the app is unavailable, the balance is
stranded, and the docs offer no recovery path.
