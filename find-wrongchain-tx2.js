const { JsonRpcProvider, formatEther, zeroPadValue } = require('ethers');

const RPC = 'https://api.infra.testnet.somnia.network';
const BOT = '0x0A1105948aA23799d4399ef0db267262b5a431D9';
const SMART = '0xAa9b198E1D34567c208178591005bF7C520fDB4b';
const ENTRYPOINTS = [
  '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
];
const botPadded = BOT.toLowerCase().slice(2).padStart(64, '0');

(async () => {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const head = await p.getBlockNumber();

  async function bal(addr, block) {
    return p.getBalance(addr, block);
  }
  async function firstAbove(addr, target, lo, hi) {
    let l = lo, h = hi;
    while (l < h) {
      const mid = Math.floor((l + h) / 2);
      if ((await bal(addr, mid)) >= target) h = mid; else l = mid + 1;
    }
    return l;
  }

  const first = await firstAbove(BOT, 1n, 0, head);
  console.log(`first non-zero at ${first}: ${formatEther(await bal(BOT, first - 1))} -> ${formatEther(await bal(BOT, first))}`);
  const second = await firstAbove(BOT, 40n * 10n ** 18n, first, head);
  console.log(`40 reached at ${second}: ${formatEther(await bal(BOT, second - 1))} -> ${formatEther(await bal(BOT, second))}`);

  for (const bn of [first, second]) {
    const block = await p.getBlock(bn, true);
    console.log(`\n=== block ${bn} ${new Date(block.timestamp * 1000).toISOString()} txs=${block.transactions.length} ===`);
    for (const tx of block.transactions) {
      const to = (tx.to || '').toLowerCase();
      const hay = (tx.data || '').toLowerCase();
      const interesting =
        to === SMART.toLowerCase() ||
        ENTRYPOINTS.map((e) => e.toLowerCase()).includes(to) ||
        hay.includes(botPadded);
      if (interesting) {
        console.log(`tx ${tx.hash}\n  from ${tx.from} to ${tx.to} value=${formatEther(tx.value)} nonce=${tx.nonce} selector=${tx.data.slice(0, 10)} len=${(tx.data.length - 2) / 2}`);
      }
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', (e.shortMessage || e.message).slice(0, 300));
  process.exit(1);
});
