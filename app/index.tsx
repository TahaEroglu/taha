import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  return (
    <View style={[styles.container, colorScheme === 'dark' && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, colorScheme === 'dark' && styles.titleDark]}>FitAdvisor</Text>
        <Text style={[styles.subtitle, colorScheme === 'dark' && styles.subtitleDark]}>
          Fitness yolculuğunu seç: Kullanıcı veya Trainer girişi.
        </Text>

        <View style={styles.buttonContainer}>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Kullanıcı Girişi</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.trainerButton]} onPress={() => router.push('/trainer-login')}>
            <Text style={[styles.buttonText, styles.trainerButtonText]}>Trainer Girişi</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5f2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 32,
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: 320,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: '#22c55e',
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 48,
    textAlign: 'center',
  },
  subtitleDark: {
    color: '#9ca3af',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#16a34a',
  },
  secondaryButton: {
    backgroundColor: '#0ea5e9',
    borderWidth: 0,
  },
  trainerButton: {
    backgroundColor: '#0ea5e9',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  trainerButtonText: {
    color: '#0b1120',
  },
  secondaryButtonText: {
    color: '#0b1120',
  },
});
