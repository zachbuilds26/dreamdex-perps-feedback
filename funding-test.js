const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider, formatUnits } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BANK = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const abs = (x) => (x < 0n ? -x : x);
const scale = 10n ** 18n;

async function sample(m, p) {
  const block = await p.getBlock('latest');
  const [st, prem] = await Promise.all([m.client.getPerpState(POOL), m.client.getPerpFundingPremium(POOL).catch(() => null)]);
  return { ts: BigInt(block.timestamp), st, prem };
}

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });

  const a = await sample(m, p);
  console.log('t0 block ts', a.ts.toString());
  console.log('rate         ', a.st.fundingRate.toString());
  console.log('cum settled  ', a.st.cumulativeFundingPerUnit.toString());
  console.log('cum projected', a.st.projectedCumulativeFundingPerUnit.toString());
  console.log('windowSec', a.st.fundingWindowSec, 'intervalSec', a.st.fundingIntervalSec);
  console.log('lastFundingUpdateAt', a.st.lastFundingUpdateAt.toString(), 'nextFundingAt', a.st.nextFundingAt.toString());
  console.log('emaPremium   ', a.st.emaPremium.toString());
  if (a.prem) console.log('premium: tw=', a.prem.timeWeightedPremium.toString(), 'last=', a.prem.lastObservedPremium.toString(), 'armed=', a.prem.armed);

  const pos = await m.client.getPerpPosition({ marginBank: BANK, account: ACCOUNT, pool: POOL });
  console.log('position size', pos.size.toString(), 'entryFundingIndex', pos.entryFundingIndex.toString());
  const owed = (-BigInt(pos.size) * (BigInt(a.st.projectedCumulativeFundingPerUnit) - BigInt(pos.entryFundingIndex))) / scale;
  console.log('funding owed at t0 (proj-entry, short sign -):', owed.toString(), '=', formatUnits(owed, 18), 'USDso');

  console.log('\nwaiting 150s ...');
  await sleep(150000);
  const b = await sample(m, p);
  const dt = b.ts - a.ts;
  const dProj = BigInt(b.st.projectedCumulativeFundingPerUnit) - BigInt(a.st.projectedCumulativeFundingPerUnit);
  const dSet = BigInt(b.st.cumulativeFundingPerUnit) - BigInt(a.st.cumulativeFundingPerUnit);
  console.log('\nt1 block ts', b.ts.toString(), 'dt', dt.toString(), 's');
  console.log('d projected', dProj.toString());
  console.log('d settled  ', dSet.toString());
  const rate = BigInt(a.st.fundingRate);
  if (rate !== 0n) {
    const expectedPerSec = rate / BigInt(a.st.fundingWindowSec);
    const expected = (rate * dt) / BigInt(a.st.fundingWindowSec);
    const ratio = (abs(dProj) * scale) / abs(expected || 1n);
    console.log('expected d (rate*dt/window)', expected.toString());
    console.log('observed/expected ratio (1e18 = 1.0):', ratio.toString(), '=', Number(ratio) / 1e18);
    const perSecFrac = Number(abs(dProj)) / Number(dt) / 1e18;
    const rateFrac = Number(abs(rate)) / 1e18;
    console.log('observed per-sec frac', perSecFrac.toExponential(6), 'rate/window', (rateFrac / a.st.fundingWindowSec).toExponential(6), 'rate/interval', (rateFrac / a.st.fundingIntervalSec).toExponential(6));
  } else {
    console.log('fundingRate = 0 at t0; projected delta =', dProj.toString());
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
