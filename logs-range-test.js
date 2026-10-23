const { JsonRpcProvider, id } = require('ethers');
const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', undefined, { staticNetwork: true });
const T = id('FundingUpdated(int256,int256,uint256,uint64,uint256)');
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
(async () => {
  const L = await p.getBlockNumber();
  console.log('latest', L);
  for (const c of [50, 200, 1000, 5000]) {
    try {
      const r = await p.getLogs({ address: POOL, topics: [T], fromBlock: L - c, toBlock: L });
      console.log(c, 'ok', r.length);
    } catch (e) {
      console.log(c, 'ERR', (e.shortMessage || e.message).slice(0, 90));
    }
  }
  process.exit(0);
})();
