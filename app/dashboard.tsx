import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";

import AnalysisScreen from "../src/screens/AnalysisScreen";
import Dashboard from "../src/screens/Dashboard";
import ProfileScreen from "../src/screens/ProfileScreen";
import ProgramScreen from "../src/screens/ProgramScreen";
import PersonalTrainers from "../src/screens/PersonalTrainers";
import Messages from "../src/screens/Messages";
import CalorieSearch from "../src/screens/CalorieSearch";
import { updateUserProfile } from "../src/firebase/service";

type Profile = {
  age: string;
  height: string;
  weight: string;
  gender: string;
  goalType: string;
  profilePhoto?: string | null;
};

type Session = {
  userId: string;
  name?: string;
  username?: string;
  goal?: string;
  programId?: string | null;
  assignedTrainerId?: string | null;
};

type DailyGoals = {
  stepsTarget: number;
  workoutMinutesTarget: number;
  waterTargetLiters: number;
};

function calculateDailyGoals(profile: Profile): DailyGoals {
  const goal = profile.goalType;

  if (goal === "gain_muscle") {
    return { stepsTarget: 7000, workoutMinutesTarget: 45, waterTargetLiters: 2.8 };
  }
  if (goal === "maintain") {
    return { stepsTarget: 7000, workoutMinutesTarget: 30, waterTargetLiters: 2.2 };
  }
  return { stepsTarget: 9000, workoutMinutesTarget: 35, waterTargetLiters: 2.5 };
}

const Tab = createBottomTabNavigator();

type SelectedProgram = { id: string; title: string } | null;

const PROFILE_STORAGE_KEY = "fitadvisor:profile";
const PROGRAM_STORAGE_KEY = "fitadvisor:program";
const SESSION_KEY = "fitadvisor:session";
const USERS_KEY = "fitadvisor:users";

export default function DashboardScreen() {
  const router = useRouter();
  const [selectedProgram, setSelectedProgram] = useState<SelectedProgram>(null);
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>({
    age: "25",
    height: "175",
    weight: "70",
    gender: "male",
    goalType: "maintain",
  });
  const goals = calculateDailyGoals(profile);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.age && parsed?.height && parsed?.weight) {
            setProfile(parsed);
          }
        }
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

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

  useEffect(() => {
    const loadProgram = async () => {
      try {
        const stored = await AsyncStorage.getItem(PROGRAM_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.selectedProgram) setSelectedProgram(parsed.selectedProgram);
          if (parsed?.completedDays) setCompletedDays(parsed.completedDays);
        }
      } catch {
        // ignore
      }
    };
    loadProgram();
  }, []);

  const handleUpdateProfile = async (updated: Profile) => {
    const updatedWithPhoto: Profile = { ...profile, ...updated };
    setProfile(updatedWithPhoto);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedWithPhoto));
      if (session) {
        const nextSession = { ...session, goal: updated.goalType, profilePhoto: updatedWithPhoto.profilePhoto };
        setSession(nextSession);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      }
      if (session?.userId) {
        const storedUsers = await AsyncStorage.getItem(USERS_KEY);
        const list = storedUsers ? JSON.parse(storedUsers) : [];
        if (Array.isArray(list)) {
          const nextUsers = list.map((u: any) =>
            u.id === session.userId
              ? {
                  ...u,
                  age: updatedWithPhoto.age,
                  goal: updatedWithPhoto.goalType,
                  height: updatedWithPhoto.height,
                  weight: updatedWithPhoto.weight,
                  gender: updatedWithPhoto.gender,
                  profilePhoto: updatedWithPhoto.profilePhoto,
                }
              : u
          );
          await AsyncStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
        }
        await updateUserProfile(session.userId, {
          age: updatedWithPhoto.age,
          height: updatedWithPhoto.height,
          weight: updatedWithPhoto.weight,
          gender: updatedWithPhoto.gender,
          goalType: updatedWithPhoto.goalType,
          profilePhoto: updatedWithPhoto.profilePhoto || null,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleSelectProgram = async (program: SelectedProgram) => {
    const nextCompleted = program ? {} : completedDays;
    setSelectedProgram(program);
    setCompletedDays(nextCompleted);
    try {
      await AsyncStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify({ selectedProgram: program, completedDays: nextCompleted }));
    } catch {
      // ignore
    }
  };

  const toggleDayCompletion = async (dayKey: string) => {
    setCompletedDays((prev) => {
      const next = { ...prev, [dayKey]: !prev[dayKey] };
      AsyncStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify({ selectedProgram, completedDays: next }));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(SESSION_KEY),
        AsyncStorage.removeItem(PROFILE_STORAGE_KEY),
        AsyncStorage.removeItem("fitadvisor:trainerSession"),
      ]);
    } catch {
      // ignore
    } finally {
      router.replace("/login");
    }
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Çıkış</Text>
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: "#16a34a",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { backgroundColor: "#ffffff" },
      }}
    >
      <Tab.Screen name="Ana">
        {() => <Dashboard profile={profile} goals={goals} selectedProgram={selectedProgram} />}
      </Tab.Screen>
      <Tab.Screen name="Program">
        {() => (
          <ProgramScreen
            selectedProgramId={selectedProgram?.id ?? null}
            completedDays={completedDays}
            onSelectProgram={handleSelectProgram}
            onToggleDay={toggleDayCompletion}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Kalori" component={CalorieSearch} />
      <Tab.Screen name="Mesajlar" component={Messages} />
      <Tab.Screen name="Trainerlar" component={PersonalTrainers} />
      <Tab.Screen name="Analiz" component={AnalysisScreen} />
      <Tab.Screen name="Profil">
        {() => <ProfileScreen profile={profile} onUpdateProfile={handleUpdateProfile} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
