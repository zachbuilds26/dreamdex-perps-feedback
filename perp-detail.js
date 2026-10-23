const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const mk = (await m.client.listPerpMarkets()).find((x) => x.baseSymbol === 'BTC');
  const ref = { marginBank: bank, pool, account: ACCOUNT };

  console.log('=== market info ===');
  console.log(j(mk));

  console.log('\n=== getPerpState ===');
  console.log(j(await m.client.getPerpState(pool)));

  console.log('\n=== getPerpFeedStatus ===');
  console.log(j(await m.client.getPerpFeedStatus(pool)));

  console.log('\n=== getPerpFundingPremium ===');
  console.log(j(await m.client.getPerpFundingPremium(pool)));

  console.log('\n=== getPerpRiskParams ===');
  console.log(j(await m.client.getPerpRiskParams(pool)));

  console.log('\n=== getPerpPortfolio ===');
  const pf = await m.client.getPerpPortfolio(ACCOUNT);
  console.log('trades:', pf.trades?.length, 'openOrders:', pf.openOrders?.length, 'positions:', pf.positions?.length);
  console.log(j(pf));

  console.log('\n=== previewPerpOrderMargin (bid 13000 @ 80000) ===');
  console.log(
    j(
      await m.client.previewPerpOrderMargin({
        pool,
        marginBank: bank,
        account: ACCOUNT,
        isBid: true,
        quantity: 13000n,
        price: 80000n * 10n ** 18n,
      })
    )
  );

  console.log('\n=== previewPerpLiquidationPrice ===');
  console.log(
    j(
      await m.client.previewPerpLiquidationPrice({
        pool,
        marginBank: bank,
        account: ACCOUNT,
        isBid: true,
        quantity: 13000n,
        price: 80000n * 10n ** 18n,
      })
    )
  );

  console.log('\n=== previewPerpClosePnl (full, price=mark) ===');
  const state = await m.client.getPerpState(pool);
  console.log(
    j(
      await m.client.previewPerpClosePnl({
        pool,
        marginBank: bank,
        account: ACCOUNT,
        quantity: 11644000n,
        price: state.markPrice,
      })
    )
  );

  console.log('\n=== stop orders {account} ===');
  console.log(j(await m.client.listPerpStopOrders({ account: ACCOUNT })));
  console.log('\n=== stop orders all, limit 3 ===');
  console.log(j(await m.client.listPerpStopOrders({ limit: 3 })));

  console.log('\n=== funding history ===');
  console.log(j(await m.client.listFundingRateHistory({ pool, limit: 3 })));
  console.log(j(await m.client.getFundingRateHistory({ pool, limit: 3 })));

  console.log('\n=== listPerpFees ===');
  console.log(j(await m.client.listPerpFees({ pool, limit: 3 })).slice(0, 800));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message, e.info ?? '');
  process.exit(1);
});
