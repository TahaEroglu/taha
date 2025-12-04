import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const STORAGE_TODAY_KEY = 'fitadvisor:todayStats';
const STORAGE_HISTORY_KEY = 'fitadvisor:history';

function computeScore(stats) {
  if (!stats) return 0;
  const stepRatio = stats.stepsTarget ? stats.steps / stats.stepsTarget : 0;
  const workoutRatio = stats.workoutTarget
    ? stats.workoutMinutes / stats.workoutTarget
    : 0;
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
  const userName = 'Alperen';

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
  });
  const [history, setHistory] = useState([]);

  const todayId = new Date().toISOString().slice(0, 10);
  const score = computeScore(todayStats);

  const heightMeters = profile?.height ? Number(profile.height) / 100 : null;
  const weightKg = profile?.weight ? Number(profile.weight) : null;

  let bmi = null;
  if (heightMeters && weightKg && heightMeters > 0) {
    bmi = weightKg / (heightMeters * heightMeters);
  }

  let bmiLabel = '—';
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
  const last7Days = history
    .slice(-7)
    .map((entry) => {
      const date = new Date(entry.date);
      const label = date.toLocaleDateString('tr-TR', { weekday: 'short' });
      return { label, score: entry.score };
    });

  const incrementSteps = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      steps: Math.min(prev.steps + delta, prev.stepsTarget),
    }));
  };

  const incrementWorkout = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      workoutMinutes: Math.min(prev.workoutMinutes + delta, prev.workoutTarget),
    }));
  };

  const incrementWater = (delta) => {
    setTodayStats((prev) => ({
      ...prev,
      waterLiters: Math.min(prev.waterLiters + delta, prev.waterTarget),
    }));
  };

  const handleRunAnalysis = async () => {
    if (!bmi) {
      setAnalysisText('Analiz için profil bilgilerini (boy ve kilo) eksiksiz doldurman yeterli.');
      return;
    }

    // Önce backend'e istek atmayı dene (çalışıyorsa gerçek analiz gelir)
    if (imageUri) {
      try {
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        });
        formData.append('bmi', String(bmi));
        formData.append('goalType', profile?.goalType ?? '');
        formData.append('selectedProgramTitle', selectedProgram?.title ?? '');

        const response = await fetch('http://localhost:4000/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.ok && data?.analysis?.comment) {
            setAnalysisText(data.analysis.comment);
            return;
          }
        }
      } catch (error) {
        // Backend yoksa veya hata alırsak sessizce local analize düşeceğiz
      }
    }

    // Backend'ten sonuç alamazsak local kural tabanlı analize geri dön
    const goal = profile?.goalType;
    let text = '';

    if (goal === 'gain_muscle') {
      if (bmi < 22) {
        text =
          'Kas kazanmak için zayıf sayılabilecek bir aralıktasın. Düzenli kuvvet antrenmanı ve dengeli beslenme kas kütleni artırmana yardımcı olacak.';
      } else if (bmi < 27) {
        text =
          'Kas kazanmak için uygun bir aralıktasın. Ağırlık antrenmanlarını düzenli tutman ve toparlanmaya dikkat etmen yeterli.';
      } else {
        text =
          'Kas kazanma hedefin var; önce hafif bir yağ azaltma dönemi ile eklemlere yükü azaltmak senin için daha konforlu olabilir.';
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
          'Formu koruma hedefinde vücut kompozisyonunu biraz hafifletmek konforunu artırabilir; sakin tempolu kilo verme bu noktada uygun görünüyor.';
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
          'Kilo verme sürecinde yavaş ve sürdürülebilir ilerlemek en sağlıklısı. Düzenli hareket, uyku ve beslenme ile başlayıp gerektiğinde uzman desteği ekleyebilirsin.';
      }
    }

    if (selectedProgram?.title) {
      text += ` Seçili programın (${selectedProgram.title}) bu hedefe destek olacak şekilde yapılandırıldı.`;
    }

    setAnalysisText(text);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToday = await AsyncStorage.getItem(STORAGE_TODAY_KEY);
        if (storedToday) {
          const parsed = JSON.parse(storedToday);
          if (parsed.date === todayId && parsed.stats) {
            setTodayStats((prev) => ({ ...prev, ...parsed.stats }));
          }
        }

        const storedHistory = await AsyncStorage.getItem(STORAGE_HISTORY_KEY);
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory)) {
            setHistory(parsedHistory);
          }
        }
      } catch (e) {
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
          JSON.stringify({ date: todayId, stats: todayStats })
        );

        setHistory((prev) => {
          const updated = updateHistory(prev, todayId, currentScore);
          AsyncStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        });
      } catch (e) {
      }
    };

    persist();
  }, [todayStats, todayId]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Merhaba, {userName}</Text>
            <Text style={styles.subtitle}>Bugünkü sağlık özetin burada.</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Gün</Text>
            <Text style={styles.badgeValue}>3</Text>
          </View>
        </View>

        {selectedProgram && (
          <View style={styles.selectedProgramBadge}>
            <Text style={styles.selectedProgramLabel}>Seçili program</Text>
            <Text style={styles.selectedProgramTitle}>{selectedProgram.title}</Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Son 7 gün</Text>
        </View>

        <View style={styles.historyList}>
          {last7Days.map((day) => (
            <View key={day.label} style={styles.historyRow}>
              <Text style={styles.historyDay}>{day.label}</Text>
              <View style={styles.historyBarBackground}>
                <View
                  style={[
                    styles.historyBarFill,
                    { width: `${day.score}%` },
                  ]}
                />
              </View>
              <Text style={styles.historyValue}>{day.score}</Text>
            </View>
          ))}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={{
                uri:
                  imageUri ?? 'https://via.placeholder.com/120x120.png?text=You',
              }}
              style={styles.profileImage}
            />
          </View>
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileTitle}>Görsel Analiz</Text>
            <Text style={styles.profileSubtitle}>
              Fotoğrafına göre duruşun ve kas dağılımın hakkında özet çıkaracağız.
              {` ${analysisText}`}
            </Text>
            {bmi && (
              <View style={styles.bmiRow}>
                <Text style={styles.bmiValue}>BMI: {bmi.toFixed(1)} ({bmiLabel})</Text>
                <Text style={styles.bmiComment}>{bmiComment}</Text>
              </View>
            )}
            <View style={styles.profileTagRow}>
              <Text style={styles.profileTag}>Duruş: Dengeli</Text>
              <Text style={styles.profileTag}>Omuz hizası: İyi</Text>
            </View>

            <TouchableOpacity style={styles.profileButton} onPress={handlePickImage}>
              <Text style={styles.profileButtonText}>Fotoğraf Seç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileButton, styles.profileAnalyzeButton]}
              onPress={handleRunAnalysis}
            >
              <Text style={styles.profileButtonText}>Analiz Et</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <View style={styles.scoreRingPlaceholder}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreUnit}>/100</Text>
          </View>
          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreTitle}>Günlük Sağlık Skoru</Text>
            <Text style={styles.scoreDescription}>
              Hedeflerine yaklaşıyorsun. Bugün adım ve su hedeflerine odaklanırsan
              skoru kolayca yükseltebilirsin.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Bugünkü hedeflerin</Text>
          <Text style={styles.sectionLink}>Detaylar</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCardWide}>
            <Text style={styles.statLabel}>Adım</Text>
            <Text style={styles.statValue}>{todayStats.steps}</Text>
            <Text style={styles.statSubValue}>
              / {todayStats.stepsTarget} adım
            </Text>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(todayStats.steps / todayStats.stepsTarget) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.smallActionButton}
                onPress={() => incrementSteps(500)}
              >
                <Text style={styles.smallActionText}>+500</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallActionButton}
                onPress={() => incrementSteps(1000)}
              >
                <Text style={styles.smallActionText}>+1000</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCardSmall}>
            <Text style={styles.statLabel}>Antrenman</Text>
            <Text style={styles.statValue}>{todayStats.workoutMinutes} dk</Text>
            <Text style={styles.statSubValue}>
              / {todayStats.workoutTarget} dk
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.smallActionButton}
                onPress={() => incrementWorkout(5)}
              >
                <Text style={styles.smallActionText}>+5 dk</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statCardSmall}>
            <Text style={styles.statLabel}>Su</Text>
            <Text style={styles.statValue}>{todayStats.waterLiters} L</Text>
            <Text style={styles.statSubValue}>
              / {todayStats.waterTarget} L
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.smallActionButton}
                onPress={() => incrementWater(0.25)}
              >
                <Text style={styles.smallActionText}>+0.25 L</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Bugünkü önerin</Text>
          <Text style={styles.sectionTag}>Full body · 35 dk</Text>
        </View>

        <View style={styles.programCard}>
          <Text style={styles.programTitle}>FitAdvisor Gün 3</Text>
          <Text style={styles.programSubtitle}>
            Isınma, temel kuvvet ve hafif kardiyo ile dengeli bir seans.
          </Text>

          <View style={styles.programList}>
            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>5 dk hafif yürüyüş</Text>
                <Text style={styles.programItemMeta}>Isınma · düşük tempo</Text>
              </View>
            </View>

            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>Squat + Push-up</Text>
                <Text style={styles.programItemMeta}>3 set · 12 tekrar</Text>
              </View>
            </View>

            <View style={styles.programItem}>
              <View style={styles.dot} />
              <View style={styles.programTextGroup}>
                <Text style={styles.programItemTitle}>Plank</Text>
                <Text style={styles.programItemMeta}>3 set · 30 sn</Text>
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
    backgroundColor: '#e5f2ff',
  },
  scrollContent: {
    paddingHorizontal: horizontalPadding,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 14,
    marginBottom: 16,
  },
  profileImageWrapper: {
    marginRight: 12,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  profileTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  profileTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  profileTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  profileTag: {
    fontSize: 11,
    color: '#166534',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bmiRow: {
    marginTop: 8,
  },
  bmiValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  bmiComment: {
    fontSize: 12,
    color: '#6b7280',
  },
  profileButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileAnalyzeButton: {
    marginLeft: 8,
    backgroundColor: '#22c55e',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 4,
  },
  selectedProgramBadge: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignSelf: 'flex-start',
  },
  selectedProgramLabel: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  selectedProgramTitle: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    marginBottom: 16,
  },
  scoreRingPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#022c22',
  },
  scoreUnit: {
    fontSize: 10,
    color: '#6b7280',
  },
  scoreTextContainer: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionLink: {
    fontSize: 12,
    color: '#16a34a',
  },
  sectionTag: {
    fontSize: 12,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  statCardWide: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statSubValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  smallActionText: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '500',
  },
  progressBarBackground: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16a34a',
  },
  programCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    marginTop: 12,
  },
  programTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  programSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
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
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  historyList: {
    marginTop: 12,
    gap: 6,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDay: {
    width: 40,
    fontSize: 12,
    color: '#6b7280',
  },
  historyBarBackground: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16a34a',
  },
  historyValue: {
    width: 32,
    fontSize: 12,
    textAlign: 'right',
    color: '#6b7280',
  },
});
