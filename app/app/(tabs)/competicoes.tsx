import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api/client";
import { isLikelyExpoGo, registerAndroidFcmAndSync } from "../../src/notifications/androidFcm";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

type Competition = {
  id: number;
  name: string;
  reference_year: number;
  is_published: boolean;
};

type NotifRow = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

export default function CompeticoesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [fcm, setFcm] = useState("");
  const [fcmHint, setFcmHint] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await api.get<{ fcm_token?: string | null }>("/api/users/me");
      return res.data;
    },
  });

  useEffect(() => {
    if (me?.fcm_token !== undefined) setFcm(me.fcm_token ?? "");
  }, [me?.fcm_token]);

  const { data: comps, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const res = await api.get<Competition[]>("/api/competitions/");
      return res.data;
    },
  });

  const { data: notifs } = useQuery({
    queryKey: ["comp-notifs"],
    queryFn: async () => {
      const res = await api.get<NotifRow[]>("/api/competitions/me/notifications");
      return res.data;
    },
  });

  const saveFcm = useMutation({
    mutationFn: async () => {
      await api.patch("/api/users/me", { fcm_token: fcm.trim() || null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-me"] }),
  });

  const syncNativeFcm = useMutation({
    mutationFn: async () => {
      if (userId == null) throw new Error("Sessão inválida");
      return registerAndroidFcmAndSync(userId);
    },
    onSuccess: (res) => {
      if (res.ok) {
        setFcmHint("Token FCM registado no servidor.");
        void qc.invalidateQueries({ queryKey: ["user-me"] });
        setFcm(res.token);
        return;
      }
      const msg: Record<typeof res.reason, string> = {
        not_android: "Sincronização automática do token FCM só está disponível no Android.",
        expo_go: "Use um development build (EAS) ou build de loja — o Expo Go não carrega o seu google-services.json.",
        simulator: "Use um dispositivo físico para obter token FCM.",
        permission_denied: "Ative as notificações nas definições do sistema para registar o token.",
        no_token: "Não foi possível obter o token do dispositivo.",
        sync_failed: "Token obtido, mas falhou ao guardar no servidor. Tente de novo.",
      };
      setFcmHint(msg[res.reason]);
    },
    onError: () => setFcmHint("Erro ao sincronizar."),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.color.bgBody }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 32 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Bell size={28} color={tokens.color.primary} strokeWidth={2} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: tokens.color.textPrimary }}>Competições</Text>
      </View>
      <Text style={{ color: tokens.color.textMuted, marginBottom: 20, fontSize: 14 }}>
        Eventos publicados e avisos do organizador.
      </Text>

      {isLoading && <ActivityIndicator color={tokens.color.primary} />}

      {(comps ?? []).map((c) => (
        <View
          key={c.id}
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: tokens.color.bgCard,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
          }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16, color: tokens.color.textPrimary }}>{c.name}</Text>
          <Text style={{ color: tokens.color.textMuted, fontSize: 13, marginTop: 4 }}>
            Ano {c.reference_year}
            {c.is_published ? " · Publicada" : ""}
          </Text>
        </View>
      ))}

      <Text style={{ fontSize: 17, fontWeight: "700", marginTop: 24, marginBottom: 8, color: tokens.color.textPrimary }}>
        Notificações recentes
      </Text>
      {(notifs ?? []).length === 0 && (
        <Text style={{ color: tokens.color.textMuted, fontSize: 14 }}>Nenhuma notificação.</Text>
      )}
      {(notifs ?? []).map((n) => (
        <View key={n.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: tokens.color.borderSubtle }}>
          <Text style={{ fontWeight: "700", color: tokens.color.textPrimary }}>{n.title}</Text>
          <Text style={{ color: tokens.color.textMuted, marginTop: 4, fontSize: 14 }}>{n.body}</Text>
          <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginTop: 4 }}>{n.created_at}</Text>
        </View>
      ))}

      <Text style={{ fontSize: 17, fontWeight: "700", marginTop: 24, marginBottom: 8, color: tokens.color.textPrimary }}>
        Notificações push (FCM)
      </Text>
      <Text style={{ color: tokens.color.textMuted, fontSize: 13, marginBottom: 8 }}>
        No Android, o app regista o token FCM nativo (Firebase) ao iniciar sessão, compatível com o envio do servidor. Pode
        sincronizar manualmente ou colar um token abaixo (ex.: outro dispositivo ou teste).
      </Text>
      {isLikelyExpoGo() && (
        <Text style={{ color: tokens.color.textMuted, fontSize: 12, marginBottom: 8 }}>
          Está no Expo Go: construa com `eas build` ou `npx expo run:android` para aplicar o Firebase.
        </Text>
      )}
      {Platform.OS === "android" && userId != null && (
        <Pressable
          onPress={() => {
            setFcmHint(null);
            syncNativeFcm.mutate();
          }}
          style={{
            marginBottom: 12,
            backgroundColor: tokens.color.bgCard,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
          }}
        >
          <Text style={{ color: tokens.color.textPrimary, fontWeight: "700" }}>
            {syncNativeFcm.isPending ? "A sincronizar…" : "Sincronizar token FCM (Android)"}
          </Text>
        </Pressable>
      )}
      {fcmHint != null && (
        <Text style={{ color: tokens.color.textMuted, fontSize: 12, marginBottom: 8 }}>{fcmHint}</Text>
      )}
      <TextInput
        value={fcm}
        onChangeText={setFcm}
        placeholder="Cole o token aqui"
        placeholderTextColor={tokens.color.textMuted}
        multiline
        style={{
          minHeight: 72,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          color: tokens.color.textPrimary,
          backgroundColor: tokens.color.bgCard,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        }}
      />
      <Pressable
        onPress={() => saveFcm.mutate()}
        style={{
          marginTop: 12,
          backgroundColor: tokens.color.primary,
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>{saveFcm.isPending ? "A guardar…" : "Guardar token"}</Text>
      </Pressable>
    </ScrollView>
  );
}
