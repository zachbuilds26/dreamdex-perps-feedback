const { JsonRpcProvider, Contract } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const USER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ABI = [
  'function placeOrdersFor(address owner, (bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k)[] requests) returns (bool[] successes, uint128[] ids)',
];
const ZERO = '0x0000000000000000000000000000000000000000';

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const c = new Contract(POOL, ABI, p);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 10n ** 9n;
  const req = (isBid, price, qty, orderType) => ({ isBid, userData: 0n, price, quantity: qty, expireTimestampNs: expiry, orderType, selfMatchingOption: 0, builder: ZERO, builderFeeBpsTimes1k: 0n });

  const cases = [
    ['[IOC no-fill, resting normal]', [req(true, 70000n * 10n ** 18n, 13000n, 2), req(true, 70000n * 10n ** 18n, 13000n, 0)]],
    ['[postonly would cross, resting]', [req(true, 90000n * 10n ** 18n, 13000n, 3), req(true, 70000n * 10n ** 18n, 13000n, 0)]],
    ['[bad tick price, resting]', [req(true, 80000n * 10n ** 18n + 50000000000000000n, 13000n, 0), req(true, 70000n * 10n ** 18n, 13000n, 0)]],
    ['[empty batch]', []],
  ];
  for (const [label, requests] of cases) {
    try {
      const r = await c.placeOrdersFor.staticCall(USER, requests, { from: BOT });
      console.log(`${label}: ACCEPTED successes=[${r[0].map(String).join(',')}] ids=[${r[1].map(String).join(',')}]`);
    } catch (e) {
      const d = e.data ?? e.info?.error?.data ?? e.error?.data;
      console.log(`${label}: REVERT ${d ?? (e.shortMessage || e.message).slice(0, 140)}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
