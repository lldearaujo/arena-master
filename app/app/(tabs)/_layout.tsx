import { CalendarDays, Receipt, ScrollText, SquareCheckBig, User } from "lucide-react-native";
import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isLikelyExpoGo, registerAndroidFcmAndSync } from "../../src/notifications/androidFcm";
import { api } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

const TAB_ICONS = {
  mural: ScrollText,
  index: SquareCheckBig,
  financeiro: Receipt,
  competicoes: CalendarDays,
  perfil: User,
} as const;

function TabIcon({
  routeName,
  color,
}: {
  routeName: keyof typeof TAB_ICONS;
  focused: boolean;
  color: string;
}) {
  const Icon = TAB_ICONS[routeName] ?? User;
  return <Icon size={24} color={color} strokeWidth={2} style={{ marginBottom: 4 }} />;
}

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) return;
    if (isLikelyExpoGo()) return;
    void registerAndroidFcmAndSync(user.id);
  }, [user?.id]);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const { data: muralUnreadCount } = useQuery({
    queryKey: ["mural-unread-count"],
    queryFn: async () => {
      const res = await api.get<{ unread_count: number }>("/api/mural/unread-count");
      return res.data.unread_count ?? 0;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: false,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: tokens.color.bgCard,
          borderTopWidth: 0,
          borderTopLeftRadius: tokens.radius.lg,
          borderTopRightRadius: tokens.radius.lg,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          paddingBottom: Math.max(insets.bottom, tokens.space.sm) + tokens.space.xs,
          paddingTop: tokens.space.xs,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textOnPrimary,
        tabBarLabelStyle: { fontSize: tokens.text.xs, fontWeight: "600" },
        headerStyle: {
          backgroundColor: tokens.color.bgBody,
        },
        headerTitleStyle: {
          fontSize: tokens.text.md,
          fontWeight: "700",
          color: tokens.color.textPrimary,
        },
      }}
    >
      <Tabs.Screen
        name="mural"
        options={{
          title: "Mural",
          headerShown: false,
          tabBarBadge: muralUnreadCount && muralUnreadCount > 0 ? muralUnreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: tokens.color.primary,
            color: tokens.color.textOnPrimary,
            fontWeight: "800",
            fontSize: tokens.text.xs,
          },
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="mural" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Treinos",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="index" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: "Financeiro",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="financeiro" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="competicoes"
        options={{
          title: "Eventos",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="competicoes" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="perfil" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="turma-checkins/[id]"
        options={{ href: null, title: "Presenças", headerShown: false }}
      />
      <Tabs.Screen
        name="alterar-plano"
        options={{ href: null, title: "Alterar plano", headerShown: false }}
      />
    </Tabs>
  );
}

