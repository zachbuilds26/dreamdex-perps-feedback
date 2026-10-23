# Bot gas top-up (`Send it ... for gas` / `Top up`) settles on Shannon 50312, but perps gas is on Hideki 50383

Severity: major
Area: app

The docs route perps gas funding through the app's bot flow and name Hideki `50383` as the
perps network, but the app's Send/Top up executes on the account chain, Shannon `50312`.
A bot funded this way receives STT and USDso on a chain where the perps contracts do not
exist, and the failure is silent.

## Steps to reproduce

1. In the app (`app.testnet.dreamdex.io`), link the bot `0x0A1105948aA23799d4399ef0db267262b5a431D9`
   to the account wallet `0x8e210068b73591C6E316cA13F1C27B36f4691251`.
2. Use the documented gas flow: **Send it ... for gas** / **Top up**. Observed: 30 STT, then
   10 STT, plus two USDso sends to the same bot address (50, then 15).
3. Read the bot's balances on both chains:

   - Shannon `50312`: `https://api.infra.testnet.somnia.network`
   - Hideki `50383`: `https://api.hideki2.infra.testnet.somnia.network`
   - USDso Shannon: `0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171`,
     USDso Hideki: `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72`

Reproduction scripts: `bot-balances.js` (balances on both chains), `find-wrongchain-tx*.js`
and `chain-compare.js` (funding trail).

## Expected

STT to pay for perps gas arrives on Hideki `50383`, as the perps docs describe ("Gas coin STT"
on the network table naming only chain `50383`), or the flow warns which chain it settles on.

## Actual

All four transfers settled on Shannon `50312`; the bot's Hideki balance is unchanged and
cannot pay for perps orders. The app shows the transfer succeeding and the bot keeps showing
"gas low" on Hideki, inviting another top-up that also lands on Shannon.

| Asset | Shannon `50312` | Hideki `50383` |
|---|---|---|
| Native STT | **40.0** | 9.98249347 (developer-funded, used for trading) |
| USDso | **65.0** (`0x9c32…b171`) | 0.0 (`0xed79…4F72`) |
| Bot nonce | **0** (never sent a transaction) | 8 (placed/cancelled orders) |

## Evidence

### Transactions (2026-10-22, all on Shannon `50312`, blocks 521,355,665 – 521,358,859)

Sender is the app's account Safe `0x8e210068b73591C6E316cA13F1C27B36f4691251`; the outer
transaction is submitted by the app relayer `0xC4ab4435b093CB6B4Ad7Ae6d7AEaC00eD7BDcCBe`
via `execTransaction`.

| Tx | Time (UTC) | Inner call | Amount |
|---|---|---|---|
| `0x7963c0ff23f8c3176aa0a0ea7acf17cf1ee0e360ab7d47c6118026995a235527` | 22:59:39 | `CALL bot` with empty data | **30 STT** |
| `0x51e5b3cf311e62a298f866dc52688e8729cf65ec569990b29ace4de189b71125` | 23:00:01 | `CALL bot` with empty data | **10 STT** |
| `0x22bf5f747c39ddfd783b0c6197a0f2caa5c9a4619bdb55e14bb9e6ab04d112a4` | 22:55:05 | `USDso.transfer(bot, 50e18)` | **50 USDso** |
| `0x3e99137cc5a85ce66a26e059271bd5ea01424fe0bc095f8bfbe48b22a0d1ebfb` | 23:00:24 | `USDso.transfer(bot, 15e18)` | **15 USDso** |

That this is the app's own flow (not a random wallet) is confirmed by the same app relayer
`0xC4ab…DCBe`, which at 23:11:47 submitted
`0xa4a3e4af83e9956944cfd37a1a28f7a35202b1bc0c9928068ef62e486d357c9e` on Shannon: an
`execTransaction` on the user's trading wallet `0xAa9b…DB4b` calling
`addOwnerWithThreshold(0x351F…F5D5, 1)`.

### What the docs say

`docs/developers/perps-testnet` (Network table):

> **Chain ID** `50383`
> **RPC** `https://api.hideki2.infra.testnet.somnia.network`
> **Gas coin** STT

`docs/developers/perps-testnet` (Get test funds):

> **STT for gas.** The simplest route is through the app: sign in at
> [app.testnet.dreamdex.io/perps](https://app.testnet.dreamdex.io/perps), then Link a Bot with
> your key's address and use **Send it ... for gas** or **Top up**.

`docs/trading/common/link-a-bot` (Step 3 and Step 4):

> 3. Leave **Send it ... for gas** on to send the bot gas from this wallet as soon as access is
>    granted.
>
> If the gas runs low, press **Top up** on the bot's row, enter an amount and send it
> (**Send STT** on testnet).

Neither page says which chain the Send/Top up executes on. The only chain named on the perps
page is Hideki `50383`, so a reader reasonably expects the STT to arrive there.

## Environment

- SDK: `@somnia-chain/markets-sdk@0.32.1`
- Network: Somnia Tokyo testnet — Shannon `50312` (`https://api.infra.testnet.somnia.network`)
  and Hideki `50383` (`https://api.hideki2.infra.testnet.somnia.network`)
- Wallet addresses: bot `0x0A1105948aA23799d4399ef0db267262b5a431D9`,
  account Safe `0x8e210068b73591C6E316cA13F1C27B36f4691251`,
  trading wallet `0xAa9b198E1D34567c208178591005bF7C520fDB4b`
- App: `https://app.testnet.dreamdex.io` (Link a Bot / Bots tab)
- Docs: `https://app.testnet.dreamdex.io/docs/developers/perps-testnet`,
  `https://app.testnet.dreamdex.io/docs/trading/common/link-a-bot`

## Suggested fix

1. **Docs:** state the chain explicitly, e.g. "Top up sends STT on the account chain
   (Shannon `50312`); perps gas is on Hideki `50383`", and warn that Shannon funds cannot pay
   for Hideki transactions.
2. **App:** execute Send/Top up on Hideki (or bridge Shannon → Hideki) and show the bot's
   Hideki balance in the Bots tab.
3. **Recovery:** document how affected users retrieve wrong-chain funds (the bot key can still
   move them on Shannon).

## Impact

A user following the documented flow ends up with 40 STT + 65 USDso stranded on the wrong
chain; a real user would have no way to move them to the trading chain. The incident is
reproducible for every new bot setup that uses the documented gas flow.
