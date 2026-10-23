const { JsonRpcProvider, formatEther } = require('ethers');

const RPC = 'https://api.infra.testnet.somnia.network';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const SMART = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const head = await p.getBlockNumber();
  console.log('head', head);

  async function balanceAt(addr, block) {
    return p.getBalance(addr, block);
  }

  async function firstBlockWhereBalanceIs(addr, target, lo, hi) {
    let l = lo, h = hi;
    while (l < h) {
      const mid = Math.floor((l + h) / 2);
      const b = await balanceAt(addr, mid);
      if (b >= target) h = mid; else l = mid + 1;
    }
    return l;
  }

  const target = 40n * 10n ** 18n;
  const b = await firstBlockWhereBalanceIs(BOT, target, 0, head);
  const before = await balanceAt(BOT, b - 1);
  const after = await balanceAt(BOT, b);
  console.log(`bot balance change at block ${b}: ${formatEther(before)} -> ${formatEther(after)}`);

  const block = await p.getBlock(b, true);
  console.log('block time', new Date(block.timestamp * 1000).toISOString(), 'txs', block.transactions.length);
  for (const tx of block.transactions) {
    if ((tx.to || '').toLowerCase() === BOT.toLowerCase() || (tx.from || '').toLowerCase() === BOT.toLowerCase()) {
      console.log('MATCH tx', tx.hash, 'from', tx.from, 'to', tx.to, 'value', formatEther(tx.value), 'nonce', tx.nonce);
      const r = await p.getTransactionReceipt(tx.hash);
      console.log('receipt status', r.status, 'logs', r.logs.length, 'gasUsed', r.gasUsed.toString());
      console.log('input', tx.data.slice(0, 202));
    }
  }
  // also show smart balance around that block
  console.log('smart @ b-1', formatEther(await balanceAt(SMART, b - 1)), '@ b', formatEther(await balanceAt(SMART, b)));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
