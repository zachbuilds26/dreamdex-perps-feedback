const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const t = setTimeout(() => { console.log('TIMEOUT after 90s (WS hang?)'); process.exit(2); }, 90000);

  await m.loadMarkets();
  console.log('symbols:', m.symbols.length, '| BTC-ish:', m.symbols.filter(s => /BTC/i.test(s)));
  const sym = 'BTC/USDso:USDso';
  const mk = m.markets[sym];
  console.log('market key:', sym);
  console.log('market fields:', JSON.stringify(mk, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 900));

  const pool = mk.info.poolAddress; const bank = mk.info.marginBank;
  console.log('\npool:', pool, '| bank:', bank);

  const state = await m.client.getPerpState(pool);
  console.log('getPerpState:', JSON.stringify(state, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 700));

  const lev = await m.client.getPerpLeverage({ marginBank: bank, account: OWNER, pool });
  console.log('\ngetPerpLeverage:', JSON.stringify(lev, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 900));

  const port = await m.client.getPerpPortfolio(OWNER, { ordersLimit: 5, tradesLimit: 5 });
  console.log('\ngetPerpPortfolio:', JSON.stringify(port, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 1200));

  const hist = await m.client.listPerpOrderHistory(OWNER, { limit: 5 });
  console.log('\nlistPerpOrderHistory:', JSON.stringify(hist, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 900));

  const elig = await m.client.getPerpVoucherEligibility(bank, OWNER);
  console.log('\nvoucher eligibility:', JSON.stringify(elig, (k, v) => typeof v === 'bigint' ? v.toString() : v));

  const max = await m.client.getMaxPerpOrderSize({ pool, marginBank: bank, account: OWNER, isBid: true, price: 70000000000000000000000n });
  console.log('\ngetMaxPerpOrderSize:', JSON.stringify(max, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 900));

  clearTimeout(t);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.name, e.message); process.exit(1); });
