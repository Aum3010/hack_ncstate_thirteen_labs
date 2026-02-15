import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import bs58 from "bs58";

// Paste your Phantom private key (base58) here, then run: node phantom-to-wallet.js
const PHANTOM_BASE58 = process.env.PHANTOM_PRIVATE_KEY_BASE58 || "CwQKHCwEtRcByX18JcoG1KpQqZcKiTh95UJsb6Mh3TyZCndARhyjCmjG1VKepVZFeLoXm4jbktTuKEtXYYeX64F";

const secret = bs58.decode(PHANTOM_BASE58); // 64 bytes
// Robust Windows path handling
const walletPath = fileURLToPath(new URL("./wallet.json", import.meta.url));
writeFileSync(walletPath, JSON.stringify(Array.from(secret)), "utf8");
console.log("Written wallet.json (64-byte array). Do not commit this file.");