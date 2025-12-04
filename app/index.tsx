import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import AnalysisScreen from "../src/screens/AnalysisScreen";
import Dashboard from "../src/screens/Dashboard";
import Login from "../src/screens/Login";
import Onboarding from "../src/screens/Onboarding";
import ProfileScreen from "../src/screens/ProfileScreen";
import ProgramScreen from "../src/screens/ProgramScreen";

type Step = "login" | "onboarding" | "dashboard";

type Profile = {
  age: string;
  height: string;
  weight: string;
  gender: string;
  goalType: string;
};

type DailyGoals = {
  stepsTarget: number;
  workoutMinutesTarget: number;
  waterTargetLiters: number;
};

function calculateDailyGoals(profile: Profile): DailyGoals {
  const goal = profile.goalType;

  if (goal === "gain_muscle") {
    return {
      stepsTarget: 7000,
      workoutMinutesTarget: 45,
      waterTargetLiters: 2.8,
    };
  }

  if (goal === "maintain") {
    return {
      stepsTarget: 7000,
      workoutMinutesTarget: 30,
      waterTargetLiters: 2.2,
    };
  }

  // varsayılan: kilo vermek
  return {
    stepsTarget: 9000,
    workoutMinutesTarget: 35,
    waterTargetLiters: 2.5,
  };
}

const Tab = createBottomTabNavigator();

type HomeTabsProps = {
  profile: Profile | null;
  goals: DailyGoals | null;
};

type SelectedProgram = { id: string; title: string } | null;

function HomeTabs({ profile, goals }: HomeTabsProps) {
  const [selectedProgram, setSelectedProgram] = useState<SelectedProgram>(null);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
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
            onSelectProgram={setSelectedProgram}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Analiz" component={AnalysisScreen} />
      <Tab.Screen name="Profil">
        {() => (
          <ProfileScreen
            profile={profile}
            onUpdateProfile={(updated: Profile) => {
              setProfile(updated);
              setGoals(calculateDailyGoals(updated));
            }}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function Page() {
  const [step, setStep] = useState<Step>("login");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {step === "login" && (
        <Login onLoginSuccess={() => setStep("onboarding")} />
      )}
      {step === "onboarding" && (
        <Onboarding
          onComplete={(p: Profile) => {
            setProfile(p);
            setGoals(calculateDailyGoals(p));
            setStep("dashboard");
          }}
        />
      )}
      {step === "dashboard" && (
        <HomeTabs profile={profile} goals={goals} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e5f2ff",
  },
});
