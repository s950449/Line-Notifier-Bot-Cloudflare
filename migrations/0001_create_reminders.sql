CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('user', 'group', 'room')),
  chat_id TEXT NOT NULL,
  message TEXT NOT NULL,
  remind_at_utc TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_status_remind_at
  ON reminders (status, remind_at_utc);

CREATE INDEX IF NOT EXISTS idx_reminders_owner_status_remind
  ON reminders (owner_user_id, status, remind_at_utc);

CREATE INDEX IF NOT EXISTS idx_reminders_chat_status_remind
  ON reminders (chat_id, status, remind_at_utc);
