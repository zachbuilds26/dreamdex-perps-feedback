import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://api.hideki2.infra.testnet.somnia.network";
const DISTRIBUTOR = "0x2ACD9EFdA721450906bfE1bef3edE269636E42C4";
const MARGIN_BANK = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394";
const KEY = process.env.BOT_KEY;

const account = privateKeyToAccount(KEY);
const client = createPublicClient({ transport: http(RPC) });

const distributorAbi = parseAbi([
  "function getPerpVoucherEligibility(address marginBank, address account) view returns (bool eligible, uint256 grantAmount, (address marginBank, address collateralToken, uint256 grantAmount, uint64 expiryDuration, uint64 campaignStart, uint64 campaignEnd) config)",
]);

console.log("=== ENVIRONMENT ===");
console.log("Chain ID:", await client.getChainId());
console.log("Account:", account.address);
console.log("Block:", await client.getBlockNumber());

console.log("\n=== STEP 1: getPerpVoucherEligibility ===");
let eligibility;
try {
  eligibility = await client.readContract({
    address: DISTRIBUTOR,
    abi: distributorAbi,
    functionName: "getPerpVoucherEligibility",
    args: [MARGIN_BANK, account.address],
  });
  console.log("eligible:", eligibility[0]);
  console.log("grantAmount:", eligibility[1].toString());
  console.log("config:", eligibility[2]);
} catch (e) {
  console.log("FAILED:", e.shortMessage ?? e.message);
}

console.log("\n=== STEP 2: eth_call claim() ===");
try {
  const result = await client.call({
    account: account.address,
    to: DISTRIBUTOR,
    data: "0x4e71d92d",
  });
  console.log("claim() simulated OK:", result.data);
} catch (e) {
  console.log("claim() REVERTED");
  console.log("  shortMessage:", e.shortMessage);
  console.log("  revert data:", e.data);
  console.log("  cause data:", e.cause?.data);
}

console.log("\n=== STEP 3: eth_estimateGas claim() ===");
try {
  const gas = await client.estimateGas({
    account: account.address,
    to: DISTRIBUTOR,
    data: "0x4e71d92d",
  });
  console.log("estimateGas OK:", gas.toString());
} catch (e) {
  console.log("estimateGas REVERTED:", e.shortMessage);
  console.log("  data:", e.data);
}
