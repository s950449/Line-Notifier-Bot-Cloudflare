import { Env, Reminder } from './types';
import { pushMessage } from './line-client';

export async function dispatchDueReminders(env: Env): Promise<void> {
  const now = new Date().toISOString();
  const batchSize = parseInt(env.DISPATCH_BATCH_SIZE, 10) || 100;
  const maxRetry = parseInt(env.MAX_RETRY, 10) || 3;

  // Fetch due reminders
  const result = await env.DB.prepare(
    `SELECT id, chat_id, message, attempts
     FROM reminders
     WHERE status = 'scheduled' AND remind_at_utc <= ?
     ORDER BY remind_at_utc ASC
     LIMIT ?`,
  )
    .bind(now, batchSize)
    .all<Pick<Reminder, 'id' | 'chat_id' | 'message' | 'attempts'>>();

  if (!result.results || result.results.length === 0) {
    return;
  }

  for (const reminder of result.results) {
    // Atomically claim: scheduled -> sending
    const claimed = await env.DB.prepare(
      `UPDATE reminders SET status = 'sending', updated_at = ? WHERE id = ? AND status = 'scheduled'`,
    )
      .bind(new Date().toISOString(), reminder.id)
      .run();

    if (!claimed.meta.changed_db || claimed.meta.changes === 0) {
      // Already claimed by another execution
      continue;
    }

    try {
      await pushMessage(reminder.chat_id, `⏰ 提醒：${reminder.message}`, env);

      // Mark as sent
      await env.DB.prepare(
        `UPDATE reminders SET status = 'sent', updated_at = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), reminder.id)
        .run();

      console.log(`Reminder ${reminder.id} sent successfully`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const newAttempts = reminder.attempts + 1;

      if (newAttempts >= maxRetry) {
        // Max retries reached, mark as failed
        await env.DB.prepare(
          `UPDATE reminders SET status = 'failed', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(newAttempts, error, new Date().toISOString(), reminder.id)
          .run();

        console.error(`Reminder ${reminder.id} failed permanently after ${newAttempts} attempts: ${error}`);
      } else {
        // Move back to scheduled for retry
        await env.DB.prepare(
          `UPDATE reminders SET status = 'scheduled', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(newAttempts, error, new Date().toISOString(), reminder.id)
          .run();

        console.warn(`Reminder ${reminder.id} failed (attempt ${newAttempts}/${maxRetry}), will retry: ${error}`);
      }
    }
  }
}
