#!/usr/bin/env node
/**
 * Generate 100-150 devnet Solana transactions with memos across three categories:
 * investments, bill_payments, short_term_goals.
 * Usage: node generate-test-transactions.js --keypair ./wallet.json --recipient RECIPIENT_ADDRESS
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createMemoInstruction } from "@solana/spl-memo";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LAMPORTS_PER_TX = 5_000_000; // 0.005 SOL
const DELAY_MS = 450;
const RPC_URL = "https://api.devnet.solana.com";

const INVESTMENTS = [
  "investments: DCA buy - SOL",
  "investments: DCA buy - ETH",
  "investments: Staking reward reinvest",
  "investments: Jupiter swap SOL to USDC",
  "investments: Raydium LP deposit",
  "investments: Marinade stake SOL",
  "investments: NFT mint - Solana Monkey",
  "investments: Token purchase - BONK",
  "investments: Jito stake SOL",
  "investments: Orca swap",
  "investments: DCA buy - RAY",
  "investments: Drift protocol deposit",
  "investments: MarginFi borrow",
  "investments: Kamino vault deposit",
  "investments: Tensor NFT bid",
  "investments: Metaplex royalty payment",
  "investments: Pyth staking",
  "investments: JUP airdrop claim",
  "investments: Solend deposit",
  "investments: Mango Markets margin",
  "investments: Phoenix DEX swap",
  "investments: Sanctum LST stake",
  "investments: DCA buy - JTO",
  "investments: Helius RPC subscription",
  "investments: DeFi yield harvest",
  "investments: Liquidity provision Orca",
  "investments: NFT secondary sale",
  "investments: Token airdrop claim",
  "investments: Staking rewards claim",
  "investments: DCA buy - mSOL",
  "investments: Protocol fee payment",
  "investments: Governance vote stake",
  "investments: Crate token purchase",
  "investments: Pump.fun token buy",
  "investments: Cross-program swap",
  "investments: LST unstake",
  "investments: Perps margin deposit",
  "investments: Options premium",
  "investments: Index fund deposit",
  "investments: Automated DCA execution",
  "investments: Reward restaking",
  "investments: Liquidity mining deposit",
  "investments: DCA buy - JUP",
  "investments: Lending protocol deposit",
];

const BILL_PAYMENTS = [
  "bill_payments: Rent - March",
  "bill_payments: Rent - April",
  "bill_payments: Electric bill",
  "bill_payments: Internet - Comcast",
  "bill_payments: Netflix subscription",
  "bill_payments: Spotify Premium",
  "bill_payments: Credit card payment",
  "bill_payments: Car loan - March",
  "bill_payments: Gym membership",
  "bill_payments: Insurance premium",
  "bill_payments: Water bill",
  "bill_payments: Gas bill",
  "bill_payments: Trash pickup",
  "bill_payments: Amazon Prime",
  "bill_payments: Disney+ subscription",
  "bill_payments: HBO Max",
  "bill_payments: YouTube Premium",
  "bill_payments: Apple iCloud",
  "bill_payments: Dropbox",
  "bill_payments: GitHub Pro",
  "bill_payments: Adobe Creative Cloud",
  "bill_payments: Microsoft 365",
  "bill_payments: Car insurance",
  "bill_payments: Health insurance copay",
  "bill_payments: Dental bill",
  "bill_payments: Phone plan - Verizon",
  "bill_payments: Student loan payment",
  "bill_payments: Personal loan",
  "bill_payments: Mortgage - March",
  "bill_payments: HOA dues",
  "bill_payments: Cable TV",
  "bill_payments: Home security - Ring",
  "bill_payments: Car registration",
  "bill_payments: Parking permit",
  "bill_payments: Transit pass",
  "bill_payments: Cloud storage - Google",
  "bill_payments: Domain renewal",
  "bill_payments: Hosting - Vercel",
  "bill_payments: VPN subscription",
  "bill_payments: Password manager",
  "bill_payments: News subscription",
  "bill_payments: Podcast support",
  "bill_payments: Patreon",
  "bill_payments: Union dues",
  "bill_payments: Professional license",
  "bill_payments: CPA fee",
  "bill_payments: Tax prep",
  "bill_payments: Pet insurance",
  "bill_payments: Dog grooming",
];

const SHORT_TERM_GOALS = [
  "short_term_goals: Laptop savings - MacBook",
  "short_term_goals: Weekend trip - Asheville",
  "short_term_goals: Concert tickets - Taylor Swift",
  "short_term_goals: New phone - iPhone 16",
  "short_term_goals: Vacation fund - Hawaii",
  "short_term_goals: Gaming PC build",
  "short_term_goals: Camera - Sony A7",
  "short_term_goals: Bike upgrade",
  "short_term_goals: Furniture - couch",
  "short_term_goals: Kitchen appliance",
  "short_term_goals: Wedding gift",
  "short_term_goals: Birthday party fund",
  "short_term_goals: Holiday gifts",
  "short_term_goals: Summer camp - kids",
  "short_term_goals: Fitness equipment",
  "short_term_goals: Home gym setup",
  "short_term_goals: Guitar - electric",
  "short_term_goals: Watch - graduation",
  "short_term_goals: Skis - new season",
  "short_term_goals: Camping gear",
  "short_term_goals: DSLR lens",
  "short_term_goals: Smart home hub",
  "short_term_goals: E-reader",
  "short_term_goals: Noise cancelling headphones",
  "short_term_goals: Stand-up desk",
  "short_term_goals: Monitor upgrade",
  "short_term_goals: Keyboard - mechanical",
  "short_term_goals: Coffee machine",
  "short_term_goals: Art supplies",
  "short_term_goals: Books - reading list",
  "short_term_goals: Cooking class",
  "short_term_goals: Spa day",
  "short_term_goals: Weekend getaway",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keypair" && args[i + 1]) opts.keypair = args[++i];
    else if (args[i] === "--recipient" && args[i + 1]) opts.recipient = args[++i];
    else if (args[i] === "--rpc" && args[i + 1]) opts.rpc = args[++i];
    else if (args[i] === "--count" && args[i + 1]) opts.count = parseInt(args[++i], 10);
  }
  return opts;
}

function loadKeypair(path) {
  const resolved = path.startsWith("/") ? path : resolve(process.cwd(), path);
  const data = JSON.parse(readFileSync(resolved, "utf-8"));
  const secret = Array.isArray(data) ? new Uint8Array(data) : new Uint8Array(Buffer.from(data, "base64"));
  return Keypair.fromSecretKey(secret);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs();
  if (!opts.keypair || !opts.recipient) {
    console.error("Usage: node generate-test-transactions.js --keypair ./wallet.json --recipient RECIPIENT_ADDRESS [--rpc URL] [--count 125]");
    process.exit(1);
  }

  const count = Math.min(opts.count || 125, 150);
  const connection = new Connection(opts.rpc || RPC_URL);
  const payer = loadKeypair(opts.keypair);
  const recipient = new PublicKey(opts.recipient);

  const memos = [...INVESTMENTS, ...BILL_PAYMENTS, ...SHORT_TERM_GOALS];
  const shuffled = memos.sort(() => Math.random() - 0.5).slice(0, count);

  console.log(`Sending ${count} transactions from ${payer.publicKey.toBase58()} to ${recipient.toBase58()}`);
  console.log(`RPC: ${opts.rpc || RPC_URL}`);
  console.log(`Amount per tx: ${LAMPORTS_PER_TX / 1e9} SOL`);
  console.log("");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < shuffled.length; i++) {
    const memo = shuffled[i];
    try {
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient,
          lamports: LAMPORTS_PER_TX,
        }),
        createMemoInstruction(memo, [payer.publicKey])
      );

      const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false, preflightCommitment: "confirmed" });
      await connection.confirmTransaction(sig, "confirmed");
      success++;
      console.log(`[${i + 1}/${count}] OK ${sig.slice(0, 16)}... ${memo}`);
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${count}] FAIL ${memo}: ${err.message}`);
    }

    if (i < shuffled.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("");
  console.log(`Done. Success: ${success}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
