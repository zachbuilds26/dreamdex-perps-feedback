const { JsonRpcProvider, Contract, formatUnits, formatEther } = require('ethers');

const CHAINS = {
  'Shannon 50312': { rpc: 'https://api.infra.testnet.somnia.network', usdso: '0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171' },
  'Hideki2 50383': { rpc: 'https://api.hideki2.infra.testnet.somnia.network', usdso: '0xed7993A74dAe1e6656B704A424DcD8711aAf4F72' },
};
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

(async () => {
  for (const [name, c] of Object.entries(CHAINS)) {
    const p = new JsonRpcProvider(c.rpc, undefined, { staticNetwork: true });
    const net = await p.getNetwork();
    const t = new Contract(c.usdso, ABI, p);
    const [stt, usdso, nonce, dec] = await Promise.all([
      p.getBalance(BOT),
      t.balanceOf(BOT),
      p.getTransactionCount(BOT),
      t.decimals(),
    ]);
    console.log(`${name} (rpc chainId ${net.chainId}): STT=${formatEther(stt)} USDso=${formatUnits(usdso, dec)} (${c.usdso}) botNonce=${nonce}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
