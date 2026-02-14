import { Env, Reminder, SourceInfo } from './types';
import { formatLocalTime } from './commands';

export function generateId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createReminder(
  db: D1Database,
  source: SourceInfo,
  remindAtUtc: string,
  message: string,
  timezone: string,
): Promise<string> {
  const id = generateId();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO reminders (id, owner_user_id, chat_type, chat_id, message, remind_at_utc, timezone, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', 0, ?, ?)`,
    )
    .bind(id, source.userId, source.chatType, source.chatId, message, remindAtUtc, timezone, now, now)
    .run();

  return id;
}

export async function listReminders(
  db: D1Database,
  ownerUserId: string,
  chatId: string,
  timezone: string,
): Promise<string> {
  const result = await db
    .prepare(
      `SELECT id, message, remind_at_utc, timezone, status
       FROM reminders
       WHERE owner_user_id = ? AND chat_id = ? AND status IN ('scheduled', 'sending')
       ORDER BY remind_at_utc ASC`,
    )
    .bind(ownerUserId, chatId)
    .all<Pick<Reminder, 'id' | 'message' | 'remind_at_utc' | 'timezone' | 'status'>>();

  if (!result.results || result.results.length === 0) {
    return '目前沒有排定的提醒。';
  }

  const lines = result.results.map((r, i) => {
    const localTime = formatLocalTime(r.remind_at_utc, r.timezone || timezone);
    const statusLabel = r.status === 'sending' ? ' (發送中)' : '';
    return `${i + 1}. [${r.id}] ${localTime} - ${r.message}${statusLabel}`;
  });

  return `你的提醒列表：\n${lines.join('\n')}`;
}

export async function cancelReminder(
  db: D1Database,
  reminderId: string,
  ownerUserId: string,
): Promise<string> {
  const reminder = await db
    .prepare(`SELECT id, owner_user_id, status FROM reminders WHERE id = ?`)
    .bind(reminderId)
    .first<Pick<Reminder, 'id' | 'owner_user_id' | 'status'>>();

  if (!reminder) {
    return `找不到提醒 ${reminderId}。`;
  }

  if (reminder.owner_user_id !== ownerUserId) {
    return '你沒有權限取消此提醒。';
  }

  if (reminder.status === 'cancelled') {
    return '此提醒已經被取消。';
  }

  if (reminder.status === 'sent') {
    return '此提醒已經發送完畢，無法取消。';
  }

  if (reminder.status === 'failed') {
    return '此提醒已失敗，無法取消。';
  }

  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .bind(now, reminderId)
    .run();

  return `已取消提醒 ${reminderId}。`;
}
