const { JsonRpcProvider, Contract, formatUnits, formatEther } = require('ethers');
const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', 50383);
const POOL = '0x4181dd08E73BbCdd1Ba3E615A18f6abD941b94C0';

(async () => {
  const pool = new Contract(POOL, [
    'function marginBank() view returns (address)',
    'function getMarkPrice() view returns (uint256)',
    'function tryGetMarkPrice() view returns (bool ok, uint256 price)',
    'function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))',
    'function getPerpPoolParameters() view returns ((uint256 initialMarginBps, uint256 maintenanceMarginBps, uint256 closeOutMarginBps, uint256 maxOpenInterest, uint256 maxPositionSize, uint256 takerFeeBpsTimes1k, int256 makerFeeBpsTimes1k, uint256 insuranceFundShareBps))',
    'function getEffectiveIMF() view returns (uint256)',
    'function getOpenInterest() view returns (uint256)',
    'function getOneBase() view returns (uint256)',
  ], p);

  const [mark, book, params, imf, oi, oneBase, marginBank] = await Promise.all([
    pool.tryGetMarkPrice(),
    pool.getOrderBookParameters(),
    pool.getPerpPoolParameters(),
    pool.getEffectiveIMF(),
    pool.getOpenInterest(),
    pool.getOneBase(),
    pool.marginBank(),
  ]);

  console.log('mark ok:', mark[0], 'price:', formatUnits(mark[1], 18));
  console.log('tickSize:', book.tickSize.toString(), '=', formatUnits(book.tickSize, 18));
  console.log('minQuantity:', book.minQuantity.toString());
  console.log('lotSize:', book.lotSize.toString());
  console.log('initialMarginBps:', params.initialMarginBps.toString());
  console.log('maintenanceMarginBps:', params.maintenanceMarginBps.toString());
  console.log('maxPositionSize:', params.maxPositionSize.toString());
  console.log('takerFeeBpsTimes1k:', params.takerFeeBpsTimes1k.toString());
  console.log('makerFeeBpsTimes1k:', params.makerFeeBpsTimes1k.toString());
  console.log('getEffectiveIMF:', imf.toString());
  console.log('getOpenInterest:', oi.toString());
  console.log('getOneBase:', oneBase.toString());
  console.log('marginBank:', marginBank);

  // base token decimals
  const factory = new Contract('0xE631fAEE547baeE07353E290f0562ea67d856560', ['function getBaseTokenForPool(address) view returns (address)'], p);
  const base = await factory.getBaseTokenForPool(POOL);
  const tok = new Contract(base, ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'], p);
  const [sym, dec] = await Promise.all([tok.symbol(), tok.decimals()]);
  console.log('base:', sym, 'decimals:', dec);
})().catch(e => { console.error('ERR:', e.shortMessage ?? e.message); process.exit(1); });
