import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { View, Text, Pressable, Image, Platform, Alert } from "react-native";

import { api, persistSession } from "../../src/api/client";
import { clearPersistedSession } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

type UserMe = {
  id: number;
  email: string;
  role: string;
  dojo_id: number | null;
  avatar_url: string | null;
  graduacao: string | null;
};

export default function PerfilScreen() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await api.get<UserMe>("/api/users/me");
      return res.data;
    },
    enabled: !!user,
  });

  const avatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      const res = await api.patch<{ avatar_url: string | null }>("/api/users/me", {
        avatar_url: avatarUrl,
      });
      return res.data;
    },
    onSuccess: (data) => {
      updateUser({ avatarUrl: data.avatar_url ?? null });
      void persistSession();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-me"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? err.message
          : "Erro ao enviar foto.";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Erro", msg);
      }
    },
  });

  async function pickImage() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") {
          alert("Permissão de acesso à galeria negada.");
        } else {
          Alert.alert(
            "Permissão necessária",
            "É preciso permitir acesso à galeria para escolher uma foto."
          );
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      let base64 = asset.base64;
      if (!base64 && asset.uri && Platform.OS === "web" && asset.uri.startsWith("blob:")) {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result as string;
            resolve(data.includes(",") ? data.split(",")[1] ?? "" : data);
          };
          reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
          reader.readAsDataURL(blob);
        });
      }
      if (!base64) {
        if (Platform.OS === "web") {
          alert("Não foi possível obter a imagem. Tente outra foto.");
        } else {
          Alert.alert("Erro", "Não foi possível obter a imagem. Tente outra foto.");
        }
        return;
      }
      const mime = asset.mimeType ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;
      if (dataUrl.length > 280000) {
        if (Platform.OS === "web") {
          alert("Imagem muito grande. Escolha uma foto menor ou com menor resolução.");
        } else {
          Alert.alert("Imagem muito grande", "Escolha uma foto menor.");
        }
        return;
      }
      avatarMutation.mutate(dataUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao selecionar imagem.";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Erro", msg);
      }
    }
  }

  if (!user) {
    return null;
  }

  const displayAvatarUrl = me?.avatar_url ?? user?.avatarUrl;
  const avatarSource =
    displayAvatarUrl && displayAvatarUrl.startsWith("data:")
      ? { uri: displayAvatarUrl }
      : displayAvatarUrl
        ? { uri: displayAvatarUrl }
        : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgBody,
        padding: tokens.space.lg,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: tokens.color.textOnPrimary,
          fontSize: tokens.text.xl,
          fontWeight: "700",
          marginBottom: tokens.space.xl,
        }}
      >
        Perfil
      </Text>

      <Pressable
        onPress={pickImage}
        disabled={avatarMutation.isPending}
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: tokens.color.borderStrong,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: tokens.space.xl,
          overflow: "hidden",
        }}
      >
        {avatarSource ? (
          <Image
            source={avatarSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              color: tokens.color.textMuted,
              fontSize: tokens.text["2xl"],
            }}
          >
            👤
          </Text>
        )}
      </Pressable>
      <Text
        style={{
          color: tokens.color.textMuted,
          fontSize: tokens.text.sm,
          marginBottom: tokens.space.lg,
        }}
      >
        Toque para alterar a foto
      </Text>

      <View style={{ width: "100%", maxWidth: 320, alignSelf: "center" }}>
        <Text style={{ color: tokens.color.textMuted, marginBottom: 4 }}>
          E-mail
        </Text>
        <Text
          style={{
            color: tokens.color.textOnPrimary,
            marginBottom: tokens.space.lg,
          }}
        >
          {user.email}
        </Text>

        <Text style={{ color: tokens.color.textMuted, marginBottom: 4 }}>
          Papel
        </Text>
        <Text
          style={{
            color: tokens.color.textOnPrimary,
            marginBottom: me?.graduacao ? tokens.space.lg : tokens.space.xl,
          }}
        >
          {user.role}
        </Text>

        {me?.graduacao ? (
          <>
            <Text style={{ color: tokens.color.textMuted, marginBottom: 4 }}>
              Graduação
            </Text>
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                marginBottom: tokens.space.xl,
              }}
            >
              {me.graduacao}
            </Text>
          </>
        ) : null}
      </View>

      <Pressable
        onPress={async () => {
          clearSession();
          await clearPersistedSession();
        }}
        style={{
          marginTop: "auto",
          width: "100%",
          maxWidth: 320,
          backgroundColor: tokens.color.primary,
          borderRadius: tokens.radius.full,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Sair</Text>
      </Pressable>
    </View>
  );
}
