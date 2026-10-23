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
  const campaign = await m.client.getPerpVoucherCampaign(bank);
  console.log('campaign:', j(campaign));

  const markets = await m.client.listPerpMarkets();
  console.log(`markets: ${markets.length}\n`);

  for (const mk of markets) {
    try {
      const pool = new Contract(mk.poolAddress, ABI, p);
      const [st, book] = await Promise.all([m.client.getPerpState(mk.poolAddress), pool.getOrderBookParameters()]);
      const mark = BigInt(st.markPrice);
      const tick = BigInt(book.tickSize);
      const lot = BigInt(book.lotSize);
      const min = BigInt(book.minQuantity);
      const snapped = tick > 0n ? (mark / tick) * tick : mark;
      const price = snapped > 0n ? snapped : tick;
      const r = await m.client.getMaxPerpOrderSize({
        pool: mk.poolAddress,
        marginBank: bank,
        account: ACCOUNT,
        isBid: true,
        price,
      });
      const flag = r.limitedBy === 'voucherBlocked' ? '  <-- VOUCHER BLOCKED' : '';
      console.log(
        `${(mk.baseSymbol || '?').padEnd(10)} tick=${tick} placeable=${r.placeable} max=${r.maxQuantity} ` +
          `limitedBy=${r.limitedBy} lock=${r.lockAmount}${flag}`
      );
    } catch (e) {
      console.log(`${(mk.baseSymbol || '?').padEnd(10)} ERR ${(e.shortMessage || e.message).slice(0, 140)}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
