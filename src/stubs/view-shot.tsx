/**
 * react-native-view-shot.
 *
 * It rasterises a live view to an image file — a share card, a saved receipt.
 * There is no rasteriser here, and the capture is never the thing being
 * photographed anyway: the screen the card is captured *from* is what a store
 * frame shows. So `captureRef` hands back a placeholder data URI (a share sheet
 * that opens is enough; a real PNG of the view is not), and `ViewShot` is a
 * plain wrapper that renders its children so the view it wraps still appears.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'

/** A 1×1 transparent PNG — a uri that resolves, for the code that reads one back. */
const BLANK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

export const captureRef = async () => BLANK
export const captureScreen = async () => BLANK
export const releaseCapture = () => undefined

export const ViewShot = View
export default ViewShot
