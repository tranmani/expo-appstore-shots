/**
 * `react-native/Libraries/…` — the deep internals, stubbed as a group.
 *
 * THE RECURRING FAILURE SHAPE, and it does not look like what it is:
 *
 *     Could not resolve "…/src/stubs/react-native.tsx/Libraries/Image/AssetRegistry"
 *
 * `react-native` is aliased to a *file*, and esbuild's alias rewrites subpaths
 * by prefix — so the moment any package imports `react-native/Libraries/…`, the
 * alias splices the subpath onto the end of the stub's own filename and asks the
 * resolver for a directory that could never exist. Nothing in that message says
 * "a native package asked for an internal module"; it reads like the tool's own
 * install is broken.
 *
 * Skia does it (AssetRegistry), react-native-maps does it
 * (codegenNativeCommands), and every new-architecture package that ships a
 * codegen'd view does it. One import, and every screen in the run fails to
 * bundle — which is why this resolves to a stub instead of an error.
 */
import { anything } from './anything'

/**
 * The asset registry, implemented rather than faked.
 *
 * It is a real registry on a device: Metro rewrites `require('./logo.png')` into
 * `registerAsset({...})` and hands back an integer, which `Image` later resolves
 * through `getAssetByID`. Nothing here goes through Metro — esbuild inlines
 * images as data URIs — so this is only ever asked for by a *package* that
 * bundles its own art. Keeping it honest (an id that resolves back to the asset
 * it was given) costs three lines and means a package that round-trips its own
 * asset gets its asset back rather than `undefined`.
 */
const assets: Record<string, unknown>[] = []

export function registerAsset(asset: Record<string, unknown>): number {
  assets.push(asset)
  return assets.length // 1-based: 0 is "no asset" in RN's own code
}

export function getAssetByID(id: number): Record<string, unknown> | undefined {
  return assets[id - 1]
}

/**
 * `codegenNativeCommands` returns the object a package calls to drive a native
 * view imperatively — `Commands.animateToRegion(ref, …)`. There is no native
 * view, so every command is a no-op; the important part is that the *object*
 * exists, because packages destructure it at module scope.
 */
export function codegenNativeCommands<T extends { supportedCommands: readonly string[] }>(
  options?: T,
): Record<string, () => void> {
  const out: Record<string, () => void> = {}
  for (const name of options?.supportedCommands ?? []) out[name] = () => undefined
  // Unlisted commands still have to answer, so anything not declared is a no-op
  // too — except `then`, which must stay undefined or this object is a thenable
  // that hangs any `await` on it forever.
  return new Proxy(out, {
    get: (t, p) => (p === 'then' ? undefined : p in t ? t[p as string] : () => undefined),
  })
}

/** `codegenNativeComponent` names a native view. There isn't one; draw nothing. */
export function codegenNativeComponent(_name?: string) {
  return () => null
}

/**
 * The default export, which has to be all of these modules at once.
 *
 * One stub answers every `react-native/Libraries/…` subpath, so its default is
 * whatever the importer thinks it imported: `codegenNativeCommands` imports a
 * *function* and calls it, `AssetRegistry` imports an *object* and reads
 * `registerAsset` off it.
 *
 * The first version of this returned `() => undefined` for every property and
 * `undefined` from every call — which looks inert and is not. Calling the
 * default as `codegenNativeCommands(...)` gave back `undefined`, and the next
 * line (`Commands.animateToRegion(...)`) threw "Cannot read properties of
 * undefined". A stub that cannot survive being *used* is not a stub; it is a
 * crash with a friendly name. The e2e run caught it, which is what the e2e run
 * is for.
 *
 * `anything()` answers all of those shapes. The two functions above are spliced
 * in because they are real: an asset that round-trips should come back.
 */
const internals: unknown = new Proxy(anything(), {
  get(target, prop) {
    if (prop === 'registerAsset') return registerAsset
    if (prop === 'getAssetByID') return getAssetByID
    if (prop === 'codegenNativeCommands') return codegenNativeCommands
    return Reflect.get(target, prop)
  },
  apply: (target, thisArg, args) => Reflect.apply(target as () => unknown, thisArg, args),
})

export default internals
