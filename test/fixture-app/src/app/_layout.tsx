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
        {/* THE FALLBACK MUST SHARE NO SUBSTRING WITH THE REGISTERED TITLE.
            It was `options.title ?? 'Fixture'` beside a
            `<Stack.Screen name="index" options={{ title: 'Fixture' }} />`, so
            the header read "Fixture" whether registration worked or not — and it
            did not work, for as long as this fixture has existed.
            The first fix was worse: fallback 'NO-REGISTERED-TITLE' against an
            assertion of `.includes('REGISTERED-TITLE')`, which is *true* of the
            fallback. A green test, a broken feature, and a fallback that lies by
            containing the answer. */}
        <Text style={styles.title}>{options.title ?? 'HEADER-FELL-BACK'}</Text>
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
          {/* What `<Stack.Screen name>` is FOR: a route's options, declared by
              the layout rather than by the screen. kitchen-sink.tsx asserts this
              string actually reaches the header. */}
          <Stack.Screen name="kitchen-sink" options={{ title: 'REGISTERED-TITLE' }} />
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
