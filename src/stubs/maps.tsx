/**
 * react-native-maps.
 *
 * The map itself is a native view — Apple's MKMapView or Google's — and there is
 * nothing in a headless browser to stand in for it. On the way in it reaches for
 * `react-native/Libraries/Utilities/codegenNativeCommands`, which is the import
 * that used to end the run (see `rnSubpath()` in build.mjs).
 *
 * `MapView` renders an empty `View` rather than `null`, and the difference is
 * the whole point: a map is usually the biggest box on its screen, and deleting
 * it would let everything below it slide up into a layout the app never has. An
 * empty box of the right size keeps the rest of the screen honest — and reads,
 * correctly, as "the map did not draw" rather than as a screen that never had
 * one.
 *
 * A screen whose selling point *is* the map should point `config.stubs` at a
 * component that renders a static map image; that frame is then real.
 */
import { View } from 'react-native'

const Nothing = (_props: Record<string, unknown>) => null

export const MapView = View
export const Marker = Nothing
export const MarkerAnimated = Nothing
export const Callout = Nothing
export const CalloutSubview = Nothing
export const Polyline = Nothing
export const Polygon = Nothing
export const Circle = Nothing
export const Overlay = Nothing
export const Heatmap = Nothing
export const Geojson = Nothing
export const UrlTile = Nothing
export const WMSTile = Nothing
export const LocalTile = Nothing
export const OverlayAnimated = Nothing

export const PROVIDER_GOOGLE = 'google'
export const PROVIDER_DEFAULT = undefined
export const MAP_TYPES = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  NONE: 'none',
  MUTEDSTANDARD: 'mutedStandard',
}

/** `new AnimatedRegion({...}).timing({...}).start()` has to survive being called. */
export class AnimatedRegion {
  constructor(region?: Record<string, number>) {
    Object.assign(this, region ?? {})
  }
  setValue = () => undefined
  setOffset = () => undefined
  flattenOffset = () => undefined
  stopAnimation = () => undefined
  addListener = () => 'id'
  removeListener = () => undefined
  spring = () => ({ start: () => undefined, stop: () => undefined })
  timing = () => ({ start: () => undefined, stop: () => undefined })
}

export const Animated = MapView
export default MapView
