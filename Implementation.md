# Inplementation Plan - LINE Reminder Bot on Cloudflare

## 1. Objective
Build a LINE reminder bot for 1:1 chats and groups with:
- `/remind <time> <message>`
- `/list`
- `/cancel <id>`

Version 1 focuses on reliability and deployment readiness.

## 2. Architecture

### Runtime
- Cloudflare Workers (TypeScript)
- Cloudflare D1 (SQLite)
- Cron Trigger (`* * * * *`) for minute-level dispatch

### External API
- LINE Messaging API
  - Webhook events
  - Reply API
  - Push API

### Components
- `webhook handler`: verify signature, parse commands, write to DB
- `command parser`: `/remind`, `/list`, `/cancel`
- `reminder service`: create/list/cancel operations
- `dispatcher`: cron-based due reminder sender
- `line client`: reply/push wrappers

## 3. Data Model (D1)

### Table: reminders
- `id TEXT PRIMARY KEY`
- `owner_user_id TEXT NOT NULL`
- `chat_type TEXT NOT NULL` (`user|group|room`)
- `chat_id TEXT NOT NULL`
- `message TEXT NOT NULL`
- `remind_at_utc TEXT NOT NULL` (ISO-8601 UTC)
- `timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'`
- `status TEXT NOT NULL` (`scheduled|sending|sent|cancelled|failed`)
- `attempts INTEGER NOT NULL DEFAULT 0`
- `last_error TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### Indexes
- `idx_reminders_status_remind_at (status, remind_at_utc)`
- `idx_reminders_owner_status_remind (owner_user_id, status, remind_at_utc)`
- `idx_reminders_chat_status_remind (chat_id, status, remind_at_utc)`

## 4. Command Specification

### `/remind`
Supported formats:
- `/remind 10m Drink water`
- `/remind 2h Send report`
- `/remind 2026-02-15 09:00 Team sync`

Rules:
- Relative units: `m`, `h`, `d`
- Absolute format: `YYYY-MM-DD HH:mm` (parsed as `Asia/Taipei`)
- Reject past timestamps
- Minimum delay: 1 minute
- Maximum delay: 365 days (configurable)
- Return created reminder id in confirmation

### `/list`
- Show only reminders where `owner_user_id` is current user
- Show active reminders (`scheduled`, `sending`)
- Display id, local time, and message

### `/cancel <id>`
- Cancel only when current user is owner
- Success: update status to `cancelled`
- Failure: not found or no permission

## 5. Webhook Flow

1. Receive webhook body and `x-line-signature`
2. Verify HMAC using `LINE_CHANNEL_SECRET`
3. Process only text message events
4. Resolve source:
   - `user` -> `chat_type=user`, `chat_id=userId`
   - `group` -> `chat_type=group`, `chat_id=groupId`
5. Execute command logic (`remind`, `list`, `cancel`)
6. Reply result via Reply API

## 6. Dispatch Flow (Cron)

Runs every minute:
1. Select due reminders: `status='scheduled' AND remind_at_utc <= now` (batch)
2. Atomically claim each reminder: `scheduled -> sending`
3. Push message to `chat_id` using LINE Push API
4. On success: `sending -> sent`
5. On failure: increment attempts
   - if attempts < `MAX_RETRY`: move back to `scheduled`
   - else: set `failed` and store `last_error`

## 7. Reliability and Security

- Enforce LINE signature verification (401 on failure)
- Use status transitions for idempotency and lock behavior
- Retry with cap and error tracking
- Keep all credentials in Worker secrets
- Store timestamps in UTC; format output in `Asia/Taipei`

## 8. Configuration

Required secrets/vars:
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `DEFAULT_TIMEZONE=Asia/Taipei`
- `MAX_RETRY=3`
- `DISPATCH_BATCH_SIZE=100`

`wrangler.toml` must include:
- D1 binding
- cron trigger
- route or workers.dev endpoint

## 9. Acceptance Criteria

- 1:1 chat create/list/cancel/trigger works
- Group create/list/cancel/trigger works
- Group `/list` shows only current user's reminders
- Non-owner cancel is rejected
- Temporary LINE API failures retry correctly
- Webhook signature failures are rejected

## 10. Future Enhancements

- Chinese natural language date parsing
- Recurring reminders (daily/weekly)
- Group admin visibility mode
- Queue-based dispatch for higher volume
