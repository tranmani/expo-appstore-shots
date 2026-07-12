/**
 * A stand-in for your backend: HTTP plus a WebSocket, answering with fixtures.
 *
 * The app is not modified for the camera. It boots, opens its session, asks for
 * a fix, fetches, and connects its sockets exactly as it does against
 * production — only the answers are seeded. Anything the fixtures do not match
 * returns `fallback` (an empty object by default), which is also what a
 * well-behaved app tolerates from an older server.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { WebSocketServer } from 'ws'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
}

/**
 * `GET /api/rooms/:id` → { method, segments }. A `:name` segment matches any
 * value and is handed to the handler as a param.
 */
export function parseRoute(key) {
  const [method, path] = key.includes(' ') ? key.split(/\s+/) : ['GET', key]
  return { method: method.toUpperCase(), parts: path.split('/').filter(Boolean) }
}

export function match(route, method, path) {
  if (route.method !== method) return null
  const parts = path.split('/').filter(Boolean)
  if (parts.length !== route.parts.length) return null

  const params = {}
  for (let i = 0; i < parts.length; i++) {
    const want = route.parts[i]
    if (want.startsWith(':')) params[want.slice(1)] = decodeURIComponent(parts[i])
    else if (want !== parts[i]) return null
  }
  return params
}

export function serve({ port, dist, fixtures }) {
  const routes = Object.entries(fixtures.routes ?? {}).map(([key, value]) => ({
    ...parseRoute(key),
    value,
  }))

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const send = (body, status = 200) => {
      const payload = JSON.stringify(body ?? {})
      res.writeHead(status, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      })
      res.end(payload)
    }

    if (req.method === 'OPTIONS') return send({})

    // The page and its bundle, served same-origin with the mock API.
    if (!isApi(url.pathname, fixtures)) {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
      try {
        const body = readFileSync(resolve(dist, file))
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
        return res.end(body)
      } catch {
        res.writeHead(404)
        return res.end('not found')
      }
    }

    for (const route of routes) {
      const params = match(route, req.method ?? 'GET', url.pathname)
      if (!params) continue
      const value =
        typeof route.value === 'function'
          ? await route.value({ params, query: Object.fromEntries(url.searchParams), req })
          : route.value
      return send(value)
    }

    return send(fixtures.fallback ?? {})
  })

  /**
   * One socket, one script. `fixtures.ws(send, info)` is called on connect and
   * pushes whatever the client expects to receive — a chat history, a presence
   * ruling, a live counter.
   */
  if (fixtures.ws) {
    const wss = new WebSocketServer({ server })
    wss.on('connection', (ws, req) => {
      const send = (event) => ws.send(typeof event === 'string' ? event : JSON.stringify(event))
      fixtures.ws(send, { url: req.url })
      ws.on('message', () => undefined)
      ws.on('error', () => undefined)
    })
  }

  return new Promise((ready) => {
    server.listen(port, () => ready(server))
  })
}

/** Anything under the API prefix is the backend; everything else is the page. */
function isApi(path, fixtures) {
  const prefix = fixtures.prefix ?? '/api/'
  return path.startsWith(prefix)
}
