/**
 * Perron's seed data, in the generic route-table form.
 *
 * Every field matches the shape the real Worker returns, so the screens run
 * their ordinary code paths: the session bootstrap, the geofence check, the
 * presence ruling, the room socket. Nothing is special-cased for the camera.
 */
const NOW = new Date('2026-03-17T09:41:00+01:00').getTime()
const min = (n) => n * 60_000
const hr = (n) => n * 3_600_000
const day = (n) => n * 86_400_000

const ME = { authorId: 'u_demo', displayName: 'Stille Conducteur' }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME.authorId, displayName: ME.displayName })}.demo`

/** GTFS gives departure times in epoch *seconds*, and the app subtracts delays from them. */
const at = (offset) => Math.floor((NOW + offset) / 1000)

const departures = [
  { stationCode: 'ASD', tripId: 'ic-3059', routeId: 'IC 3059', departureAt: at(min(3)), delaySec: 0, canceled: false, destination: 'Utrecht Centraal', platform: '4a' },
  { stationCode: 'ASD', tripId: 'spr-4429', routeId: 'SPR 4429', departureAt: at(min(6)), delaySec: 300, canceled: false, destination: 'Haarlem', platform: '11b' },
  { stationCode: 'ASD', tripId: 'ic-841', routeId: 'IC 841', departureAt: at(min(9)), delaySec: 0, canceled: false, destination: 'Rotterdam Centraal', platform: '2' },
  { stationCode: 'ASD', tripId: 'ic-1543', routeId: 'IC 1543', departureAt: at(min(12)), delaySec: 720, canceled: false, destination: 'Den Haag Centraal', platform: '7b' },
  { stationCode: 'ASD', tripId: 'spr-6021', routeId: 'SPR 6021', departureAt: at(min(15)), delaySec: 0, canceled: true, destination: 'Zaandam', platform: '8' },
]

const post = (id, kind, body, displayName, ago, ttl) => ({
  id,
  stationCode: 'ASD',
  kind,
  authorId: `u_${id}`,
  displayName,
  body,
  createdAt: NOW - ago,
  expiresAt: NOW - ago + ttl,
})

const msg = (id, displayName, body, ago, reactions, mine = false) => ({
  id,
  roomId: 'r-disruption',
  authorId: mine ? ME.authorId : `u_${id}`,
  displayName,
  body,
  sentAt: NOW - ago,
  ...(reactions ? { reactions } : {}),
})

const STAMPS = ['ASD', 'UT', 'EHV', 'GVC', 'RTD', 'SHL', 'AMF', 'ALM', 'DVD', 'ASS', 'ZL', 'HGL', 'ASDZ', 'ASA', 'GN']

export const routes = {
  'POST /api/session': { token, authorId: ME.authorId, displayName: ME.displayName },
  'GET /api/status': { maintenance: false, broadcasts: [], stringsVersion: 1, disabledFeatures: [] },
  'GET /api/strings': { version: 1, catalogs: {} },

  // A room opens within 250m and the screen nudges you from up to 1km away —
  // so standing on the platform, exactly one station is in range.
  'GET /api/nearby': [{ code: 'ASD', name: 'Amsterdam Centraal', distanceM: 62 }],

  'GET /api/stations/:code/departures': departures,
  'GET /api/stations/:code/presence': { present: 212, windowMinutes: 15 },

  'GET /api/stations/:code/rooms': [
    { id: 'r-disruption', title: 'Storing: seinstoring tussen Amsterdam C. en Haarlem', visibility: 'public', createdAt: NOW - min(26), onlineCount: 34, disruptionId: 'ovapi-9912' },
    { id: 'r-spoor-4a', title: 'Spoor 4a — wachten op de 8:44', visibility: 'public', createdAt: NOW - min(11), onlineCount: 12 },
    { id: 'r-koffie', title: 'Wie staat er in de rij bij de koffie?', visibility: 'public', createdAt: NOW - min(48), onlineCount: 7 },
  ],

  'GET /api/stations/:code/questions': [
    { question: post('q1', 'question', 'Welk spoor voor de intercity naar Zwolle? Het bord springt heen en weer.', 'Blauwe Paraplu', min(4), hr(6)), answerCount: 3 },
    { question: post('q2', 'question', 'Is de roltrap naar 10/11 weer in bedrijf, of moet ik omlopen?', 'Late Forens', min(19), hr(6)), answerCount: 2 },
  ],

  'GET /api/stations/:code/wall': [
    post('w1', 'outage', 'Lift naar spoor 5/6 is stuk — met een koffer moet je om via 7.', 'Rolkoffer', min(22), hr(12)),
    post('w2', 'lost', 'Blauwe paraplu laten staan in de 8:12 naar Deventer, bak 3.', 'Doorweekt', hr(3), day(30)),
  ],

  'POST /api/stations/:code/checkin': {
    stationCode: 'ASD', firstVisitAt: NOW - day(90), lastVisitAt: NOW,
    visits: 12, collected: STAMPS.length, total: 397, counted: false,
  },

  'GET /api/users/:id/passport': {
    authorId: ME.authorId,
    displayName: ME.displayName,
    collected: STAMPS.length,
    total: 397,
    stamps: STAMPS.map((code, i) => ({
      stationCode: code,
      firstVisitAt: NOW - day(180 - i * 3),
      lastVisitAt: NOW - day(i % 11),
      visits: 1 + ((i * 7) % 23),
    })),
  },

  'GET /api/me/profile': {
    authorId: ME.authorId, displayName: ME.displayName, delivery: 'all',
    deviceCount: 1, collected: STAMPS.length, total: 397, blockedCount: 0,
  },
  'GET /api/me/subscription': { active: false, until: 0 },
  'GET /api/me/blocked': [],
  'GET /api/cosmetics/catalog': { enabled: false, items: [] },

  // The passport screen reads the boards to place you on them; an unmatched
  // route would fall back to {} and the screen would try to .filter() an object.
  'GET /api/leaderboard/stamps': [
    { name: 'Spoorzoeker', collected: 291, spanMs: day(430) },
    { name: 'Nachtnet', collected: 264, spanMs: day(612) },
  ],
  'GET /api/leaderboard/streak': [{ name: 'Nachtnet', streak: 96, collected: 264 }],
  'GET /api/leaderboard/disruptions': [{ station: 'UT', name: 'Utrecht Centraal', count: 160 }],
  'GET /api/leaderboard/busiest': [{ station: 'ASD', name: 'Amsterdam Centraal', count: 4820 }],
}

export const fallback = {}

/** The room socket: what a joiner actually receives. */
export function ws(send) {
  send({
    type: 'history',
    messages: [
      msg('m1', 'Kapotte Wissel', 'Seinstoring bij Sloterdijk. Ze zeggen zeker tot 9:30, niks over de IC naar Haarlem.', min(14), [{ emoji: '😮', by: ['a', 'b', 'c'] }]),
      msg('m2', 'Blauwe Paraplu', 'Bus 356 vanaf de IJ-zijde rijdt wel. Halte staat vol maar hij komt elke 10 min.', min(11), [{ emoji: '🙏', by: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }]),
      msg('m3', 'Late Forens', 'Iemand net langs spoor 4? Staat daar nog iets richting Haarlem?', min(9)),
      msg('m4', 'Kop van Trein', 'Sta er nu. Bord is leeg, conducteur zegt: eerst Utrecht afwerken.', min(8), [{ emoji: '👍', by: ['a', 'b', 'c', 'd'] }]),
      msg('m5', ME.displayName, 'Dan wordt het de bus. Dank — scheelt 40 minuten staren naar een leeg bord.', min(6), undefined, true),
      msg('m6', 'Kapotte Wissel', 'Update van het bord: 9:05 weer eerste trein. Blijf staan als je kunt.', min(2), [{ emoji: '❤️', by: ['a', 'b'] }]),
    ],
  })
  send({ type: 'presence', state: { canWrite: true, reason: 'inside', lastInsideAt: NOW, distanceM: 48 } })
  send({ type: 'online', count: 34 })
  send({ type: 'reaction', count: 18, mine: false })
}
