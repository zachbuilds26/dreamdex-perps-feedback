const { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } = require("@somnia-chain/markets-sdk");
const { hidekiTestnet } = require("@somnia-chain/markets-sdk/chains");

const PRIVATE_KEY = process.env.BOT_KEY;

async function main() {
  const markets = new SomniaMarkets({
    chain: hidekiTestnet,
    indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    privateKey: PRIVATE_KEY,
  });

  const account = markets.walletAddress;
  console.log("Account:", account);

  const perps = await markets.client.listPerpMarkets();
  console.log("Perp markets found:", perps.length);

  const btc = perps.find((m) => m.baseSymbol === "BTC");
  if (!btc) {
    console.log("No BTC market. Available:", perps.map((m) => m.baseSymbol).join(", "));
    return;
  }
  console.log("Using BTC market, marginBank:", btc.marginBank);

  const eligibility = await markets.client.getPerpVoucherEligibility(btc.marginBank, account);
  console.log("Eligible:", eligibility.eligible);

  if (eligibility.eligible) {
    console.log("Claiming paper USDso voucher...");
    const tx = await markets.trader.claimPerpVoucher({ marginBank: btc.marginBank });
    console.log("Claim result:", tx && tx.hash ? tx.hash : String(tx));
  } else {
    console.log("Not eligible or already claimed.");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("Error:", e.message || e); process.exit(1); });
