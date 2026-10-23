const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider, Contract } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const provider = new JsonRpcProvider(hidekiTestnet.rpcUrls.default.http[0], 50383);

  console.log('=== funding history (positional) ===');
  const fh = await m.client.listFundingRateHistory(pool, { limit: 3 });
  console.log(j(fh));

  console.log('\n=== getMaxPerpOrderSize ===');
  for (const isBid of [true, false]) {
    const r = await m.client.getMaxPerpOrderSize({
      pool,
      marginBank: bank,
      account: ACCOUNT,
      isBid,
      price: 80000n * 10n ** 18n,
    });
    console.log(isBid ? 'BID(buy)' : 'ASK(sell)', j(r));
  }

  console.log('\n=== margin preview at max / max+lot ===');
  for (const isBid of [true, false]) {
    const max = await m.client.getMaxPerpOrderSize({
      pool,
      marginBank: bank,
      account: ACCOUNT,
      isBid,
      price: 80000n * 10n ** 18n,
    });
    for (const [label, qty] of [
      ['max', BigInt(max.maxQuantity)],
      ['max+lot', BigInt(max.maxQuantity) + 1000n],
    ]) {
      try {
        const pv = await m.client.previewPerpOrderMargin({
          pool,
          marginBank: bank,
          account: ACCOUNT,
          isBid,
          quantity: qty,
          price: 80000n * 10n ** 18n,
        });
        console.log(
          `${isBid ? 'BID' : 'ASK'} ${label} qty=${qty} increasing=${pv.increasingQuantity} ` +
            `reducing=${pv.reducingQuantity} im=${pv.imRequirement} sufficient=${pv.sufficient} ` +
            `meetsIM=${pv.meetsInitialMargin} limitedBy=${max.limitedBy}`
        );
      } catch (e) {
        console.log(`${isBid ? 'BID' : 'ASK'} ${label} qty=${qty} ERR ${(e.shortMessage || e.message).slice(0, 160)}`);
      }
    }
  }

  console.log('\n=== leverage consistency ===');
  const lev = await m.client.getPerpLeverage({ marginBank: bank, pool, account: ACCOUNT });
  const ana = await m.client.getPerpPositionAnalytics({ marginBank: bank, pool, account: ACCOUNT });
  console.log('getPerpLeverage:', j(lev));
  console.log('analytics       :', j(ana));

  console.log('\n=== mark price: indexer row vs on-chain state vs pool view ===');
  let poolAbi = null;
  try {
    const sdk = require('@somnia-chain/markets-sdk');
    const cand = Object.keys(sdk).filter((k) => /abi/i.test(k));
    console.log('sdk abi exports:', cand.join(','));
    poolAbi = sdk.perpPoolReadAbi || sdk.perpPoolAbi || null;
  } catch (e) {
    console.log('abi export err', e.message);
  }
  let markView = null;
  if (poolAbi) {
    try {
      const c = new Contract(pool, poolAbi, provider);
      const fn = c.getFunction ? c.getFunction('getMarkPrice') : null;
      if (fn) markView = await fn.staticCall();
      else console.log('getMarkPrice not in pool ABI');
    } catch (e) {
      console.log('direct getMarkPrice ERR', (e.shortMessage || e.message).slice(0, 120));
    }
  }

  for (let i = 0; i < 4; i++) {
    const mk = await m.client.getPerpMarket('0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0');
    const st = await m.client.getPerpState(pool);
    console.log(
      `${new Date().toISOString()} row.mark=${mk.markPrice} rowUpdatedAt=${mk.markPriceUpdatedAt} ` +
        `state.mark=${st.markPrice} index=${st.indexPrice} indexUpdatedAt=${st.indexUpdatedAt} ` +
        (markView !== null ? `pool.mark=${markView}` : '')
    );
    if (i < 3) await sleep(20000);
  }

  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message, e.info ?? '');
  process.exit(1);
});
