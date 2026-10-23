const { JsonRpcProvider, Wallet, Contract, Interface } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';

const abi = [
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
  'function getAllOpenOrdersOffChain(bool isBid, uint256 maxCount, uint64 startCursor) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs)[] orders, bool hasMoreOrders, uint64 nextCursor)',
  'function cancelOrderFor(address owner, uint128 orderId)',
];
const iface = new Interface(abi);

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const bot = new Wallet(process.env.BOT_KEY, p);
  const pool = new Contract(POOL, abi, p);

  const price = 69_000n * 10n ** 18n;
  const quantity = 13000n;
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n;

  const sim = await pool.placeOrderFor.staticCall(OWNER, true, 0n, price, quantity, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n, { from: bot.address });
  console.log('staticCall orderId:', sim[1].toString(), '| hex:', '0x' + sim[1].toString(16));

  const tx = await pool.connect(bot).placeOrderFor(OWNER, true, 0n, price, quantity, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n, { gasLimit: 10_000_000n });
  const rec = await tx.wait();
  console.log('place tx:', tx.hash, '| status:', rec.status, '| block:', rec.blockNumber);

  for (const log of rec.logs) {
    console.log('log topics:', log.topics.map(t => t.slice(0, 18) + '…'));
    console.log('  topic1 full:', log.topics[1] ?? '(none)');
  }

  const book = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  const mine = book[0].filter(o => o.owner.toLowerCase() === OWNER.toLowerCase());
  console.log('book orderIds:', mine.map(o => ({ id: o[0].toString(), hex: '0x' + o[0].toString(16), price: o[4].toString() })));

  for (const o of mine) {
    await (await pool.connect(bot).cancelOrderFor(OWNER, o[0], { gasLimit: 5_000_000n })).wait();
  }
  const after = await pool.getAllOpenOrdersOffChain(true, 100, 0);
  console.log('mine after cleanup:', after[0].filter(o => o.owner.toLowerCase() === OWNER.toLowerCase()).length);
})().catch(e => { console.error('ERROR:', e.shortMessage ?? e.message, '| data:', e.data ?? ''); process.exit(1); });
