const { JsonRpcProvider, formatEther, getAddress } = require('ethers');

const RPCS = {
  hideki2: 'https://api.hideki2.infra.testnet.somnia.network',
  global: 'https://api.infra.testnet.somnia.network',
};
const ADDRS = {
  eoa: '0x351FEF8d75aF1625C9cfB696d433646D6114F5D5',
  smart: '0xAa9b198E1D34567c208178591005bF7C520fDB4b',
  bot: '0x0A1105948aA23799d4399ef0db267262b5a431D9',
};
const OWNER_TX = '0xa4a3e4af83e9956944cfd37a1a28f7a35202b1bc0c9928068ef62e486d357c9e';

(async () => {
  for (const [name, url] of Object.entries(RPCS)) {
    const p = new JsonRpcProvider(url, undefined, { staticNetwork: true });
    const net = await p.getNetwork();
    console.log(`\n=== ${name} chainId=${net.chainId} ===`);
    for (const [label, addr] of Object.entries(ADDRS)) {
      const [bal, nonce, code] = await Promise.all([
        p.getBalance(addr),
        p.getTransactionCount(addr),
        p.getCode(addr),
      ]);
      console.log(`${label.padEnd(5)} ${addr} balance=${formatEther(bal)} nonce=${nonce} code=${code === '0x' ? 'EOA' : code.length + 'B'}`);
    }
    try {
      const tx = await p.getTransaction(OWNER_TX);
      console.log('owner-add tx:', tx ? `from=${tx.from} to=${tx.to} value=${formatEther(tx.value)} block=${tx.blockNumber}` : 'not found');
    } catch (e) {
      console.log('owner-add tx lookup ERR', (e.shortMessage || e.message).slice(0, 120));
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.shortMessage || e.message);
  process.exit(1);
});
