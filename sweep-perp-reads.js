const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';

const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
const brief = (v) => {
  const s = j(v);
  return s && s.length > 220 ? s.slice(0, 220) + '...' : s;
};
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT after ${ms}ms`)), ms).unref?.()),
  ]).catch((e) => {
    throw Object.assign(e, { _label: label });
  });

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const markets = await m.client.listPerpMarkets();
  console.log(`markets: ${markets.length}`);
  console.log('symbols:', markets.map((x) => x.baseSymbol).join(','));

  const failures = [];
  const banks = new Map();
  const rows = [];

  for (const mk of markets) {
    const pool = mk.poolAddress;
    const bank = mk.marginBank;
    banks.set(String(bank).toLowerCase(), bank);
    const r = { symbol: mk.baseSymbol, pool, errors: {} };

    const probes = {
      state: () => m.client.getPerpState(pool),
      feed: () => m.client.getPerpFeedStatus(pool),
      premium: () => m.client.getPerpFundingPremium(pool),
      risk: () => m.client.getPerpRiskParams(pool),
    };
    for (const [name, fn] of Object.entries(probes)) {
      const t0 = Date.now();
      try {
        const out = await withTimeout(fn(), 20000, `${mk.baseSymbol}:${name}`);
        r[name] = out;
        r[name + 'Ms'] = Date.now() - t0;
      } catch (e) {
        r.errors[name] = `${e.shortMessage || e.message}`.slice(0, 160);
        failures.push({ symbol: mk.baseSymbol, probe: name, error: r.errors[name] });
      }
    }
    rows.push(r);
  }

  console.log('\n=== per-market probe failures ===');
  if (!failures.length) console.log('none');
  failures.forEach((f) => console.log(`${f.symbol} ${f.probe}: ${f.error}`));

  console.log('\n=== state summary ===');
  for (const r of rows) {
    if (r.state) {
      console.log(
        `${r.symbol.padEnd(8)} mark=${r.state.markPrice ?? '?'} ok=${r.state.markPriceOk} ` +
          `bid=${r.state.bestBidPrice ?? '?'} ask=${r.state.bestAskPrice ?? '?'} ` +
          `feedMs=${r.feedMs ?? 0} stateMs=${r.stateMs ?? 0}`
      );
    }
  }

  console.log('\n=== system config (per bank) ===');
  for (const [k, bank] of banks) {
    try {
      const cfg = await withTimeout(m.client.getPerpSystemConfig(bank), 20000, 'syscfg');
      console.log(k, brief(cfg));
    } catch (e) {
      console.log(k, 'ERROR', e.message.slice(0, 160));
    }
  }

  console.log('\n=== BTC account reads ===');
  const btc = markets.find((x) => x.baseSymbol === 'BTC');
  const ref = { marginBank: btc.marginBank, pool: btc.poolAddress, account: ACCOUNT };
  const accountProbes = {
    position: () => m.client.getPerpPosition(ref),
    analytics: () => m.client.getPerpPositionAnalytics(ref),
    leverage: () => m.client.getPerpLeverage(ref),
    maxLeverage: () => m.client.getPerpMaxLeverage(ref),
    collateralBasis: () => m.client.getPerpCollateralBasis(btc.marginBank, ACCOUNT),
    portfolio: () => m.client.getPerpPortfolio(ACCOUNT),
    ledger: () => m.client.listPerpPositions(ACCOUNT),
    changes: () => m.client.listPerpPositionChanges({ account: ACCOUNT }),
    rejections: () => m.client.listPerpOrderRejections({ owner: ACCOUNT }),
    marginPulls: () => m.client.listPerpMarginPulls({ account: ACCOUNT }),
    pullsByOrder: () => m.client.listPerpMarginPulls({ orderId: '8614629482422367682061' }),
    walletPull: () => m.client.getPerpWalletPullCapacity(btc.marginBank, ACCOUNT),
    linkageRegistry: () => m.client.getPerpLinkedWalletRegistry(btc.marginBank),
    voucher: () => m.client.getPerpVoucher(btc.marginBank, ACCOUNT),
    campaign: () => m.client.getPerpVoucherCampaign(btc.marginBank),
    eligibility: () => m.client.getPerpVoucherEligibility(btc.marginBank, ACCOUNT),
    stops: () => m.client.getPerpStopOrders([]),
    stopList: () => m.client.listPerpStopOrders(ACCOUNT),
    sideHolders: () => m.client.getPerpSideHolders({ marginBank: btc.marginBank, pool: btc.poolAddress, isLong: true }),
    sideHoldersShort: () => m.client.getPerpSideHolders({ marginBank: btc.marginBank, pool: btc.poolAddress, isLong: false }),
    orderMarginPreview: () =>
      m.client.previewPerpOrderMargin({
        pool: btc.poolAddress,
        marginBank: btc.marginBank,
        account: ACCOUNT,
        isBid: true,
        quantity: 13000n,
        price: 80000n * 10n ** 18n,
      }),
    liqPreview: () =>
      m.client.previewPerpLiquidationPrice({
        pool: btc.poolAddress,
        marginBank: btc.marginBank,
        account: ACCOUNT,
        isBid: false,
        quantity: 13000n,
        price: 80000n * 10n ** 18n,
      }),
    closePnl: () =>
      m.client.previewPerpClosePnl({
        pool: btc.poolAddress,
        marginBank: btc.marginBank,
        account: ACCOUNT,
        quantity: 11644000n,
        price: 80000n * 10n ** 18n,
      }),
    topUp: () =>
      m.client.quotePerpOrderTopUp({
        pool: btc.poolAddress,
        marginBank: btc.marginBank,
        account: ACCOUNT,
        lockAmount: 0n,
        feeHeadroom: 0n,
        increasingQuantity: 0n,
        price: 80000n * 10n ** 18n,
      }),
  };

  for (const [name, fn] of Object.entries(accountProbes)) {
    const t0 = Date.now();
    try {
      const out = await withTimeout(fn(), 20000, name);
      console.log(`${name.padEnd(22)} OK ${Date.now() - t0}ms ${brief(out)}`);
    } catch (e) {
      console.log(`${name.padEnd(22)} ERR ${Date.now() - t0}ms ${(e.shortMessage || e.message).slice(0, 200)}`);
    }
  }

  console.log('\n=== pool discovery ===');
  try {
    const statuses = await m.client.listPerpPoolStatuses({ factory: '0xE631fAEE547baeE07353E290f0562ea67d856560' });
    console.log('listPerpPoolStatuses:', statuses.length);
    console.log(brief(statuses.map((s) => ({ pool: s.pool, registered: s.registered ?? s.tradeable ?? null }))));
  } catch (e) {
    console.log('listPerpPoolStatuses ERR', e.message.slice(0, 200));
  }
  try {
    const tradeable = await m.client.listTradeablePerpPools({ factory: '0xE631fAEE547baeE07353E290f0562ea67d856560' });
    console.log('listTradeablePerpPools:', tradeable.length);
  } catch (e) {
    console.log('listTradeablePerpPools ERR', e.message.slice(0, 200));
  }

  require('fs').writeFileSync('sweep-perp-reads.json', j(rows));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
