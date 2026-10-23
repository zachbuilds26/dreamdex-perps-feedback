const { JsonRpcProvider, Contract, parseUnits, ZeroAddress } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ABI = [
  'function getMaxBuilderFeeBpsTimes1k() view returns (uint256)',
  'function getEffectiveBuilderApproval(address user, address builder) view returns (uint256)',
  'function getBuilderApproval(address user, address builder) view returns (uint256)',
  'function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))',
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
];

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const c = new Contract(POOL, ABI, p);
  const [maxFee, effBot, rawBot, effZero, book] = await Promise.all([
    c.getMaxBuilderFeeBpsTimes1k(),
    c.getEffectiveBuilderApproval(OWNER, BOT),
    c.getBuilderApproval(OWNER, BOT),
    c.getEffectiveBuilderApproval(OWNER, ZeroAddress),
    c.getOrderBookParameters(),
  ]);
  console.log(`maxBuilderFee=${maxFee} owner->bot effective=${effBot} raw=${rawBot} owner->zero=${effZero}`);
  console.log(`tick=${book.tickSize} min=${book.minQuantity} lot=${book.lotSize}`);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 10n ** 9n;
  const price = 70000n * 10n ** 18n; // far below mark: resting bid, no cross
  const qty = 13000n;
  const fee = maxFee > 0n ? maxFee : 100000n;

  for (const [label, builder, bfee, orderType] of [
    ['no builder', ZeroAddress, 0n, 0],
    ['builder=bot fee=0', BOT, 0n, 0],
    ['builder=bot fee=1', BOT, 1n, 0],
    ['builder=bot fee=max', BOT, fee, 0],
    ['builder=bot fee=max IOC cross', BOT, fee, 2],
  ]) {
    const args = [OWNER, true, 0n, price, qty, expiry, orderType, 0, builder, bfee];
    try {
      const r = await c.placeOrderFor.staticCall(...args, { from: BOT, value: 0 });
      console.log(`${label}: ACCEPTED success=${r[0]} orderId=${r[1]}`);
    } catch (e) {
      const data = e.data ?? e.info?.error?.data ?? e.error?.data;
      console.log(`${label}: REVERT ${data ?? (e.shortMessage || e.message).slice(0, 140)}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
