/**
 * Who “ran” a Saturday race for profile history.
 * Default = ZKCTF. Optional sponsor via env or round.json fields.
 */
import { readRound } from "./roundStore.js";

const ZKCTF = {
  id: "zkctf",
  name: "ZKCTF",
  logo: "/logo.png",
};

export function raceHost(roundStartSec = null) {
  const row = readRound();
  const fromRound =
    row?.sponsor && (row.sponsor.name || row.sponsor.logo)
      ? {
          id: "sponsor",
          name: String(row.sponsor.name || "Sponsor"),
          logo: row.sponsor.logo ? String(row.sponsor.logo) : null,
        }
      : null;
  const fromEnv =
    process.env.WEEK_SPONSOR_NAME || process.env.WEEK_SPONSOR_LOGO
      ? {
          id: "sponsor",
          name: process.env.WEEK_SPONSOR_NAME || "Sponsor",
          logo: process.env.WEEK_SPONSOR_LOGO || null,
        }
      : null;
  const host = fromRound || fromEnv || ZKCTF;
  return {
    ...host,
    roundStart: roundStartSec,
  };
}
