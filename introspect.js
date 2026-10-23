const URL = 'https://hideki-dev.smk.somnia.host/v1/graphql';
async function gql(q) {
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
}
(async () => {
  const j = await gql('{ __type(name: "Order") { fields { name type { name kind ofType { name } } } } }');
  if (j?.data?.__type) {
    console.log(j.data.__type.fields.map(f => `${f.name}:${f.type.name || f.type.ofType?.name || f.type.kind}`).join('\n'));
  } else console.log(JSON.stringify(j).slice(0, 800));

  console.log('\n--- orders by owner+pool (poolAddress?) ---');
  const q2 = await gql('query { Order(where: {owner: {_eq: "0xaa9b198e1d34567c208178591005bf7c520fdb4b"}, pool: {_eq: "0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0"}}, limit: 3) { orderId pool } }');
  console.log(JSON.stringify(q2).slice(0, 500));
})().catch(e => console.log('ERR', e.message));
