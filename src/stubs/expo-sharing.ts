/**
 * expo-sharing.
 *
 * The OS share sheet has no place in a still frame, and `shareAsync` opening one
 * would be a modal over the very screen we came to photograph. So it is inert.
 *
 * `isAvailableAsync` answers TRUE, deliberately: an app hides its share button
 * when sharing is unavailable, and hiding a real feature from the screenshot
 * misrepresents the app more than a button that leads to a sheet the camera
 * never opens.
 */
export const isAvailableAsync = async () => true
export const shareAsync = async () => undefined
