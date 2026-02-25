import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      {/* screenOptions={{ headerShown: false }} 
         We hide the top header because each child layout (Admin/Worker) 
         will provide its own headers.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* The Landing Page (Checks auth state) */}
        <Stack.Screen name="index" />

        {/* The Auth Group (Login/Register) */}
        <Stack.Screen name="(auth)" />

        {/* The Admin Group (Dashboard/Create Job) */}
        <Stack.Screen name="(admin)" />

        {/* The Worker Group (Job List/Job Details) */}
        <Stack.Screen name="(worker)" />
      </Stack>
    </AuthProvider>
  );
}