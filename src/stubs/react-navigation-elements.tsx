/**
 * @react-navigation/elements — the header pieces, which screens import for one
 * number far more often than for a component.
 *
 * `useHeaderHeight()` is how a screen pads itself out from under the header. Get
 * it wrong and the first row of content sits behind the title bar in the frame,
 * which looks exactly like an app bug and is not one.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { getInsets } from './runtime'

/** UIKit's own: 44pt of bar, plus the notch. */
export const getDefaultHeaderHeight = () => 44 + getInsets().top
export const useHeaderHeight = () => getDefaultHeaderHeight()
export const HeaderHeightContext = {
  Provider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Consumer: ({ children }: { children?: (h: number) => ReactNode }) => <>{children?.(getDefaultHeaderHeight())}</>,
}
export const HeaderShownContext = {
  Provider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Consumer: ({ children }: { children?: (shown: boolean) => ReactNode }) => <>{children?.(true)}</>,
}

const Nothing = (_props: Record<string, unknown>) => null

export const Header = Nothing
export const HeaderBackground = View
export const HeaderBackButton = Nothing
export const HeaderTitle = Nothing
export const HeaderButton = Nothing
export const MissingIcon = Nothing
export const PlatformPressable = View
export const Background = View
export const Button = View
export const Label = Nothing
export const Screen = Nothing
export const SafeAreaProviderCompat = ({ children }: { children?: ReactNode }) => <>{children}</>
export const getHeaderTitle = (options: { title?: string; headerTitle?: string }, fallback: string) =>
  options.headerTitle ?? options.title ?? fallback
export const getLabel = (options: { title?: string }, fallback: string) => options.title ?? fallback
export const useFrameSize = <T,>(selector: (frame: { width: number; height: number }) => T): T =>
  selector({ width: window.innerWidth, height: window.innerHeight })
export const useHeaderConfigProps = () => ({})
