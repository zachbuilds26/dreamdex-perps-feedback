const { JsonRpcProvider, id, AbiCoder } = require('ethers');

const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const TOPIC = id('FundingUpdated(int256,int256,uint256,uint64,uint256)');
const coder = AbiCoder.defaultAbiCoder();
const ranges = [[30981000, 30982000], [31018000, 31019000], [31054000, 31055000], [31090000, 31091000]];

(async () => {
  const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', undefined, { staticNetwork: true });
  const rows = [];
  for (const [from, to] of ranges) {
    const logs = await p.getLogs({ address: POOL, topics: [TOPIC], fromBlock: from, toBlock: to });
    for (const l of logs) {
      const [rate, cum, idx, k, mark] = coder.decode(['int256', 'int256', 'uint256', 'uint64', 'uint256'], l.data);
      const blk = await p.getBlock(l.blockNumber);
      rows.push({ block: l.blockNumber, ts: blk.timestamp, rate, cum, idx, k, mark });
    }
  }
  rows.sort((a, b) => a.block - b.block);
  console.log('block      ts          k rate            dCum                   dCum/(rate*k/8)      idx                    mark');
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const dCum = b.cum - a.cum;
    const kEff = b.k > 8n ? 8n : b.k;
    const unit = (a.rate * kEff) / 8n;
    const impliedP = unit !== 0n ? (dCum * 10n ** 18n) / unit : 0n;
    const ratioIdx = b.idx !== 0n ? (impliedP * 1000000n) / b.idx : 0n;
    const ratioMark = b.mark !== 0n ? (impliedP * 1000000n) / b.mark : 0n;
    console.log([b.block, b.ts, b.k.toString(), a.rate.toString(), dCum.toString(), impliedP.toString(), b.idx.toString(), b.mark.toString(), 'idxRatio(ppm)=' + ratioIdx, 'mkRatio(ppm)=' + ratioMark].join('  '));
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
