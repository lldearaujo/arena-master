import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { View, Text, TextInput, Pressable } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { api, persistSession } from "../../src/api/client";
import { Role, useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

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
    onError: () => {
      setError("Falha ao entrar. Verifique suas credenciais.");
    },
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgBody,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Text
        style={{
          color: tokens.color.textOnPrimary,
          fontSize: tokens.text["2xl"],
          fontWeight: "700",
          marginBottom: tokens.space.lg,
        }}
      >
        Arena Master
      </Text>
      <View
        style={{
          width: "100%",
          maxWidth: 360,
          padding: tokens.space.lg,
          borderRadius: tokens.radius.lg,
          backgroundColor: "white",
        }}
      >
        <Text
          style={{
            fontSize: tokens.text.lg,
            marginBottom: tokens.space.md,
          }}
        >
          Entrar
        </Text>
        <TextInput
          placeholder="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            borderRadius: tokens.radius.md,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: tokens.space.sm,
          }}
        />
        <TextInput
          placeholder="Senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            borderRadius: tokens.radius.md,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: tokens.space.xs,
          }}
        />
        {error && (
          <Text
            style={{
              color: tokens.color.error,
              fontSize: tokens.text.sm,
              marginBottom: tokens.space.xs,
            }}
          >
            {error}
          </Text>
        )}
        <Pressable
          onPress={() => mutation.mutate()}
          style={{
            backgroundColor: tokens.color.primary,
            paddingVertical: 10,
            borderRadius: tokens.radius.md,
            alignItems: "center",
            marginTop: tokens.space.sm,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>
            {mutation.isPending ? "Entrando..." : "Entrar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

