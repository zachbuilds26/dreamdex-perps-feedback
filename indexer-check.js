const URL = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';

async function gql(query, variables) {
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  return { status: r.status, body: j ?? t.slice(0, 800) };
}

(async () => {
  const intro = await gql('{ Order(limit: 1, order_by: {placedAtTimestamp: desc}) { id orderId owner isBid price quantityRemaining fullQuantity status placedAtTimestamp placedTxHash pool } }');
  console.log('latest Order row:', JSON.stringify(intro, null, 2).slice(0, 1500));

  const mine = await gql('query($o: String!) { Order(where: {owner: {_eq: $o}}, order_by: {placedAtTimestamp: desc}, limit: 10) { id orderId owner isBid price quantityRemaining fullQuantity status placedTxHash placedAtTimestamp } }', { o: OWNER });
  console.log('\nmy orders (exact case):', JSON.stringify(mine, null, 2).slice(0, 2000));

  const mineLower = await gql('query($o: String!) { Order(where: {owner: {_eq: $o}}, order_by: {placedAtTimestamp: desc}, limit: 10) { orderId status quantityRemaining } }', { o: OWNER.toLowerCase() });
  console.log('\nmy orders (lowercase):', JSON.stringify(mineLower, null, 2).slice(0, 1200));

  const poolOrders = await gql('query($p: String!) { Order(where: {pool: {_eq: $p}}, order_by: {placedAtTimestamp: desc}, limit: 5) { orderId owner status placedAtBlock } }', { p: POOL.toLowerCase() });
  console.log('\npool latest orders:', JSON.stringify(poolOrders, null, 2).slice(0, 1200));
})().catch(e => console.log('ERR', e.message));
