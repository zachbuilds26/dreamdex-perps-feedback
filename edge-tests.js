const { JsonRpcProvider, Wallet, Contract, Interface } = require('ethers');
const { contractErrorsAbi } = require('@somnia-chain/markets-sdk');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ZERO = '0x0000000000000000000000000000000000000000';
const GWEI = 10n ** 18n;

const abi = [
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
  'function cancelOrderFor(address owner, uint128 orderId)',
  'function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)',
  'function getAllOpenOrdersOffChain(bool isBid, uint256 maxCount, uint64 startCursor) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs)[] orders, bool hasMoreOrders, uint64 nextCursor)',
];
const errorsIface = new Interface(contractErrorsAbi);

function decode(e) {
  const data = e.data ?? e.info?.error?.data ?? e.revert?.data ?? null;
  if (!data || data === '0x') return { name: 'NO_DATA (require(false)/empty revert)', data };
  try { const p = errorsIface.parseError(data); return { name: p ? `${p.name}(${p.args.map(a => a.toString()).join(',')})` : 'PARSE_NULL', data }; }
  catch { return { name: 'UNKNOWN_SELECTOR', data }; }
}

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const bot = new Wallet(process.env.BOT_KEY, p);
  const pool = new Contract(POOL, abi, p);
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const hour = 3600n * 1_000_000_000n;

  const asks = await pool.getAllOpenOrdersOffChain(false, 3, 0);
  const bids = await pool.getAllOpenOrdersOffChain(true, 3, 0);
  console.log('TOP ASKS:', asks[0].map(o => o[4].toString()));
  console.log('TOP BIDS:', bids[0].map(o => o[4].toString()));

  async function call(label, args) {
    try {
      const r = await pool.placeOrderFor.staticCall(...args, { from: BOT });
      console.log(`[OK  ] ${label} -> success=${r[0]} simId=${r[1].toString()}`);
      return true;
    } catch (e) {
      const d = decode(e);
      console.log(`[FAIL] ${label} -> ${d.name}${d.data ? ' | ' + d.data.slice(0, 74) : ''}`);
      return false;
    }
  }

  const base = [OWNER, true, 0n, 70000n * GWEI, 13000n, nowNs + hour, 0, 0, ZERO, 0n];

  await call('baseline valid bid 70000 x13000', base);
  await call('price off tick (70000.05)', [OWNER, true, 0n, 7000005n * GWEI, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('price off tick (70000.1 -> tick is 0.1 so OK)', [OWNER, true, 0n, 700001n * GWEI, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('price off tick (70000.01)', [OWNER, true, 0n, 7000001n * 10n ** 16n, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('qty below min (12000)', [OWNER, true, 0n, 70000n * GWEI, 12000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('qty not on lot (13500)', [OWNER, true, 0n, 70000n * GWEI, 13500n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('qty = 0', [OWNER, true, 0n, 70000n * GWEI, 0n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('price = 0', [OWNER, true, 0n, 0n, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('expiry in past', [OWNER, true, 0n, 70000n * GWEI, 13000n, nowNs - hour, 0, 0, ZERO, 0n]);
  await call('expiry farFuture (+50y, SDK default)', [OWNER, true, 0n, 70000n * GWEI, 13000n, (BigInt(Math.floor(Date.now() / 1000) + 50 * 365 * 24 * 3600)) * 1_000_000_000n, 0, 0, ZERO, 0n]);
  await call('orderType = 4 (invalid)', [OWNER, true, 0n, 70000n * GWEI, 13000n, nowNs + hour, 4, 0, ZERO, 0n]);
  await call('selfMatchingOption = 9', [OWNER, true, 0n, 70000n * GWEI, 13000n, nowNs + hour, 0, 9, ZERO, 0n]);
  await call('PostOnly bid 90000 (would cross asks)', [OWNER, true, 0n, 90000n * GWEI, 13000n, nowNs + hour, 3, 0, ZERO, 0n]);
  await call('owner without approval (random EOA)', ['0x6354CC1E363457Da8976a68D717F2B1Aec190b7C', true, 0n, 70000n * GWEI, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('insufficient margin (1 BTC @ 70000)', [OWNER, true, 0n, 70000n * GWEI, 100000000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('max position (101 BTC @ 70000)', [OWNER, true, 0n, 70000n * GWEI, 10100000000n, nowNs + hour, 0, 0, ZERO, 0n]);
  await call('non-bid (ask) at 70000', [OWNER, false, 0n, 70000n * GWEI, 13000n, nowNs + hour, 0, 0, ZERO, 0n]);
})().catch(e => { console.error('FATAL:', e.shortMessage ?? e.message, '|', e.data ?? ''); process.exit(1); });
