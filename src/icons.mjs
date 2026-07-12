/**
 * Tab-bar icon names, checked against the lucide the app actually has.
 *
 * lucide renames icons between majors — `BarChart3` became `ChartColumn` — and a
 * name it does not know renders as *nothing*. The tab bar then photographs with
 * a hole in it, and the only way to find out is to look very hard at a small
 * glyph. So the name is checked up front, and a near miss is named.
 */

/** Levenshtein, small and exact — the lists here are hundreds of names, not millions. */
export function distance(a, b) {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)

  for (let i = 1; i <= m; i++) {
    const row = [i]
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[n]
}

/**
 * The names closest to `name`, best first.
 *
 * Case-insensitive containment comes first — someone writing `barchart` means
 * `BarChart`, and edit distance alone would rank a same-length unrelated word
 * above it.
 */
export function suggest(name, known, limit = 3) {
  const lower = name.toLowerCase()

  const scored = known.map((k) => {
    const kl = k.toLowerCase()
    const contains = kl.includes(lower) || lower.includes(kl)
    return { k, contains, d: distance(lower, kl) }
  })

  return scored
    .filter((s) => s.contains || s.d <= Math.max(3, Math.ceil(name.length / 3)))
    .sort((a, b) => Number(b.contains) - Number(a.contains) || a.d - b.d)
    .slice(0, limit)
    .map((s) => s.k)
}

/** Every unknown icon in the config, with what the author probably meant. */
export function checkIcons(items, known) {
  const problems = []
  const have = new Set(known)

  for (const item of items ?? []) {
    if (!item.icon || have.has(item.icon)) continue
    const near = suggest(item.icon, known)
    problems.push({
      icon: item.icon,
      tab: item.id,
      suggestions: near,
    })
  }
  return problems
}
