import { Env, LineWebhookBody, SourceInfo, Command } from './types';
import { verifySignature, replyMessage, leaveChat } from './line-client';
import { parseCommand, formatLocalTime } from './commands';
import { createReminder, listReminders, cancelReminder } from './reminder-service';

const USAGE_TEXT = `LINE 提醒機器人 使用說明：

/remind <時間> <訊息>
  設定提醒
  範例：
  /remind 10m 喝水
  /remind 2h 寄報告
  /remind 2026-02-15 09:00 開會

/list
  查看你的提醒列表

/cancel <id>
  取消提醒`;

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const signature = request.headers.get('x-line-signature');
  if (!signature) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.text();

  const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const webhook: LineWebhookBody = JSON.parse(body);

  // Process events in background to return 200 quickly
  const eventPromises = webhook.events.map((event) => processEvent(event, env));

  // Wait for all but don't block LINE with errors
  await Promise.allSettled(eventPromises);

  return new Response('OK', { status: 200 });
}

function getAllowedGroups(env: Env): string[] {
  return (env.ALLOWED_GROUPS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

async function processEvent(
  event: LineWebhookBody['events'][number],
  env: Env,
): Promise<void> {
  // Auto-leave non-whitelisted groups on join
  if (event.type === 'join') {
    const allowed = getAllowedGroups(env);
    if (allowed.length > 0) {
      const sourceType = event.source.type;
      const chatId = sourceType === 'group' ? event.source.groupId : event.source.roomId;
      if (chatId && (sourceType === 'group' || sourceType === 'room') && !allowed.includes(chatId)) {
        await replyMessage(event.replyToken, '此群組不在許可名單中，Bot 將自動退出。', env);
        await leaveChat(sourceType, chatId, env);
        return;
      }
    }
    return;
  }

  // Only handle text messages
  if (event.type !== 'message' || event.message?.type !== 'text' || !event.message.text) {
    return;
  }

  const text = event.message.text.trim();

  // Only process commands starting with /
  if (!text.startsWith('/')) {
    return;
  }

  // /groupid: always respond, even if group is not whitelisted
  if (text === '/groupid') {
    const src = resolveSource(event.source);
    if (src && (src.chatType === 'group' || src.chatType === 'room')) {
      await replyMessage(event.replyToken, `此群組 ID：\n${src.chatId}`, env);
    } else {
      await replyMessage(event.replyToken, '此指令僅在群組中可用。', env);
    }
    return;
  }

  const source = resolveSource(event.source);
  if (!source) {
    console.error('Could not resolve source from event');
    return;
  }

  // Group whitelist: only respond in allowed groups, 1:1 always allowed
  if (source.chatType === 'group' || source.chatType === 'room') {
    const allowed = getAllowedGroups(env);
    if (allowed.length > 0 && !allowed.includes(source.chatId)) {
      return;
    }
  }

  const timezone = env.DEFAULT_TIMEZONE || 'Asia/Taipei';
  const result = parseCommand(text, timezone);

  // Parse error
  if ('error' in result) {
    await replyMessage(event.replyToken, result.error, env);
    return;
  }

  const command = result as Command;

  switch (command.type) {
    case 'remind': {
      const id = await createReminder(
        env.DB,
        source,
        command.remindAtUtc,
        command.message,
        timezone,
      );
      const localTime = formatLocalTime(command.remindAtUtc, timezone);
      await replyMessage(
        event.replyToken,
        `已設定提醒！\nID: ${id}\n時間：${localTime}\n訊息：${command.message}`,
        env,
      );
      break;
    }

    case 'list': {
      const listResult = await listReminders(env.DB, source.userId, source.chatId, timezone);
      await replyMessage(event.replyToken, listResult, env);
      break;
    }

    case 'cancel': {
      const cancelResult = await cancelReminder(env.DB, command.reminderId, source.userId);
      await replyMessage(event.replyToken, cancelResult, env);
      break;
    }

    case 'unknown': {
      await replyMessage(event.replyToken, USAGE_TEXT, env);
      break;
    }
  }
}

function resolveSource(source: LineWebhookBody['events'][number]['source']): SourceInfo | null {
  if (!source.userId) return null;

  switch (source.type) {
    case 'user':
      return { userId: source.userId, chatType: 'user', chatId: source.userId };
    case 'group':
      if (!source.groupId) return null;
      return { userId: source.userId, chatType: 'group', chatId: source.groupId };
    case 'room':
      if (!source.roomId) return null;
      return { userId: source.userId, chatType: 'room', chatId: source.roomId };
    default:
      return null;
  }
}
