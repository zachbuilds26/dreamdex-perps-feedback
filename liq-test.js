const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider, Contract, formatUnits } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
const fmt = (v) => (v === null ? 'null' : formatUnits(v, 18));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });

  const ref = { marginBank: bank, account: ACCOUNT, pool };
  const [liq, bankr, lev, pos, st, risk] = await Promise.all([
    m.client.getLiquidationPrice(ref),
    m.client.getBankruptcyPrice(ref),
    m.client.getPerpLeverage(ref),
    m.client.getPerpPosition(ref),
    m.client.getPerpState(pool),
    m.client.getPerpRiskParams(pool),
  ]);
  console.log('size          ', pos.size.toString());
  console.log('entry         ', pos.avgEntryPrice?.toString?.() ?? j(pos));
  console.log('mark          ', st.markPrice.toString());
  console.log('equity        ', lev.equity.toString());
  console.log('mmBps         ', risk.maintenanceMarginBps.toString(), ' imfBps', risk.initialMarginBps.toString());
  console.log('SDK liq price ', liq === null ? 'null' : liq.toString(), '=', fmt(liq));
  console.log('bankruptcy    ', bankr.toString(), '=', fmt(bankr));

  const S = -BigInt(pos.size);
  const E = BigInt(pos.avgEntryPrice);
  const Q = BigInt(lev.equity);
  const mm = BigInt(risk.maintenanceMarginBps);
  const BPS = 10000n;
  const one = 10n ** 18n;
  const trigger = ((Q + (S * E) / one) * BPS) / ((S * (BPS + mm)) / one);
  console.log('computed trigger (no funding) ', trigger.toString(), '=', fmt(trigger));
  const diffBps = liq ? ((liq - trigger) * BPS) / trigger : null;
  console.log('SDK vs computed diff (bps)   ', diffBps?.toString());

  const mark = BigInt(st.markPrice);
  const tick = 100000000000000000n;
  const price = (mark / tick) * tick;
  const pv = await m.client.previewPerpLiquidationPrice({ pool, marginBank: bank, account: ACCOUNT, isBid: true, quantity: 13000n, price });
  console.log('\npreview (reduce 13000):', j(pv));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
