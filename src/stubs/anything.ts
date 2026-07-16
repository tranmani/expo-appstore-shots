/**
 * A value that answers to everything and never throws.
 *
 * Native modules are reached in shapes a stub cannot predict:
 * `Skia.Path.Make().moveTo(0,0).lineTo(1,1)`, `Commands.animateToRegion(ref)`,
 * `new Thing().start()`. Enumerating every one of them is a losing game — and
 * the cost of missing one is not a degraded screen, it is a TypeError that takes
 * the whole screenshot.
 *
 * So: every property is another one of these, every call returns another one,
 * and `new` works. It is callable, so `typeof` says `function`, which is what
 * app code guards on more often than not.
 *
 * `then` IS DELIBERATELY UNDEFINED, and this is the only subtle thing here. A
 * proxy that answers `then` with a function *is* a thenable, so `await` on one
 * would call it, hand it a `resolve` it never calls, and hang the render
 * forever. That failure is a blank frame with no error at all — which is the one
 * thing this tool must never produce.
 */
export const anything = (): any =>
  new Proxy(function () {} as unknown as Record<string, unknown>, {
    get(_t, prop) {
      if (prop === 'then') return undefined
      if (prop === Symbol.toPrimitive) return () => 0
      if (prop === Symbol.iterator) return function* () {}
      if (prop === 'toString' || prop === 'valueOf') return () => ''
      if (prop === 'length') return 0
      return anything()
    },
    apply: () => anything(),
    construct: () => anything(),
  })
