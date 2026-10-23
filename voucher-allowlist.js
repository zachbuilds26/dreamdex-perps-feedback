const { SomniaMarkets } = require('@somnia-chain/markets-sdk');
const { hidekiTestnet } = require('@somnia-chain/markets-sdk/chains');
const { JsonRpcProvider, Contract } = require('ethers');

const INDEXER = 'https://hideki-dev.smk.somnia.host/v1/graphql';
const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const ACCOUNT = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const bank = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const BANK_ABI = [
  'function isVoucherMarketAllowed(address perpPool) view returns (bool)',
  'function getCreditFloor(address account) view returns (uint256)',
  'function getMaxLeverage(address account, address perpPool) view returns (uint256)',
];
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));

(async () => {
  const m = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER });
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const b = new Contract(bank, BANK_ABI, p);

  console.log('voucher:', j(await m.client.getPerpVoucher(bank, ACCOUNT)));
  console.log('creditFloor:', (await b.getCreditFloor(ACCOUNT)).toString());

  const markets = await m.client.listPerpMarkets();
  let allowed = 0, blocked = 0;
  for (const mk of markets) {
    const [ok, cap, lev] = await Promise.all([
      b.isVoucherMarketAllowed(mk.poolAddress),
      m.client.getPerpVoucherCampaign(bank).then((c) => c.leverageCapX),
      b.getMaxLeverage(ACCOUNT, mk.poolAddress),
    ]);
    if (ok) allowed++; else blocked++;
    if (!ok) console.log(`NOT ALLOWED: ${mk.baseSymbol} ${mk.poolAddress} accountCap=${lev}`);
  }
  console.log(`\nallowed=${allowed} blocked=${blocked}`);

  console.log('\nleverage BTC:', j(await m.client.getPerpLeverage({ marginBank: bank, pool: markets.find((x) => x.baseSymbol === 'BTC').poolAddress, account: ACCOUNT })));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
