const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const show = (rows) => rows.map((r) => ({ id: r.id, pool: r.pool ?? r.market?.poolAddress, status: r.status, ended: r.endedAt ?? r.lastUpdatedAtTimestamp }));

  console.log('=== no filter ===');
  const all = await m.client.listPerpOrderHistory(ACCOUNT);
  console.log(all.length, j(show(all)));

  console.log('\n=== pool filter (BTC) ===');
  const byPool = await m.client.listPerpOrderHistory(ACCOUNT, { pool });
  console.log(byPool.length, j(show(byPool)));

  console.log('\n=== pool filter (lowercase) ===');
  const byPoolLc = await m.client.listPerpOrderHistory(ACCOUNT, { pool: pool.toLowerCase() });
  console.log(byPoolLc.length, j(show(byPoolLc)));

  console.log('\n=== status Cancelled ===');
  const cancelled = await m.client.listPerpOrderHistory(ACCOUNT, { status: ['Cancelled'] });
  console.log(cancelled.length, j(show(cancelled)));

  console.log('\n=== status Filled ===');
  const filled = await m.client.listPerpOrderHistory(ACCOUNT, { status: ['Filled'] });
  console.log(filled.length, j(show(filled)));

  console.log('\n=== status Open (should exclude working) ===');
  const open = await m.client.listPerpOrderHistory(ACCOUNT, { status: ['Open'] });
  console.log(open.length, j(show(open)));

  console.log('\n=== pagination limit=2 offset=0 / 2 ===');
  const p1 = await m.client.listPerpOrderHistory(ACCOUNT, { limit: 2, offset: 0 });
  const p2 = await m.client.listPerpOrderHistory(ACCOUNT, { limit: 2, offset: 2 });
  console.log('page1', j(show(p1)));
  console.log('page2', j(show(p2)));
  console.log('overlap?', p1.some((a) => p2.some((b) => a.id === b.id)));

  console.log('\n=== limit 0 / negative / huge ===');
  for (const limit of [0, -1, 100000]) {
    try {
      const r = await m.client.listPerpOrderHistory(ACCOUNT, { limit });
      console.log(`limit=${limit} -> ${r.length}`);
    } catch (e) {
      console.log(`limit=${limit} ERR ${(e.shortMessage || e.message).slice(0, 140)}`);
    }
  }

  console.log('\n=== positions includeFlat ===');
  for (const includeFlat of [false, true]) {
    const r = await m.client.listPerpPositions(ACCOUNT, { includeFlat });
    console.log(`includeFlat=${includeFlat} -> ${r.length}`, j(r.map((x) => ({ pool: x.pool, size: x.size }))));
  }

  console.log('\n=== position changes filters ===');
  const pc = await m.client.listPerpPositionChanges({ account: ACCOUNT });
  console.log('changes', pc.length, j(pc.map((x) => ({ kind: x.kind, before: x.sizeBefore, after: x.sizeAfter }))));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message, e.info ?? '');
  process.exit(1);
});
