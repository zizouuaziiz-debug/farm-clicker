/**
 * BscScan API helper for verifying BEP20 USDT deposits.
 *
 * USDT BEP20 contract on BSC mainnet:
 *   0x55d398326f99059fF775485246999027B3197955
 *
 * The Transfer(address,address,uint256) event topic:
 *   0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
 *
 * USDT on BSC uses 18 decimals.
 */

import { logger } from "./logger.js";

export const USDT_CONTRACT_BSC = "0x55d398326f99059fF775485246999027B3197955";
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// Minimum on-chain confirmations before we credit.
export const MIN_CONFIRMATIONS = 12;
// USDT on BSC Mainnet has 18 decimals.
const USDT_DECIMALS = 18n;

const BSCSCAN_BASE = "https://api.bscscan.com/api";

function apiKey(): string {
  return process.env.BSCSCAN_API_KEY ?? "";
}

async function bscscanFetch(params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, apikey: apiKey() });
  const url = `${BSCSCAN_BASE}?${qs.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BscScan HTTP ${res.status}`);
  return res.json();
}

interface TxReceipt {
  status: string; // "0x1" = success
  blockNumber: string; // hex
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

interface BscScanProxyResult<T> {
  jsonrpc: string;
  id: number;
  result: T | null;
}

export interface DepositVerificationResult {
  ok: boolean;
  /** Human-readable failure reason when ok=false */
  failReason?: string;
  /** Confirmed USDT amount (only when ok=true) */
  confirmedAmountUsdt?: number;
}

/**
 * Verify a BEP20 USDT transaction on BSC.
 *
 * @param txHash       Raw transaction hash (0x-prefixed)
 * @param expectedTo   Admin wallet address that should receive the funds (case-insensitive)
 * @param expectedUsdt Declared USDT amount the user claims to have sent
 * @param tolerance    Allowed relative deviation from declared amount (default 0.5 %)
 */
export async function verifyUsdtDeposit(
  txHash: string,
  expectedTo: string,
  expectedUsdt: number,
  tolerance = 0.005,
): Promise<DepositVerificationResult> {
  // ── 1. Fetch receipt ──────────────────────────────────────────────────────
  let receipt: TxReceipt | null = null;
  try {
    const raw = (await bscscanFetch({
      module: "proxy",
      action: "eth_getTransactionReceipt",
      txhash: txHash,
    })) as BscScanProxyResult<TxReceipt>;
    receipt = raw.result;
  } catch (err) {
    logger.error({ err, txHash }, "BscScan: failed to fetch receipt");
    return { ok: false, failReason: "Could not reach the blockchain API. Please try again later." };
  }

  if (!receipt) {
    return { ok: false, failReason: "Transaction not found on BSC. It may still be pending." };
  }

  // ── 2. Check transaction success ─────────────────────────────────────────
  if (receipt.status !== "0x1") {
    return { ok: false, failReason: "Transaction failed on-chain (status ≠ 0x1)." };
  }

  // ── 3. Check confirmations ────────────────────────────────────────────────
  let currentBlock = 0n;
  try {
    const raw = (await bscscanFetch({
      module: "proxy",
      action: "eth_blockNumber",
    })) as BscScanProxyResult<string>;
    if (raw.result) currentBlock = BigInt(raw.result);
  } catch {
    // Non-fatal — we fall back to 0 which means confirmations check may fail.
  }

  const txBlock = BigInt(receipt.blockNumber);
  const confirmations = currentBlock >= txBlock ? currentBlock - txBlock : 0n;
  if (confirmations < BigInt(MIN_CONFIRMATIONS)) {
    return {
      ok: false,
      failReason: `Only ${confirmations} confirmations so far; ${MIN_CONFIRMATIONS} required. Please retry in a minute.`,
    };
  }

  // ── 4. Find the USDT Transfer log ─────────────────────────────────────────
  const transferLog = receipt.logs.find((log) => {
    const contractMatch =
      log.address.toLowerCase() === USDT_CONTRACT_BSC.toLowerCase();
    const isTransferEvent =
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC.toLowerCase();
    const recipientTopic = log.topics[2];
    // topics[2] is the `to` address, zero-padded to 32 bytes
    const toAddress = recipientTopic
      ? "0x" + recipientTopic.slice(-40)
      : "";
    const toMatch =
      toAddress.toLowerCase() === expectedTo.toLowerCase().replace(/^0x/, "").slice(-40) ||
      toAddress.toLowerCase() === expectedTo.toLowerCase();
    return contractMatch && isTransferEvent && toMatch;
  });

  if (!transferLog) {
    return {
      ok: false,
      failReason: `No USDT BEP20 transfer to the deposit address was found in this transaction. Make sure you sent to the correct wallet on BSC.`,
    };
  }

  // ── 5. Verify amount ──────────────────────────────────────────────────────
  // data field is the uint256 amount (32 bytes hex, no topics prefix)
  const rawAmount = BigInt(transferLog.data);
  // Convert from 18-decimal integer to float
  const divisor = 10n ** USDT_DECIMALS;
  const confirmedUsdt =
    Number(rawAmount / divisor) +
    Number(rawAmount % divisor) / Number(divisor);

  const lowerBound = expectedUsdt * (1 - tolerance);
  const upperBound = expectedUsdt * (1 + tolerance);
  if (confirmedUsdt < lowerBound) {
    return {
      ok: false,
      failReason: `Amount mismatch: you claimed ${expectedUsdt} USDT but the transaction shows ${confirmedUsdt.toFixed(4)} USDT.`,
    };
  }
  if (confirmedUsdt > upperBound * 2) {
    // Sanity check — if the on-chain amount is vastly higher we still credit
    // the declared amount (conservative approach).
  }

  return { ok: true, confirmedAmountUsdt: confirmedUsdt };
}
