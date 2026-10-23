const { JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits, formatEther } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT_KEY = process.env.BOT_KEY;
const REGISTRY = '0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a';

const placeOrderForAbi = [
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
  'function cancelOrderFor(address owner, uint128 orderId) payable returns (bool success)',
  'function getLatestOrderForUser(address user) view returns (uint128)',
];

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const bot = new Wallet(BOT_KEY, p);
  const pool = new Contract(POOL, placeOrderForAbi, p);
  console.log('Bot:', bot.address, '| owner:', OWNER);

  const price = parseUnits('70000', 18);       // 0.1 tick multiple, well below mark => rests
  const quantity = 13000n;                     // minQuantity, 0.00013 BTC
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n; // +1h

  // 1) simulate
  let sim;
  try {
    sim = await pool.placeOrderFor.staticCall(OWNER, true, 0n, price, quantity, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n, { from: bot.address });
    console.log('SIMULATE OK -> success:', sim[0], 'orderId:', sim[1].toString());
  } catch (e) {
    console.log('SIMULATE FAILED:', e.shortMessage ?? e.message);
    console.log('revert data:', e.data ?? e.info?.error?.data);
    process.exit(1);
  }

  // 2) send
  const gas = 10_000_000n;
  const tx = await pool.connect(bot).placeOrderFor(OWNER, true, 0n, price, quantity, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n, { gasLimit: gas });
  console.log('SENT tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('STATUS:', receipt.status, '| gasUsed:', receipt.gasUsed.toString(), '| block:', receipt.blockNumber);
  console.log('Logs:', receipt.logs.length);

  // 3) read it back
  const latest = await pool.getLatestOrderForUser(OWNER);
  console.log('getLatestOrderForUser:', latest.toString());

  // 4) cancel the same order
  const csim = await pool.cancelOrderFor.staticCall(OWNER, sim[1]);
  console.log('CANCEL SIMULATE OK:', csim);
  const ctx = await pool.connect(bot).cancelOrderFor(OWNER, sim[1], { gasLimit: gas });
  console.log('CANCEL tx:', ctx.hash);
  const crec = await ctx.wait();
  console.log('CANCEL STATUS:', crec.status, '| gasUsed:', crec.gasUsed.toString());
})().catch(e => { console.error('ERROR:', e.shortMessage ?? e.message, e.data ?? ''); process.exit(1); });
