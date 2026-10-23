const { keccak256, toUtf8Bytes } = require('ethers');
const names = [
  'CampaignInactive()', 'AlreadyClaimed()', 'BudgetExhausted()', 'ClaimantNotFlat()', 'ClaimantIsMainFunded()',
  'ClaimantNotFlat(address)', 'CampaignInactive(uint64,uint64)', 'AlreadyClaimed(address)', 'BudgetExhausted(uint256,uint256)',
  'ClaimantIsMainFunded(address)', 'ClaimantNotFlat(address,uint256)', 'VoucherAlreadyClaimed()', 'VoucherNotClaimable()',
  'NotEligible()', 'NotFlat()', 'MainFunded()', 'ClaimWindowClosed()', 'ClaimWindowNotOpen()', 'CampaignNotActive()',
  'GrantAlreadyClaimed()', 'AlreadyGranted()', 'GrantClaimed()', 'InvalidClaimant()', 'NotClaimant()',
  'VoucherClaimed()', 'VoucherExpired()', 'VoucherNotExpired()', 'ClaimantHasPosition()', 'ClaimantHasOrders()',
  'OnlyClaimant()', 'OnlySelf()', 'NotSmartAccount()', 'NotContract()', 'OnlyContract()', 'OnlyEOA()',
];
for (const n of names) {
  const sel = keccak256(toUtf8Bytes(n)).slice(0, 10);
  console.log(sel, n, sel === '0x3e31dcc2' ? '   <== MATCH' : '');
}
