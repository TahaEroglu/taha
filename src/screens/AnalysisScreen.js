import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function AnalysisScreen() {
  const weeklyData = [70, 62, 55, 80, 65, 50, 72];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Analiz</Text>
        <Text style={styles.subtitle}>
          Adım, antrenman ve sağlık skorunun zaman içindeki değişimini burada takip edeceksin.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Haftalık sağlık skoru</Text>

          <View style={styles.barRow}>
            {weeklyData.map((value, index) => (
              <View key={index} style={styles.barItem}>
                <View style={[styles.bar, { height: 40 + (value / 100) * 60 }]} />
                <Text style={styles.barLabel}>G{index + 1}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.cardText}>
            Skorun genel olarak dengeli görünüyor. Hedefine göre bu alanı daha detaylı
            raporlarla zenginleştireceğiz.
          </Text>
        </View>
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
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 10,
    borderRadius: 999,
    backgroundColor: '#16a34a',
    marginBottom: 4,
    alignSelf: 'center',
  },
  barLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
