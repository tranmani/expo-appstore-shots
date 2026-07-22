/**
 * Auto-drafted, narrative-aware caption copy.
 *
 * We already run the real app and hold the app's own metadata, so of everyone in
 * this space we are best placed to draft the headline — not to finalise it. This
 * module drafts, scores against the doctrine, and hands back variants; a human
 * still chooses. The rules below are the competitor's `_QUALITY_BAR` and narrative
 * doctrine, encoded so a draft that breaks them is caught, not shipped.
 *
 * The LLM call itself is injected as `provider` (an async `(prompt) => text`), so
 * everything here — the prompt, the scoring, the ordering — is pure and testable,
 * and the tool stays free of any bundled key: the caller supplies the provider,
 * the same way store credentials are the caller's to hold.
 */

/** The narrative arc a store deck should walk, in order. */
export const NARRATIVE_ARC = ['hero', 'differentiator', 'ecosystem', 'feature', 'trust', 'wall']

const STOP_COMPOUND = /\band\b|&|\+|,/i

/**
 * Score one headline against the iron rules. Returns `{ ok, issues }`; `ok` is
 * true only when nothing fired. These are the rules a scroller's half-second
 * enforces whether we check them or not — one idea, few words, legible small.
 */
export function scoreHeadline(text) {
  const issues = []
  const trimmed = (text ?? '').trim()
  const words = trimmed ? trimmed.split(/\s+/) : []

  if (!trimmed) issues.push('empty')
  if (words.length > 5) issues.push(`too long (${words.length} words; aim for 3–5)`)
  if (words.length === 1 && trimmed) issues.push('one word rarely sells a benefit')
  // "and" / a comma / a plus is two ideas wearing one headline — the thumbnail
  // reader finishes neither.
  if (STOP_COMPOUND.test(trimmed)) issues.push('two ideas (drop the "and"/comma — one idea per slide)')
  // A period mid-headline is usually a full sentence smuggled in.
  if (/[.!?].+/.test(trimmed)) issues.push('reads as a sentence, not a headline')
  // Thumbnail legibility is length-driven too: long strings shrink illegibly.
  if (trimmed.length > 40) issues.push(`too many characters (${trimmed.length}; long strings vanish at thumbnail size)`)

  return { ok: issues.length === 0, issues }
}

/**
 * The prompt handed to the provider for one slide. It carries the app's identity,
 * what the screen actually shows (so the draft cannot overclaim what is not on
 * screen — App Review rejects that), the slide's role in the arc, and the iron
 * rules. It asks for several distinct options, never one, because this stays a
 * drafting aid.
 */
export function draftPrompt({ app, screen, role, count = 3 }) {
  const lines = [
    `You are writing App Store screenshot headlines for "${app?.name ?? 'this app'}".`,
    app?.tagline ? `The app in one line: ${app.tagline}.` : null,
    app?.audience ? `Who it is for: ${app.audience}.` : null,
    '',
    `This screenshot shows the "${screen?.id ?? 'app'}" screen.`,
    screen?.shows ? `On screen: ${screen.shows}.` : null,
    role ? `Its job in the deck: the ${role} slide (${roleBrief(role)}).` : null,
    '',
    'Rules, all of them hard:',
    '- One idea. 3–5 words. No "and", no comma, no second clause.',
    '- A benefit the user feels, not a feature name.',
    '- Legible shrunk to a thumbnail; so short and concrete.',
    '- Never claim anything the screen does not actually show.',
    '',
    `Give ${count} distinct options, one per line, no numbering, nothing else.`,
  ]
  return lines.filter((l) => l !== null).join('\n')
}

/** A one-line reminder of what each arc role is for, folded into the prompt. */
function roleBrief(role) {
  return (
    {
      hero: 'the single most important thing the app does',
      differentiator: 'why this app and not the obvious alternative',
      ecosystem: 'how it fits the rest of the user’s world',
      feature: 'one concrete capability, shown not told',
      trust: 'proof it is safe and well-made',
      wall: 'the last nudge to download',
    }[role] ?? 'sell this screen'
  )
}

/** Split a provider's reply into candidate lines, cleaned of numbering/quotes/bullets. */
export function parseOptions(reply) {
  return (reply ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
}

/**
 * Draft captions for a deck. For each slide, ask the provider, parse the options,
 * score every one, and return them — best (rule-passing, then shortest) first,
 * each with its score. Never picks a single answer, never mutates the config:
 * output is a suggestion list a human folds in.
 *
 * `provider` is `(prompt, slide) => Promise<string>`; the caller wires it to their
 * LLM. The slide is passed too so a provider can send the actual screenshot
 * (`slide.image`) — the surest way to stop a draft claiming what is not on screen.
 */
export async function draftCaptions({ provider, app, slides }) {
  const out = []
  for (const [i, slide] of slides.entries()) {
    const role = slide.role ?? NARRATIVE_ARC[Math.min(i, NARRATIVE_ARC.length - 1)]
    const prompt = draftPrompt({ app, screen: slide, role, count: 3 })
    const reply = await provider(prompt, slide)
    const options = parseOptions(reply)
      .map((text) => ({ text, ...scoreHeadline(text) }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.text.length - b.text.length)
    out.push({ screen: slide.id ?? slide.screen, role, options })
  }
  return out
}

/**
 * The default provider: Anthropic's Messages API, multimodal. It sends the prompt
 * AND the rendered screenshot (when the slide carries one), so the draft is
 * grounded in what the screen actually shows. The key is the caller's — read from
 * the environment, never bundled — the same stance as store credentials.
 *
 * Returns `(prompt, slide) => Promise<string>`. Kept out of `draftCaptions` so the
 * doctrine logic stays pure and testable; this is the one impure edge.
 */
export function anthropicProvider({ apiKey, model = 'claude-opus-4-8', fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('anthropicProvider needs an apiKey (set ANTHROPIC_API_KEY)')
  return async (prompt, slide) => {
    const content = [{ type: 'text', text: prompt }]
    if (slide?.image) {
      content.unshift({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: slide.image.toString('base64') },
      })
    }
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content }] }),
    })
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return (data.content ?? []).map((b) => b.text ?? '').join('\n')
  }
}
