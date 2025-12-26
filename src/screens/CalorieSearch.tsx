import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { FoodLogEntry, getDailyFoodLog, upsertDailyFoodLog } from '../firebase/service';
import { getUsdaApiKey } from '../utils/api';

type FoodItem = {
  id: string;
  description: string;
  brand?: string;
  calories: number;
};

const SESSION_KEY = 'fitadvisor:session';
const STORAGE_TODAY_KEY = 'fitadvisor:todayStats';
const buildFoodCacheKey = (userId: string, date: string) => `fitadvisor:foodLog:${userId}:${date}`;

const TR_EN_MAP: Record<string, string> = {
  'tavuk göğüs': 'chicken breast',
  'tavuk gögüs': 'chicken breast',
  'tavuk': 'chicken',
  'pirinç': 'rice',
  'bulgur': 'bulgur',
  'elma': 'apple',
  'armut': 'pear',
  'muz': 'banana',
  'yumurta': 'egg',
  'peynir': 'cheese',
  'yoğurt': 'yogurt',
  'ton balığı': 'tuna',
  'somon': 'salmon',
  'patates': 'potato',
  'mercimek': 'lentils',
  'fasulye': 'beans',
  'nohut': 'chickpeas',
  'yulaf': 'oats',
};

const translateQuery = (q: string) => {
  const lower = q.toLowerCase();
  for (const [tr, en] of Object.entries(TR_EN_MAP)) {
    if (lower.includes(tr)) return en;
  }
  return q;
};

export default function CalorieSearch() {
  const usdaApiKey = getUsdaApiKey();
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodLogEntry[]>([]);
  const [foodStatus, setFoodStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [foodError, setFoodError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [logStatus, setLogStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [portionGrams, setPortionGrams] = useState('100');

  const todayId = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const loadSessionAndLog = async () => {
      try {
        const storedSession = await AsyncStorage.getItem(SESSION_KEY);
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          setSession(parsed);
          if (parsed?.userId) {
            const cacheKey = buildFoodCacheKey(parsed.userId, todayId);
            try {
              const cached = await AsyncStorage.getItem(cacheKey);
              if (cached) {
                const parsedCache = JSON.parse(cached);
                if (Array.isArray(parsedCache?.entries)) {
                  setFoodEntries(parsedCache.entries);
                }
              }
            } catch {
              // ignore cache read errors
            }
            try {
              const res = await getDailyFoodLog(parsed.userId, todayId);
              if (res?.ok && res.log) {
                const entries = res.log.entries || [];
                const total = res.log.totalCalories ?? entries.reduce((s, i) => s + (Number(i.calories) || 0), 0);
                setFoodEntries(entries);
                await AsyncStorage.setItem(cacheKey, JSON.stringify({ entries, total }));
              }
            } catch {
              // ignore remote errors; keep cached
            }
          }
        }
        setLogStatus('idle');
      } catch {
        setLogStatus('error');
        setFoodError('Günlük kalori kaydı alınamadı.');
      }
    };
    loadSessionAndLog();
  }, [todayId]);

  const handleSearchFood = async () => {
    if (!foodQuery.trim()) {
      setFoodError('Bir besin adı yazın.');
      return;
    }
    if (!usdaApiKey) {
      setFoodError('USDA API anahtarı bulunamadı. EXPO_PUBLIC_USDA_API_KEY tanımlayın.');
      return;
    }
    setFoodStatus('loading');
    setFoodError('');
    try {
      const translated = translateQuery(foodQuery.trim());
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(translated)}&pageSize=10&api_key=${usdaApiKey}`
      );
      if (!res.ok) {
        setFoodError('USDA isteği başarısız.');
        setFoodStatus('error');
        return;
      }
      const data = await res.json();
      const foods = Array.isArray(data?.foods) ? data.foods : [];
      const mapped: FoodItem[] = foods.map((f: any) => {
        const nutrient =
          (f.foodNutrients || []).find(
            (n: any) =>
              typeof n?.nutrientName === 'string' &&
              n.nutrientName.toLowerCase().includes('energy') &&
              (n.unitName || '').toLowerCase() === 'kcal'
          ) || {};
        return {
          id: f.fdcId?.toString() || f.description,
          description: f.description || 'Bilinmeyen',
          brand: f.brandOwner || f.brandName || '',
          calories: nutrient.value || 0,
        };
      });
      setFoodResults(mapped.slice(0, 1)); // tek öneri
      setFoodStatus('idle');
    } catch (e) {
      setFoodError('Arama sırasında hata oluştu.');
      setFoodStatus('error');
    }
  };

  const persistFoodLog = async (entries: FoodLogEntry[]) => {
    if (!session?.userId) {
      setFoodError('Önce giriş yapman gerekiyor.');
      return;
    }
    const total = entries.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
    setSaveStatus('saving');
    const cacheKey = buildFoodCacheKey(session.userId, todayId);

    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ entries, total }));
      const existingTodayRaw = await AsyncStorage.getItem(STORAGE_TODAY_KEY);
      let existingToday: any = {};
      try {
        if (existingTodayRaw) existingToday = JSON.parse(existingTodayRaw);
      } catch {
        existingToday = {};
      }
      const mergedToday = {
        date: todayId,
        stats: {
          ...(existingToday?.stats || {}),
          calories: total,
          caloriesTarget: existingToday?.stats?.caloriesTarget || 2000,
        },
        foodEntries: entries,
      };
      await AsyncStorage.setItem(STORAGE_TODAY_KEY, JSON.stringify(mergedToday));
    } catch {
      // ignore local cache errors
    }

    try {
      await upsertDailyFoodLog(session.userId, todayId, entries);
      setSaveStatus('idle');
      setFoodError('');
    } catch {
      setSaveStatus('error');
      setFoodError('Kayıt saklanamadı, lütfen tekrar dene. Yerel liste korunuyor.');
    }
  };

  const addFoodEntry = async (item: FoodItem) => {
    if (!session?.userId) {
      setFoodError('Önce giriş yapman gerekiyor.');
      return;
    }
    const grams = Number(portionGrams) || 100;
    const adjustedCalories = Math.round((item.calories || 0) * (grams / 100));
    const entry: FoodLogEntry = {
      id: `${item.id}-${Date.now()}`,
      description: item.description,
      brand: item.brand || '',
      calories: adjustedCalories,
      portionGrams: grams,
      source: 'usda',
      addedAt: Date.now(),
    };
    const nextEntries = [...foodEntries, entry];
    setFoodEntries(nextEntries);
    await persistFoodLog(nextEntries);
  };

  const totalCalories = foodEntries.reduce((sum, item) => sum + (item.calories || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Kalori Arama</Text>
        <Text style={styles.subtitle}>
          Besinleri Türkçe ya da İngilizce yazabilirsin; arka planda USDA FoodData Central sonuçlarını getiriyoruz.
        </Text>
        {session?.userId ? (
          <Text style={styles.sessionMeta}>Giriş yaptın: {session.username || session.userId}</Text>
        ) : (
          <Text style={styles.warning}>Giriş yapmadan kaydedemezsin.</Text>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>USDA ile Kalori Ara</Text>
            {usdaApiKey ? <Text style={styles.sectionTag}>API hazır</Text> : <Text style={styles.sectionTag}>API anahtarı eksik</Text>}
          </View>
          <View style={styles.foodSearchRow}>
            <TextInput
              value={foodQuery}
              onChangeText={setFoodQuery}
              placeholder="Örn. tavuk göğüs 200g"
              placeholderTextColor="#9ca3af"
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.searchButton, foodStatus === 'loading' && styles.searchButtonDisabled]}
              onPress={handleSearchFood}
              disabled={foodStatus === 'loading'}
            >
              <Text style={styles.searchButtonText}>{foodStatus === 'loading' ? 'Aranıyor...' : 'Ara'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={portionGrams}
            onChangeText={setPortionGrams}
            placeholder="Miktar (gram) - varsayılan 100"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.metaText}>USDA kalorileri çoğunlukla 100g içindir; miktar girersen bu değeri ölçekleriz.</Text>
          {foodError ? <Text style={styles.message}>{foodError}</Text> : null}
          {foodResults.length > 0 ? (
            <View style={styles.foodResults}>
              {foodResults.map((item) => (
                <View key={item.id} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodTitle}>{item.description}</Text>
                    <Text style={styles.foodMeta}>
                      {item.brand ? `${item.brand} · ` : ''}
                      {Math.round(item.calories || 0)} kcal / 100g
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.foodAddButton} onPress={() => addFoodEntry(item)}>
                    <Text style={styles.foodAddButtonText}>Ekle</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          {saveStatus === 'saving' ? <Text style={styles.metaText}>Kaydediliyor...</Text> : null}
        </View>

        {foodEntries.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Eklediklerin</Text>
              <Text style={styles.sectionTag}>{totalCalories} kcal</Text>
            </View>
            <View style={styles.foodResults}>
              {foodEntries.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodTitle}>{item.description}</Text>
                    <Text style={styles.foodMeta}>
                      {Math.round(item.calories || 0)} kcal{item.portionGrams ? ` · ${item.portionGrams}g` : ''}{' '}
                      {item.brand ? `(${item.brand})` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : logStatus === 'loading' ? (
          <View style={styles.card}>
            <Text style={styles.metaText}>Bugünün kaydı alınıyor...</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  sessionMeta: { color: '#22c55e', fontSize: 12 },
  warning: { color: '#f97316', fontSize: 12 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 10,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  sectionTag: { fontSize: 12, color: '#94a3b8' },
  foodSearchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#f8fafc',
    fontSize: 15,
  },
  searchButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
  },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { color: '#0b1120', fontWeight: '800', fontSize: 13 },
  message: { color: '#f87171', fontSize: 12 },
  foodResults: { gap: 10 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  foodTitle: { color: '#e2e8f0', fontWeight: '700' },
  foodMeta: { color: '#94a3b8', fontSize: 12 },
  foodAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#10b981',
    borderRadius: 10,
  },
  foodAddButtonText: { color: '#0b1120', fontWeight: '800', fontSize: 12 },
  metaText: { color: '#94a3b8', fontSize: 12 },
});
