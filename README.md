# Farm Clicker — Telegram Mini App

A farming clicker game for Telegram with BEP20 USDT auto-verified deposits.

## Environment Variables

### API Server (Railway)

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for signing JWTs | ✅ |
| `SESSION_SECRET` | Express session secret | ✅ |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | ✅ |
| `DEPOSIT_WALLET_ADDRESS` | Admin BEP20 (BSC) USDT wallet address | ✅ |
| `BSCSCAN_API_KEY` | BscScan API key for tx verification | ✅ |
| `VIP_WALLET_ADDRESS` | (Legacy) VIP wallet address | Optional |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | Production |

### Getting a BscScan API Key

1. Go to https://bscscan.com/register
2. Create a free account
3. Go to API Keys → Add
4. Copy the key and set it as `BSCSCAN_API_KEY`

## New: BEP20 USDT Deposit System

Replaces the manual VIP review flow with automatic on-chain verification:

1. User opens **Deposit USDT** page in the mini app
2. User sends USDT (BEP20 only!) to the `DEPOSIT_WALLET_ADDRESS`  
3. User enters the amount + transaction hash
4. Backend calls BscScan API to verify:
   - ✅ Correct USDT BEP20 contract (`0x55d398326f99059fF775485246999027B3197955`)
   - ✅ Correct destination wallet
   - ✅ Correct amount (within 0.5% tolerance)
   - ✅ Transaction succeeded (status = 0x1)
   - ✅ At least 12 confirmations
   - ✅ No duplicate txHash
5. On success: coins are credited instantly
6. On failure: marked as Failed with a specific reason

### Admin Deposits Page

- `/deposits` in the admin panel shows all deposits
- Filter by pending / completed / failed
- **Re-verify** button to manually retry verification for pending/failed deposits

## Database Migration

Run after deploying new code:

```bash
pnpm --filter @workspace/db run push
```

This creates the new `deposits` table automatically via Drizzle's schema push.

Alternatively, apply `lib/db/migrations/0001_add_deposits.sql` directly.
