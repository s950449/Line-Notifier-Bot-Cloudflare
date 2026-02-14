# TODO - LINE Reminder Bot (Cloudflare Workers)

## Scope
- [x] Support LINE 1:1 chat and group reminders
- [x] Group `/list` shows only reminders created by current user
- [x] `/cancel` allowed only for reminder owner
- [x] v1 uses only `/remind`, `/list`, `/cancel`

## Project Setup
- [ ] Initialize Cloudflare Worker TypeScript project
- [ ] Configure `wrangler.toml` (route, D1 binding, cron trigger)
- [ ] Add `.dev.vars.example`
- [ ] Configure secrets:
  - [ ] `LINE_CHANNEL_SECRET`
  - [ ] `LINE_CHANNEL_ACCESS_TOKEN`
  - [ ] `DEFAULT_TIMEZONE=Asia/Taipei`
  - [ ] `MAX_RETRY=3`
  - [ ] `DISPATCH_BATCH_SIZE=100`

## Database (D1)
- [ ] Create `reminders` table
- [ ] Add indexes (`status+remind_at`, `owner+status+remind_at`)
- [ ] Add initial migration
- [ ] Implement repository functions (create/list/cancel/dispatch)

## Webhook
- [ ] Implement `POST /webhook/line`
- [ ] Implement `x-line-signature` HMAC verification
- [ ] Handle only `message.type=text`
- [ ] Parse source:
  - [ ] `user` -> `chatType=user`, `chatId=userId`
  - [ ] `group` -> `chatType=group`, `chatId=groupId`
- [ ] Return usage for unknown command

## Commands
- [ ] `/remind <duration|datetime> <message>`
  - [ ] duration: `10m`, `2h`, `1d`
  - [ ] datetime: `YYYY-MM-DD HH:mm`
  - [ ] validate minimum and maximum allowed schedule
- [ ] `/list`
  - [ ] show only reminders created by current user
- [ ] `/cancel <id>`
  - [ ] allow cancel only for owner
- [ ] Define consistent response templates (success/error/usage)

## Scheduler and Dispatch
- [ ] Configure cron `* * * * *`
- [ ] Fetch due reminders in batch from `scheduled`
- [ ] Atomically move `scheduled -> sending`
- [ ] Send push message via LINE Messaging API
- [ ] Mark success as `sent`
- [ ] On failure increment retry count and move to `failed` after max retries
- [ ] Ensure idempotency and duplicate-send prevention

## Quality and Observability
- [ ] Input validation (past time, invalid format, empty message)
- [ ] Structured logs (`requestId`, `reminderId`)
- [ ] Optional alerting for repeated dispatch failures

## Testing
- [ ] 1:1 chat create/list/cancel/trigger
- [ ] Group create/list/cancel/trigger
- [ ] Non-owner cancel must be rejected
- [ ] Retry behavior when LINE API fails temporarily
- [ ] Cron re-entry does not send duplicate reminders

## Deploy
- [ ] Run `wrangler deploy`
- [ ] Set LINE Webhook URL to worker endpoint
- [ ] Enable webhook in LINE Developers Console
- [ ] Run production smoke test (1:1 + group)
