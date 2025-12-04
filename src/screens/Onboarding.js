import { useState } from 'react';
import {
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function Onboarding({ onComplete }) {
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [goalType, setGoalType] = useState('');

  const handleContinue = () => {
    const profile = { age, height, weight, gender, goalType };
    if (typeof onComplete === 'function') {
      onComplete(profile);
    }
  };

  const selectGoal = (value) => {
    setGoalType(value);
  };

  const selectGender = (value) => {
    setGender(value);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.appName}>FitAdvisor</Text>
          <Text style={styles.title}>Kendini Tanıt</Text>
          <Text style={styles.subtitle}>
            Senin için en uygun günlük sağlık ve fitness hedeflerini belirleyelim.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Yaş</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="22"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>Cinsiyet</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    gender === 'female' && styles.chipSelected,
                  ]}
                  onPress={() => selectGender('female')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      gender === 'female' && styles.chipTextSelected,
                    ]}
                  >
                    Kadın
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    gender === 'male' && styles.chipSelected,
                  ]}
                  onPress={() => selectGender('male')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      gender === 'male' && styles.chipTextSelected,
                    ]}
                  >
                    Erkek
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Boy (cm)</Text>
              <TextInput
                value={height}
                onChangeText={setHeight}
                placeholder="175"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.rowItem}>
              <Text style={styles.label}>Kilo (kg)</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="70"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hedefin Ne?</Text>
          <Text style={styles.sectionSubtitle}>
            Günlük adım sayısı, antrenman süresi ve program önerilerini buna göre ayarlayacağız.
          </Text>

          <View style={styles.goalGrid}>
            <TouchableOpacity
              style={[
                styles.goalCard,
                goalType === 'lose_weight' && styles.goalCardSelected,
              ]}
              onPress={() => selectGoal('lose_weight')}
            >
              <Text style={styles.goalTitle}>Kilo Vermek</Text>
              <Text style={styles.goalDescription}>
                Daha yüksek adım hedefi ve yağ yakmaya odaklı antrenmanlar.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.goalCard,
                goalType === 'maintain' && styles.goalCardSelected,
              ]}
              onPress={() => selectGoal('maintain')}
            >
              <Text style={styles.goalTitle}>Formu Korumak</Text>
              <Text style={styles.goalDescription}>
                Dengeli aktivite, hafif kuvvet ve mobilite çalışmaları.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.goalCard,
                goalType === 'gain_muscle' && styles.goalCardSelected,
              ]}
              onPress={() => selectGoal('gain_muscle')}
            >
              <Text style={styles.goalTitle}>Kas Kazanmak</Text>
              <Text style={styles.goalDescription}>
                Ağırlık odaklı programlar, destekleyici kardiyo hedefleri.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Devam Et</Text>
        </TouchableOpacity>

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
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerContainer: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rowItem: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#d1d5db',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  chipSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#166534',
    fontWeight: '600',
  },
  goalGrid: {
    gap: 12,
  },
  goalCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  goalCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpace: {
    height: 16,
  },
});
