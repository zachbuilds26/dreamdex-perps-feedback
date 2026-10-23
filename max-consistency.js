const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider, Contract } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const ABI = ['function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))'];
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });

  for (const sym of ['BTC', 'ETH', 'SOL', 'ZEC', 'NEAR']) {
    const mk = (await m.client.listPerpMarkets()).find((x) => x.baseSymbol === sym);
    const pool = new Contract(mk.poolAddress, ABI, p);
    const [st, book] = await Promise.all([m.client.getPerpState(mk.poolAddress), pool.getOrderBookParameters()]);
    const tick = BigInt(book.tickSize);
    const lot = BigInt(book.lotSize);
    const price = (BigInt(st.markPrice) / tick) * tick;
    const max = await m.client.getMaxPerpOrderSize({ pool: mk.poolAddress, marginBank: bank, account: ACCOUNT, isBid: true, price });
    const pv = await m.client.previewPerpOrderMargin({
      pool: mk.poolAddress, marginBank: bank, account: ACCOUNT, isBid: true, price, quantity: max.maxQuantity,
    });
    const pvLess = max.maxQuantity > lot
      ? await m.client.previewPerpOrderMargin({
          pool: mk.poolAddress, marginBank: bank, account: ACCOUNT, isBid: true, price, quantity: max.maxQuantity - lot,
        })
      : null;
    console.log(`\n=== ${sym} price=${price} maxQty=${max.maxQuantity} lot=${lot} ===`);
    console.log(`max:     placeable=${max.placeable} limitedBy=${max.limitedBy} lock=${max.lockAmount} increasing=${max.increasingQuantity}`);
    console.log(`preview: sufficient=${pv.sufficient} meetsIM=${pv.meetsInitialMargin} lock=${pv.lockAmount} eq=${pv.equity} im=${pv.imRequirement} inc=${pv.increasingQuantity}`);
    if (pvLess) console.log(`preview(max-lot): sufficient=${pvLess.sufficient} lock=${pvLess.lockAmount} eq=${pvLess.equity} im=${pvLess.imRequirement}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
