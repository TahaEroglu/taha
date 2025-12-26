import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDailyFoodLog } from '../firebase/service';
import { getApiBase } from '../utils/api';

const { width } = Dimensions.get('window');

const STORAGE_TODAY_KEY = 'fitadvisor:todayStats';
const STORAGE_HISTORY_KEY = 'fitadvisor:history';
const STORAGE_DATA_SOURCE_KEY = 'fitadvisor:dataSource';
const STORAGE_REMINDERS_KEY = 'fitadvisor:reminders';
const SESSION_KEY = 'fitadvisor:session';
const buildFoodCacheKey = (userId, date) => `fitadvisor:foodLog:${userId}:${date}`;

function computeScore(stats) {
  if (!stats) return 0;
  const stepRatio = stats.stepsTarget ? stats.steps / stats.stepsTarget : 0;
  const workoutRatio = stats.workoutTarget ? stats.workoutMinutes / stats.workoutTarget : 0;
  const waterRatio = stats.waterTarget ? stats.waterLiters / stats.waterTarget : 0;
  const avg = (stepRatio + workoutRatio + waterRatio) / 3;
  const clamped = Math.max(0, Math.min(1, avg));
  return Math.round(clamped * 100);
}

function updateHistory(prevHistory, todayId, score) {
  const filtered = (prevHistory || []).filter((entry) => entry.date !== todayId);
  return [...filtered, { date: todayId, score }];
}

export default function Dashboard({ profile, goals, selectedProgram }) {
  const [imageUri, setImageUri] = useState(null);
  const [analysisText, setAnalysisText] = useState('Şimdilik örnek bir analiz gösteriliyor.');
  const [analysisStatus, setAnalysisStatus] = useState('idle'); // idle | loading | ready | error
  const userName = profile?.name || 'Alperen';

  const stepsTarget = goals?.stepsTarget ?? 8000;
  const workoutTarget = goals?.workoutMinutesTarget ?? 30;
  const waterTarget = goals?.waterTargetLiters ?? 2;
  const [todayStats, setTodayStats] = useState({
    steps: 3250,
    stepsTarget,
    workoutMinutes: 15,
    workoutTarget,
    waterLiters: 0.8,
    waterTarget,
    calories: 0,
    caloriesTarget: 2000,
  });
  const [history, setHistory] = useState([]);
  const [dataSource, setDataSource] = useState('manual'); // manual | synced
  const [reminders, setReminders] = useState({ water: true, steps: false, workout: true });
  const [session, setSession] = useState(null);
  const [foodLogEntries, setFoodLogEntries] = useState([]);
  const [foodTotal, setFoodTotal] = useState(0);
  const [foodLoading, setFoodLoading] = useState(true);
  const [stepsInput, setStepsInput] = useState('');
  const [sleepInput, setSleepInput] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [recData, setRecData] = useState(null);

  const apiBase = useMemo(() => getApiBase(), []);
  const todayId = new Date().toISOString().slice(0, 10);
  const score = computeScore(todayStats);
  const intakeFromRec = recData?.inputs?.intakeCalories;
  const burnedFromRec = recData?.inputs?.burnedCalories;
  const netFromRec = recData?.inputs?.netCalories;
  const displayIntake = intakeFromRec != null ? Math.round(intakeFromRec) : foodTotal;

  const heightMeters = profile?.height ? Number(profile.height) / 100 : null;
  const weightKg = profile?.weight ? Number(profile.weight) : null;

  let bmi = null;
  if (heightMeters && weightKg && heightMeters > 0) {
    bmi = weightKg / (heightMeters * heightMeters);
  }

  let bmiLabel = '';
  let bmiComment = 'Profil bilgilerinle daha net bir analiz çıkaracağız.';

  if (bmi) {
    if (bmi < 18.5) {
      bmiLabel = 'Zayıf';
      bmiComment = 'Biraz kilo alman ve kas kütleni artırman faydalı olabilir.';
    } else if (bmi < 25) {
      bmiLabel = 'Normal';
      bmiComment = 'Sağlıklı aralıktasın, hedefini korumaya odaklanabilirsin.';
    } else if (bmi < 30) {
      bmiLabel = 'Fazla kilolu';
      bmiComment = 'Düzenli adım ve antrenmanla yağ oranını düşürmeye odaklan.';
    } else {
      bmiLabel = 'Obezite';
      bmiComment = 'Daha kontrollü bir program ve doktor desteğiyle çalışmak önemli.';
    }
  }

  const last7Days = history.slice(-7).map((entry) => {
    const date = new Date(entry.date);
    const label = date.toLocaleDateString('tr-TR', { weekday: 'short' });
    return { label, score: entry.score };
  });

  const incrementSteps = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      steps: Math.min(prev.steps + delta, prev.stepsTarget),
    }));
    setDataSource('manual');
  };

  const incrementWorkout = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      workoutMinutes: Math.min(prev.workoutMinutes + delta, prev.workoutTarget),
    }));
    setDataSource('manual');
  };

  const incrementWater = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      waterLiters: Math.min(prev.waterLiters + delta, prev.waterTarget),
    }));
    setDataSource('manual');
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_KEY);
        if (stored) {
          setSession(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    };
    loadSession();
  }, []);

  const loadFoodLog = useCallback(async () => {
    if (!session?.userId) return;
    setFoodLoading(true);
    const cacheKey = buildFoodCacheKey(session.userId, todayId);
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        const total = parsed?.total || entries.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
        setFoodLogEntries(entries);
        setFoodTotal(total);
        setTodayStats((prev) => ({ ...prev, calories: total }));
      }
    } catch {
      // ignore cache errors
    }

    try {
      const res = await getDailyFoodLog(session.userId, todayId);
      if (res?.ok && res.log) {
        const entries = Array.isArray(res.log.entries) ? res.log.entries : [];
        const total = res.log.totalCalories ?? entries.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
        if (entries.length > 0 || total > 0) {
          setFoodLogEntries(entries);
          setFoodTotal(total);
          setTodayStats((prev) => ({ ...prev, calories: total }));
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ entries, total }));
        }
      }
    } catch {
      // ignore fetch errors
    } finally {
      setFoodLoading(false);
    }
  }, [session?.userId, todayId]);


  const fetchDailyLog = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const res = await fetch(`${apiBase}/api/daily-log?userId=${session.userId}&date=${todayId}`);
      const json = await res.json();
      if (res.ok && json?.log) {
        const { steps = '', sleepHours = '' } = json.log;
        setStepsInput(steps === 0 ? '' : String(steps));
        setSleepInput(sleepHours === 0 ? '' : String(sleepHours));
        setTodayStats((prev) => ({ ...prev, steps: steps || prev.steps }));
      }
    } catch (e) {
      setRecError('Günlük kayıt yüklenemedi.');
    }
  }, [apiBase, session?.userId, todayId]);

  const refreshRecommendations = useCallback(
    async (opts = {}) => {
      if (!session?.userId) return;
      if (!opts.keepLoading) setRecLoading(true);
      setRecError('');
      try {
        const res = await fetch(`${apiBase}/api/recommendations/daily?userId=${session.userId}&date=${todayId}`);
        const json = await res.json();
        if (res.ok && json?.ok) {
          setRecData({
            summary: json.summary,
            recommendations: json.recommendations || [],
            challenges: json.challenges || [],
            inputs: json.inputs || {},
            clusterId: json.clusterId ?? null,
          });
          if (json.inputs) {
            setTodayStats((prev) => ({
              ...prev,
              steps: json.inputs.steps ?? prev.steps,
              calories: json.inputs.intakeCalories ?? prev.calories,
            }));
          }
        } else {
          setRecError(json?.error || 'Öneri alınamadı.');
        }
      } catch (e) {
        setRecError('Öneri alınamadı.');
      } finally {
        setRecLoading(false);
      }
    },
    [apiBase, session?.userId, todayId]
  );

  const handleSaveDailyLog = async () => {
    if (!session?.userId) {
      setRecError('Önce giriş yapın.');
      return;
    }
    const stepsNumber = Number(stepsInput) || 0;
    const sleepNumber = Number(sleepInput) || 0;
    setRecLoading(true);
    setRecError('');
    try {
      const res = await fetch(`${apiBase}/api/daily-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.userId,
          date: todayId,
          steps: stepsNumber,
          sleepHours: sleepNumber,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Kayıt başarısız');
      }
      setTodayStats((prev) => ({ ...prev, steps: stepsNumber }));
      await refreshRecommendations({ keepLoading: true });
    } catch (e) {
      setRecError('Kayıt/öneri alınamadı. Lütfen tekrar deneyin.');
      setRecLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFoodLog();
    }, [loadFoodLog])
  );

  useEffect(() => {
    loadFoodLog();
  }, [loadFoodLog]);

  useEffect(() => {
    if (session?.userId) {
      fetchDailyLog();
      refreshRecommendations();
    }
  }, [session?.userId, todayId, fetchDailyLog, refreshRecommendations]);

  const handleRunAnalysis = async () => {
    if (!bmi) {
      setAnalysisStatus('error');
      setAnalysisText('Analiz için profil bilgilerini (boy ve kilo) eksiksiz doldurman yeterli.');
      return;
    }

    setAnalysisStatus('loading');

    const goal = profile?.goalType;
    let text = '';

    if (goal === 'gain_muscle') {
      if (bmi < 22) {
        text =
          'Kas kazanmak için nispeten zayıf sayılabilecek bir aralıktasın. Düzenli kuvvet antrenmanı ve dengeli beslenme kas kütleni artırmana yardım edecek.';
      } else if (bmi < 27) {
        text =
          'Kas kazanmak için uygun bir aralıktasın. Ağırlık antrenmanlarını düzenli tutman ve toparlanmaya dikkat etmen yeterli.';
      } else {
        text =
          'Kas kazanma hedefin var; önce hafif bir yağ azaltma dönemi ile eklemlere yükü azaltmak daha konforlu olabilir.';
      }
    } else if (goal === 'maintain') {
      if (bmi < 18.5) {
        text =
          'Formu koruma hedefi için kilon alt sınırda. Biraz daha güçlü kas kütlesi ve yeterli kalori almak seni daha dengeli hissettirebilir.';
      } else if (bmi < 25) {
        text =
          'Formunu koruma açısından iyi bir aralıktasın. Düzenli adım, hafif kuvvet ve esneme çalışmaları bu durumu sürdürmeni sağlar.';
      } else {
        text =
          'Formu koruma hedefinde vücut kompozisyonunu biraz hafifletmek konforunu artırabilir; sakin tempolu kilo verme uygun görünüyor.';
      }
    } else {
      if (bmi < 25) {
        text =
          'Kilo verme hedefin var ama BMI aralığın fena değil. Vücudu sıkılaştırmaya, kas korumaya ve sağlıklı beslenmeye odaklanmak yeterli olabilir.';
      } else if (bmi < 30) {
        text =
          'Kilo verme hedefin için yürüyüş, hafif koşu ve kuvvet egzersizlerini birleştirmek yağ oranını istikrarlı şekilde azaltmana yardımcı olur.';
      } else {
        text =
          'Kilo verme sürecinde yavaş ve sürdürülebilir ilerlemek en sağlıklısı. Düzenli hareket, uyku ve beslenme ile başlayıp gerekirse uzman desteği ekleyebilirsin.';
      }
    }

    if (selectedProgram?.title) {
      text += ` Seçili programın (${selectedProgram.title}) bu hedefe destek olacak şekilde yapılandırıldı.`;
    }

    setAnalysisText(text);
    setAnalysisStatus('ready');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToday = await AsyncStorage.getItem(STORAGE_TODAY_KEY);
        if (storedToday) {
          const parsed = JSON.parse(storedToday);
          if (parsed.date === todayId && parsed.stats) {
            setTodayStats((prev) => ({
              ...prev,
              ...parsed.stats,
              calories: prev.calories ?? 0, // kalori loadFoodLog tarafından belirleniyor
              caloriesTarget: parsed.stats.caloriesTarget ?? prev.caloriesTarget ?? 2000,
            }));
          }
        }

        const storedHistory = await AsyncStorage.getItem(STORAGE_HISTORY_KEY);
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory)) {
            setHistory(parsedHistory);
          }
        }

        const storedSource = await AsyncStorage.getItem(STORAGE_DATA_SOURCE_KEY);
        if (storedSource) {
          setDataSource(storedSource);
        }

        const storedReminders = await AsyncStorage.getItem(STORAGE_REMINDERS_KEY);
        if (storedReminders) {
          const parsed = JSON.parse(storedReminders);
          if (parsed) {
            setReminders(parsed);
          }
        }
      } catch (e) {
        // Ignore load errors; fall back to defaults
      }
    };

    loadData();
  }, [todayId]);

  useEffect(() => {
    const persist = async () => {
      try {
        const currentScore = computeScore(todayStats);
        await AsyncStorage.setItem(
          STORAGE_TODAY_KEY,
          JSON.stringify({ date: todayId, stats: todayStats, foodEntries: foodLogEntries })
        );

        setHistory((prev) => {
          const updated = updateHistory(prev, todayId, currentScore);
          AsyncStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        });

        await AsyncStorage.setItem(STORAGE_DATA_SOURCE_KEY, dataSource);
      } catch (e) {
        // Non-blocking persistence
      }
    };

    persist();
  }, [todayStats, todayId, dataSource, foodLogEntries]);

  useEffect(() => {
    const persistReminders = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(reminders));
      } catch (e) {
        // Non-blocking
      }
    };

    persistReminders();
  }, [reminders]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const toggleReminder = (key) => {
    setReminders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const markAsSynced = () => setDataSource('synced');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.heroOverlay} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.greeting}>Merhaba, {userName}</Text>
            <Text style={styles.subtitle}>Bugünkü sağlık özetin hazır.</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  Veri kaynağın: {dataSource === 'synced' ? 'Senkron' : 'Manuel'}
                </Text>
              </View>
              {selectedProgram ? (
                <View style={[styles.chip, styles.chipAlt]}>
                  <Text style={styles.chipText}>Program: {selectedProgram.title}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Gün</Text>
            <Text style={styles.badgeValue}>3</Text>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreUnit}>/100</Text>
          </View>
          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreTitle}>Günlük sağlık skoru</Text>
            <Text style={styles.scoreDescription}>
              Adım, su ve antrenman hedeflerin tek yerde toplandı. Devam edersen bugün hedefi yakalayabilirsin.
            </Text>
            <View style={styles.dataSourceRow}>
              <Text style={styles.dataSourceValue}>
                {dataSource === 'synced' ? 'Senkron verisi' : 'Manuel giriş'}
              </Text>
              {dataSource !== 'synced' && (
                <TouchableOpacity style={styles.dataSourceButton} onPress={markAsSynced}>
                  <Text style={styles.dataSourceButtonText}>Senkron işaretle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Adım ve Uyku</Text>
            <Text style={styles.sectionTag}>Net kalori + öneri</Text>
          </View>
          <Text style={styles.subtitle}>Adım ve uyku süreni gir, günlük özet ve önerilerini al.</Text>
          <View style={styles.dailyInputRow}>
            <View style={styles.inputColumn}>
              <Text style={styles.statLabel}>Adım sayın</Text>
              <TextInput
                value={stepsInput}
                onChangeText={setStepsInput}
                keyboardType="numeric"
                placeholder="Örn. 7500"
                placeholderTextColor="#64748b"
                style={styles.numericInput}
              />
            </View>
            <View style={styles.inputColumn}>
              <Text style={styles.statLabel}>Uyku (saat)</Text>
              <TextInput
                value={sleepInput}
                onChangeText={setSleepInput}
                keyboardType="decimal-pad"
                placeholder="Örn. 7.5"
                placeholderTextColor="#64748b"
                style={styles.numericInput}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, recLoading ? styles.primaryButtonDisabled : null]}
            onPress={handleSaveDailyLog}
            disabled={recLoading}
          >
            <Text style={styles.primaryButtonText}>{recLoading ? 'Hesaplanıyor...' : 'Kaydet ve öneri al'}</Text>
          </TouchableOpacity>
          {recError ? <Text style={styles.errorText}>{recError}</Text> : null}
          {recData ? (
            <View style={styles.recommendationBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.recommendationTitle}>{recData.summary || 'Günlük özet hazır'}</Text>
                {recData.clusterId != null ? (
                  <Text style={styles.recommendationBadge}>Küme #{recData.clusterId}</Text>
                ) : null}
              </View>
              <Text style={styles.statSubValue}>
                Net: {recData.inputs?.netCalories != null ? Math.round(recData.inputs.netCalories) : '...'} kcal | Alınan:{' '}
                {recData.inputs?.intakeCalories != null ? Math.round(recData.inputs.intakeCalories) : '...'} kcal | Yakılan:{' '}
                {recData.inputs?.burnedCalories != null ? Math.round(recData.inputs.burnedCalories) : '...'} kcal
              </Text>
              {recData.recommendations?.length ? (
                <View style={styles.recommendationList}>
                  {recData.recommendations.map((item, idx) => (
                    <Text key={`rec-${idx}`} style={styles.recommendationItem}>
                      - {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {recData.challenges?.length ? (
                <View style={styles.challengeBox}>
                  <Text style={styles.recommendationBadge}>Challenge</Text>
                  {recData.challenges.map((item, idx) => (
                    <Text key={`ch-${idx}`} style={styles.recommendationItem}>
                      - {item}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.statSubValue}>Adım ve uyku verilerini girerek günlük önerini al.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>G�nl�k Kalori</Text>
            <Text style={styles.sectionTag}>Hedef: {todayStats.caloriesTarget} kcal</Text>
          </View>
          <Text style={styles.subtitle}>
            Bug�n ald���n�z kalori: {foodLoading ? '...' : `${displayIntake} kcal`}
          </Text>
          <Text style={styles.statSubValue}>
            USDA FoodData Central aramalar�ndan gelen kay�tlar otomatik toplan�yor.
          </Text>
          {burnedFromRec != null || netFromRec != null ? (
            <Text style={styles.statSubValue}>
              Yak�lan: {burnedFromRec != null ? Math.round(burnedFromRec) : '...'} kcal | Net: {
                netFromRec != null ? Math.round(netFromRec) : '...'
              } kcal
            </Text>
          ) : null}
          {foodLogEntries.length > 0 ? (
            <View style={styles.foodResults}>
              {foodLogEntries.slice(-3).reverse().map((item, index) => (
                <View key={`${item.id || index}-${index}`} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodTitle}>{item.description || 'Bilinmeyen'}</Text>
                    <Text style={styles.foodMeta}>
                      {Math.round(item.calories || 0)} kcal {item.portionGrams ? `${item.portionGrams}g` : ''}{' '}
                      {item.brand ? `(${item.brand})` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.statSubValue}>Bugün için kayıt yok.</Text>
          )}
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    100,
                    todayStats.caloriesTarget ? ((displayIntake || 0) / todayStats.caloriesTarget) * 100 : 0
                  )}%`,
                  backgroundColor: '#f59e0b',
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Son 7 gün</Text>
            <Text style={styles.sectionTag}>Günlük skor</Text>
          </View>
          <View style={styles.historyList}>
            {last7Days.map((day) => (
              <View key={day.label} style={styles.historyRow}>
                <Text style={styles.historyDay}>{day.label}</Text>
                <View style={styles.historyBarBackground}>
                  <View style={[styles.historyBarFill, { width: `${day.score}%` }]} />
                </View>
                <Text style={styles.historyValue}>{day.score}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bugünkü önerin</Text>
            <Text style={styles.sectionTag}>Full body • 35 dk</Text>
          </View>

          <Text style={styles.programTitle}>FitAdvisor Gün 3</Text>
          <Text style={styles.programSubtitle}>Isınma, temel kuvvet ve hafif kardiyo ile dengeli bir seans.</Text>

          <View style={styles.programList}>
            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>5 dk hafif yürüyüş</Text>
                <Text style={styles.programItemMeta}>Isınma • düşük tempo</Text>
              </View>
            </View>

            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>Squat + Push-up</Text>
                <Text style={styles.programItemMeta}>3 set • 12 tekrar</Text>
              </View>
            </View>

            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>Plank</Text>
                <Text style={styles.programItemMeta}>3 set • 30 sn</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const horizontalPadding = width < 380 ? 16 : 24;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: -80,
    right: -80,
    height: 220,
    backgroundColor: '#0f172a',
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    opacity: 0.95,
  },
  scrollContent: {
    paddingHorizontal: horizontalPadding,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  chipAlt: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  badgeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
  },
  scoreRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 8,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: '#0f172a',
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ecfeff',
  },
  scoreUnit: {
    fontSize: 11,
    color: '#94a3b8',
  },
  scoreTextContainer: {
    flex: 1,
    gap: 6,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  scoreDescription: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 19,
  },
  dataSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dataSourceValue: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: '600',
  },
  dataSourceButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dataSourceButtonText: {
    fontSize: 12,
    color: '#0b1120',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#020617',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  sectionLink: {
    fontSize: 12,
    color: '#38bdf8',
  },
  sectionTag: {
    fontSize: 12,
    color: '#94a3b8',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileImage: {
    width: 92,
    height: 92,
    borderRadius: 18,
    backgroundColor: '#1f2937',
  },
  profileTextContainer: {
    flex: 1,
    gap: 6,
  },
  profileSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  bmiComment: {
    fontSize: 12,
    color: '#94a3b8',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  profileButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  profileAnalyzeButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  profileButtonDisabled: {
    opacity: 0.6,
  },
  profileButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  statCardWide: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  statSubValue: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  calorieRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    marginTop: 8,
  },
  calorieInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#f8fafc',
    fontSize: 16,
  },
  calorieSummary: {
    minWidth: 120,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'flex-start',
  },
  calorieTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fef3c7',
  },
  foodResults: {
    marginTop: 8,
    gap: 10,
  },
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
  foodTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  foodMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  foodAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#10b981',
    borderRadius: 10,
  },
  foodAddButtonText: {
    color: '#0b1120',
    fontWeight: '800',
    fontSize: 12,
  },
  dailyInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  inputColumn: {
    flex: 1,
  },
  numericInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#f8fafc',
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0b1120',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#f87171',
    marginTop: 8,
    fontSize: 12,
  },
  recommendationBox: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    gap: 6,
  },
  recommendationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    flex: 1,
  },
  recommendationList: {
    gap: 6,
    marginTop: 6,
  },
  recommendationItem: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  challengeBox: {
    marginTop: 8,
    gap: 6,
  },
  recommendationBadge: {
    backgroundColor: '#0ea5e9',
    color: '#0b1120',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '700',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  smallActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0ea5e91a',
  },
  smallActionText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  progressBarBackground: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 8,
  },
  reminderRowActive: {
    borderColor: '#10b981',
  },
  reminderLabel: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  reminderHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  historyList: {
    gap: 8,
    marginTop: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDay: {
    width: 48,
    fontSize: 12,
    color: '#cbd5e1',
  },
  historyBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#38bdf8',
  },
  historyValue: {
    width: 36,
    fontSize: 12,
    textAlign: 'right',
    color: '#cbd5e1',
  },
  programTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  programSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 12,
  },
  programList: {
    gap: 10,
  },
  programItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 10,
  },
  programTextGroup: {
    flex: 1,
  },
  programItemTitle: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  programItemMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  footerSpace: {
    height: 24,
  },
});
