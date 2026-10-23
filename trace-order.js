const { JsonRpcProvider, Interface, Wallet, parseUnits } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const OWNER = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';

const iface = new Interface([
  'function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)',
]);

(async () => {
  const p = new JsonRpcProvider(RPC, 50383);
  const price = parseUnits('70000', 18);
  const quantity = 13000n;
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n;
  const data = iface.encodeFunctionData('placeOrderFor', [OWNER, true, 0n, price, quantity, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n]);

  const call = { from: BOT, to: POOL, data, gas: '0x989680' };

  for (const cfg of [{ tracer: 'callTracer' }, { tracer: 'callTracer', tracerConfig: { withLog: true } }, {}]) {
    try {
      const trace = await p.send('debug_traceCall', [call, 'latest', cfg]);
      console.log('TRACER', JSON.stringify(cfg), 'OK');
      console.log(JSON.stringify(trace, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 12000));
      return;
    } catch (e) {
      console.log('TRACER', JSON.stringify(cfg), 'failed:', (e.shortMessage ?? e.message).slice(0, 200));
    }
  }
})();
