import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { configurePushNotificationsIfAvailable } from "../src/notifications/configurePush";
import { restoreSession } from "../src/api/client";
import { tokens } from "../src/ui/tokens";

const queryClient = new QueryClient();

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(() => setSessionRestored(true))
      .catch(() => setSessionRestored(true));
  }, []);

  useEffect(() => {
    // Fire-and-forget: em Expo Go não faz nada.
    void configurePushNotificationsIfAvailable();
  }, []);

  if (!sessionRestored) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: tokens.color.bgBody }}>
        <ActivityIndicator size="large" color={tokens.color.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: tokens.color.textMuted }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

