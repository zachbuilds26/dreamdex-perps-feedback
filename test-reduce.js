const { JsonRpcProvider, Wallet, Contract, Interface } = require('ethers');
const { contractErrorsAbi } = require('@somnia-chain/markets-sdk');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ZERO = '0x0000000000000000000000000000000000000000';
const G = 10n ** 18n;
const OTHER = '0x6354CC1E363457Da8976a68D717F2B1Aec190b7C';

const abi = [
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
  'function cancelOrderFor(address owner, uint128 orderId)',
  'function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)',
  'function getAllOpenOrdersOffChain(bool isBid, uint256 maxCount, uint64 startCursor) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs)[] orders, bool hasMoreOrders, uint64 nextCursor)',
];
const errIface = new Interface(contractErrorsAbi);
function decode(e) {
  const data = e.data ?? e.info?.error?.data ?? null;
  if (!data || data === '0x') return 'NO_DATA';
  try { const x = errIface.parseError(data); return x ? `${x.name}(${x.args.map(a => a.toString()).join(',')})` : 'PARSE_NULL'; }
  catch { return 'UNKNOWN ' + data.slice(0, 74); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function mine() { await sleep(2500); }

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const bot = new Wallet(process.env.BOT_KEY, p);
  const pool = new Contract(POOL, abi, p);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n;

  const tx = await pool.connect(bot).placeOrderFor(OWNER, true, 0n, 69000n * G, 26000n, expiry, 0, 0, ZERO, 0n, { gasLimit: 10_000_000n });
  const rec = await tx.wait();
  const id = BigInt(rec.logs[0].topics[1]);
  console.log('place 26000 -> tx', tx.hash, '| orderId', id.toString(), '0x' + id.toString(16));

  for (const [label, qty] of [['reduce to 13000 (valid)', 13000n], ['reduce UP to 14000', 14000n], ['reduce to 2000 (below min)', 2000n], ['reduce to 0', 0n]]) {
    try {
      await pool.reduceOrderFor.staticCall(OWNER, id, qty, { from: BOT });
      console.log(`[OK  ] ${label}`);
    } catch (e) { console.log(`[FAIL] ${label} -> ${decode(e)}`); }
  }

  const rtx = await pool.connect(bot).reduceOrderFor(OWNER, id, 13000n, { gasLimit: 5_000_000n });
  const rrec = await rtx.wait();
  console.log('reduce tx:', rtx.hash, '| status:', rrec.status);
  let book = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  console.log('after reduce:', book[0].filter(o => o[0] === id).map(o => ({ id: o[0].toString(), full: o[5].toString(), rem: o[6].toString() })));

  try { await pool.cancelOrderFor.staticCall(OTHER, id, { from: BOT }); console.log('[OK  ] cancel with wrong owner (unexpected)'); }
  catch (e) { console.log('[FAIL] cancel with wrong owner ->', decode(e)); }
  try { await pool.cancelOrderFor.staticCall(OWNER, 123456789n, { from: BOT }); console.log('[OK  ] cancel nonexistent id (unexpected)'); }
  catch (e) { console.log('[FAIL] cancel nonexistent id ->', decode(e)); }

  const ctx = await pool.connect(bot).cancelOrderFor(OWNER, id, { gasLimit: 5_000_000n });
  const crec = await ctx.wait();
  console.log('cancel tx:', ctx.hash, '| status:', crec.status);
  book = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  console.log('mine after cleanup:', book[0].filter(o => o.owner.toLowerCase() === OWNER.toLowerCase()).length);
})().catch(e => { console.error('FATAL:', e.shortMessage ?? e.message, '|', e.data ?? ''); process.exit(1); });
