const { JsonRpcProvider, id, AbiCoder } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const TOPIC = id('FundingUpdated(int256,int256,uint256,uint64,uint256)');
const coder = AbiCoder.defaultAbiCoder();

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const latest = await p.getBlockNumber();
  console.log('latest block', latest);
  const span = 400000;
  const chunk = 10000;
  let logs = [];
  for (let from = latest - span; from <= latest; from += chunk) {
    const to = Math.min(from + chunk - 1, latest);
    try {
      const part = await p.getLogs({ address: POOL, topics: [TOPIC], fromBlock: from, toBlock: to });
      logs = logs.concat(part);
      console.log(`chunk ${from}-${to}: ${part.length} logs`);
    } catch (e) {
      console.log(`chunk ${from}-${to}: ERR ${(e.shortMessage || e.message).slice(0, 80)}`);
    }
  }
  logs.sort((a, b) => a.blockNumber - b.blockNumber);
  console.log('total logs', logs.length);
  const rows = [];
  for (const l of logs) {
    const [rate, cum, idx, k, mark] = coder.decode(['int256', 'int256', 'uint256', 'uint64', 'uint256'], l.data);
    const blk = await p.getBlock(l.blockNumber);
    rows.push({ block: l.blockNumber, ts: blk.timestamp, rate, cum, idx, k, mark });
  }
  console.log('\nblock        ts          dt   k  rate            dCum                     expected(rate*k/8)         ratio');
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const dCum = b.cum - a.cum;
    const dt = b.ts - a.ts;
    const kEff = b.k > 8n ? 8n : b.k;
    const expected = (a.rate * kEff) / 8n;
    const ratio = expected !== 0n ? Number((dCum * 1000n) / expected) / 1000 : NaN;
    console.log([b.block, b.ts, dt, b.k.toString(), a.rate.toString(), dCum.toString(), expected.toString(), ratio].join('  '));
  }
  if (rows.length) {
    const last = rows[rows.length - 1];
    console.log('\nlast log: rate', last.rate.toString(), 'cum', last.cum.toString(), 'k', last.k.toString(), 'mark', last.mark.toString(), 'idx', last.idx.toString());
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
