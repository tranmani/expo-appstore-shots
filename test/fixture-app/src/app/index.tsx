/**
 * The screen under test. It does the three things that break a naive bundler:
 * asks for a location permission, reads AsyncStorage, and fetches from the API —
 * so if this renders its rows, the stubs and the mock backend are both working.
 */
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack } from 'expo-router'

interface Item {
  id: string
  title: string
  subtitle: string
}

export default function HomeScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [where, setWhere] = useState<string>('locating…')
  const [seen, setSeen] = useState<string>('')

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const fix = await Location.getCurrentPositionAsync({})
        setWhere(`${fix.coords.latitude.toFixed(3)}, ${fix.coords.longitude.toFixed(3)}`)
      } else {
        setWhere('permission denied')
      }
      setSeen((await AsyncStorage.getItem('fixture.seen')) ?? 'first launch')
      const res = await fetch('http://127.0.0.1:8788/api/items')
      setItems((await res.json()) as Item[])
    })()
  }, [])

  return (
    <>
      <Stack.Screen options={{ title: 'Fixture' }} />
      <View style={styles.body}>
        <Text style={styles.meta} testID="where">
          at {where} · {seen}
        </Text>
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, gap: 10 },
  meta: { fontSize: 13, color: '#676F6D', marginBottom: 4 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 3 },
  title: { fontSize: 17, fontWeight: '600', color: '#181A17' },
  subtitle: { fontSize: 14, color: '#676F6D' },
})
