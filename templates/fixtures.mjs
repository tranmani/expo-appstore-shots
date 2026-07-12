/**
 * What your backend answers while the app is being photographed.
 *
 * These are the *only* things that are faked. The app still runs its own code:
 * its query client, its auth bootstrap, its permission checks, its sockets. If a
 * screen cannot render this data, it cannot render production data either — so
 * make every field match the shape your real endpoint returns.
 *
 * Keys are `METHOD /path`, with `:name` matching any segment. A value can be
 * data, or a function of `{ params, query }`.
 */

/** Keep every relative label ("3 min ago") in step with the clock in the config. */
const NOW = new Date('2026-03-17T09:41:00+01:00').getTime()
const min = (n) => n * 60_000

export const routes = {
  'POST /api/session': { token: 'demo-token', userId: 'u_demo', displayName: 'Alex' },

  'GET /api/me': {
    id: 'u_demo',
    displayName: 'Alex',
    joinedAt: NOW - min(60 * 24 * 90),
  },

  'GET /api/items': [
    { id: '1', title: 'The first thing', subtitle: 'With a believable subtitle', at: NOW - min(3) },
    { id: '2', title: 'The second thing', subtitle: 'Not lorem ipsum, ever', at: NOW - min(11) },
  ],

  'GET /api/items/:id': ({ params }) => ({
    id: params.id,
    title: 'The first thing',
    body: 'Real copy, the length real copy actually runs to.',
  }),
}

/** Anything unmatched. An empty object is what a tolerant client expects. */
export const fallback = {}

/** Everything under this prefix is the API; the rest is the page. */
export const prefix = '/api/'

/**
 * A WebSocket, if your app opens one. `send` pushes an event to the client the
 * moment it connects — a chat history, a presence ruling, a live counter.
 */
export function ws(send) {
  send({
    type: 'history',
    messages: [
      { id: 'm1', author: 'Sam', body: 'Anyone else stuck here?', at: NOW - min(9) },
      { id: 'm2', author: 'Alex', body: 'Bus 356 is running. 10 minutes.', at: NOW - min(6) },
    ],
  })
}
