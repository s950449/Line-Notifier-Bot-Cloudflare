# LINE Reminder Bot

A LINE reminder bot built on Cloudflare Workers + D1. Supports 1:1 chats and group chats.

## Features

- `/remind <time> <message>` — Set a reminder
  - Relative: `10m`, `2h`, `1d`
  - Absolute: `2026-02-15 09:00`
- `/list` — View your scheduled reminders
- `/cancel <id>` — Cancel a reminder
- `/groupid` — Show current group ID (for whitelist setup)
- Group whitelist with auto-leave for unauthorized groups
- Retry with configurable max attempts on delivery failure

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [LINE Messaging API channel](https://developers.line.biz/console/)
- Node.js 18+

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd Line-Notifier-Cloudflare
   npm install
   ```

2. **Configure Cloudflare**

   ```bash
   npx wrangler login
   npx wrangler d1 create line-reminder-db
   ```

   Copy `wrangler.toml.example` to `wrangler.toml` and fill in your `database_id`.

3. **Run database migration**

   ```bash
   npm run migrate:remote
   ```

4. **Set secrets**

   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   ```

   Optionally restrict to specific groups:

   ```bash
   echo "Cxxx,Cyyy" | npx wrangler secret put ALLOWED_GROUPS
   ```

5. **Deploy**

   ```bash
   npm run deploy
   ```

6. **Configure LINE webhook**

   Set webhook URL in [LINE Developers Console](https://developers.line.biz/console/) to:

   ```
   https://<your-worker>.workers.dev/webhook/line
   ```

   Enable **Use webhook** and disable **Auto-reply messages** in [LINE Official Account Manager](https://manager.line.biz/).

## Configuration

| Variable | Type | Description |
|----------|------|-------------|
| `LINE_CHANNEL_SECRET` | Secret | LINE channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Secret | LINE channel access token |
| `ALLOWED_GROUPS` | Secret | Comma-separated group IDs (empty = allow all) |
| `DEFAULT_TIMEZONE` | Var | Display timezone (default: `Asia/Taipei`) |
| `MAX_RETRY` | Var | Max delivery retry attempts (default: `3`) |
| `DISPATCH_BATCH_SIZE` | Var | Reminders per cron run (default: `100`) |

## Architecture

```
Cloudflare Worker
├── POST /webhook/line    → Receive LINE events, parse commands, write to D1
├── GET /                 → Health check
└── Cron (* * * * *)      → Dispatch due reminders via LINE Push API
```

Data flow: `LINE → Webhook → D1 → Cron → LINE Push API`

## License

[BSD-2-Clause](./LICENSE)
