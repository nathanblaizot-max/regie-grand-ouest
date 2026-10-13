import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { handle } from "../lib/core.mjs";
import { SETUP_CODE } from "../lib/setup-code.mjs";

export default async (req: Request) => handle(req, getDatabase(), { setupCode: SETUP_CODE });

export const config: Config = { path: "/api/*" };
