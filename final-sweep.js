const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BANK = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const E18 = 10n ** 18n;
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x), 1);

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', undefined, { staticNetwork: true });

  const tryCall = async (label, fn) => {
    try {
      const r = await fn();
      console.log(`\n== ${label} ==\n${j(r)}`);
      return r;
    } catch (e) {
      console.log(`\n== ${label} == ERR ${(e.shortMessage || e.message).slice(0, 160)}`);
      return null;
    }
  };

  // 1) linked-wallet state
  const registry = await tryCall('getPerpLinkedWalletRegistry', () => m.client.getPerpLinkedWalletRegistry(BANK));
  if (registry) {
    await tryCall('getPerpWalletLinkage(ACCOUNT)', () => m.client.getPerpWalletLinkage(registry, ACCOUNT));
    await tryCall('listPerpLinkedChildren(ACCOUNT)', () => m.client.listPerpLinkedChildren(registry, ACCOUNT));
    await tryCall('getPerpMaxLinkedChildren', () => m.client.getPerpMaxLinkedChildren(registry));
  }
  await tryCall('getPerpMainFunding(BANK, ACCOUNT)', () => m.client.getPerpMainFunding(BANK, ACCOUNT));

  // 2) indexer vs chain position
  const chainPos = await tryCall('chain getPerpPosition', () => m.client.getPerpPosition({ marginBank: BANK, account: ACCOUNT, pool: POOL }));
  const idxPos = await tryCall('indexer listPerpPositions', () => m.client.listPerpPositions(ACCOUNT, { pool: POOL }));
  if (chainPos && idxPos?.length) {
    console.log('\nposition compare: chain size', chainPos.size.toString(), 'entry', chainPos.entryFundingIndex.toString(), '| idx', j(idxPos[0]));
  }

  // 3) funding payments vs chain cumulative funding delta
  const st = await m.client.getPerpState(POOL);
  const pays = await tryCall('getFundingPayments(ACCOUNT)', () => m.client.getFundingPayments(ACCOUNT, { pool: POOL, limit: 100 }));
  const k = await tryCall('getPerpState', () => st);
  if (pays) {
    const sum = pays.reduce((acc, r) => {
      const amt = BigInt(r.amount ?? r.payment ?? r.value ?? 0);
      return acc + amt;
    }, 0n);
    const dCum = BigInt(st.cumulativeFundingPerUnit) - BigInt(chainPos.entryFundingIndex);
    const chainFunding = (-BigInt(chainPos.size) * dCum) / E18;
    console.log(`\nfunding payments: ${pays.length} rows, sum=${sum} (${Number(sum) / 1e18} USDso)`);
    console.log(`chain estimate since entry: ${chainFunding} (${Number(chainFunding) / 1e18} USDso)  [positive = short receives]`);
  }

  // 4) fee records
  await tryCall('listPerpFees(ACCOUNT)', () => m.client.listPerpFees({ account: ACCOUNT, limit: 10 }));
  // 5) margin events
  const me = await tryCall('getMarginEvents(ACCOUNT)', () => m.client.getMarginEvents(ACCOUNT, { limit: 10 }));
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
