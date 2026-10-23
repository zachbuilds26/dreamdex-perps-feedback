const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const prices = [
    ['tick-aligned 80000.0', 80000n * 10n ** 18n],
    ['off-tick 80000.05', 8000005n * 10n ** 16n],
    ['off-tick 80000.01', 8000001n * 10n ** 16n],
    ['below tick 0.05', 5n * 10n ** 16n],
    ['one tick 0.1', 1n * 10n ** 17n],
    ['huge 1e9', 10n ** 9n * 10n ** 18n],
  ];
  for (const [label, price] of prices) {
    try {
      const r = await m.client.getMaxPerpOrderSize({
        pool,
        marginBank: bank,
        account: ACCOUNT,
        isBid: true,
        price,
      });
      console.log(
        `${label.padEnd(20)} price=${price} placeable=${r.placeable} maxQty=${r.maxQuantity} ` +
          `limitedBy=${r.limitedBy} lock=${r.lockAmount}`
      );
      if (r.placeable) {
        const pv = await m.client.previewPerpOrderMargin({
          pool,
          marginBank: bank,
          account: ACCOUNT,
          isBid: true,
          price,
          quantity: r.maxQuantity,
        });
        console.log(`   preview: sufficient=${pv.sufficient} lock=${pv.lockAmount} im=${pv.imRequirement}`);
      }
    } catch (e) {
      console.log(`${label.padEnd(20)} ERR ${(e.shortMessage || e.message).slice(0, 160)}`);
    }
  }

  console.log('\n--- actual pool acceptance (eth_call placeOrderFor, no fill) ---');
  const { JsonRpcProvider, Contract, Interface } = require('ethers');
  const provider = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', 50383);
  const abi = [
    'function placeOrderFor(address owner,bool isBid,uint64 userData,uint256 price,uint256 quantity,uint64 expireTimestampNs,uint8 orderType,uint8 selfMatchingOption,address builder,uint96 builderFeeBpsTimes1k) payable returns (bool,uint128)',
  ];
  const c = new Contract(pool, abi, provider);
  const { contractErrorsAbi } = require('@somnia-chain/markets-sdk');
  const ei = new Interface(contractErrorsAbi);
  const bot = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
  const expiry = BigInt(Date.now() + 3600000) * 1000000n;
  for (const [label, price] of prices) {
    try {
      await c.placeOrderFor.staticCall(ACCOUNT, true, 0n, price, 13000n, expiry, 0, 0, '0x0000000000000000000000000000000000000000', 0n, { from: bot });
      console.log(`${label.padEnd(20)} POOL ACCEPTS`);
    } catch (e) {
      const d = e.data ?? e.info?.error?.data ?? '';
      let n = '?';
      try {
        const x = ei.parseError(d);
        n = x ? x.name + '(' + x.args.map((a) => a.toString()).join(',') + ')' : 'no-match';
      } catch {
        n = 'undecodable';
      }
      console.log(`${label.padEnd(20)} POOL REVERTS ${n} ${d}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message);
  process.exit(1);
});
