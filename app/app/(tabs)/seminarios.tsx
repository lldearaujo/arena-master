import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { api } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

type StudentMe = {
  id: number;
  name: string;
};

type SeminarRead = {
  id: number;
  organizer_dojo_id: number;
  organizer_dojo_name?: string | null;
  title: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_city: string | null;
  location_state: string | null;
  location_text: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  speaker_photo_url: string | null;
  speaker_achievements: string | null;
  capacity: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type SeminarLotRead = {
  id: number;
  seminar_id: number;
  name: string;
  price_amount: number;
  starts_at: string | null;
  ends_at: string | null;
  order: number;
};

type SeminarScheduleItemRead = {
  id: number;
  seminar_id: number;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  title: string;
  notes: string | null;
};

type SeminarPricingRead = {
  seminar_id: number;
  lot: SeminarLotRead | null;
  current_price_amount: number;
  seats_total: number | null;
  seats_filled: number;
  percent_filled: number;
  next_lot_starts_at: string | null;
};

type SeminarRegistrationRead = {
  id: number;
  seminar_id: number;
  buyer_user_id: number | null;
  student_id: number | null;
  student_name?: string | null;
  guest_full_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  payment_status: "pending_payment" | "pending_confirmation" | "confirmed" | "rejected" | "not_applicable";
  payment_receipt_path: string | null;
  payment_notes: string | null;
  payment_confirmed_at: string | null;
  paid_amount: number | null;
  public_code: string;
  created_at: string;
};

function mapSeminarPaymentStatusPt(
  raw: SeminarRegistrationRead["payment_status"] | string | null | undefined,
): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "confirmed" || s === "not_applicable") return "Pagamento confirmado";
  if (s === "pending_confirmation") return "Pagamento em análise";
  if (s === "rejected") return "Pagamento rejeitado";
  if (s === "pending_payment") return "Pagamento pendente";
  return "Pagamento pendente";
}

function mapSeminarScheduleKindPt(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "intro") return "Abertura";
  if (s === "technique") return "Técnica";
  if (s === "drills") return "Drills";
  if (s === "qa" || s === "q&a") return "Perguntas e respostas";
  if (s === "sparring") return "Treino";
  if (s === "graduation") return "Graduação";
  if (s === "other") return "Outro";
  return "Outro";
}

type SeminarTicketRead = {
  registration_id: number;
  seminar_id: number;
  token: string;
  public_code: string;
  expires_at: string;
};

type SeminarAttendanceRead = {
  id: number;
  seminar_id: number;
  registration_id: number;
  checked_in_at: string;
  checked_in_by_user_id: number | null;
};

type PixConfig = {
  key_type: string;
  key_value: string;
  recipient_name?: string | null;
  bank_name?: string | null;
  instructions?: string | null;
  static_qr_image_path?: string | null;
};

type FinanceSummary = {
  pix_config: PixConfig | null;
};

function resolveStaticUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  if (pathOrUrl.startsWith("http")) {
    if (pathOrUrl.includes("localhost") || pathOrUrl.includes("127.0.0.1")) {
      const p = pathOrUrl.replace(/^https?:\/\/[^/]+/, "");
      return `${base}${p}`;
    }
    return pathOrUrl;
  }
  return `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export default function SeminariosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tokensState = useAuthStore((s) => s.tokens);
  const onDarkText = tokens.color.textOnPrimary;
  const onDarkMuted = "rgba(255,255,255,0.78)";
  const onDarkSubtle = "rgba(255,255,255,0.12)";
  const onDarkInactiveText = "rgba(255,255,255,0.88)";
  const onDarkInactiveBg = "rgba(255,255,255,0.06)";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SeminarRead | null>(null);
  const consumedDeepLinkRef = useRef(false);
  const lastDeepLinkIdRef = useRef<number | null>(null);
  const [enrollMode, setEnrollMode] = useState<"student" | "guest">("student");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [uploadingRegId, setUploadingRegId] = useState<number | null>(null);
  const [isPickingReceipt, setIsPickingReceipt] = useState(false);
  const [ticketRegId, setTicketRegId] = useState<number | null>(null);
  const [staffCode, setStaffCode] = useState("");
  const [staffResult, setStaffResult] = useState<SeminarAttendanceRead | null>(null);

  const cameFromEventos = params?.from === "eventos";

  function goBackFromEventos() {
    router.replace("/(tabs)/eventos");
  }

  function handleBackFromDetails() {
    // Se a tela foi aberta por deep-link vindo de "Eventos", não podemos apenas fechar o modal,
    // porque o `id` continua na URL e o efeito abaixo reabriria o modal (loop).
    consumedDeepLinkRef.current = true;
    // Sempre fecha o modal primeiro (especialmente no web).
    setSelected(null);
    if (cameFromEventos) {
      goBackFromEventos();
      return;
    }
  }

  function resolveSeminarGuestEnrollLink(seminarId: number): string {
    const base =
      (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/+$/, "") ||
      (__DEV__ ? "http://localhost:5173" : "https://arenamaster.com.br");
    return `${base}/seminario/inscricao/${seminarId}`;
  }

  async function handleCopyGuestLink() {
    if (!selected?.id) return;
    const url = resolveSeminarGuestEnrollLink(selected.id);
    try {
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Clipboard = (await import("react-native")).Clipboard as any;
        Clipboard?.setString?.(url);
      }
      if (Platform.OS !== "web") Alert.alert("Link copiado", "Envie o link para o convidado preencher a inscrição.");
    } catch {
      if (Platform.OS !== "web") Alert.alert("Erro ao copiar", "Não foi possível copiar. Copie manualmente o link.");
    }
  }

  async function handleShareGuestLink() {
    if (!selected?.id) return;
    const url = resolveSeminarGuestEnrollLink(selected.id);
    try {
      await Share.share({
        message: `Inscrição para o seminário "${selected.title}": ${url}`,
        url,
      });
    } catch {
      // ignore (usuário pode cancelar)
    }
  }

  const { data: seminars, isLoading } = useQuery({
    queryKey: ["seminars"],
    queryFn: async () => {
      const res = await api.get<SeminarRead[]>("/api/seminars/");
      return res.data;
    },
  });

  const { data: student } = useQuery({
    queryKey: ["student-me"],
    queryFn: async () => {
      const res = await api.get<StudentMe>("/api/students/me");
      return res.data;
    },
    enabled: user?.role === "aluno",
    retry: false,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return seminars ?? [];
    return (seminars ?? []).filter((s) => {
      return (
        s.title.toLowerCase().includes(q) ||
        (s.speaker_name ?? "").toLowerCase().includes(q) ||
        (s.location_text ?? "").toLowerCase().includes(q)
      );
    });
  }, [seminars, query]);

  // Deep-link vindo de "Eventos": abre diretamente o modal do item.
  const deepLinkId = useMemo(() => {
    const raw = params?.id;
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [params?.id]);

  // A tela pode permanecer montada na navegação por abas (tabs). Se o `id` de deep-link mudar
  // (ou sumir quando voltamos para Eventos), precisamos permitir consumir novamente.
  useEffect(() => {
    if (deepLinkId !== lastDeepLinkIdRef.current) {
      consumedDeepLinkRef.current = false;
      lastDeepLinkIdRef.current = deepLinkId;
    }
  }, [deepLinkId]);

  useEffect(() => {
    if (!deepLinkId) return;
    if (consumedDeepLinkRef.current) return;
    if (selected) return;
    if (!(seminars ?? []).length) return;
    const found = (seminars ?? []).find((s) => s.id === deepLinkId) ?? null;
    if (!found) return;
    setSelected(found);
    setEnrollMode("student");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    consumedDeepLinkRef.current = true;
  }, [deepLinkId, seminars, selected]);

  const { data: pricing } = useQuery({
    queryKey: ["seminar-pricing", selected?.id],
    queryFn: async () => {
      const res = await api.get<SeminarPricingRead>(`/api/seminars/${selected!.id}/pricing`);
      return res.data;
    },
    enabled: !!selected?.id,
  });

  const { data: schedule } = useQuery({
    queryKey: ["seminar-schedule", selected?.id],
    queryFn: async () => {
      const res = await api.get<SeminarScheduleItemRead[]>(
        `/api/seminars/${selected!.id}/schedule-items`,
      );
      return res.data;
    },
    enabled: !!selected?.id,
  });

  const { data: myRegs } = useQuery({
    queryKey: ["seminar-my-regs", selected?.id],
    queryFn: async () => {
      const res = await api.get<SeminarRegistrationRead[]>(
        `/api/seminars/${selected!.id}/me/registrations`,
      );
      return res.data;
    },
    enabled: !!selected?.id,
  });

  const isAlreadyEnrolled = (myRegs ?? []).length > 0;

  const { data: financeSummary } = useQuery({
    queryKey: ["finance-summary-lite"],
    queryFn: async () => {
      const res = await api.get<FinanceSummary>("/api/finance/me/summary");
      return { pix_config: res.data.pix_config ?? null };
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.id) throw new Error("Seminário inválido");
      const payload =
        enrollMode === "guest"
          ? {
              guest_full_name: guestName.trim(),
              guest_email: guestEmail.trim(),
              guest_phone: guestPhone.trim() || null,
            }
          : {
              student_id: student?.id ?? null,
            };
      const res = await api.post<SeminarRegistrationRead>(`/api/seminars/${selected.id}/registrations`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seminar-my-regs", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["seminar-pricing", selected?.id] });
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async (payload: { regId: number; formData: FormData }) => {
      if (!selected?.id) throw new Error("Seminário inválido");
      await api.post(
        `/api/seminars/${selected.id}/registrations/${payload.regId}/payment-receipt`,
        payload.formData,
        tokensState?.accessToken
          ? {
              headers: {
                Authorization: `Bearer ${tokensState.accessToken}`,
                "Content-Type": "multipart/form-data",
              },
            }
          : { headers: { "Content-Type": "multipart/form-data" } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seminar-my-regs", selected?.id] });
    },
  });

  const { data: ticketData, isLoading: ticketLoading } = useQuery({
    queryKey: ["seminar-ticket", selected?.id, ticketRegId],
    queryFn: async () => {
      const res = await api.get<SeminarTicketRead>(
        `/api/seminars/${selected!.id}/registrations/${ticketRegId}/ticket`,
      );
      return res.data;
    },
    enabled: !!selected?.id && !!ticketRegId,
  });

  const staffCheckinMutation = useMutation({
    mutationFn: async (payload: { public_code: string }) => {
      if (!selected?.id) throw new Error("Seminário inválido");
      const res = await api.post<SeminarAttendanceRead>(`/api/seminars/${selected.id}/check-in`, {
        public_code: payload.public_code,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setStaffResult(data);
    },
  });

  async function handleAttachReceipt(regId: number) {
    if (isPickingReceipt || uploadingRegId !== null) return;
    setIsPickingReceipt(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const msg = "Permita acesso à galeria para anexar o comprovante.";
        if (Platform.OS === "web") alert(msg);
        else Alert.alert("Permissão necessária", msg);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploadingRegId(regId);
      try {
        const form = new FormData();
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          form.append("file", blob, "comprovante.jpg");
        } else {
          form.append(
            "file",
            {
              uri: asset.uri,
              name: "comprovante.jpg",
              type: asset.mimeType ?? "image/jpeg",
            } as any,
          );
        }
        await uploadReceiptMutation.mutateAsync({ regId, formData: form });
        if (Platform.OS !== "web") {
          Alert.alert("Comprovante enviado", "Agora o professor vai confirmar seu pagamento.");
        }
      } finally {
        setUploadingRegId(null);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? (err as any)?.response?.data?.detail ?? err.message
          : "Não foi possível enviar o comprovante.";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Erro", msg);
    } finally {
      setIsPickingReceipt(false);
    }
  }

  const header = (
    <View
      style={{
        paddingTop: insets.top + tokens.space.md,
        paddingHorizontal: tokens.space.lg,
        paddingBottom: tokens.space.md,
        backgroundColor: tokens.color.bgBody,
      }}
    >
      {params?.from === "eventos" ? (
        <Pressable onPress={goBackFromEventos} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
          <Text style={{ color: tokens.color.primary, fontWeight: "900" }}>Voltar</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: tokens.color.textPrimary, fontSize: tokens.text.lg, fontWeight: "800" }}>
        Seminários
      </Text>
      <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm, marginTop: 4 }}>
        Masterclass, aulões e intercâmbio de conhecimento.
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por tema, palestrante ou local"
        placeholderTextColor={tokens.color.textMuted}
        style={{
          marginTop: tokens.space.md,
          borderWidth: 1,
          borderColor: tokens.color.borderStrong,
          borderRadius: tokens.radius.lg,
          paddingHorizontal: tokens.space.md,
          paddingVertical: tokens.space.sm,
          color: tokens.color.textPrimary,
          backgroundColor: tokens.color.bgCard,
        }}
      />
    </View>
  );

  const detailsScreen = (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      <View
        style={{
          paddingTop: insets.top + tokens.space.md,
          paddingHorizontal: tokens.space.lg,
          paddingBottom: tokens.space.md,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderStrong,
        }}
      >
        <Pressable onPress={handleBackFromDetails} style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: tokens.color.primary, fontWeight: "800" }}>Voltar</Text>
        </Pressable>
        <Text style={{ marginTop: 8, color: tokens.color.textPrimary, fontSize: tokens.text.lg, fontWeight: "900" }}>
          {selected?.title}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: tokens.space.lg, paddingBottom: 140, gap: tokens.space.lg }}
      >
        {selected?.banner_url ? (
          <Image
            source={{ uri: resolveStaticUrl(selected.banner_url) ?? undefined }}
            style={{ width: "100%", height: 180, borderRadius: tokens.radius.lg }}
            resizeMode="cover"
          />
        ) : null}

        {pricing ? (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderRadius: tokens.radius.lg,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
              padding: tokens.space.md,
              gap: 8,
            }}
          >
            <Text style={{ color: onDarkText, fontWeight: "900", fontSize: tokens.text.md }}>
              Vagas e lote
            </Text>
            <Text style={{ color: onDarkMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
              {pricing.seats_total ? `${pricing.seats_filled}/${pricing.seats_total} vagas` : `${pricing.seats_filled} inscritos`}
              {pricing.seats_total ? ` • ${pricing.percent_filled}% preenchido` : ""}
            </Text>
            <Text style={{ color: onDarkText, fontWeight: "900", fontSize: tokens.text.lg }}>
              {pricing.lot ? `${pricing.lot.name}: ` : "Preço: "}
              R$ {Number(pricing.current_price_amount ?? 0).toFixed(2).replace(".", ",")}
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={tokens.color.primary} />
        )}

        <View style={{ gap: 6 }}>
          <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>Sobre</Text>
          {selected?.starts_at ? (
            <Text style={{ color: tokens.color.textMuted }}>
              {new Date(selected.starts_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
            </Text>
          ) : null}
          {selected?.location_text ? (
            <Text style={{ color: tokens.color.textMuted }}>
              Local:{" "}
              {[
                selected.location_city,
                selected.location_state ? String(selected.location_state).toUpperCase() : null,
              ]
                .filter(Boolean)
                .join(" - ") || selected.location_text}
            </Text>
          ) : null}
          {selected?.description ? (
            <Text style={{ color: tokens.color.textPrimary, lineHeight: 20 }}>{selected.description}</Text>
          ) : null}
        </View>

        {(selected?.speaker_name || selected?.speaker_bio || selected?.speaker_achievements) ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>Palestrante</Text>
            {selected?.speaker_name ? (
              <Text style={{ color: tokens.color.textPrimary, fontWeight: "800" }}>{selected.speaker_name}</Text>
            ) : null}
            {selected?.speaker_achievements ? (
              <Text style={{ color: tokens.color.textMuted }}>{selected.speaker_achievements}</Text>
            ) : null}
            {selected?.speaker_bio ? (
              <Text style={{ color: tokens.color.textPrimary, lineHeight: 20 }}>{selected.speaker_bio}</Text>
            ) : null}
          </View>
        ) : null}

        {schedule?.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>Cronograma</Text>
            {schedule.map((it) => (
              <View
                key={it.id}
                style={{
                  padding: tokens.space.md,
                  backgroundColor: tokens.color.bgCard,
                  borderWidth: 1,
                  borderColor: tokens.color.borderStrong,
                  borderRadius: tokens.radius.lg,
                  gap: 4,
                }}
              >
                <Text style={{ color: onDarkText, fontWeight: "900", fontSize: tokens.text.md }}>
                  {it.title}
                </Text>
                <Text style={{ color: onDarkMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
                  {it.starts_at
                    ? new Date(it.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "--:--"}
                  {it.ends_at
                    ? ` → ${new Date(it.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                  {it.kind ? ` • ${mapSeminarScheduleKindPt(it.kind) ?? "Outro"}` : ""}
                </Text>
                {it.notes ? (
                  <Text style={{ color: onDarkMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
                    {it.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: tokens.color.bgCard,
            borderWidth: 1,
            borderColor: tokens.color.borderStrong,
            borderRadius: tokens.radius.lg,
            padding: tokens.space.md,
            gap: tokens.space.sm,
          }}
        >
          <Text style={{ color: onDarkText, fontWeight: "900", fontSize: tokens.text.md }}>Inscrição</Text>

          <View style={{ flexDirection: "row", gap: tokens.space.sm }}>
            <Pressable
              onPress={() => setEnrollMode("student")}
              style={{
                flex: 1,
                paddingVertical: tokens.space.sm,
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: enrollMode === "student" ? tokens.color.primary : tokens.color.borderStrong,
                backgroundColor: enrollMode === "student" ? tokens.color.primary : onDarkInactiveBg,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: enrollMode === "student" ? tokens.color.textOnPrimary : onDarkInactiveText,
                  fontWeight: "800",
                }}
              >
                Para mim
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setEnrollMode("guest")}
              style={{
                flex: 1,
                paddingVertical: tokens.space.sm,
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: enrollMode === "guest" ? tokens.color.primary : tokens.color.borderStrong,
                backgroundColor: enrollMode === "guest" ? tokens.color.primary : onDarkInactiveBg,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: enrollMode === "guest" ? tokens.color.textOnPrimary : onDarkInactiveText,
                  fontWeight: "800",
                }}
              >
                Convidado
              </Text>
            </Pressable>
          </View>

          {enrollMode === "guest" ? (
            <View style={{ gap: tokens.space.sm }}>
              <Text style={{ color: onDarkMuted, lineHeight: 20 }}>
                Gere um link para o convidado preencher a inscrição por etapas (sem precisar ter conta).
              </Text>
              <View style={{ flexDirection: "row", gap: tokens.space.sm }}>
                <Pressable
                  onPress={handleCopyGuestLink}
                  style={{
                    flex: 1,
                    paddingVertical: tokens.space.sm,
                    borderRadius: tokens.radius.lg,
                    borderWidth: 1,
                    borderColor: tokens.color.primary,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: tokens.color.primary, fontWeight: "900" }}>Copiar link</Text>
                </Pressable>
                <Pressable
                  onPress={handleShareGuestLink}
                  style={{
                    flex: 1,
                    paddingVertical: tokens.space.sm,
                    borderRadius: tokens.radius.lg,
                    backgroundColor: tokens.color.primary,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>Compartilhar</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              if (enrollMode === "guest") {
                void handleShareGuestLink();
                return;
              }
              enrollMutation.mutate();
            }}
            disabled={enrollMode === "student" && (enrollMutation.isPending || isAlreadyEnrolled)}
            style={{
              marginTop: tokens.space.sm,
              paddingVertical: tokens.space.md,
              borderRadius: tokens.radius.lg,
              backgroundColor: tokens.color.primary,
              alignItems: "center",
              opacity: enrollMode === "student" && isAlreadyEnrolled ? 0.85 : 1,
            }}
          >
            {enrollMode === "student" && enrollMutation.isPending ? (
              <ActivityIndicator color={tokens.color.textOnPrimary} />
            ) : (
              <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>
                {enrollMode === "guest"
                  ? "Gerar link de inscrição"
                  : isAlreadyEnrolled
                    ? "Inscrito"
                    : "Inscrever-se"}
              </Text>
            )}
          </Pressable>

          {!!myRegs?.length ? (
            <View style={{ marginTop: tokens.space.md, gap: tokens.space.sm }}>
              <Text style={{ color: onDarkText, fontWeight: "900" }}>Minhas inscrições</Text>
              {myRegs.map((r) => {
                const label = r.student_id
                  ? (r.student_name ?? "Participante")
                  : r.guest_full_name
                    ? r.guest_full_name
                    : "Convidado";
                const statusLabel = mapSeminarPaymentStatusPt(r.payment_status);
                return (
                  <View
                    key={r.id}
                    style={{
                      padding: tokens.space.md,
                      borderRadius: tokens.radius.lg,
                      borderWidth: 1,
                      borderColor: tokens.color.borderStrong,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: onDarkText, fontWeight: "900" }}>{label}</Text>
                    <Text style={{ color: onDarkMuted, lineHeight: 20 }}>{statusLabel}</Text>
                    {r.payment_status === "rejected" && r.payment_notes ? (
                      <Text style={{ color: tokens.color.error }}>{r.payment_notes}</Text>
                    ) : null}

                    {r.payment_status !== "confirmed" ? (
                      <Pressable
                        onPress={() => handleAttachReceipt(r.id)}
                        disabled={uploadingRegId === r.id}
                        style={{
                          marginTop: 4,
                          paddingVertical: tokens.space.sm,
                          borderRadius: tokens.radius.lg,
                          borderWidth: 1,
                          borderColor: tokens.color.primary,
                          alignItems: "center",
                        }}
                      >
                        {uploadingRegId === r.id ? (
                          <ActivityIndicator color={tokens.color.primary} />
                        ) : (
                          <Text style={{ color: tokens.color.primary, fontWeight: "900" }}>
                            Enviar comprovante
                          </Text>
                        )}
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setTicketRegId(r.id)}
                        style={{
                          marginTop: 4,
                          paddingVertical: tokens.space.sm,
                          borderRadius: tokens.radius.lg,
                          backgroundColor: tokens.color.primary,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>
                          Ver ingresso (QR)
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          {financeSummary?.pix_config ? (
            <View style={{ marginTop: tokens.space.md, gap: 6 }}>
              <Text style={{ color: onDarkText, fontWeight: "900" }}>PIX da academia</Text>
              <Text style={{ color: onDarkMuted, lineHeight: 20 }}>
                {financeSummary.pix_config.key_type}: {financeSummary.pix_config.key_value}
              </Text>
              {financeSummary.pix_config.instructions ? (
                <Text style={{ color: onDarkMuted, lineHeight: 20 }}>
                  {financeSummary.pix_config.instructions}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {user?.role === "admin" ? (
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
              borderRadius: tokens.radius.lg,
              padding: tokens.space.md,
              gap: tokens.space.sm,
            }}
          >
            <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>Check-in (staff)</Text>
            <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
              Cole o código do ingresso (fallback ao QR).
            </Text>
            <TextInput
              value={staffCode}
              onChangeText={setStaffCode}
              placeholder="Ex.: A1BC23D4EF56"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="characters"
              style={{
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                borderRadius: tokens.radius.lg,
                paddingHorizontal: tokens.space.md,
                paddingVertical: tokens.space.sm,
                color: tokens.color.textPrimary,
              }}
            />
            <Pressable
              onPress={() => staffCheckinMutation.mutate({ public_code: staffCode.trim() })}
              disabled={staffCheckinMutation.isPending}
              style={{
                paddingVertical: tokens.space.md,
                borderRadius: tokens.radius.lg,
                backgroundColor: tokens.color.primary,
                alignItems: "center",
              }}
            >
              {staffCheckinMutation.isPending ? (
                <ActivityIndicator color={tokens.color.textOnPrimary} />
              ) : (
                <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>Confirmar presença</Text>
              )}
            </Pressable>
            {staffResult ? (
              <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                Check-in ok. Registro #{staffResult.id} •{" "}
                {new Date(staffResult.checked_in_at).toLocaleString("pt-BR")}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      {cameFromEventos && deepLinkId ? (
        <>
          {selected ? (
            detailsScreen
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={tokens.color.primary} />
            </View>
          )}
        </>
      ) : (
        <>
          {header}

          {isLoading ? (
            <View style={{ padding: tokens.space.lg, alignItems: "center" }}>
              <ActivityIndicator color={tokens.color.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: tokens.space.lg, gap: tokens.space.md, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {(filtered ?? []).map((s) => {
                const banner = resolveStaticUrl(s.banner_url);
                const dateLabel = s.starts_at
                  ? new Date(s.starts_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })
                  : "Data a definir";

                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setSelected(s);
                      setEnrollMode("student");
                      setGuestName("");
                      setGuestEmail("");
                      setGuestPhone("");
                    }}
                    style={{
                      borderRadius: tokens.radius.lg,
                      borderWidth: 1,
                      borderColor: tokens.color.borderStrong,
                      backgroundColor: tokens.color.bgCard,
                      overflow: "hidden",
                    }}
                  >
                    {banner ? (
                      <Image source={{ uri: banner }} style={{ width: "100%", height: 140 }} resizeMode="cover" />
                    ) : (
                      <View style={{ height: 16 }} />
                    )}
                    <View style={{ padding: tokens.space.md, gap: 6 }}>
                      <Text style={{ color: tokens.color.textPrimary, fontWeight: "800", fontSize: tokens.text.md }}>
                        {s.title}
                      </Text>
                      <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>{dateLabel}</Text>
                      {s.organizer_dojo_name ? (
                        <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                          Academia: {s.organizer_dojo_name}
                        </Text>
                      ) : null}
                      {s.speaker_name ? (
                        <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                          Palestrante: {s.speaker_name}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Modal visible={!!selected} animationType="slide" onRequestClose={handleBackFromDetails}>
            {detailsScreen}
          </Modal>
        </>
      )}

      <Modal
        visible={ticketRegId !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setTicketRegId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            padding: tokens.space.lg,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: tokens.color.bgBody,
              borderRadius: tokens.radius.lg,
              borderWidth: 1,
              borderColor: tokens.color.borderStrong,
              padding: tokens.space.lg,
              gap: tokens.space.md,
            }}
          >
            <Text style={{ color: tokens.color.textPrimary, fontWeight: "900", fontSize: tokens.text.md }}>
              Ingresso do seminário
            </Text>
            {ticketLoading ? (
              <ActivityIndicator color={tokens.color.primary} />
            ) : ticketData ? (
              <View style={{ alignItems: "center", gap: tokens.space.sm }}>
                <View
                  style={{
                    backgroundColor: "#fff",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <QRCode value={ticketData.token} size={220} />
                </View>
                <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.sm }}>
                  Código: <Text style={{ fontWeight: "900", color: tokens.color.textPrimary }}>{ticketData.public_code}</Text>
                </Text>
                <Text style={{ color: tokens.color.textMuted, fontSize: tokens.text.xs }}>
                  Válido até {new Date(ticketData.expires_at).toLocaleString("pt-BR")}
                </Text>
              </View>
            ) : (
              <Text style={{ color: tokens.color.error }}>Não foi possível carregar o ingresso.</Text>
            )}
            <Pressable
              onPress={() => setTicketRegId(null)}
              style={{
                paddingVertical: tokens.space.md,
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: tokens.color.borderStrong,
                alignItems: "center",
              }}
            >
              <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

