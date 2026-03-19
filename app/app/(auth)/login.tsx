import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TextInput, Pressable, Image, Linking } from "react-native";
import { HelpCircle } from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";

import { api, persistSession } from "../../src/api/client";
import { Role, useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

const arenaMasterLogo = require("../../assets/arena-master-logo.png");

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    role: Role;
    dojo_id: number | null;
    avatar_url?: string | null;
  };
};

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });
      const tokens = {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
      };
      setSession(tokens, {
        id: res.data.user.id,
        email: res.data.user.email,
        role: res.data.user.role,
        dojoId: res.data.user.dojo_id,
        avatarUrl: res.data.user.avatar_url ?? null,
      });
    },
    onSuccess: async () => {
      await persistSession();
      router.replace("/(tabs)");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? err.message
          : "Falha ao entrar. Verifique suas credenciais.";
      setError(message);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgCard }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Topo: faixa dourada com logo */}
      <View
        style={{
          backgroundColor: tokens.color.primary,
          borderBottomLeftRadius: tokens.radius.lg,
          borderBottomRightRadius: tokens.radius.lg,
          paddingTop: 48,
          paddingBottom: 32,
          paddingHorizontal: tokens.space.xl,
          alignItems: "center",
        }}
      >
        <Image
          source={arenaMasterLogo}
          style={{ width: 203, height: 203 }}
          resizeMode="contain"
        />
      </View>

      {/* Conteúdo: área azul escura com formulário */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: tokens.space.xl,
          paddingTop: tokens.space.xl,
          paddingBottom: tokens.space.xl,
        }}
      >
        <View>
          <Text
            style={{
              color: tokens.color.textOnPrimary,
              fontSize: tokens.text.xl,
              fontWeight: "900",
              letterSpacing: 0.5,
              marginBottom: tokens.space.lg,
              textAlign: "center",
            }}
          >
            BEM-VINDO
          </Text>

          <TextInput
            placeholder="Telefone/Email"
            placeholderTextColor="rgba(255,255,255,0.6)"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              borderRadius: tokens.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: tokens.space.md,
              fontSize: tokens.text.md,
              color: tokens.color.textOnPrimary,
            }}
          />

          <TextInput
            placeholder="Senha"
            placeholderTextColor="rgba(255,255,255,0.6)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              borderRadius: tokens.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: tokens.space.sm,
              fontSize: tokens.text.md,
              color: tokens.color.textOnPrimary,
            }}
          />

          {error && (
            <Text
              style={{
                color: tokens.color.error,
                fontSize: tokens.text.sm,
                marginBottom: tokens.space.sm,
              }}
            >
              {error}
            </Text>
          )}

          <Pressable
            onPress={() => mutation.mutate()}
            style={{
              backgroundColor: tokens.color.primary,
              paddingVertical: 14,
              borderRadius: tokens.radius.lg,
              alignItems: "center",
              marginTop: tokens.space.md,
            }}
          >
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontWeight: "700",
                fontSize: tokens.text.md,
              }}
            >
              {mutation.isPending ? "Entrando..." : "Entrar"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            Linking.openURL("https://wa.me/5583994068978");
          }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: tokens.color.primary,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            marginTop: "25%",
          }}
        >
          <HelpCircle
            size={26}
            color={tokens.color.primary}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>
    </View>
  );
}

