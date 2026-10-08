import type { Env } from './lobby';

export { Lobby } from './lobby';

export default {
  /** API calls go to the single directory Durable Object; everything else is the built client. */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return env.LOBBY.getByName('directory').fetch(request);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
