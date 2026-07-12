/** What the fixture app's backend answers. */
export const routes = {
  'GET /api/items': [
    { id: '1', title: 'Rendered from the app', subtitle: 'not a mock-up' },
    { id: '2', title: 'Seeded from fixtures', subtitle: 'shaped like the real endpoint' },
  ],
}

export const fallback = {}
