import { Stack } from 'expo-router';
import { SafeAreaView, StatusBar, useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'FitAdvisor' }} />
        <Stack.Screen name="login" options={{ title: 'Giriş', headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Kullanıcı Oluştur', headerShown: true }} />
        <Stack.Screen name="trainer-login" options={{ title: 'Trainer Girişi', headerShown: true }} />
        <Stack.Screen name="trainer-register" options={{ title: 'Trainer Oluştur', headerShown: true }} />
        <Stack.Screen name="logout" options={{ title: 'Çıkış Yap', headerShown: true }} />
        <Stack.Screen name="trainer-notifications" options={{ title: 'Trainer Bildirimleri' }} />
        <Stack.Screen name="trainer-students" options={{ title: 'Trainer Öğrencileri' }} />
        <Stack.Screen name="trainer-messages" options={{ title: 'Trainer Mesajları' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="profile" options={{ title: 'Profil' }} />
        <Stack.Screen name="program" options={{ title: 'Program' }} />
        <Stack.Screen name="analysis" options={{ title: 'Analiz' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding', headerShown: false }} />
      </Stack>
    </SafeAreaView>
  );
}
