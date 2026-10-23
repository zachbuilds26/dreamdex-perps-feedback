const { JsonRpcProvider, Contract } = require('ethers');

const RPC = 'https://api.hideki2.infra.testnet.somnia.network';
const DIST = '0x2ACD9EFdA721450906bfE1bef3edE269636E42C4';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const USER = '0x351FEF8d75aF1625C9cfB696d433646D6114F5D5';
const APP_SAFE = '0x8e210068b73591C6E316cA13F1C27B36f4691251';
const ABI = [
  'function grantTo(address[])',
  'function owner() view returns (address)',
  'function getRoleAdmin(bytes32) view returns (bytes32)',
  'function hasRole(bytes32,address) view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function budgetRemaining() view returns (uint256)',
  'function grantAmount() view returns (uint256)',
  'function claim()',
  'function claimed(address) view returns (bool)',
];
const sel = {
  grantTo: '0x0677d0a3',
  claim: '0x4e71d92d',
};

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const c = new Contract(DIST, ABI, p);
  for (const fn of ['owner', 'DEFAULT_ADMIN_ROLE', 'budgetRemaining', 'grantAmount']) {
    try { console.log(fn, '=', (await c[fn]()).toString()); } catch (e) { console.log(fn, 'ERR', (e.shortMessage || e.message).slice(0, 80)); }
  }
  const adminRole = await c.DEFAULT_ADMIN_ROLE().catch(() => null);
  if (adminRole) {
    for (const who of [BOT, USER, APP_SAFE]) {
      try { console.log('hasRole(admin,', who, ') =', await c.hasRole(adminRole, who)); } catch {}
    }
  }
  for (const [who, from] of [['bot', BOT], ['userEOA', USER]]) {
    try {
      await c.grantTo.staticCall([from], { from });
      console.log(`grantTo([self]) from ${who}: ACCEPTED !!`);
    } catch (e) {
      const d = e.data ?? e.info?.error?.data ?? e.error?.data;
      console.log(`grantTo from ${who}: revert ${d ?? (e.shortMessage || e.message).slice(0, 120)}`);
    }
  }
  try {
    await c.claim.staticCall({ from: BOT });
    console.log('claim from bot: ACCEPTED');
  } catch (e) {
    const d = e.data ?? e.info?.error?.data ?? e.error?.data;
    console.log('claim from bot: revert', d);
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', (e.shortMessage || e.message).slice(0, 300)); process.exit(1); });
