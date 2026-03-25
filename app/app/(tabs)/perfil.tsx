import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  Award,
  Calendar,
  BookOpen,
  ChevronRight,
  KeyRound,
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
  Modal,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

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
  /** Quando false, modalidade(s) no catálogo sem sistema de faixas/graus */
  exibir_graduacao_no_perfil?: boolean;
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

type MySkills = {
  skills: string[];
  ratings: number[];
};

function resolveAvatarUri(url: string | null | undefined): { uri: string } | null {
  if (!url) return null;
  if (url.startsWith("data:")) return { uri: url };
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (url.startsWith("http")) return { uri: url };
  return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
}

function SectionHeader({
  title,
  subtitle,
  compact,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <View style={{ marginBottom: compact ? tokens.space.sm : tokens.space.md }}>
      <Text
        style={{
          color: tokens.color.textPrimary,
          fontSize: tokens.text.lg,
          fontWeight: "800",
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: tokens.space.xs,
            color: tokens.color.textMuted,
            fontSize: tokens.text.xs,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function ProfileField({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: tokens.space.sm,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth * 2,
        borderBottomColor: "rgba(255,255,255,0.14)",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.55)",
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: tokens.text.md,
          color: tokens.color.textOnPrimary,
          fontWeight: "600",
          lineHeight: 22,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

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

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: {
      current_password: string;
      new_password: string;
    }) => {
      await api.post("/api/users/me/password", payload);
    },
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setIsChangePasswordOpen(false);
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        alert("Senha atualizada com sucesso.");
      } else {
        Alert.alert("Senha atualizada", "Sua senha foi alterada com sucesso.");
      }
    },
    onError: (err) => {
      const detail =
        (err as any)?.response?.data?.detail ??
        (err instanceof Error ? err.message : null) ??
        "Não foi possível alterar a senha. Tente novamente.";
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        alert(detail);
      } else {
        Alert.alert("Erro ao alterar senha", String(detail));
      }
    },
  });

  const { data: mySkills } = useQuery({
    queryKey: ["skills", "me"],
    queryFn: async () => {
      const res = await api.get<MySkills>("/api/skills/me");
      return res.data;
    },
    enabled: user?.role === "aluno",
    staleTime: 60_000,
  });

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
  const showGraduacaoNoPerfil = student?.exibir_graduacao_no_perfil !== false;

  const checkinsCount = checkinsRange?.length ?? 0;
  const expectedSessions = 12;
  const assiduidadePercent = Math.min(100, Math.round((checkinsCount / expectedSessions) * 100));

  if (!user) return null;

  const isAluno = user.role === "aluno";
  /** Só empilha em telas bem estreitas — layout “antigo” usa mais linha/3 colunas. */
  const isVeryNarrow = width < 360;
  const gridGap = tokens.space.md;
  const contentWidth = width - tokens.space.lg * 2;
  const twoColItemWidth = (contentWidth - gridGap) / 2;
  const modalityDisplay = student?.modalidade?.trim() || null;
  const techniquesBullets =
    modalityDisplay
      ? modalityDisplay
          .split(/[,;/]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const skillsLabels = mySkills?.skills?.length === 5 ? mySkills.skills : ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"];
  const skillsRatings = mySkills?.ratings?.length === 5 ? mySkills.ratings : [0, 0, 0, 0, 0];

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
          paddingBottom: tokens.space.xl + 80 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title="Informações pessoais"
          subtitle="Toque na foto para alterar (alunos)."
          compact
        />
        <View
          style={{
            flexDirection: isVeryNarrow ? "column" : "row",
            alignItems: isVeryNarrow ? "stretch" : "flex-start",
            backgroundColor: tokens.color.bgCard,
            borderRadius: tokens.radius.lg * 1.25,
            padding: tokens.space.lg,
            marginBottom: tokens.space.lg,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Pressable
            onPress={isAluno ? pickImage : undefined}
            disabled={avatarMutation.isPending || !isAluno}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: tokens.color.borderStrong,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: isVeryNarrow ? "center" : "flex-start",
              marginBottom: isVeryNarrow ? tokens.space.md : 0,
            }}
          >
            {avatarSource ? (
              <Image source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 34 }}>👤</Text>
            )}
          </Pressable>
          <View style={{ flex: 1, marginLeft: isVeryNarrow ? 0 : tokens.space.lg, minWidth: 0 }}>
            {(() => {
              const rows: { label: string; value: string }[] = [
                { label: isAluno ? "Aluno" : "Nome", value: displayName },
              ];
              if (!isAluno || showGraduacaoNoPerfil) {
                rows.push({
                  label: "Faixa",
                  value: me?.graduacao ?? student?.graduacao ?? "—",
                });
              }
              if (isAluno) {
                rows.push({
                  label: "Modalidade",
                  value: student?.modalidade?.trim() ? student.modalidade.trim() : "—",
                });
              }
              rows.push({ label: "Dojo", value: dojo?.name ?? "—" });
              return rows.map((r, i) => (
                <ProfileField key={`${r.label}-${i}`} label={r.label} value={r.value} isLast={i === rows.length - 1} />
              ));
            })()}
          </View>
        </View>

        <SectionHeader
          title="Meu progresso acadêmico"
          subtitle="Presença, técnicas da matrícula e tempo estimado (check-ins)."
          compact
        />
        <View
          style={{
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.lg * 1.25,
            paddingHorizontal: tokens.space.md,
            paddingVertical: tokens.space.lg,
            marginBottom: tokens.space.lg,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <Text
            style={{
              color: tokens.color.textOnPrimary,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.2,
              marginBottom: tokens.space.md,
              textAlign: "center",
            }}
          >
            MEU PROGRESSO ACADÊMICO
          </Text>
          <View
            style={{
              flexDirection: isVeryNarrow ? "column" : "row",
              alignItems: isVeryNarrow ? "stretch" : "flex-start",
              gap: isVeryNarrow ? tokens.space.md : tokens.space.sm,
            }}
          >
            {/* Coluna 1 — Presença */}
            <View
              style={{
                flex: isVeryNarrow ? undefined : 1,
                minWidth: isVeryNarrow ? undefined : 100,
                alignItems: "center",
                paddingVertical: tokens.space.xs,
              }}
            >
              <View style={{ alignItems: "center", marginBottom: tokens.space.sm, height: 74, justifyContent: "center" }}>
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
                  fontSize: 10,
                  textAlign: "center",
                  fontWeight: "800",
                  letterSpacing: 0.6,
                }}
              >
                PRESENÇA
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.88)",
                  fontSize: 10,
                  textAlign: "center",
                  marginTop: 2,
                }}
              >
                (últimos 30 dias)
              </Text>
            </View>

            {!isVeryNarrow ? (
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  alignSelf: "stretch",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  marginVertical: tokens.space.xs,
                }}
              />
            ) : (
              <View
                style={{
                  height: 1,
                  backgroundColor: "rgba(255,255,255,0.2)",
                }}
              />
            )}

            {/* Coluna 2 — Técnicas + objetivos (layout clássico) */}
            <View
              style={{
                flex: isVeryNarrow ? undefined : 2,
                flexGrow: 1,
                minWidth: isVeryNarrow ? undefined : 120,
                paddingHorizontal: isVeryNarrow ? 0 : tokens.space.xs,
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                TÉCNICAS MASTERIZADAS
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 12, lineHeight: 18 }}>
                {techniquesBullets.length > 0
                  ? techniquesBullets.map((t) => `• ${t}`).join("\n")
                  : "• —"}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  marginTop: tokens.space.md,
                  marginBottom: 6,
                }}
              >
                PRÓXIMOS OBJETIVOS
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 18 }}>
                • Evolução contínua{"\n"}• Novas técnicas com o professor
              </Text>
            </View>

            {!isVeryNarrow ? (
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  alignSelf: "stretch",
                  backgroundColor: "rgba(255,255,255,0.25)",
                  marginVertical: tokens.space.xs,
                }}
              />
            ) : (
              <View
                style={{
                  height: 1,
                  backgroundColor: "rgba(255,255,255,0.2)",
                }}
              />
            )}

            {/* Coluna 3 — Tempos */}
            <View
              style={{
                flex: isVeryNarrow ? undefined : 1,
                minWidth: isVeryNarrow ? undefined : 92,
                alignItems: isVeryNarrow ? "flex-start" : "flex-end",
              }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.88)",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                TEMPO TOTAL
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
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 2 }}>total (check-ins)</Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.88)",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  marginTop: tokens.space.md,
                  marginBottom: 4,
                }}
              >
                MÉDIA / SEMANA
              </Text>
              <Text style={{ color: tokens.color.textOnPrimary, fontSize: tokens.text.lg, fontWeight: "800" }}>
                {Math.round((checkinsCount / 4) * 10) / 10}h
              </Text>
            </View>
          </View>
        </View>

        <SectionHeader
          title="Meus status detalhados"
          subtitle="Visão rápida da sua jornada na arena."
          compact
        />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginBottom: tokens.space.lg,
            gap: gridGap,
          }}
        >
          {showGraduacaoNoPerfil ? (
            <View
              style={{
                width: isVeryNarrow ? "100%" : twoColItemWidth,
                backgroundColor: tokens.color.borderSubtle,
                borderRadius: tokens.radius.lg,
                padding: tokens.space.lg,
                alignItems: "center",
                minHeight: 132,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(27,48,63,0.06)",
              }}
            >
              <Award size={26} color={tokens.color.primary} strokeWidth={2} />
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
                  fontSize: 10,
                  textAlign: "center",
                  marginTop: 6,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                }}
              >
                GRAUS ADQUIRIDOS
              </Text>
            </View>
          ) : null}

          <View
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.lg,
              alignItems: "center",
              minHeight: 132,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(27,48,63,0.06)",
            }}
          >
            <Trophy size={26} color={tokens.color.primary} strokeWidth={2} />
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
                fontSize: 10,
                textAlign: "center",
                marginTop: 6,
                fontWeight: "700",
                letterSpacing: 0.6,
              }}
            >
              COMPETIÇÕES DISPUTADAS
            </Text>
          </View>

          <View
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.lg,
              alignItems: "center",
              minHeight: 132,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(27,48,63,0.06)",
            }}
          >
            <Target size={26} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text["2xl"],
                fontWeight: "800",
                marginTop: tokens.space.sm,
              }}
            >
              {checkinsCount}
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: 10,
                textAlign: "center",
                marginTop: 6,
                fontWeight: "700",
                letterSpacing: 0.6,
              }}
            >
              CHECK-INS (30 DIAS)
            </Text>
          </View>

          <View
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              backgroundColor: tokens.color.borderSubtle,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.lg,
              alignItems: "center",
              minHeight: 132,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(27,48,63,0.06)",
            }}
          >
            <MessageSquare size={26} color={tokens.color.primary} strokeWidth={2} />
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: tokens.text.sm,
                textAlign: "center",
                marginTop: tokens.space.sm,
                lineHeight: 20,
                fontWeight: "600",
              }}
              numberOfLines={4}
            >
              {student?.notes?.trim() ? student.notes.trim() : "Nenhuma nota do mestre."}
            </Text>
            <Text
              style={{
                color: tokens.color.textMuted,
                fontSize: 10,
                textAlign: "center",
                marginTop: 8,
                fontWeight: "700",
                letterSpacing: 0.6,
              }}
            >
              NOTAS DO MESTRE
            </Text>
          </View>
        </View>

        {isAluno && (
          <View style={{ marginBottom: tokens.space.xl }}>
            <SectionHeader
              title="Habilidades"
              subtitle="Radar com as 5 dimensões avaliadas pelo professor do dojo (0 a 10)."
            />
            <View
              style={{
                backgroundColor: tokens.color.bgCard,
                borderRadius: tokens.radius.lg,
                paddingHorizontal: tokens.space.md,
                paddingTop: tokens.space.lg,
                paddingBottom: tokens.space.xl + 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <View style={{ alignItems: "center", overflow: "visible" }}>
                <RadarChart
                  size={Math.min(contentWidth - tokens.space.md * 2, 300)}
                  labels={skillsLabels}
                  values={skillsRatings}
                  maxValue={10}
                />
              </View>
              <Text
                style={{
                  marginTop: tokens.space.md,
                  color: "rgba(255,255,255,0.65)",
                  fontSize: tokens.text.xs,
                  textAlign: "center",
                  lineHeight: 18,
                  paddingHorizontal: tokens.space.sm,
                }}
              >
                Avaliação do seu professor (0 a 10) para as 5 habilidades do dojo.
              </Text>
            </View>
          </View>
        )}

        {/* Navegação inferior */}
        <View
          style={{
            flexDirection: isVeryNarrow ? "column" : "row",
            flexWrap: isVeryNarrow ? "nowrap" : "wrap",
            marginBottom: tokens.space.xl,
          }}
        >
          <Pressable
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              marginRight: isVeryNarrow ? 0 : gridGap,
              marginBottom: gridGap,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: tokens.space.sm,
              paddingHorizontal: tokens.space.sm,
              borderRadius: tokens.radius.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
              <BookOpen size={18} color={tokens.color.primary} strokeWidth={2} />
              <Text
                style={{
                  color: tokens.color.primary,
                  fontWeight: "600",
                  marginLeft: tokens.space.sm,
                  flexShrink: 1,
                }}
              >
                Plano de Aulas
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>
          <Pressable
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              marginRight: 0,
              marginBottom: gridGap,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: tokens.space.sm,
              paddingHorizontal: tokens.space.sm,
              borderRadius: tokens.radius.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
              <Calendar size={18} color={tokens.color.primary} strokeWidth={2} />
              <Text
                style={{
                  color: tokens.color.primary,
                  fontWeight: "600",
                  marginLeft: tokens.space.sm,
                  flexShrink: 1,
                }}
              >
                Metas do Mestre
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>
          <Pressable
            onPress={handleContatoDojo}
            style={{
              width: isVeryNarrow ? "100%" : twoColItemWidth,
              marginRight: isVeryNarrow ? 0 : gridGap,
              marginBottom: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: tokens.space.sm,
              paddingHorizontal: tokens.space.sm,
              borderRadius: tokens.radius.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
              <MessageSquare size={18} color={tokens.color.primary} strokeWidth={2} />
              <Text
                style={{
                  color: tokens.color.primary,
                  fontWeight: "600",
                  marginLeft: tokens.space.sm,
                  flexShrink: 1,
                }}
              >
                Contato do Dojo
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.color.primary} />
          </Pressable>

          {isAluno && (
            <Pressable
              onPress={() => setIsChangePasswordOpen(true)}
              style={{
                width: isVeryNarrow ? "100%" : twoColItemWidth,
                marginRight: 0,
                marginBottom: 0,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: tokens.space.sm,
                paddingHorizontal: tokens.space.sm,
                borderRadius: tokens.radius.md,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
                <KeyRound size={18} color={tokens.color.primary} strokeWidth={2} />
                <Text
                  style={{
                    color: tokens.color.primary,
                    fontWeight: "600",
                    marginLeft: tokens.space.sm,
                    flexShrink: 1,
                  }}
                >
                  Trocar senha
                </Text>
              </View>
              <ChevronRight size={16} color={tokens.color.primary} />
            </Pressable>
          )}
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

      <Modal
        visible={isChangePasswordOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!changePasswordMutation.isPending) setIsChangePasswordOpen(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: tokens.space.lg,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.lg,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
            }}
          >
            <Text
              style={{
                color: tokens.color.textOnPrimary,
                fontSize: tokens.text.md,
                fontWeight: "800",
                marginBottom: tokens.space.md,
              }}
            >
              Trocar senha
            </Text>

            <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
              Por segurança, informe sua senha atual e defina uma nova senha.
            </Text>

            <View style={{ height: tokens.space.md }} />

            <Text style={{ color: tokens.color.textOnPrimary, fontSize: tokens.text.xs }}>
              Senha atual
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              editable={!changePasswordMutation.isPending}
              placeholder="Digite sua senha atual"
              placeholderTextColor={tokens.color.textMuted}
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space.md,
                paddingVertical: 10,
                color: tokens.color.textOnPrimary,
                backgroundColor: tokens.color.bgBody,
              }}
            />

            <View style={{ height: tokens.space.md }} />

            <Text style={{ color: tokens.color.textOnPrimary, fontSize: tokens.text.xs }}>
              Nova senha
            </Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!changePasswordMutation.isPending}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={tokens.color.textMuted}
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space.md,
                paddingVertical: 10,
                color: tokens.color.textOnPrimary,
                backgroundColor: tokens.color.bgBody,
              }}
            />

            <View style={{ height: tokens.space.md }} />

            <Text style={{ color: tokens.color.textOnPrimary, fontSize: tokens.text.xs }}>
              Confirmar nova senha
            </Text>
            <TextInput
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              editable={!changePasswordMutation.isPending}
              placeholder="Digite novamente"
              placeholderTextColor={tokens.color.textMuted}
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space.md,
                paddingVertical: 10,
                color: tokens.color.textOnPrimary,
                backgroundColor: tokens.color.bgBody,
              }}
            />

            <View style={{ height: tokens.space.lg }} />

            <View style={{ flexDirection: "row", gap: tokens.space.sm }}>
              <Pressable
                onPress={() => {
                  if (!changePasswordMutation.isPending) {
                    setIsChangePasswordOpen(false);
                  }
                }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: tokens.color.borderStrong,
                  borderRadius: tokens.radius.full,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "transparent",
                }}
              >
                <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "700" }}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const cur = currentPassword;
                  const next = newPassword;
                  const confirm = confirmNewPassword;

                  if (!cur || !next || !confirm) {
                    if (Platform.OS === "web") alert("Preencha todos os campos.");
                    else Alert.alert("Atenção", "Preencha todos os campos.");
                    return;
                  }
                  if (next.length < 6) {
                    if (Platform.OS === "web")
                      alert("A nova senha deve ter pelo menos 6 caracteres.");
                    else
                      Alert.alert(
                        "Senha fraca",
                        "A nova senha deve ter pelo menos 6 caracteres.",
                      );
                    return;
                  }
                  if (next !== confirm) {
                    if (Platform.OS === "web") alert("As senhas não conferem.");
                    else Alert.alert("Atenção", "As senhas não conferem.");
                    return;
                  }

                  changePasswordMutation.mutate({
                    current_password: cur,
                    new_password: next,
                  });
                }}
                disabled={changePasswordMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: tokens.color.primary,
                  borderRadius: tokens.radius.full,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: changePasswordMutation.isPending ? 0.85 : 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {changePasswordMutation.isPending && (
                  <ActivityIndicator size="small" color={tokens.color.textOnPrimary} />
                )}
                <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "800" }}>
                  Salvar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RadarChart({
  size,
  labels,
  values,
  maxValue,
}: {
  size: number;
  labels: string[];
  values: number[];
  maxValue: number;
}) {
  const center = size / 2;
  // Mais respiro para não cortar labels e melhorar leitura
  const padding = 34;
  const radius = center - padding;
  const levels = 4; // 0.25, 0.5, 0.75, 1.0
  const angleStep = (Math.PI * 2) / 5;
  const startAngle = -Math.PI / 2;

  const clamp = (n: number) => Math.max(0, Math.min(maxValue, n));

  // Paleta alinhada ao design do app (card escuro + dourado)
  const gridStroke = "rgba(255,255,255,0.12)";
  const axisStroke = "rgba(255,255,255,0.18)";
  const labelColor = "rgba(255,255,255,0.72)";
  const valueColor = tokens.color.textOnPrimary;
  const accentStroke = "rgba(184,158,93,0.95)"; // tokens.color.primary
  const accentFill = "rgba(184,158,93,0.28)";

  const axisPoints = Array.from({ length: 5 }, (_, i) => {
    const a = startAngle + i * angleStep;
    return {
      x: center + radius * Math.cos(a),
      y: center + radius * Math.sin(a),
      a,
    };
  });

  const polygonPoints = values
    .map((v, i) => {
      const a = startAngle + i * angleStep;
      const r = (radius * clamp(v)) / maxValue;
      const x = center + r * Math.cos(a);
      const y = center + r * Math.sin(a);
      return `${x},${y}`;
    })
    .join(" ");

  const gridPolygons = Array.from({ length: levels }, (_, lvl) => {
    const t = (lvl + 1) / levels;
    const pts = axisPoints
      .map((p) => `${center + (p.x - center) * t},${center + (p.y - center) * t}`)
      .join(" ");
    return pts;
  });

  const labelOffset = 18;
  const labelFontSize = 12;
  const labelMaxWidth = 110;

  return (
    <View style={{ width: size, minHeight: size + 40, overflow: "visible" }}>
      <Svg width={size} height={size}>
        {/* grid */}
        {gridPolygons.map((pts, idx) => (
          <Polygon
            key={idx}
            points={pts}
            fill="transparent"
            stroke={gridStroke}
            strokeWidth={1}
          />
        ))}

        {/* axes */}
        {axisPoints.map((p, idx) => (
          <Line
            key={idx}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke={axisStroke}
            strokeWidth={1}
          />
        ))}

        {/* data polygon */}
        <Polygon
          points={polygonPoints}
          fill={accentFill}
          stroke={accentStroke}
          strokeWidth={2.5}
        />

        {/* points */}
        {values.map((v, i) => {
          const a = startAngle + i * angleStep;
          const r = (radius * clamp(v)) / maxValue;
          const x = center + r * Math.cos(a);
          const y = center + r * Math.sin(a);
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={accentStroke}
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      {/* labels (fora do SVG para facilitar quebra) */}
      {axisPoints.map((p, idx) => {
        const x = center + (p.x - center) * 1.08;
        const y = center + (p.y - center) * 1.08;

        // Ajuste simples por quadrante
        const dx = Math.cos(p.a) * labelOffset;
        const dy = Math.sin(p.a) * labelOffset;

        return (
          <View
            key={idx}
            style={{
              position: "absolute",
              left: x + dx - labelMaxWidth / 2,
              top: y + dy - 8,
              width: labelMaxWidth,
            }}
          >
            <Text
              style={{
                fontSize: labelFontSize,
                color: labelColor,
                textAlign: "center",
                fontWeight: "600",
              }}
              numberOfLines={2}
            >
              {labels[idx] ?? `Skill ${idx + 1}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
