/**
 * Phase 7: auto-drafted, narrative-aware copy.
 *
 * The LLM is injected, so everything worth testing is pure: the doctrine scorer
 * that decides whether a draft is shippable, the prompt that constrains what the
 * model may say, and the drafter that ranks options without ever picking one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreHeadline, draftPrompt, parseOptions, draftCaptions, anthropicProvider, NARRATIVE_ARC } from '../src/copy.mjs'

test('scoreHeadline enforces the iron rules', () => {
  assert.ok(scoreHeadline('Find your people').ok, 'a tight benefit passes')
  assert.ok(!scoreHeadline('Track your workouts and your meals and your sleep').ok, 'two ideas + too long fails')
  assert.deepEqual(
    scoreHeadline('Fast and simple').issues.filter((i) => /two ideas/.test(i)).length,
    1,
    '"and" is caught',
  )
  assert.ok(!scoreHeadline('').ok, 'empty fails')
  assert.ok(scoreHeadline('This is a genuinely very long overpromising headline here').issues.some((i) => /too long/.test(i)))
  assert.ok(scoreHeadline('Chat').issues.some((i) => /one word/.test(i)), 'a lone word is flagged — it rarely sells a benefit')
})

test('scoreHeadline flags a smuggled sentence and thumbnail-illegible length', () => {
  assert.ok(scoreHeadline('Book it. Forget it.').issues.some((i) => /sentence/.test(i)))
  const long = 'Everything you could ever possibly want right here'
  assert.ok(scoreHeadline(long).issues.some((i) => /too many characters|too long/.test(i)))
})

test('draftPrompt carries the app, the screen, the arc role, and the no-overclaim rule', () => {
  const p = draftPrompt({
    app: { name: 'Perron', tagline: 'Chat with the platform you are on', audience: 'commuters' },
    screen: { id: 'nearby', shows: 'stations within 250m' },
    role: 'hero',
    count: 3,
  })
  assert.match(p, /Perron/)
  assert.match(p, /commuters/)
  assert.match(p, /stations within 250m/)
  assert.match(p, /hero/)
  assert.match(p, /never claim anything the screen does not actually show/i)
  assert.match(p, /3 distinct options/)
})

test('parseOptions strips numbering, bullets and quotes', () => {
  assert.deepEqual(parseOptions('1. Find your people\n- "Only when you are there"\n• Chat nearby'), [
    'Find your people',
    'Only when you are there',
    'Chat nearby',
  ])
})

test('draftCaptions ranks rule-passing options first and never picks one', async () => {
  // A provider that returns one good option and one rule-breaker.
  const provider = async () => 'Find your people\nTrack this and that and everything else here'
  const drafted = await draftCaptions({
    provider,
    app: { name: 'X' },
    slides: [{ id: 'home' }],
  })
  assert.equal(drafted.length, 1)
  const opts = drafted[0].options
  assert.equal(opts[0].text, 'Find your people', 'the rule-passing option ranks first')
  assert.ok(opts[0].ok && !opts[1].ok, 'both are returned, scored — nothing is auto-chosen')
  assert.equal(drafted[0].role, 'hero', 'the first slide takes the hero role by default')
})

test('draftCaptions walks the narrative arc by slide position', async () => {
  const provider = async () => 'One option'
  const slides = NARRATIVE_ARC.map((_, i) => ({ id: `s${i}` }))
  const drafted = await draftCaptions({ provider, app: { name: 'X' }, slides })
  assert.deepEqual(drafted.map((d) => d.role), NARRATIVE_ARC, 'roles follow the arc in order')
})

test('anthropicProvider sends the screenshot and the prompt, and parses the reply', async () => {
  let captured
  const fetchImpl = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body), headers: opts.headers }
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'A\nB' }] }) }
  }
  const provider = anthropicProvider({ apiKey: 'k', model: 'claude-opus-4-8', fetchImpl })
  const reply = await provider('draft this', { image: Buffer.from('PNGBYTES') })

  assert.equal(captured.url, 'https://api.anthropic.com/v1/messages')
  assert.equal(captured.headers['x-api-key'], 'k')
  const content = captured.body.messages[0].content
  assert.equal(content[0].type, 'image', 'the screenshot is sent so the draft cannot overclaim')
  assert.equal(content[0].source.data, Buffer.from('PNGBYTES').toString('base64'))
  assert.equal(content[1].text, 'draft this')
  assert.equal(reply, 'A\nB', 'the text blocks are joined')
})

test('anthropicProvider refuses to run without a key', () => {
  assert.throws(() => anthropicProvider({}), /apiKey/)
})
