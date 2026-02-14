# Agent Guidelines — LINE Reminder Bot

## Project Overview

LINE reminder bot running on Cloudflare Workers + D1 (SQLite). Users interact via LINE commands: `/remind`, `/list`, `/cancel`.

## Tech Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1
- **External API**: LINE Messaging API
- **Build**: wrangler

## Architecture

```
src/
├── index.ts              # Worker entry: fetch (webhook) + scheduled (cron)
├── types.ts              # All type definitions and interfaces
├── webhook.ts            # LINE webhook handler, event routing, group whitelist
├── commands.ts           # Command parsing (/remind, /list, /cancel), time parsing
├── reminder-service.ts   # DB CRUD: create, list, cancel reminders
├── dispatcher.ts         # Cron job: dispatch due reminders via LINE Push API
└── line-client.ts        # LINE API wrappers: reply, push, leave, signature verify
```

## Key Design Decisions

- All timestamps stored in UTC (`remind_at_utc`), displayed in `Asia/Taipei`
- Status machine for reminders: `scheduled → sending → sent` (or `failed`/`cancelled`)
- Atomic claim (`scheduled → sending`) prevents duplicate sends in concurrent cron runs
- Group whitelist via `ALLOWED_GROUPS` secret; bot auto-leaves non-whitelisted groups
- 1:1 private chats are always allowed regardless of whitelist

## Database

Single table `reminders` in D1. Schema in `migrations/0001_create_reminders.sql`.

Status values: `scheduled`, `sending`, `sent`, `cancelled`, `failed`

## Secrets Management

Sensitive values are managed via `wrangler secret put`, never in code or `wrangler.toml`:
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `ALLOWED_GROUPS`

`wrangler.toml` is in `.gitignore`. Use `wrangler.toml.example` as template.

## Development Commands

```bash
npm run dev              # Local dev server
npm run deploy           # Deploy to Cloudflare
npm run migrate:local    # Run migration locally
npm run migrate:remote   # Run migration on remote D1
npx wrangler secret put <NAME>  # Set a secret
```

## Conventions

- Language: TypeScript strict mode
- User-facing messages: Traditional Chinese (繁體中文)
- No external dependencies beyond `@cloudflare/workers-types`
- Prefer simple, flat module structure — no deep nesting
- Error handling: reply user-friendly messages, log errors with `console.error`
