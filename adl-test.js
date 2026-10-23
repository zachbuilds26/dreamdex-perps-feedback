const { JsonRpcProvider, Contract } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const ENGINE = '0xA66d3C24Ad4a389d863846905D8173e1017e9F4D';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const USER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const E18 = 10n ** 18n;
const E = (n) => BigInt(n) * E18;
const A = (n) => '0x' + n.toString(16).padStart(40, '0');

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const engine = new Contract(ENGINE, [
    'function isLiquidatable(address account) view returns (bool)',
    'function getBidderCount() view returns (uint256)',
    'function getBidders() view returns (address[])',
    'function getAdlRanker() view returns (address)',
    'function getMaxAdlScanPerCall() view returns (uint256)',
    'function getMaxLiquidationVolumePerBlock() view returns (uint256)',
    'function getLiquidationPenaltyBps() view returns (uint256)',
    'function getMinLiquidationSpreadBps() view returns (uint256)',
    'function getMaxLiquidationSpreadBps() view returns (uint256)',
  ], p);

  const [liq, bidders, ranker, scan, vol, pen, minS, maxS] = await Promise.all([
    engine.isLiquidatable(USER), engine.getBidderCount(), engine.getAdlRanker(),
    engine.getMaxAdlScanPerCall(), engine.getMaxLiquidationVolumePerBlock(),
    engine.getLiquidationPenaltyBps(), engine.getMinLiquidationSpreadBps(), engine.getMaxLiquidationSpreadBps(),
  ]);
  console.log('isLiquidatable(USER) =', liq);
  console.log('bidderCount =', bidders.toString(), 'adlRanker =', ranker, 'maxAdlScanPerCall =', scan.toString());
  console.log('maxLiqVolumePerBlock =', vol.toString(), 'penaltyBps =', pen.toString(), 'spreadBps =', minS.toString(), '-', maxS.toString());

  if (ranker === '0x0000000000000000000000000000000000000000') {
    console.log('NO RANKER ARMED — ADL cannot run');
    process.exit(0);
  }
  const rankerC = new Contract(ranker, [
    'function rank(address bankrupt, (address account, address perpPool, int128 size, uint128 entryPrice, uint256 markPrice, int256 accountEquity)[] candidates) view returns (uint256[] ordering)',
  ], p);

  const cand = (account, sizeE8, entry, mark, equity) => ({ account, perpPool: POOL, size: sizeE8, entryPrice: entry, markPrice: mark, accountEquity: equity });
  const cases = [
    ['base: eq1000/E80k/M81k, eq500/E80k/M81k', [cand(A(1), 10000000n, E(80000), E(81000), E(1000)), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['sign: losing long mixed with winners', [cand(A(1), 10000000n, E(82000), E(81000), E(1000)), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['equity=0 profitable', [cand(A(1), 10000000n, E(80000), E(81000), 0n), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['equity<0', [cand(A(1), 10000000n, E(80000), E(81000), E(-10)), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['size=0', [cand(A(1), 0n, E(80000), E(81000), E(1000)), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['mark=0', [cand(A(1), 10000000n, E(80000), 0n, E(1000)), cand(A(2), 10000000n, E(80000), E(81000), E(500))]],
    ['empty', []],
    ['one candidate', [cand(A(1), 10000000n, E(80000), E(81000), E(1000))]],
    ['equal factors', [cand(A(1), 10000000n, E(80000), E(81000), E(1000)), cand(A(2), 20000000n, E(80000), E(81000), E(2000))]],
    ['swapped entry/mark (mark>entry as entry)', [cand(A(1), 10000000n, E(81000), E(80000), E(1000)), cand(A(2), 10000000n, E(81000), E(80000), E(500))]],
  ];
  for (const [label, candidates] of cases) {
    try {
      const r = await rankerC.rank(USER, candidates);
      console.log(`${label}: ordering=[${[...r].map(String).join(',')}]`);
    } catch (e) {
      const d = e.data ?? e.info?.error?.data ?? e.error?.data;
      console.log(`${label}: REVERT ${d ?? (e.shortMessage || e.message).slice(0, 120)}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
