const { JsonRpcProvider, Contract } = require('ethers');
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const ABI = [
  'function getCurrentFundingRate() view returns (int256)',
  'function getCumulativeFundingPerUnit() view returns (int256)',
  'function getProjectedCumulativeFundingPerUnit() view returns (int256)',
  'function getOpenInterest() view returns (uint256)',
  'function getFundingParameters() view returns ((uint256 fundingCalculationWindowSec, uint256 fundingSettlementIntervalSec, int256 interestRatePerWindow, uint256 maxFundingRatePerWindow, uint256 dampener, uint256 emaSmoothingAlpha, uint256 maxOracleStalenessSec))',
  'function getLastFundingUpdateTimestampNs() view returns (uint256)',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function snap(c, p) {
  const b = await p.getBlock('latest');
  const [rate, cum, proj, oi, params, last] = await Promise.all([
    c.getCurrentFundingRate(), c.getCumulativeFundingPerUnit(), c.getProjectedCumulativeFundingPerUnit(),
    c.getOpenInterest(), c.getFundingParameters(), c.getLastFundingUpdateTimestampNs(),
  ]);
  return { ts: BigInt(b.timestamp), rate, cum, proj, oi, win: params[0], iv: params[1], lastNs: last };
}

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const c = new Contract(POOL, ABI, p);
  const a = await snap(c, p);
  console.log('t0 ts', a.ts.toString());
  console.log('rate', a.rate.toString());
  console.log('settled', a.cum.toString());
  console.log('projected', a.proj.toString());
  console.log('proj==settled:', a.proj === a.cum);
  console.log('openInterest', a.oi.toString());
  console.log('window', a.win.toString(), 'interval', a.iv.toString());
  const elapsed = a.ts - a.lastNs / 1000000000n;
  const nowNs = a.ts * 1000000000n;
  console.log('elapsed since last settlement (s)', elapsed.toString(), 'of interval', a.iv.toString());
  const dueIn = a.iv - elapsed;
  console.log('settlement due in (s)', dueIn.toString());
  await sleep(60000);
  const b = await snap(c, p);
  console.log('\nt1 ts', b.ts.toString(), 'dt', (b.ts - a.ts).toString());
  console.log('settled', b.cum.toString(), 'delta', (b.cum - a.cum).toString());
  console.log('projected', b.proj.toString(), 'delta', (b.proj - a.proj).toString());
  console.log('proj==settled:', b.proj === b.cum);
  const expectContinuous = (a.rate * (b.ts - a.ts)) / a.win;
  const expectWholeInterval = expectContinuous / a.iv;
  console.log('expected proj delta if continuous (rate*dt/window):', expectContinuous.toString());
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
