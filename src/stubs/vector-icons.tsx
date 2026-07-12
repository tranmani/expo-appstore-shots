/**
 * @expo/vector-icons ships icon fonts the bundler would have to load and the
 * browser would have to have. Each family renders as an empty box of the right
 * size instead, so layout is preserved and nothing crashes. If icons matter to
 * the screenshot, the app almost certainly also has lucide — use that.
 */
import { View } from 'react-native'

function family() {
  const Icon = ({ size = 24, color }: { size?: number; color?: string }) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, opacity: 0.25, backgroundColor: color ?? '#888' }} />
  )
  Icon.Button = Icon
  Icon.loadFont = async () => undefined
  Icon.font = {}
  return Icon
}

export const Ionicons = family()
export const MaterialIcons = family()
export const MaterialCommunityIcons = family()
export const FontAwesome = family()
export const FontAwesome5 = family()
export const FontAwesome6 = family()
export const Feather = family()
export const AntDesign = family()
export const Entypo = family()
export const EvilIcons = family()
export const Foundation = family()
export const Octicons = family()
export const SimpleLineIcons = family()
export const Zocial = family()
export const createIconSet = () => family()
export default { Ionicons, MaterialIcons, Feather }
