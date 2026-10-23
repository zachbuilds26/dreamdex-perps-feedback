const { JsonRpcProvider, Contract } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const REG = '0x52e2ccebaec9332672c247e9a90aa3d61fb615ef';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const USER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const RAND = '0x1111111111111111111111111111111111111111';
const RAND2 = '0x2222222222222222222222222222222222222222';
const ABI = [
  'function somiPaymentPerOrder() view returns (uint256)',
  'function createPendingOrder(((bool isBid, address owner, uint64 userData, uint256 quantity) order, uint8 orderType, uint256 triggerPrice, uint8 triggerOperator, uint256 limitPrice, address builder, uint96 builderFeeBpsTimes1k) orderWithTrigger) payable returns (uint128)',
  'function createTriggerOrder(((bool isBid, address owner, uint64 userData, uint256 quantity) order, uint8 orderType, uint256 triggerPrice, uint8 triggerOperator, uint256 limitPrice, address builder, uint96 builderFeeBpsTimes1k) orderWithTrigger, uint8 intent) payable returns (uint128)',
  'function isOperatorAuthorized(address owner, address operator, bytes4 selector) view returns (bool)',
];
const MARK = 81843306281522451500000n;
const TICK = 100000000000000000n;
const TRIG = (MARK / TICK) * TICK;

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const c = new Contract(REG, ABI, p);
  const pool = new Contract(POOL, ['function isOperatorAuthorized(address owner, address operator, bytes4 selector) view returns (bool)'], p);
  const somi = await c.somiPaymentPerOrder();
  console.log('somiPaymentPerOrder =', somi.toString(), '(' + Number(somi) / 1e18 + ' SOMI)');
  const placeSel = '0x80054449';
  for (const [label, owner, op] of [
    ['registry authorized for USER placeOrderFor', USER, REG],
    ['registr authorized for USER generic', USER, REG],
    ['bot authorized for USER placeOrderFor', USER, BOT],
  ]) {
    try { console.log(label, '=', await pool.isOperatorAuthorized(owner, op, placeSel)); } catch (e) { console.log(label, 'ERR'); }
  }

  const order = (owner, isBid, qty) => ({ isBid, owner, userData: 0n, quantity: qty });
  const owt = (owner, isBid, qty, trig, limit) => ({
    order: order(owner, isBid, qty),
    orderType: 0,
    triggerPrice: trig,
    triggerOperator: 0,
    limitPrice: limit,
    builder: '0x0000000000000000000000000000000000000000',
    builderFeeBpsTimes1k: 0n,
  });

  const cases = [
    ['A random->USER reduceOnly', 'createPendingOrder', RAND, owt(USER, true, 13000n, TRIG, MARK * 2n)],
    ['B bot->USER reduceOnly', 'createPendingOrder', BOT, owt(USER, true, 13000n, TRIG, MARK * 2n)],
    ['C bot->random2 reduceOnly', 'createPendingOrder', BOT, owt(RAND2, true, 13000n, TRIG, MARK * 2n)],
    ['D random->random2 reduceOnly', 'createPendingOrder', RAND, owt(RAND2, true, 13000n, TRIG, MARK * 2n)],
    ['E random->USER OPENING', 'createTriggerOrder', RAND, owt(USER, true, 13000n, TRIG, MARK * 2n)],
    ['F bot->USER OPENING', 'createTriggerOrder', BOT, owt(USER, true, 13000n, TRIG, MARK * 2n)],
  ];
  for (const [label, fn, from, arg] of cases) {
    const args = fn === 'createTriggerOrder' ? [arg, 1] : [arg];
    try {
      const r = await c[fn].staticCall(...args, { from, value: somi });
      console.log(`${label}: ACCEPTED id=${r}`);
    } catch (e) {
      const d = e.data ?? e.info?.error?.data ?? e.error?.data;
      console.log(`${label}: revert ${d ?? (e.shortMessage || e.message).slice(0, 130)}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
