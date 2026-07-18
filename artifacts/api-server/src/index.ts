import app from "./app";
import { logger } from "./lib/logger";
import { initConfigStore } from "./lib/config-store.js";

// ── Required environment variables ──────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === "production";

if (!process.env["SESSION_SECRET"]) {
  throw new Error("SESSION_SECRET environment variable is required.");
}
if (IS_PROD && !process.env["TELEGRAM_BOT_TOKEN"]) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required in production.");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  // Load game configuration from the database before accepting requests.
  // Falls back to game-config.ts defaults if the DB table does not yet exist.
  await initConfigStore();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
