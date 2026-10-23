const URL = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const OWNER = '0xaa9b198e1d34567c208178591005bf7c520fdb4b';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
async function gql(q, v) {
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: v }) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}
(async () => {
  const rows = await gql('query($o:String!){ Order(where:{owner:{_eq:$o}}, order_by:{placedAtTimestamp: desc}, limit:5){ orderId status pool market_id market { id poolAddress marketType } isBid price quantityRemaining fullQuantity } }', { o: OWNER });
  console.log('my orders with market:', JSON.stringify(rows, null, 2).slice(0, 2500));

  const mk = await gql('query($p:String!){ Market(where:{poolAddress:{_eq:$p}}){ id poolAddress marketType baseSymbol quoteSymbol } }', { p: POOL.toLowerCase() });
  console.log('\nBTC market row:', JSON.stringify(mk, null, 2).slice(0, 800));

  const mkAny = await gql('{ Market(limit:3, order_by:{id: asc}){ id poolAddress marketType } }');
  console.log('\nany markets:', JSON.stringify(mkAny, null, 2).slice(0, 800));
})().catch(e => console.log('ERR', e.message));
