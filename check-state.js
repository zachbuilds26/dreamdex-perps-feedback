const { JsonRpcProvider, Contract, formatEther } = require('ethers');
const p = new JsonRpcProvider('https://api.hideki2.infra.testnet.somnia.network', 50383);
const DIST = '0x2ACD9EFdA721450906bfE1bef3edE269636E42C4';
const BANK = '0x478769E1177C0773c43A593DCCc4Ad15F15F1394';
const USDso = '0xed7993A74dAe1e6656B704A424DcD8711aAf4F72';
const acct = process.argv[2] || '0x0A1105948aA23799d4399ef0db267262b5a431D9';

(async () => {
  const dist = new Contract(DIST, [
    'function getConfig() view returns ((address marginBank, address collateralToken, uint256 grantAmount, uint64 expiryDuration, uint64 campaignStart, uint64 campaignEnd) config)',
    'function budgetRemaining() view returns (uint256)',
    'function isClaimed(address) view returns (bool)',
    'function voucherExpiryOf(address) view returns (uint64)',
    'function paused() view returns (bool)',
  ], p);
  const bank = new Contract(BANK, [
    'function getCreditGranter() view returns (address)',
    'function getVoucherLeverageCap() view returns (uint256)',
    'function getMainFundedPrincipal(address) view returns (uint256)',
    'function getActivePerpPools(address) view returns (address[])',
    'function getCreditFloor(address) view returns (uint256)',
    'function getCollateralBasis(address) view returns (uint256)',
  ], p);

  console.log('Account:', acct);
  console.log('Now:', new Date().toISOString(), '| unix:', Math.floor(Date.now() / 1000));
  const cfg = await dist.getConfig();
  console.log('\n--- Distributor config ---');
  console.log('marginBank:', cfg.marginBank);
  console.log('collateralToken:', cfg.collateralToken);
  console.log('grantAmount:', formatEther(cfg.grantAmount));
  console.log('expiryDuration:', cfg.expiryDuration.toString(), 'sec');
  console.log('campaignStart:', cfg.campaignStart.toString(), '=', new Date(Number(cfg.campaignStart) * 1000).toISOString());
  console.log('campaignEnd:', cfg.campaignEnd.toString(), '=', new Date(Number(cfg.campaignEnd) * 1000).toISOString());
  const budget = await dist.budgetRemaining();
  console.log('budgetRemaining:', formatEther(budget), 'USDso');

  console.log('\n--- Account state ---');
  console.log('isClaimed:', await dist.isClaimed(acct));
  console.log('voucherExpiryOf:', (await dist.voucherExpiryOf(acct)).toString());
  console.log('bank.getCreditGranter:', await bank.getCreditGranter());
  console.log('bank.getVoucherLeverageCap:', (await bank.getVoucherLeverageCap()).toString());
  const mf = await bank.getMainFundedPrincipal(acct);
  console.log('bank.getMainFundedPrincipal:', formatEther(mf));
  const pools = await bank.getActivePerpPools(acct);
  console.log('bank.getActivePerpPools:', pools.length, pools);
  console.log('bank.getCreditFloor:', formatEther(await bank.getCreditFloor(acct)));
  console.log('bank.getCollateralBasis:', formatEther(await bank.getCollateralBasis(acct)));

  console.log('\n--- Token ---');
  const tok = new Contract(cfg.collateralToken, ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'], p);
  console.log('distributor token balance:', formatEther(await tok.balanceOf(DIST)), await tok.symbol());

  console.log('\n--- Config sanity ---');
  console.log('config.marginBank == BANK:', cfg.marginBank.toLowerCase() === BANK.toLowerCase());
  console.log('config.collateralToken == USDso:', cfg.collateralToken.toLowerCase() === USDso.toLowerCase());
  console.log('budget >= grantAmount:', budget >= cfg.grantAmount);
  console.log('now within campaign:', Number(cfg.campaignStart) <= Math.floor(Date.now()/1000) && Math.floor(Date.now()/1000) < Number(cfg.campaignEnd));
})().catch(e => { console.error('ERROR:', e.shortMessage ?? e.message); process.exit(1); });
