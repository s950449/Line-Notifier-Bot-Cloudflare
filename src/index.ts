import { Env } from './types';
import { handleWebhook } from './webhook';
import { dispatchDueReminders } from './dispatcher';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/webhook/line') {
      return handleWebhook(request, env);
    }

    // Health check
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('LINE Reminder Bot is running', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await dispatchDueReminders(env);
  },
} satisfies ExportedHandler<Env>;
