# Perp voucher `claim()` always reverts with undocumented error `0x3e31dcc2`, while `getPerpVoucherEligibility` reports `eligible: true`

Severity: major
Area: contracts

The documented "Get test funds" flow (`getPerpVoucherEligibility` → `claimPerpVoucher`) cannot
succeed on the live Hideki deployment: `claim()` reverts with `0x3e31dcc2` for every caller,
including the privileged relayer the app itself uses. Meanwhile the app grants vouchers through
an undocumented, role-gated `grantTo(address[])`, which SDK users cannot call.

## Steps to reproduce

1. Confirm the SDK's eligibility check says "eligible" for an unclaimed, flat account:
   `getConfig()` → campaign 2026-09-28 → 2026-12-28; `budgetRemaining()` ≥ grant;
   `isClaimed(account)` → false; `getActivePerpPools()` → `[]`; `getMainFundedPrincipal(account)` → 0.
   All six checks in `perp/voucher.ts:216-232` pass, so

   ```ts
   const eligibility = await markets.client.getPerpVoucherEligibility(btc.marginBank, account)
   // → { eligible: true, grantAmount: 1000000000000000000000n }
   ```

2. Call the documented write — `claim()` — as a funded EOA. Raw JSON-RPC:

   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "eth_call",
     "params": [
       {
         "from": "0x0A1105948aA23799d4399ef0db267262b5a431D9",
         "to": "0x2ACD9EFdA721450906bfE1bef3edE269636E42C4",
         "data": "0x4e71d92d"
       },
       "latest"
     ]
   }
   ```

   Response:

   ```json
   {"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted","data":"0x3e31dcc2"}}
   ```

3. Repeat from other callers and at historical blocks (see the revert matrix under Evidence).
   `eth_estimateGas` reverts identically, so the SDK cannot even estimate the transaction.

4. Observe what the app actually does. The user's smart account received its 1,000 USDso
   voucher in tx `0x5ed92931601c6e1560a4ba957ea26c44bfc795b213599363da4ee7c56889322b`
   (block `30593121`, 2026-10-23T00:42:27Z): `from` the app relayer
   `0x792182e6B2bd50dEB22dc5436F7C518b34F9bD12`, `to` the VoucherDistributor, selector
   **`0x0677d0a3` = `grantTo(address[])`**, calldata one `address[]` of 147 addresses,
   receipt status `1`, 441 logs.

5. Verify `grantTo` is privileged:

   ```
   eth_call grantTo([0x0A11…31D9]) from 0x0A11…31D9
   → revert 0xdeeb0ebb
   ```

Reproduction script: `repro-voucher.mjs` (viem + raw RPC) covers steps 1–2 end-to-end.

## Expected

Following the docs should credit the caller's perps account with 1,000 paper USDso (as the
app's batch grants do), or at minimum `getPerpVoucherEligibility()` should return
`{ eligible: false, reason: … }` and any failure should be a documented, decodable error.

## Actual

- `claimPerpVoucher()` reverts with `0x3e31dcc2`, which no SDK error decoder, docs page, or
  public signature database knows (`4byte.directory` returns `count: 0`).
- Eligibility reports `eligible: true` for an operation that cannot succeed.
- The only working path is the undocumented, role-gated `grantTo(address[])`.

## Evidence

### Revert matrix (all `0x3e31dcc2`)

| Caller | State | Result |
|---|---|---|
| `0x0A11…31D9` (funded EOA, 10 STT) | flat, unclaimed | `0x3e31dcc2` |
| `0x6354…0b7C` (fresh random EOA) | flat, unclaimed | `0x3e31dcc2` |
| `0xAa9b…DB4b` (user smart account) | open BTC short, `isClaimed=true` | `0x3e31dcc2` (expected `ClaimantNotFlat`/`AlreadyClaimed`) |
| `0x7921…bD12` (app's privileged relayer) | never claimed | `0x3e31dcc2` |

The revert also occurs at historical blocks **before** the campaign started (tested blocks
`9042857`…`9044857`, spanning 2026-09-27T23:58:20Z → 2026-09-28T00:01:40Z, campaign start
block `9043857`), so it is not a campaign-window comparison bug and not account-state-dependent.

### The error is undocumented

| Error | Selector | In SDK `contractErrorsAbi` | On Errors docs |
|---|---|---|---|
| `AlreadyClaimed()` | `0x646cf558` | yes | yes |
| `BudgetExhausted()` | `0x16394a52` | yes | yes |
| `CampaignInactive()` | `0xe72b39f9` | yes | yes |
| `ClaimantNotFlat()` | `0x3f3d2141` | yes | yes |
| `ClaimantIsMainFunded()` | `0x1fac9b7d` | yes | yes |
| **observed `0x3e31dcc2`** | **`0x3e31dcc2`** | **no** | **no** |

Static inspection of the implementation shows the revert is thrown from PC `0x0e86`
(function `0x0dbc`, entered from the `claim()` dispatcher at `0x033b`) after reading the
distributor's packed config word at storage slot
`0xb7eec95aff28cce8bff19b18abdccf660b86b19d20d482db65d20a29a05aa807` — a global flag check
that fails for every caller in this deployment.

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet, Hideki, chain ID `50383`, RPC `https://api.hideki2.infra.testnet.somnia.network`
- VoucherDistributor: `0x2ACD9EFdA721450906bfE1bef3edE269636E42C4` (ERC-1967 proxy),
  implementation `0x9657f0fd53efc01cd108d93c835bb4b517732b43` (unverified on the explorer)
- MarginBank: `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`
- Wallet addresses: bot EOA `0x0A1105948aA23799d4399ef0db267262b5a431D9`,
  user smart account `0xAa9b198E1D34567c208178591005bF7C520fDB4b`
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`

## Suggested fix

1. **Short term (docs):** state that paper USDso is granted by the app/backend via
   `grantTo(address[])` and that `claimPerpVoucher()` is not usable on this deployment.
2. **SDK:** if `claim()` is disabled on a deployment, `getPerpVoucherEligibility()` must detect
   it (e.g., simulate `claim()` and return the reverting reason) instead of `eligible: true`.
3. **SDK:** add `grantTo(address[])` and `0x3e31dcc2` to the ABIs/error tables, or remove the
   misleading `claimPerpVoucher` from the docs until the on-chain path works.
4. **Contract:** if `claim()` is meant to be user-callable, fix/initialize the flag; if it is
   intentionally disabled, revert with a named, documented error (e.g. `ClaimsDisabled()`).

## Impact

Every developer who follows the documented "Get test funds" flow cannot obtain paper USDso and
cannot trade perps on testnet, and the SDK's `eligible: true` answer is actively misleading —
finding the working path required a manual on-chain trace of the app relayer's transaction.
