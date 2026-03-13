import { Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/auth";
import { Redirect } from "expo-router";

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: "Minhas turmas" }}
      />
      <Tabs.Screen
        name="filhos"
        options={{ title: "Turmas dos filhos" }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil" }}
      />
      <Tabs.Screen
        name="turma-checkins/[id]"
        options={{ href: null, title: "Presenças" }}
      />
    </Tabs>
  );
}

