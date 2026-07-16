/**
 * react-native-gesture-handler.
 *
 * Almost all of it is in `native.tsx` with everything else — but the scrollables
 * are not, because that module already imports `ScrollView` and `FlatList` from
 * `react-native` and cannot export those names again. It parks them under a
 * trailing underscore, and this is where they get their real names back:
 * `import { ScrollView } from 'react-native-gesture-handler'` is what apps
 * write, and it has to be the scrollable, not `undefined`.
 */
export * from './native'
export { ScrollView_ as ScrollView, FlatList_ as FlatList, TextInput_ as TextInput } from './native'
