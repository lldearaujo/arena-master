import { Receipt, ScrollText, SquareCheckBig, User, Users } from "lucide-react-native";
import { Tabs } from "expo-router";
import { Redirect } from "expo-router";

import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

const TAB_ICONS = {
  mural: ScrollText,
  index: SquareCheckBig,
  filhos: Users,
  financeiro: Receipt,
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

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

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
        name="filhos"
        options={{
          title: "Turma kids",
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon routeName="filhos" focused={focused} color={color} />
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

