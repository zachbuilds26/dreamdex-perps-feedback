const { JsonRpcProvider, Wallet, Contract } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';

const abi = [
  'function getAllOpenOrdersOffChain(bool isBid, uint256 maxCount, uint64 startCursor) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs)[] orders, bool hasMoreOrders, uint64 nextCursor)',
  'function cancelOrderFor(address owner, uint128 orderId) payable returns (bool success)',
];

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const bot = new Wallet(process.env.BOT_KEY, p);
  const pool = new Contract(POOL, abi, p);

  const bids = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  const asks = await pool.getAllOpenOrdersOffChain(false, 10, 0);
  console.log('bids:', bids[0].length, '| asks:', asks[0].length);
  const mine = bids[0].filter(o => o.owner.toLowerCase() === OWNER.toLowerCase());
  console.log('my resting bids:', mine.map(o => ({ id: o[0].toString(), hex: '0x' + o[0].toString(16), price: o[4].toString(), rem: o[6].toString(), exp: new Date(Number(o[7])/1e6).toISOString() })));
  if (!mine.length) { console.log('no resting bid found'); return; }

  const id = mine[0][0];
  const csim = await pool.cancelOrderFor.staticCall(OWNER, id, { from: bot.address });
  console.log('CANCEL SIMULATE OK:', csim);
  const ctx = await pool.connect(bot).cancelOrderFor(OWNER, id, { gasLimit: 5_000_000n });
  console.log('CANCEL tx:', ctx.hash);
  const rec = await ctx.wait();
  console.log('CANCEL STATUS:', rec.status, '| gasUsed:', rec.gasUsed.toString(), '| logs:', rec.logs.length);

  const after = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  const still = after[0].filter(o => o.owner.toLowerCase() === OWNER.toLowerCase());
  console.log('my resting bids after cancel:', still.length);
})().catch(e => { console.error('ERROR:', e.shortMessage ?? e.message, '| data:', e.data ?? ''); process.exit(1); });
