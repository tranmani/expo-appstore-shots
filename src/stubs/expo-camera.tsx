/**
 * expo-camera.
 *
 * There is no camera, and a screenshot of a live viewfinder would be a
 * screenshot of a grey rectangle even if there were. What matters is the
 * permission: `useCameraPermissions()` is read at the top of any screen that can
 * open a camera — a meal form, an avatar picker — and a screen that thinks
 * permission is undecided renders its "allow camera access" wall instead of
 * itself.
 *
 * So permission is granted, as it is in every other stub here: the state of a
 * phone that has been used before, not a fresh install mid-prompt.
 */
import { View } from 'react-native'

const permission = { granted: true, status: 'granted', canAskAgain: false, expires: 'never' }
const request = async () => permission

/** `const [permission, requestPermission] = useCameraPermissions()` */
export const useCameraPermissions = (): [typeof permission, typeof request] => [permission, request]
export const useMicrophonePermissions = useCameraPermissions
export const getCameraPermissionsAsync = request
export const requestCameraPermissionsAsync = request
export const getMicrophonePermissionsAsync = request
export const requestMicrophonePermissionsAsync = request

/** A View, not null: a viewfinder is usually the biggest box on its screen. */
export const CameraView = View
export const Camera = View
export const CameraType = { front: 'front', back: 'back' }
export const FlashMode = { off: 'off', on: 'on', auto: 'auto', torch: 'torch' }
export const CameraMode = { picture: 'picture', video: 'video' }
export const AutoFocus = { on: 'on', off: 'off' }
export const WhiteBalance = { auto: 'auto' }
export const VideoQuality = { '2160p': '2160p', '1080p': '1080p', '720p': '720p' }
export const scanFromURLAsync = async () => []
export const isAvailableAsync = async () => false
