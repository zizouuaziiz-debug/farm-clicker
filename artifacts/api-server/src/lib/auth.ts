import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import { logger } from "./logger.js";

const IS_DEV = process.env.NODE_ENV !== "production";
const ALLOW_MOCK_AUTH = process.env.ALLOW_MOCK_AUTH === "true";

if (!process.env.SESSION_SECRET) {
  if (IS_DEV) {
    logger.warn("[auth] SESSION_SECRET is not set — using insecure development fallback.");
  } else {
    throw new Error(
      "SESSION_SECRET environment variable is required in production.",
    );
  }
}

if (!IS_DEV && !process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN environment variable is required in production.",
  );
}

const JWT_SECRET =
  process.env.SESSION_SECRET ||
  "farm-clicker-dev-secret-do-not-use-in-prod";

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user?: TelegramUser;
  hash: string;
  auth_date: number;
  query_id?: string;
}


export function validateTelegramInitData(
  initData: string,
): ParsedInitData | null {

  /*
    Browser Demo Mode
    Enabled by Railway variable:
    ALLOW_MOCK_AUTH=true
  */
  if (ALLOW_MOCK_AUTH) {
    try {
      // Telegram real format
      const params = new URLSearchParams(initData);
      const userString = params.get("user");

      if (userString) {
        const user = JSON.parse(
          decodeURIComponent(userString)
        );

        return {
          user,
          hash: "mock",
          auth_date: Math.floor(Date.now() / 1000),
        };
      }

      // Browser JSON fallback
      const user = JSON.parse(initData);

      if (user && typeof user.id === "number") {
        return {
          user,
          hash: "mock",
          auth_date: Math.floor(Date.now() / 1000),
        };
      }

      return null;

    } catch {
      return null;
    }
  }


  /*
    Real Telegram WebApp validation
  */

  try {

    const params = new URLSearchParams(initData);

    const hash = params.get("hash");

    if (!hash) {
      return null;
    }


    const entries: string[] = [];

    params.forEach((value, key) => {

      if (key !== "hash") {
        entries.push(`${key}=${value}`);
      }

    });


    entries.sort();


    const dataCheckString =
      entries.join("\n");


    const secretKey = createHmac(
      "sha256",
      "WebAppData",
    )
      .update(TELEGRAM_BOT_TOKEN)
      .digest();


    const calculatedHash =
      createHmac(
        "sha256",
        secretKey,
      )
        .update(dataCheckString)
        .digest("hex");


    if (calculatedHash !== hash) {
      return null;
    }


    const authDate = parseInt(
      params.get("auth_date") || "0",
      10,
    );


    const now =
      Math.floor(Date.now() / 1000);


    // Telegram session expires after 5 minutes
    if (now - authDate > 300) {
      return null;
    }


    const userString =
      params.get("user");


    const user = userString
      ? JSON.parse(
          decodeURIComponent(userString)
        )
      : undefined;


    return {
      user,
      hash,
      auth_date: authDate,
      query_id:
        params.get("query_id") || undefined,
    };


  } catch {

    return null;

  }
}



export interface JwtPayload {
  userId: number;
  telegramId: string;
  isAdmin: boolean;
}



export function signJwt(
  payload: JwtPayload,
): string {

  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: "30d",
    },
  );

}



export function verifyJwt(
  token: string,
): JwtPayload | null {

  try {

    return jwt.verify(
      token,
      JWT_SECRET,
    ) as JwtPayload;


  } catch {

    return null;

  }

}
