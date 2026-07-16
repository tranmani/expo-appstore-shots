/**
 * expo-image-picker.
 *
 * Nobody picks a photo during a screenshot — the picker is a sheet that opens on
 * a tap, and a still frame has no taps. But the *permissions* are read at the top
 * of any screen that can open one, and a screen that believes permission is
 * undecided renders its "allow photo access" wall rather than itself. So they are
 * granted, like every other permission here.
 *
 * It used to fall back to the generic `noop.ts`, which had the launch functions
 * but not the permission hooks — so `useCameraPermissions` was a hard "No
 * matching export" that failed the entire run, from one form component nobody
 * was photographing.
 */
const permission = { granted: true, status: 'granted', canAskAgain: false, expires: 'never' }
const request = async () => permission

export const useCameraPermissions = (): [typeof permission, typeof request] => [permission, request]
export const useMediaLibraryPermissions = useCameraPermissions

export const getCameraPermissionsAsync = request
export const requestCameraPermissionsAsync = request
export const getMediaLibraryPermissionsAsync = request
export const requestMediaLibraryPermissionsAsync = request

/** A cancelled pick: the branch every caller handles, and the honest one here. */
const cancelled = async () => ({ canceled: true, assets: null })
export const launchCameraAsync = cancelled
export const launchImageLibraryAsync = cancelled
export const getPendingResultAsync = async () => []

export const MediaTypeOptions = { All: 'All', Videos: 'Videos', Images: 'Images' }
export const MediaType = { Images: 'images', Videos: 'videos', Livephotos: 'livePhotos' }
export const UIImagePickerControllerQualityType = { High: 0, Medium: 1, Low: 2 }
export const UIImagePickerPresentationStyle = {
  FULL_SCREEN: 'fullScreen',
  PAGE_SHEET: 'pageSheet',
  FORM_SHEET: 'formSheet',
  CURRENT_CONTEXT: 'currentContext',
  OVER_FULL_SCREEN: 'overFullScreen',
  OVER_CURRENT_CONTEXT: 'overCurrentContext',
  POPOVER: 'popover',
  AUTOMATIC: 'automatic',
}
export const CameraType = { front: 'front', back: 'back' }
