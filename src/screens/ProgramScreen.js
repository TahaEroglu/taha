import { useState } from 'react';
import {
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

const PROGRAMS = [
  {
    id: 'fullbody-3',
    title: 'Full Body · 3 Gün',
    level: 'Başlangıç / Orta seviye',
    description:
      'Tüm vücut odaklı, haftada 3 gün yapılacak güç ve dayanıklılık programı.',
    days: [
      {
        label: 'Gün 1 · Üst vücut ağırlık',
        exercises: [
          'Isınma: 5 dk hafif yürüyüş',
          'Şınav · 3 x 10-12',
          'Dumbbell Row · 3 x 12',
          'Omuz Press · 3 x 12',
        ],
      },
      {
        label: 'Gün 2 · Alt vücut & core',
        exercises: [
          'Isınma: 5 dk hafif koşu',
          'Squat · 3 x 12',
          'Lunge · 3 x 10 (bacak başına)',
          'Plank · 3 x 30 sn',
        ],
      },
      {
        label: 'Gün 3 · Tüm vücut hafif',
        exercises: [
          'Isınma: 10 dk tempolu yürüyüş',
          'Kettlebell Deadlift · 3 x 12',
          'Incline Push-up · 3 x 12',
          'Side Plank · 3 x 20 sn',
        ],
      },
    ],
  },
  {
    id: 'hiit-2',
    title: 'HIIT · 2 Gün',
    level: 'Orta seviye',
    description: 'Kısa ama yoğun kardiyo seanslarıyla kondisyonunu artır.',
    days: [
      {
        label: 'Gün 1 · Interval koşu',
        exercises: [
          '5 dk ısınma yürüyüşü',
          '30 sn sprint / 60 sn yürüyüş · 8-10 tur',
          '5 dk soğuma yürüyüşü',
        ],
      },
      {
        label: 'Gün 2 · Vücut ağırlığı HIIT',
        exercises: [
          'Jump Squat · 30 sn',
          'Mountain Climber · 30 sn',
          'Burpee · 30 sn',
          'Her tur sonrası 60 sn dinlen, 4-5 tur',
        ],
      },
    ],
  },
];

export default function ProgramScreen({ selectedProgramId, onSelectProgram }) {
  const [openProgramId, setOpenProgramId] = useState(selectedProgramId ?? null);
  const [completedKeys, setCompletedKeys] = useState([]);

  const toggleExercise = (programId, dayLabel, exercise) => {
    const key = `${programId}|${dayLabel}|${exercise}`;
    setCompletedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleProgram = (id, title) => {
    setOpenProgramId((prev) => {
      const next = prev === id ? null : id;
      if (typeof onSelectProgram === 'function') {
        onSelectProgram(next ? { id, title } : null);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Programlar</Text>
        <Text style={styles.subtitle}>
          Hedefine göre uyarlanmış hazır programlardan birini seçebilir veya ilerde kendi
          programını oluşturabileceksin.
        </Text>

        {PROGRAMS.map((program) => {
          const isOpen = openProgramId === program.id;
          return (
            <View key={program.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                activeOpacity={0.7}
                onPress={() => toggleProgram(program.id, program.title)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{program.title}</Text>
                  <Text style={styles.cardLevel}>{program.level}</Text>
                </View>
                <Text style={styles.cardToggle}>{isOpen ? '−' : '+'}</Text>
              </TouchableOpacity>

              <Text style={styles.cardText}>{program.description}</Text>

              {isOpen && (
                <View style={styles.daysContainer}>
                  {program.days.map((day) => (
                    <View key={day.label} style={styles.dayCard}>
                      <Text style={styles.dayLabel}>{day.label}</Text>
                      {day.exercises.map((ex) => {
                        const key = `${program.id}|${day.label}|${ex}`;
                        const done = completedKeys.includes(key);
                        return (
                          <TouchableOpacity
                            key={ex}
                            style={styles.exerciseRow}
                            activeOpacity={0.7}
                            onPress={() => toggleExercise(program.id, day.label, ex)}
                          >
                            <View style={[styles.bullet, done && styles.bulletDone]} />
                            <Text
                              style={[styles.exerciseText, done && styles.exerciseTextDone]}
                            >
                              {ex}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardLevel: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  cardToggle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#16a34a',
    marginLeft: 8,
  },
  daysContainer: {
    marginTop: 8,
    gap: 8,
  },
  dayCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 6,
  },
  exerciseText: {
    flex: 1,
    fontSize: 12,
    color: '#4b5563',
  },
});
