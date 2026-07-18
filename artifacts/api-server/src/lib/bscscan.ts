/**
 * bscscan.ts
 *
 * Backend-only BscScan API integration for verifying BEP20 USDT deposits.
 * NEVER called from the frontend — all verification happens server-side.
 */

const BSCSCAN_API_URL = "https://api.bscscan.com/api";
/** BSC Mainnet USDT (BEP20) contract address — do not change */
export const USDT_CONTRACT_BEP20 = "0x55d398326f99059fF775485246999027B3197955".toLowerCase();
/** ERC-20 Transfer event topic */
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** Minimum on-chain confirmations required before crediting a deposit */
const MIN_CONFIRMATIONS = 12;
/** USDT has 18 decimals on BSC */
const USDT_DECIMALS = 18;

interface BscScanResponse<T = unknown> {
  status: string;
  message: string;
  result: T;
}

export interface VerifyResult {
  success: boolean;
  amountUsdt?: number;
  confirmations?: number;
  error?: string;
}

async function callBscScan<T>(params: Record<string, string>): Promise<BscScanResponse<T>> {
  const apiKey = process.env.BSCSCAN_API_KEY || "";
  const url = new URL(BSCSCAN_API_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BscScan HTTP ${res.status}`);
  const data = (await res.json()) as BscScanResponse<T>;
  return data;
}

/**
 * Verify a BEP20 USDT transfer transaction.
 *
 * Checks:
 *  1. Transaction exists on-chain and succeeded.
 *  2. Has at least MIN_CONFIRMATIONS confirmations.
 *  3. Contains a USDT BEP20 Transfer event.
 *  4. The Transfer destination matches `expectedToAddress`.
 *  5. The transferred amount is >= `expectedMinUsdt`.
 */
export async function verifyUsdtDeposit(
  txHash: string,
  expectedToAddress: string,
  expectedMinUsdt: number,
): Promise<VerifyResult> {
  const normalizedHash = txHash.toLowerCase().trim();
  const normalizedTo = expectedToAddress.toLowerCase().trim();

  // Run the three BscScan calls in parallel for speed
  let receiptData: BscScanResponse<{ status: string; logs: any[] } | null>;
  let txData: BscScanResponse<{ blockNumber: string } | null>;
  let blockData: BscScanResponse<string>;

  try {
    [receiptData, txData, blockData] = await Promise.all([
      callBscScan<{ status: string; logs: any[] } | null>({
        module: "proxy",
        action: "eth_getTransactionReceipt",
        txhash: normalizedHash,
      }),
      callBscScan<{ blockNumber: string } | null>({
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash: normalizedHash,
      }),
      callBscScan<string>({
        module: "proxy",
        action: "eth_blockNumber",
      }),
    ]);
  } catch (err) {
    return { success: false, error: `BscScan request failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const receipt = receiptData.result;
  const tx = txData.result;

  // 1. Transaction must exist
  if (!receipt || !tx) {
    return { success: false, error: "Transaction not found on BSC network. Please wait a moment and try again." };
  }

  // 2. Transaction must have succeeded (status 0x1)
  if ((receipt as any).status !== "0x1") {
    return { success: false, error: "Transaction failed on-chain." };
  }

  // 3. Confirmations check
  const txBlock = parseInt((tx as any).blockNumber, 16);
  const currentBlock = parseInt(blockData.result as string, 16);
  const confirmations = currentBlock - txBlock;
  if (confirmations < MIN_CONFIRMATIONS) {
    return {
      success: false,
      error: `Transaction has only ${confirmations} confirmations. Please wait for at least ${MIN_CONFIRMATIONS} confirmations.`,
      confirmations,
    };
  }

  // 4. Find the USDT BEP20 Transfer log in this transaction
  const logs: any[] = (receipt as any).logs ?? [];
  const transferLog = logs.find(
    (log: any) =>
      log.address?.toLowerCase() === USDT_CONTRACT_BEP20 &&
      Array.isArray(log.topics) &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics.length >= 3,
  );

  if (!transferLog) {
    return {
      success: false,
      error: "No USDT BEP20 transfer event found in this transaction. Make sure you sent USDT on the BNB Smart Chain.",
    };
  }

  // 5. Verify destination address (topics[2] is the `to` address, zero-padded to 32 bytes)
  const toAddressRaw: string = transferLog.topics[2];
  const toAddress = ("0x" + toAddressRaw.slice(26)).toLowerCase();
  if (toAddress !== normalizedTo) {
    return {
      success: false,
      error: `Wrong destination wallet. This transaction was not sent to the deposit wallet.`,
    };
  }

  // 6. Decode the transferred amount (data field, 32-byte uint256, 18 decimals)
  const amountHex: string = transferLog.data;
  const amountWei = BigInt(amountHex);
  const amountUsdt = Number(amountWei) / Math.pow(10, USDT_DECIMALS);

  if (amountUsdt < expectedMinUsdt * 0.999) {
    return {
      success: false,
      error: `Deposited amount (${amountUsdt.toFixed(2)} USDT) is less than the minimum deposit (${expectedMinUsdt} USDT).`,
    };
  }

  return { success: true, amountUsdt, confirmations };
}
