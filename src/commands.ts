import { Command } from './types';

const RELATIVE_PATTERN = /^(\d+)([mhd])$/;
const ABSOLUTE_PATTERN = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/;
const MAX_DELAY_DAYS = 365;

export function parseCommand(text: string, timezone: string): Command | { error: string } {
  const trimmed = text.trim();

  if (trimmed === '/list') {
    return { type: 'list' };
  }

  if (trimmed.startsWith('/cancel ')) {
    const reminderId = trimmed.slice('/cancel '.length).trim();
    if (!reminderId) {
      return { error: '請提供提醒 ID。\n用法：/cancel <id>' };
    }
    return { type: 'cancel', reminderId };
  }

  if (trimmed.startsWith('/remind ')) {
    return parseRemindCommand(trimmed.slice('/remind '.length).trim(), timezone);
  }

  // Not a recognized command
  return { type: 'unknown' };
}

function parseRemindCommand(args: string, timezone: string): Command | { error: string } {
  if (!args) {
    return { error: '用法：/remind <時間> <訊息>\n範例：\n  /remind 10m 喝水\n  /remind 2h 寄報告\n  /remind 2026-02-15 09:00 開會' };
  }

  // Try relative time: "10m message", "2h message", "1d message"
  const relativeMatch = args.match(/^(\d+[mhd])\s+(.+)$/s);
  if (relativeMatch) {
    const [, duration, message] = relativeMatch;
    const parsed = parseRelativeDuration(duration);
    if ('error' in parsed) return parsed;
    return { type: 'remind', remindAtUtc: parsed.utc, message: message.trim() };
  }

  // Try absolute time: "2026-02-15 09:00 message"
  const absoluteMatch = args.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/s);
  if (absoluteMatch) {
    const [, datetime, message] = absoluteMatch;
    const parsed = parseAbsoluteDatetime(datetime, timezone);
    if ('error' in parsed) return parsed;
    return { type: 'remind', remindAtUtc: parsed.utc, message: message.trim() };
  }

  return { error: '無法解析時間格式。\n支援格式：\n  相對時間：10m, 2h, 1d\n  絕對時間：YYYY-MM-DD HH:mm' };
}

function parseRelativeDuration(duration: string): { utc: string } | { error: string } {
  const match = duration.match(RELATIVE_PATTERN);
  if (!match) {
    return { error: '無效的時間格式。' };
  }

  const [, numStr, unit] = match;
  const num = parseInt(numStr, 10);

  let minutes: number;
  switch (unit) {
    case 'm': minutes = num; break;
    case 'h': minutes = num * 60; break;
    case 'd': minutes = num * 60 * 24; break;
    default: return { error: '無效的時間單位。' };
  }

  if (minutes < 1) {
    return { error: '提醒時間至少需要 1 分鐘。' };
  }

  if (minutes > MAX_DELAY_DAYS * 24 * 60) {
    return { error: `提醒時間不能超過 ${MAX_DELAY_DAYS} 天。` };
  }

  const remindAt = new Date(Date.now() + minutes * 60 * 1000);
  return { utc: remindAt.toISOString() };
}

function parseAbsoluteDatetime(
  datetime: string,
  timezone: string,
): { utc: string } | { error: string } {
  const match = datetime.match(ABSOLUTE_PATTERN);
  if (!match) {
    return { error: '無效的日期格式。請使用 YYYY-MM-DD HH:mm。' };
  }

  const [, date, time] = match;

  // Parse as local timezone by creating a formatter then reverse-converting
  const localStr = `${date}T${time}:00`;
  const utcDate = localToUtc(localStr, timezone);

  if (!utcDate || isNaN(utcDate.getTime())) {
    return { error: '無效的日期時間。' };
  }

  const now = new Date();
  if (utcDate.getTime() <= now.getTime()) {
    return { error: '提醒時間必須在未來。' };
  }

  const diffMinutes = (utcDate.getTime() - now.getTime()) / (60 * 1000);
  if (diffMinutes < 1) {
    return { error: '提醒時間至少需要 1 分鐘後。' };
  }

  if (diffMinutes > MAX_DELAY_DAYS * 24 * 60) {
    return { error: `提醒時間不能超過 ${MAX_DELAY_DAYS} 天。` };
  }

  return { utc: utcDate.toISOString() };
}

function localToUtc(localIso: string, timezone: string): Date {
  // Use Intl to figure out the offset for the given timezone
  // Create a date assuming UTC, then find the offset
  const tempDate = new Date(localIso + 'Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format the UTC time as if it were in the target timezone to find offset
  const parts = formatter.formatToParts(tempDate);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

  const tzYear = parseInt(get('year'), 10);
  const tzMonth = parseInt(get('month'), 10);
  const tzDay = parseInt(get('day'), 10);
  const tzHour = parseInt(get('hour'), 10);
  const tzMinute = parseInt(get('minute'), 10);
  const tzSecond = parseInt(get('second'), 10);

  // The local time in timezone when tempDate is UTC
  const tzDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond));

  // Offset = tzDate - tempDate (in ms)
  const offsetMs = tzDate.getTime() - tempDate.getTime();

  // The actual UTC time for the user's local input
  const inputAsUtc = new Date(localIso + 'Z');
  return new Date(inputAsUtc.getTime() - offsetMs);
}

export function formatLocalTime(utcIso: string, timezone: string): string {
  const date = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}
