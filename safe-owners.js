const { JsonRpcProvider, Contract } = require('ethers');

const CHAINS = {
  Hideki2: 'https://api.hideki2.infra.testnet.somnia.network',
  Shannon: 'https://api.infra.testnet.somnia.network',
};
const SAFE = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const APP_SAFE = '0x8e210068b73591C6E316cA13F1C27B36f4691251';
const USER_EOA = '0x351FEF8d75aF1625C9cfB696d433646D6114F5D5';
const APP_RELAYER = '0xC4ab4435b093CB6B4Ad7Ae6d7AEaC00eD7BDcCBe';
const ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function VERSION() view returns (string)',
];

(async () => {
  for (const [name, rpc] of Object.entries(CHAINS)) {
    const p = new JsonRpcProvider(rpc, undefined, { staticNetwork: true });
    console.log(`\n=== ${name} ===`);
    for (const [label, addr] of [['trading', SAFE], ['app', APP_SAFE]]) {
      const c = new Contract(addr, ABI, p);
      try {
        const [owners, threshold, version] = await Promise.all([c.getOwners(), c.getThreshold(), c.VERSION().catch(() => '?')]);
        console.log(`${label} ${addr} version=${version} threshold=${threshold} owners=${owners.join(', ')}`);
        console.log(`   userEOA owner? ${owners.map((x) => x.toLowerCase()).includes(USER_EOA.toLowerCase())}  appRelayer owner? ${owners.map((x) => x.toLowerCase()).includes(APP_RELAYER.toLowerCase())}`);
      } catch (e) {
        const code = await p.getCode(addr);
        console.log(`${label} ${addr} not Safe (code ${code.length}B): ${(e.shortMessage || e.message).slice(0, 100)}`);
      }
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
