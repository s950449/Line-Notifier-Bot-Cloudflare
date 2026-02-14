import { Env } from './types';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export async function replyMessage(replyToken: string, text: string, env: Env): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`LINE reply failed: ${res.status} ${body}`);
  }
}

export async function pushMessage(chatId: string, text: string, env: Env): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: chatId,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push failed: ${res.status} ${body}`);
  }
}

export async function leaveChat(chatType: 'group' | 'room', chatId: string, env: Env): Promise<void> {
  const endpoint = chatType === 'group' ? 'group' : 'room';
  const res = await fetch(`${LINE_API_BASE}/${endpoint}/${chatId}/leave`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`LINE leave ${endpoint} failed: ${res.status} ${body}`);
  }
}

export async function verifySignature(
  body: string,
  signature: string,
  channelSecret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}
