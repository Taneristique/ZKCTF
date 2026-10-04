#!/usr/bin/env node
/**
 * Manual run of the weekly bot. In production the same steps run automatically inside the API
 * (backend/src/scheduler.js); use this to preview a round or recover by hand.
 *
 *   cd backend && node ../scripts/weekly-challenge-bot.mjs --dry-run   # generate + verify, print, write nothing
 *   cd backend && node ../scripts/weekly-challenge-bot.mjs             # write backend/data/round.json for the next window
 *   CHAIN_DEPLOY=1 node ../scripts/weekly-challenge-bot.mjs            # …and publish create_round
 *
 * Flags are computed by code and re-derived by an independent solver per puzzle type
 * (backend/src/ctfgen.js); OPENROUTER_API_KEY only adds a story intro.
 */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const require = createRequire(join(BACKEND, "package.json"));
try {
  require("dotenv").config({ path: join(BACKEND, ".env") });
} catch {
  /* optional */
}

const load = (rel) => import(pathToFileURL(join(BACKEND, "src", rel)).href);

async function main() {
  process.chdir(BACKEND);
  const { generateRound } = await load("bot.js");
  const { saturdayWindow } = await load("race.js");
  const { writeRound, readRound } = await load("roundStore.js");
  const { start, end } = saturdayWindow();
  const prev = readRound();
  const { levels, source } = await generateRound({ avoid: (prev.levels ?? []).map((l) => l.type).filter(Boolean) });

  if (process.argv.includes("--dry-run")) {
    console.log(`DRY RUN — ${levels.length} levels (${source}) for ${start.toISOString()}; round.json not changed.\n`);
    for (const lv of levels) {
      console.log(`── L${lv.id} [${lv.type}] ${lv.title}  flag=${lv.flag}`);
      console.log(lv.statement);
      if (lv.artifacts.length) console.log(`Artifacts:\n  ${lv.artifacts.join("\n  ")}`);
      console.log(`Hints: ${lv.hints.join(" | ")}`);
      console.log(`Walkthrough: ${lv.walkthrough}\n`);
    }
    return;
  }

  if (prev.start === start.toISOString() && !process.argv.includes("--force")) {
    console.log(`round.json already holds ${prev.start}. Use --force to replace it (only before it is published on chain).`);
  } else {
    const row = writeRound({ start: start.toISOString(), end: end.toISOString(), levels, source });
    console.log(`Wrote ${row.levels.length} levels (${source}) for ${row.start} → ${row.end}`);
    for (const lv of row.levels) console.log(`  L${lv.id} [${lv.type}] ${lv.title}  flag=${lv.flag}`);
  }

  if (process.env.CHAIN_DEPLOY !== "1") {
    console.log("Skip on-chain create_round (set CHAIN_DEPLOY=1 to publish).");
    return;
  }
  const { Connection } = await import("@solana/web3.js");
  const { authorityKeypair } = await load("authority.js");
  const { onChainRound } = await load("chain.js");
  const { createRoundOnChain } = await load("scheduler.js");
  const connection = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
  const round = await onChainRound(connection);
  if (round && !round.settled) {
    throw new Error(`on-chain round ${new Date(round.start * 1000).toISOString()} is not settled yet; run settle-round.mjs first.`);
  }
  const sig = await createRoundOnChain({ connection, authority: authorityKeypair(), row: readRound() });
  console.log(`create_round tx ${sig}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
