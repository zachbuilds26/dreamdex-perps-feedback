const { JsonRpcProvider, Wallet, Contract, Interface } = require('ethers');
const { contractErrorsAbi } = require('@somnia-chain/markets-sdk');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ZERO = '0x0000000000000000000000000000000000000000';
const POOLS = {
  BTC: '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0',
  ETH: '0xD6Cb1DD58580B84D76068aC21594219ce03aeddf',
  SOL: '0xB483ec1fb34996638677c20ab087b16F1896FA53',
};

const abi = [
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
  'function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))',
  'function getMarkPrice() view returns (uint256)',
  'function getOneBase() view returns (uint256)',
];
const errorsIface = new Interface(contractErrorsAbi);
const G = 10n ** 18n;

function decode(e) {
  const data = e.data ?? e.info?.error?.data ?? null;
  if (!data || data === '0x') return 'NO_DATA (require(false))';
  try { const x = errorsIface.parseError(data); return x ? `${x.name}(${x.args.map(a => a.toString()).join(',')})` : 'PARSE_NULL'; }
  catch { return 'UNKNOWN ' + data.slice(0, 74); }
}

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const hour = 3600n * 1_000_000_000n;

  for (const [name, addr] of Object.entries(POOLS)) {
    const pool = new Contract(addr, abi, p);
    try {
      const [params, mark] = await Promise.all([pool.getOrderBookParameters(), pool.getMarkPrice()]);
      const [tick, minQ, lot] = params;
      console.log(`\n${name} ${addr}\n  tick=${tick} minQ=${minQ} lot=${lot} mark=${mark} (${Number(mark) / 1e18})`);
      const price = (mark * 8n / 10n / tick) * tick;
      const qty = ((minQ + lot - 1n) / lot) * lot;
      const args = [OWNER, true, 0n, price, qty, nowNs + hour, 0, 0, ZERO, 0n];
      try {
        const r = await pool.placeOrderFor.staticCall(...args, { from: BOT });
        console.log(`  placeOrderFor bid ${price} x ${qty} -> OK success=${r[0]} simId=${r[1].toString()}`);
      } catch (e) { console.log(`  placeOrderFor -> FAIL ${decode(e)}`); }
    } catch (e) { console.log(`${name}: setup failed: ${e.shortMessage ?? e.message}`); }
  }
})().catch(e => { console.error('FATAL:', e.shortMessage ?? e.message); process.exit(1); });
