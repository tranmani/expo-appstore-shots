/** expo-image, as a plain web <img>: same props that matter, no native decoder. */
import { Image as RNImage } from 'react-native'

export const Image = RNImage
export const ImageBackground = RNImage
export const useImage = () => null
export default { Image: RNImage }
