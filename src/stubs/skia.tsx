/**
 * @shopify/react-native-skia.
 *
 * Skia draws on a GPU canvas through a native module and a WASM build; neither
 * exists here, and its own `Platform.web.js` reaches for
 * `react-native/Libraries/Image/AssetRegistry` on the way in — which is the
 * import that used to take the whole bundle down (see `rnSubpath()` in
 * build.mjs).
 *
 * So the drawing primitives render nothing. This is a real limitation and worth
 * being plain about: a screen whose *content* is a Skia canvas — a chart, a
 * signature pad, a shader background — photographs empty, and no warning here
 * can tell the difference between that and a canvas that was only ever a
 * decorative flourish. If a Skia canvas is the product, point `config.stubs` at
 * a component of your own that draws the same thing in ordinary views, and the
 * frame will be honest.
 *
 * What this does buy: every *other* screen in the app bundles and renders. One
 * chart component reached through a barrel file used to cost the entire run.
 */
import type { ReactNode } from 'react'
import { anything } from './anything'

/** Draws nothing, and swallows whatever props a canvas element was given. */
const Nothing = (_props: Record<string, unknown>) => null

/** `Skia.Path.Make().moveTo(0,0).lineTo(1,1)` — a factory, a namespace and a builder at once. */
export const Skia = anything()

/* ------------------------------------------------------------ components --- */

export const Canvas = Nothing
export const Group = Nothing
export const Layer = Nothing
export const Paint = Nothing
export const Fill = Nothing
export const Box = Nothing
export const BoxShadow = Nothing
export const Circle = Nothing
export const Rect = Nothing
export const RoundedRect = Nothing
export const DiffRect = Nothing
export const Oval = Nothing
export const Line = Nothing
export const Path = Nothing
export const Points = Nothing
export const Patch = Nothing
export const Vertices = Nothing
export const Atlas = Nothing
export const Image = Nothing
export const ImageSVG = Nothing
export const Picture = Nothing
export const Text = Nothing
export const TextPath = Nothing
export const TextBlob = Nothing
export const Glyphs = Nothing
export const Paragraph = Nothing
export const Mask = Nothing
export const Drawing = Nothing
export const Shader = Nothing
export const ImageShader = Nothing
export const ColorShader = Nothing
export const Turbulence = Nothing
export const FractalNoise = Nothing
export const LinearGradient = Nothing
export const RadialGradient = Nothing
export const SweepGradient = Nothing
export const TwoPointConicalGradient = Nothing
export const Blend = Nothing
export const BlendColor = Nothing
export const ColorMatrix = Nothing
export const MatrixColorFilter = Nothing
export const LerpColorFilter = Nothing
export const LumaColorFilter = Nothing
export const SRGBToLinearGamma = Nothing
export const LinearToSRGBGamma = Nothing
export const Blur = Nothing
export const BlurMask = Nothing
export const DropShadow = Nothing
export const InnerShadow = Nothing
export const Shadow = Nothing
export const Offset = Nothing
export const Morphology = Nothing
export const DisplacementMap = Nothing
export const RuntimeShader = Nothing
export const BackdropFilter = Nothing
export const BackdropBlur = Nothing
export const DashPathEffect = Nothing
export const DiscretePathEffect = Nothing
export const CornerPathEffect = Nothing
export const Path1DPathEffect = Nothing
export const Path2DPathEffect = Nothing
export const Line2DPathEffect = Nothing
export const SumPathEffect = Nothing
export const FitBox = Nothing
export const SkiaDomView = Nothing
export const SkiaPictureView = Nothing
export const SkiaView = Nothing
export const CanvasKitProvider = ({ children }: { children?: ReactNode }) => <>{children}</>
export const WithSkiaWeb = () => null
export const LoadSkiaWeb = async () => undefined

/* ----------------------------------------------------------------- hooks --- */

/**
 * A font, image or typeface that never loads.
 *
 * These return the chainable proxy rather than `null` on purpose: an app writes
 * `if (!font) return null`, and a `null` here would delete the surrounding
 * screen — not just the canvas. Truthy keeps the app on its normal path, where
 * every Skia element it then renders is one of the `Nothing`s above.
 */
export const useFont = () => anything()
export const useFonts = () => anything()
export const matchFont = () => anything()
export const useImage = () => anything()
export const useSVG = () => anything()
export const useVideo = () => anything()
export const useTexture = () => anything()
export const usePicture = () => anything()
export const useTypeface = () => anything()
export const useData = () => anything()
export const useRawData = () => anything()
export const useDataCollection = () => anything()
export const useCanvasRef = () => ({ current: anything() })
export const usePictureAsTexture = () => anything()
export const useImageAsTexture = () => anything()

/** Buffers: reanimated-shaped hooks that fill a typed array on the UI thread. */
export const useRSXformBuffer = () => anything()
export const useRectBuffer = () => anything()
export const usePointBuffer = () => anything()
export const useColorBuffer = () => anything()
export const useTextureValue = () => anything()
export const useTextureValueFromPicture = () => anything()
export const useClock = () => ({ value: 0 })
export const useComputedValue = (fn: () => unknown) => {
  try {
    return { value: fn() }
  } catch {
    return { value: undefined }
  }
}
export const useValue = <T,>(v: T) => ({ current: v, value: v })
export const useValueEffect = () => undefined
export const useSharedValueEffect = () => undefined
export const useTouchHandler = () => () => undefined
export const useTiming = () => ({ current: 0, value: 0 })
export const useLoop = () => ({ current: 0, value: 0 })
export const useSpring = () => ({ current: 0, value: 0 })

/* ------------------------------------------------------------- functions --- */

export const createPicture = () => anything()
export const drawAsImage = () => anything()
export const drawAsImageFromPicture = () => anything()
export const makeImageFromView = async () => anything()
export const notifyChange = () => undefined
export const vec = (x = 0, y = 0) => ({ x, y })
export const point = vec
export const rect = (x = 0, y = 0, width = 0, height = 0) => ({ x, y, width, height })
export const rrect = (r: unknown, rx = 0, ry = 0) => ({ rect: r, rx, ry })
export const bounds = () => ({ x: 0, y: 0, width: 0, height: 0 })
export const topLeft = vec
export const topRight = vec
export const bottomLeft = vec
export const bottomRight = vec
export const center = vec
export const add = (a: { x: number; y: number }, b: { x: number; y: number }) => vec(a.x + b.x, a.y + b.y)
export const sub = (a: { x: number; y: number }, b: { x: number; y: number }) => vec(a.x - b.x, a.y - b.y)
export const neg = (a: { x: number; y: number }) => vec(-a.x, -a.y)
export const dist = () => 0
export const mix = (t: number, a: number, b: number) => a + (b - a) * t
export const mixColors = (_t: number, a: unknown) => a
export const interpolateVector = (_t: number, _i: number[], out: unknown[]) => out[0]
export const interpolateColors = (_t: number, _i: number[], out: unknown[]) => out[0]
export const interpolatePaths = (_t: number, _i: number[], out: unknown[]) => out[0]
export const processTransform2d = () => anything()
export const fitbox = () => anything()
export const rect2rect = () => anything()
export const polar2Canvas = vec
export const canvas2Polar = (v: { x: number; y: number }) => ({ theta: 0, radius: v.x })
export const isImage = () => false
export const isPaint = () => false
export const isPath = () => false

/* ----------------------------------------------------------------- enums --- */

export const PaintStyle = { Fill: 0, Stroke: 1 }
export const StrokeCap = { Butt: 0, Round: 1, Square: 2 }
export const StrokeJoin = { Miter: 0, Round: 1, Bevel: 2 }
export const BlendMode = {
  Clear: 0, Src: 1, Dst: 2, SrcOver: 3, DstOver: 4, SrcIn: 5, DstIn: 6, SrcOut: 7, DstOut: 8,
  SrcATop: 9, DstATop: 10, Xor: 11, Plus: 12, Modulate: 13, Screen: 14, Overlay: 15, Darken: 16,
  Lighten: 17, ColorDodge: 18, ColorBurn: 19, HardLight: 20, SoftLight: 21, Difference: 22,
  Exclusion: 23, Multiply: 24, Hue: 25, Saturation: 26, Color: 27, Luminosity: 28,
}
export const ClipOp = { Difference: 0, Intersect: 1 }
export const FillType = { Winding: 0, EvenOdd: 1, InverseWinding: 2, InverseEvenOdd: 3 }
export const PathOp = { Difference: 0, Intersect: 1, Union: 2, XOR: 3, ReverseDifference: 4 }
export const TileMode = { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 }
export const FilterMode = { Nearest: 0, Linear: 1 }
export const MipmapMode = { None: 0, Nearest: 1, Linear: 2 }
export const ColorType = { Unknown: 0, Alpha_8: 1, RGB_565: 2, RGBA_8888: 4, BGRA_8888: 6 }
export const AlphaType = { Unknown: 0, Opaque: 1, Premul: 2, Unpremul: 3 }
export const ImageFormat = { JPEG: 3, PNG: 4, WEBP: 6 }
export const ColorChannel = { R: 0, G: 1, B: 2, A: 3 }
export const VertexMode = { Triangles: 0, TrianglesStrip: 1, TriangleFan: 2 }
export const PointMode = { Points: 0, Lines: 1, Polygon: 2 }
export const FontSlant = { Upright: 0, Italic: 1, Oblique: 2 }
export const FontWeight = { Invisible: 0, Thin: 100, Light: 300, Normal: 400, Medium: 500, Bold: 700, Black: 900 }
export const FontWidth = { UltraCondensed: 1, Condensed: 3, Normal: 5, Expanded: 7, UltraExpanded: 9 }
export const FontStyle = { Normal: 0, Bold: 1, Italic: 2, BoldItalic: 3 }
export const FontEdging = { Alias: 0, AntiAlias: 1, SubpixelAntiAlias: 2 }
export const FontHinting = { None: 0, Slight: 1, Normal: 2, Full: 3 }
export const TextAlign = { Left: 0, Right: 1, Center: 2, Justify: 3, Start: 4, End: 5 }
export const TextDirection = { RTL: 0, LTR: 1 }
export const TextBaseline = { Alphabetic: 0, Ideographic: 1 }
export const TextDecoration = { NoDecoration: 0, Underline: 1, Overline: 2, LineThrough: 4 }
export const TextDecorationStyle = { Solid: 0, Double: 1, Dotted: 2, Dashed: 3, Wavy: 4 }
export const TextHeightBehavior = { All: 0, DisableFirstAscent: 1, DisableLastDescent: 2, DisableAll: 3 }
export const RectHeightStyle = { Tight: 0, Max: 1 }
export const RectWidthStyle = { Tight: 0, Max: 1 }
export const PlaceholderAlignment = { Baseline: 0, AboveBaseline: 1, BelowBaseline: 2, Top: 3, Bottom: 4, Middle: 5 }
export const Fit = {
  cover: 'cover', contain: 'contain', fill: 'fill', fitHeight: 'fitHeight',
  fitWidth: 'fitWidth', none: 'none', scaleDown: 'scaleDown',
}
export const DataSourceContext = { Provider: ({ children }: { children?: ReactNode }) => <>{children}</> }
