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

export default function ProfileScreen({ profile, onUpdateProfile }) {
  const [age, setAge] = useState(profile?.age ?? '');
  const [height, setHeight] = useState(profile?.height ?? '');
  const [weight, setWeight] = useState(profile?.weight ?? '');
  const [goalType, setGoalType] = useState(profile?.goalType ?? 'lose_weight');
  const [savedMessage, setSavedMessage] = useState('');

  const handleSave = () => {
    const updated = {
      age: age.trim(),
      height: height.trim(),
      weight: weight.trim(),
      gender: profile?.gender ?? '',
      goalType,
    };

    if (typeof onUpdateProfile === 'function') {
      onUpdateProfile(updated);
      setSavedMessage('Profil bilgilerin güncellendi. Hedeflerin buna göre yeniden hesaplandı.');
      setTimeout(() => setSavedMessage(''), 2500);
    }
  };

  const renderGoalChip = (value, label) => (
    <TouchableOpacity
      key={value}
      style={[styles.goalChip, goalType === value && styles.goalChipSelected]}
      onPress={() => setGoalType(value)}
      activeOpacity={0.8}
    >
      <Text
        style={[styles.goalChipText, goalType === value && styles.goalChipTextSelected]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.subtitle}>
          Kişisel bilgilerini ve hedeflerini güncellediğinde, günlük hedeflerin ve analizlerin de
          buna göre yenilenir.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Temel Bilgiler</Text>

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
          </View>

          <View style={styles.row}>
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
          <Text style={styles.cardTitle}>Hedefin</Text>
          <Text style={styles.cardText}>
            Buradaki seçimlerin günlük adım, antrenman süresi ve su hedeflerine doğrudan etki eder.
          </Text>

          <View style={styles.goalRow}>
            {renderGoalChip('lose_weight', 'Kilo vermek')}
            {renderGoalChip('maintain', 'Formu korumak')}
            {renderGoalChip('gain_muscle', 'Kas kazanmak')}
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Kaydet</Text>
        </TouchableOpacity>

        {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}
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
  content: {
    paddingHorizontal: horizontalPadding,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
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
  goalRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  goalChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  goalChipSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  goalChipText: {
    fontSize: 13,
    color: '#374151',
  },
  goalChipTextSelected: {
    color: '#166534',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  savedMessage: {
    marginTop: 8,
    fontSize: 12,
    color: '#16a34a',
  },
});
