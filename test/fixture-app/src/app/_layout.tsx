/**
 * A root layout shaped like a real one: a provider, a themed background, and a
 * JS header installed through `screenOptions.header` — the path most Expo apps
 * take, and the one the router stub has to honour.
 */
import { View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

function Header({ options, back }: { options: { title?: string }; back?: unknown }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Text style={styles.back}>{back ? '‹' : ''}</Text>
        <Text style={styles.title}>{options.title ?? 'Fixture'}</Text>
        <Text style={styles.back} />
      </View>
    </View>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <Stack screenOptions={{ header: (props: never) => <Header {...(props as never)} /> }}>
          <Stack.Screen name="index" options={{ title: 'Fixture' }} />
        </Stack>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F3F0' },
  header: { backgroundColor: '#F4F3F0', borderBottomWidth: 1, borderBottomColor: '#E2E0D9' },
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#181A17' },
  back: { width: 24, fontSize: 26, color: '#17513F' },
})
