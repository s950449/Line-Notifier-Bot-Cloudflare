export interface Env {
  DB: D1Database;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  DEFAULT_TIMEZONE: string;
  MAX_RETRY: string;
  DISPATCH_BATCH_SIZE: string;
  ALLOWED_GROUPS: string;
}

export type ChatType = 'user' | 'group' | 'room';
export type ReminderStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface Reminder {
  id: string;
  owner_user_id: string;
  chat_type: ChatType;
  chat_id: string;
  message: string;
  remind_at_utc: string;
  timezone: string;
  status: ReminderStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceInfo {
  userId: string;
  chatType: ChatType;
  chatId: string;
}

export interface ParsedCommand {
  type: 'remind' | 'list' | 'cancel' | 'unknown';
}

export interface RemindCommand extends ParsedCommand {
  type: 'remind';
  remindAtUtc: string;
  message: string;
}

export interface ListCommand extends ParsedCommand {
  type: 'list';
}

export interface CancelCommand extends ParsedCommand {
  type: 'cancel';
  reminderId: string;
}

export interface UnknownCommand extends ParsedCommand {
  type: 'unknown';
}

export type Command = RemindCommand | ListCommand | CancelCommand | UnknownCommand;

// LINE Webhook Types
export interface LineWebhookBody {
  events: LineEvent[];
}

export interface LineEvent {
  type: string;
  replyToken: string;
  source: LineSource;
  message?: LineMessage;
}

export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface LineMessage {
  type: string;
  text?: string;
}
