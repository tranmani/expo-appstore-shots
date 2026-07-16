/**
 * react-native-android-widget.
 *
 * A home-screen widget is not in the app and cannot be in an App Store
 * screenshot — it is drawn by the launcher, from a tree this library serialises
 * and hands to Android. None of that has a browser equivalent.
 *
 * It is here for one reason: the app imports it. `requestWidgetUpdate()` gets
 * called from a save handler, `TurboModuleRegistry` gets reached for at import
 * time (see the react-native stub), and the screen that pays for it is whichever
 * one happened to import the module — which is every screen, because they all
 * bundle together.
 */
const Nothing = (_props: Record<string, unknown>) => null

export const FlexWidget = Nothing
export const TextWidget = Nothing
export const OverlapWidget = Nothing
export const SvgWidget = Nothing
export const ImageWidget = Nothing
export const IconWidget = Nothing
export const ListWidget = Nothing
export const WidgetPreview = Nothing

export const requestWidgetUpdate = async () => undefined
export const requestWidgetUpdateById = async () => undefined
export const registerWidgetTaskHandler = () => undefined
export const registerWidgetConfigurationScreen = () => undefined
export const getWidgetInfo = async () => []
export const buildWidgetTree = () => ({})
export const convertClickAction = () => ({})
export const convertColor = (c: unknown) => c
export const convertCommonStyle = (s: unknown) => s
export const withWidget = <T,>(config: T) => config
