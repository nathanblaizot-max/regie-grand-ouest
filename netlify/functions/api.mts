import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/core.mjs";
import { SETUP_CODE } from "../lib/setup-code.mjs";

// Stockage de fichiers Netlify Blobs (lecture immédiate après écriture).
const files = getStore({ name: "fichiers", consistency: "strong" });
const blobs = {
  set: (k: string, v: string) => files.set(k, v),
  get: (k: string) => files.get(k, { type: "text" }),
  delete: (k: string) => files.delete(k),
};

export default async (req: Request) => handle(req, getDatabase(), { setupCode: SETUP_CODE, blobs });

export const config: Config = { path: "/api/*" };
