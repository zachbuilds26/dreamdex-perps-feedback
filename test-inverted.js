const { JsonRpcProvider } = require('ethers');
const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', 50383);
const DIST = '0x2ACD9EFdA721450906bfE1bef3edE269636E42C4';
const ACCT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const CAMPAIGN_START = 1790553600n;

(async () => {
  let lo = 8900000, hi = 9200000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await p.getBlock(mid);
    if (BigInt(b.timestamp) < CAMPAIGN_START) lo = mid + 1; else hi = mid;
  }
  const startBlock = lo;
  const b = await p.getBlock(startBlock);
  console.log('Campaign start block:', startBlock, 'ts:', b.timestamp, new Date(Number(b.timestamp) * 1000).toISOString());

  for (const offset of [-1000, -100, -1, 0, 100, 1000]) {
    const bn = startBlock + offset;
    const blk = await p.getBlock(bn);
    try {
      const res = await p.call({ from: ACCT, to: DIST, data: '0x4e71d92d' }, bn);
      console.log(`block ${bn} (${new Date(Number(blk.timestamp)*1000).toISOString()}): claim() CALL SUCCEEDED, ret=${res}`);
    } catch (e) {
      console.log(`block ${bn} (${new Date(Number(blk.timestamp)*1000).toISOString()}): claim() reverted ${e.data ?? e.info?.error?.data ?? '?'}`);
    }
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
