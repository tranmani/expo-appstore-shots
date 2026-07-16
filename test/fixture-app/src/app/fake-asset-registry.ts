/**
 * A stand-in used by two tests: one proves `config.stubs` can override even the
 * `react-native/…` subpath catch-all, the other proves `redirectFile` matches a
 * module by where it lands rather than by what the import called it.
 *
 * The marker has to be LOAD-BEARING, and getting there took two tries. It began
 * as an exported constant, which esbuild tree-shook away — the importer only
 * imports `registerAsset`, so nothing else survives. Then it was `void 'MARKER'`
 * inside the function, which esbuild also dropped: a statement with no effect is
 * not kept just because someone was hoping to grep for it. Both versions made
 * the test fail whether the config won or lost.
 *
 * So the marker is the value `registerAsset` actually returns from. It cannot be
 * removed without changing what the function does.
 */
const MARKER = 'USER_ASSET_REGISTRY_WON'

/** kitchen-sink.tsx asserts the id is > 0; 22 is. */
export const registerAsset = () => MARKER.length
export const getAssetByID = () => undefined
export const codegenNativeCommands = () => new Proxy({}, { get: () => () => undefined })
export default { registerAsset, getAssetByID }
