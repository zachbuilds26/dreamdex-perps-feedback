const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const pool = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });

  console.log('bot eligibility:', JSON.stringify(await m.client.getPerpVoucherEligibility(bank, BOT), (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  try {
    await p.call({ from: BOT, to: '0x2ACD9EFdA721450906bfE1bef3edE269636E42C4', data: '0x4e71d92d' });
    console.log('claim() from bot: SUCCESS (unexpected)');
  } catch (e) {
    const data = e.data ?? e.info?.error?.data ?? e.error?.data;
    console.log('claim() from bot reverted:', data ?? (e.shortMessage || e.message).slice(0, 120));
  }

  for (let i = 0; i < 3; i++) {
    for (const isBid of [true, false]) {
      const t0 = Date.now();
      const r = await m.client.getPerpSideHolders({ pool, marginBank: bank, isLong: isBid });
      const ms = Date.now() - t0;
      console.log(`side=${isBid ? 'long ' : 'short'} ${ms}ms holders=${r.holders?.length ?? r.rows?.length ?? JSON.stringify(Object.keys(r))}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
