import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  Calendar,
  BookOpen,
  ChevronRight,
  MessageSquare,
  Target,
  Trophy,
} from "lucide-react-native";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Alert,
  useWindowDimensions,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { api, clearPersistedSession, persistSession } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

const arenaMasterLogo = require("../../assets/arena-master-logo.png");

type UserMe = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  dojo_id: number | null;
  avatar_url: string | null;
  graduacao: string | null;
};

type StudentMe = {
  id: number;
  name: string;
  graduacao: string | null;
  modalidade: string | null;
  notes: string | null;
  grau: number;
};

type DojoMe = {
  id: number;
  name: string;
  contato: string | null;
  logo_url: string | null;
};

type CheckInRead = {
  id: number;
  occurred_at: string;
};

function resolveAvatarUri(url: string | null | undefined): { uri: string } | null {
  if (!url) return null;
  if (url.startsWith("data:")) return { uri: url };
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
}

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data: me } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await api.get<UserMe>("/api/users/me");
      return res.data;
    },
    enabled: !!user,
  });

  const { data: student } = useQuery({
    queryKey: ["student-me"],
    queryFn: async () => {
      const res = await api.get<StudentMe>("/api/students/me");
      return res.data;
    },
    enabled: !!user && user?.role === "aluno",
    retry: false,
  });

  const { data: dojo } = useQuery({
    queryKey: ["dojo-me"],
    queryFn: async () => {
      const res = await api.get<DojoMe>("/api/dojos/me");
      return res.data;
    },
    enabled: !!user?.dojoId,
    retry: false,
  });

  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 30);
  const startDateStr = startDate.toISOString().slice(0, 10);

  const { data: checkinsRange } = useQuery({
    queryKey: ["checkins-range", startDateStr, endDate],
    queryFn: async () => {
      const res = await api.get<CheckInRead[]>(
        `/api/check-in/my/range?start_date=${startDateStr}&end_date=${endDate}`
      );
      return res.data;
    },
    enabled: !!user && user?.role === "aluno",
    retry: false,
  });

  const avatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      const res = await api.patch<{ avatar_url: string | null }>("/api/users/me", {
        avatar_url: avatarUrl,
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const avatarUrl = data.avatar_url ?? null;
      updateUser({ avatarUrl });

      // Evita tentar persistir um avatar enorme em SecureStore,
      // o que gera warning e pode falhar em alguns dispositivos.
      if (avatarUrl && avatarUrl.startsWith("data:") && avatarUrl.length > 2000) {
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          alert(
            "Sua foto foi atualizada nesta sessão, mas pode não ser salva permanentemente neste dispositivo por causa do tamanho do arquivo.",
          );
        } else {
          Alert.alert(
            "Foto muito grande",
            "Sua foto foi atualizada nesta sessão, mas pode não ser salva permanentemente neste dispositivo por causa do tamanho do arquivo.",
          );
        }
        return;
      }

      try {
        await persistSession();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Não foi possível salvar os dados de sessão no dispositivo.";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          alert(msg);
        } else {
          Alert.alert("Erro ao salvar sessão", msg);
        }
      }
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
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Erro", msg);
    },
  });

  const [isPickingImage, setIsPickingImage] = useState(false);

  async function pickImage() {
    if (isPickingImage) return;
    setIsPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") alert("Permissão de acesso à galeria negada.");
        else Alert.alert("Permissão necessária", "Permita acesso à galeria para escolher foto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // Usa apenas a API estável compatível com sua versão
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        if (Platform.OS === "web") alert("Não foi possível obter a imagem.");
        else Alert.alert("Erro", "Não foi possível obter a imagem.");
        return;
      }
      const mime = asset.mimeType ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;
      if (dataUrl.length > 280000) {
        if (Platform.OS === "web") alert("Imagem muito grande.");
        else Alert.alert("Imagem grande", "Escolha uma foto menor.");
        return;
      }
      avatarMutation.mutate(dataUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao selecionar imagem.";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Erro", msg);
    } finally {
      setIsPickingImage(false);
    }
  }

  const handleLogout = async () => {
    clearSession();
    await clearPersistedSession();
    router.replace("/(auth)/login");
  };

  const handleContatoDojo = () => {
    const contato = dojo?.contato;
    if (!contato) return;
    if (contato.includes("@")) {
      Linking.openURL(`mailto:${contato}`);
    } else {
      const tel = contato.replace(/\D/g, "");
      if (tel.length >= 10) Linking.openURL(`tel:${tel}`);
    }
  };

  const displayName = student?.name ?? me?.name ?? user?.email ?? "Aluno";
  const displayAvatar = me?.avatar_url ?? user?.avatarUrl;
  const avatarSource = resolveAvatarUri(displayAvatar);

  const checkinsCount = checkinsRange?.length ?? 0;
  const expectedSessions = 12;
  const assiduidadePercent = Math.min(100, Math.round((checkinsCount / expectedSessions) * 100));

  if (!user) return null;

  const isAluno = user.role === "aluno";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      {/* Header com logo Arena Master */}
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.lg,
          paddingBottom: tokens.space.lg,
          paddingHorizontal: tokens.space.xl,
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Image
          source={arenaMasterLogo}
          style={{ width: 150, height: 150, resizeMode: "contain" }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: tokens.space.lg,
          paddingBottom: tokens.space.xl + 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Informações Pessoais */}
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "800",
            marginBottom: tokens.space.md,
          }}
        >
          Informações Pessoais
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tokens.color.bgCard,
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            marginBottom: tokens.space.xl,
          }}
        >
          <Pressable
            onPress={isAluno ? pickImage : undefined}
            disabled={avatarMutation.isPending || !isAluno}
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: tokens.color.borderStrong,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatarSource ? (
              <Image source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 36 }}>👤</Text>
            )}
          </Pressable>
          <View style={{ flex: 1, marginLeft: tokens.space.lg }}>
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.sm,
                fontWeight: "600",
                marginBottom: 4,
              }}
            >
              ALUNO: {displayName}
            </Text>
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.sm,
                marginBottom: 4,
              }}
            >
              FAIXA: {me?.graduacao ?? student?.graduacao ?? "—"}
            </Text>
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.sm,
              }}
            >
              Dojo: {dojo?.name ?? "—"}
            </Text>
          </View>
        </View>

        {/* MEU PROGRESSO ACADÊMICO */}
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "800",
            marginBottom: tokens.space.md,
          }}
        >
          Meu Progresso Acadêmico
        </Text>
        <View
          style={{
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.lg,
            padding: tokens.space.lg,
            marginBottom: tokens.space.xl,
          }}
        >
          <Text
            style={{
              color: tokens.color.textOnPrimary,
              fontSize: tokens.text.md,
              fontWeight: "700",
              marginBottom: tokens.space.lg,
            }}
          >
            MEU PROGRESSO ACADÊMICO
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.lg }}>
            {/* Presença */}
            <View style={{ flex: 1, minWidth: width > 400 ? 100 : "100%" }}>
              <View style={{ alignItems: "center", marginBottom: tokens.space.sm }}>
                <Svg width={70} height={70} style={{ transform: [{ rotate: "-90deg" }] }}>
                  <Circle
                    cx={35}
                    cy={35}
                    r={28}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={6}
                    fill="none"
                  />
                  <Circle
                    cx={35}
                    cy={35}
                    r={28}
                    stroke="white"
                    strokeWidth={6}
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={2 * Math.PI * 28 * (1 - assiduidadePercent / 100)}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text
                  style={{
                    position: "absolute",
                    top: 22,
                    color: tokens.color.textOnPrimary,
                    fontWeight: "800",
                    fontSize: tokens.text.sm,
                  }}
                >
                  {assiduidadePercent}%
                </Text>
              </View>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xs,
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                PRESENÇA
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 11,
                  textAlign: "center",
                  marginTop: 2,
                }}
              >
                (últimos 30 dias)
              </Text>
            </View>

            {/* Evolução Técnica */}
            <View style={{ flex: 1.5, minWidth: width > 400 ? 120 : "100%" }}>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xs,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                Técnicas Masterizadas
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 11,
                  marginBottom: tokens.space.sm,
                }}
              >
                • {student?.modalidade ?? "Jiu-Jitsu"} {"\n"}
                • Judô / Kata
              </Text>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xs,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                Próximos Objetivos
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11 }}>
                • Evolução contínua {"\n"}
                • Novas técnicas
              </Text>
            </View>

            {/* Tempo de Treino */}
            <View style={{ flex: 1, minWidth: width > 400 ? 90 : "100%" }}>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xs,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                Tempo Total:
              </Text>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xl,
                  fontWeight: "800",
                }}
              >
                {checkinsCount * 1}h
              </Text>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.xs,
                  fontWeight: "700",
                  marginTop: tokens.space.sm,
                  marginBottom: 4,
                }}
              >
                Média/Semana:
              </Text>
              <Text
                style={{
                  color: tokens.color.textOnPrimary,
                  fontSize: tokens.text.lg,
                  fontWeight: "800",
                }}
              >
                {Math.round((checkinsCount / 4) * 10) / 10}h
              </Text>
            </View>
          </View>
        </View>

        {/* MEUS STATUS DETALHADOS */}
        <Text
          style={{
            color: tokens.color.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: "800",
            marginBottom: tokens.space.md,
          }}
        >
          Meus Status Detalhados
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: tokens.space.md,
            marginBottom: tokens.space.xl,
          }}
        >
          <View
            style={{
              flex: 1,
              minWidth: (width - tokens.space.lg * 4) / 2 - tokens.space.md,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.md,
              padding: tokens.space.lg,
              alignItems: "center",
            }}
          >
            <Award size={28} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text["2xl"],
                fontWeight: "800",
                marginTop: tokens.space.sm,
              }}
            >
              {student?.grau ?? 0}
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: tokens.text.xs,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              GRAUS ADQUIRIDOS
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minWidth: (width - tokens.space.lg * 4) / 2 - tokens.space.md,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.md,
              padding: tokens.space.lg,
              alignItems: "center",
            }}
          >
            <Trophy size={28} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text["2xl"],
                fontWeight: "800",
                marginTop: tokens.space.sm,
              }}
            >
              —
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: tokens.text.xs,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              COMPETIÇÕES DISPUTADAS
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minWidth: (width - tokens.space.lg * 4) / 2 - tokens.space.md,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.md,
              padding: tokens.space.lg,
              alignItems: "center",
            }}
          >
            <Target size={28} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text.sm,
                fontWeight: "700",
                marginTop: tokens.space.sm,
                textAlign: "center",
              }}
            >
              {student?.modalidade ?? "—"}
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: tokens.text.xs,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              TREINOS ESPECÍFICOS
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minWidth: (width - tokens.space.lg * 4) / 2 - tokens.space.md,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.md,
              padding: tokens.space.lg,
              alignItems: "center",
            }}
          >
            <MessageSquare size={28} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text.xs,
                textAlign: "center",
                marginTop: tokens.space.sm,
                flex: 1,
              }}
              numberOfLines={3}
            >
              {student?.notes ?? "Nenhuma nota do mestre."}
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: tokens.text.xs,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              NOTAS DO MESTRE
            </Text>
          </View>
        </View>

        {/* Navegação inferior */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: tokens.space.md,
            marginBottom: tokens.space.xl,
          }}
        >
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: tokens.space.sm,
              paddingRight: tokens.space.sm,
            }}
          >
            <BookOpen size={18} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.primary,
                fontWeight: "600",
                marginLeft: tokens.space.sm,
              }}
            >
              Plano de Aulas
            </Text>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: tokens.space.sm,
              paddingRight: tokens.space.sm,
            }}
          >
            <Calendar size={18} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.primary,
                fontWeight: "600",
                marginLeft: tokens.space.sm,
              }}
            >
              Metas do Mestre
            </Text>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>
          <Pressable
            onPress={handleContatoDojo}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: tokens.space.sm,
              paddingRight: tokens.space.sm,
            }}
          >
            <MessageSquare size={18} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.primary,
                fontWeight: "600",
                marginLeft: tokens.space.sm,
              }}
            >
              Contato do Dojo
            </Text>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>
        </View>

        {/* Sair */}
        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.full,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: tokens.color.textOnPrimary,
              fontWeight: "700",
              fontSize: tokens.text.md,
            }}
          >
            Sair da arena
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
