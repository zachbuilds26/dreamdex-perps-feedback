const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const st = await m.client.getPerpState(pool);
  console.log('mark price:', st.markPrice, 'is tick-aligned?', BigInt(st.markPrice) % (10n ** 17n) === 0n);

  for (const [label, account] of [
    ['smart(voucher)', ACCOUNT],
    ['bot(no funds)', BOT],
  ]) {
    for (const autoPull of [false, true]) {
      try {
        const r = await m.client.getMaxPerpOrderSize({
          pool,
          marginBank: bank,
          account,
          isBid: true,
          price: BigInt(st.markPrice),
          autoPull,
        });
        console.log(
          `${label} autoPull=${autoPull} placeable=${r.placeable} max=${r.maxQuantity} ` +
            `limitedBy=${r.limitedBy} lock=${r.lockAmount} topUp=${r.topUpRequired} ` +
            `wallet=${r.wallet ? j(r.wallet) : 'null'} payer=${r.fundingPayer}`
        );
      } catch (e) {
        console.log(`${label} autoPull=${autoPull} ERR ${(e.shortMessage || e.message).slice(0, 160)}`);
      }
    }
  }

  console.log('\n--- preview at mark (off-tick) ---');
  const pv = await m.client.previewPerpOrderMargin({
    pool,
    marginBank: bank,
    account: ACCOUNT,
    isBid: true,
    price: BigInt(st.markPrice),
    quantity: 24861000n,
  });
  console.log(j(pv));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message);
  process.exit(1);
});
