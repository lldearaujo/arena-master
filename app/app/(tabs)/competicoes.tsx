import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Search, Ticket } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";

import { api } from "../../src/api/client";
import { useAuthStore } from "../../src/store/auth";
import { tokens } from "../../src/ui/tokens";

const arenaMasterLogo = require("../../assets/arena-master-logo.png");

type CompetitionRead = {
  id: number;
  organizer_dojo_id: number;
  name: string;
  reference_year: number;
  event_starts_at: string | null;
  is_published: boolean;
  created_at: string;
  registration_fee_amount: number | null;
  registration_payment_instructions: string | null;
  event_modality: string | null;
  description?: string | null;
  banner_url: string | null;
  organizer_dojo_name: string | null;
  organizer_logo_url: string | null;
};

type StudentMe = {
  id: number;
  name: string;
  birth_date: string | null;
  weight_kg?: number | null;
  modalidade: string | null;
};

type RegistrationSummary = {
  id: number;
  competition_id: number;
  kind?: string;
  modality?: string;
  status: string;
  payment_status: string;
  payment_receipt_path?: string | null;
  payment_notes?: string | null;
  payment_confirmed_at?: string | null;
  age_division_label: string | null;
  weight_class_label: string | null;
  registration_fee_amount: number | null;
  registration_payment_instructions: string | null;
};

type EligibilityOptionsResponse = {
  age_divisions: {
    age_division: { id: number; label: string };
    allowed_faixa_ids: number[];
  }[];
  weight_classes: {
    weight_class: {
      id: number;
      label: string;
      modality: string;
      weight_interval_label: string | null;
      age_division_id: number;
    };
  }[];
};

type PrizeRead = {
  id: number;
  competition_id: number;
  kind: "category" | "absolute" | string;
  age_division_id: number | null;
  faixa_id: number | null;
  faixa_label?: string | null;
  gender: string;
  modality: string;
  place: number;
  reward: string;
};

type StudentInitialMatchRead = {
  match_id: number;
  competition_id: number;
  registration_id: number;
  my_side: "red" | "blue" | string;
  opponent_name: string | null;
  mat_id: number | null;
  mat_name: string | null;
  queue_order: number | null;
  estimated_start_at: string | null;
  match_status: string;
  round_index: number;
  red_score: number;
  blue_score: number;
  finish_method: string | null;
  my_result: "pending" | "win" | "loss" | "draw" | string;
} | null;

type StudentBracketMatchRead = {
  match_id: number;
  bracket_id: number;
  competition_id: number;
  registration_id: number;
  round_index: number;
  position_in_round: number;
  my_side: "red" | "blue" | string;
  opponent_name: string | null;
  mat_id: number | null;
  mat_name: string | null;
  queue_order: number | null;
  estimated_start_at: string | null;
  match_status: string;
  red_score: number;
  blue_score: number;
  finish_method: string | null;
  my_result: "pending" | "win" | "loss" | "draw" | string;
};

const STAGE_FROM_FINAL = ["Final", "Semi-final", "Quartas de final", "Oitavas de final", "16ª de final", "32ª de final", "64ª de final"] as const;

/** Inscrição efetiva no evento: isento ou pagamento confirmado pelo organizador. */
function registrationPaymentCleared(ps: string | null | undefined): boolean {
  const s = String(ps ?? "").trim().toLowerCase();
  return s === "not_applicable" || s === "confirmed";
}

function bracketStageLabelFromTotalRounds(roundIndex: number, totalRounds: number): string {
  const tr = Math.max(1, totalRounds);
  const ri = Math.max(0, roundIndex);
  const stepsFromFinal = tr - 1 - ri;
  if (stepsFromFinal < 0) return `Rodada ${roundIndex + 1}`;
  if (stepsFromFinal < STAGE_FROM_FINAL.length) return STAGE_FROM_FINAL[stepsFromFinal]!;
  return `Rodada ${roundIndex + 1}`;
}

export default function CompeticoesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const onCardText = tokens.color.textOnPrimary;
  const onCardMuted = "rgba(255,255,255,0.72)";
  const onCardSubtle = "rgba(255,255,255,0.16)";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CompetitionRead | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [modality, setModality] = useState<"gi" | "nogi">("gi");
  const [ageDivisionId, setAgeDivisionId] = useState<number | null>(null);
  const [weightClassId, setWeightClassId] = useState<number | null>(null);
  const [alsoAbsolute, setAlsoAbsolute] = useState(false);
  const [uploadingRegId, setUploadingRegId] = useState<number | null>(null);
  const [isPickingReceipt, setIsPickingReceipt] = useState(false);

  const { data: comps, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const res = await api.get<CompetitionRead[]>("/api/competitions/");
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

  const birthYear = useMemo(() => {
    const raw = student?.birth_date;
    if (!raw) return null;
    // aceita YYYY-MM-DD ou ISO; pega os 4 primeiros
    const y = Number(String(raw).slice(0, 4));
    return Number.isFinite(y) ? y : null;
  }, [student?.birth_date]);

  const { data: myRegs } = useQuery({
    queryKey: ["my-competition-registrations"],
    queryFn: async () => {
      const res = await api.get<RegistrationSummary[]>("/api/competitions/me/my-registrations");
      return res.data;
    },
    enabled: !!user,
    staleTime: 20_000,
  });

  const regByCompetitionId = useMemo(() => {
    const m = new Map<number, RegistrationSummary[]>();
    for (const r of myRegs ?? []) {
      const cur = m.get(r.competition_id) ?? [];
      cur.push(r);
      m.set(r.competition_id, cur);
    }
    return m;
  }, [myRegs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const studentModalidades = new Set(
      String(student?.modalidade ?? "")
        .split(/[,;/]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase()),
    );
    const items = (comps ?? []).filter((c) => {
      if (user?.role === "aluno") {
        if (!c.is_published) return false;
        const cm = (c.event_modality ?? "").trim().toLowerCase();
        if (!cm) return false;
        return studentModalidades.has(cm);
      }
      return true;
    });
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q) || String(c.reference_year).includes(q));
  }, [comps, query, user?.role, student?.modalidade]);

  function resolvePublicImage(url: string | null | undefined): { uri: string } | null {
    if (!url) return null;
    if (url.startsWith("http")) return { uri: url };
    const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
    return { uri: `${base}${url.startsWith("/") ? "" : "/"}${url}` };
  }

  function receiptUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function fmtDate(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    try {
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  function fmtDateTime(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    try {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d.toISOString();
    }
  }

  function fmtGenderPt(g: string | null | undefined): string {
    const s = String(g ?? "").trim().toLowerCase();
    if (s === "male") return "Masculino";
    if (s === "female") return "Feminino";
    return "—";
  }

  function fmtModalityPt(m: string | null | undefined): string {
    const s = String(m ?? "").trim().toLowerCase();
    if (s === "gi") return "Gi";
    if (s === "nogi") return "No-Gi";
    return "—";
  }

  function fmtPrizeKindPt(k: string | null | undefined): string {
    const s = String(k ?? "").trim().toLowerCase();
    if (s === "absolute") return "Absoluto";
    if (s === "category") return "Categoria";
    return "Premiação";
  }

  function mapPaymentStatusPt(
    raw: string | null | undefined,
  ): { label: string; bg: string; border: string; text: string } {
    const s = String(raw ?? "").trim().toLowerCase();
    const ok = {
      label: "Pago",
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.28)",
      text: "rgba(34,197,94,0.98)",
    };
    const warn = {
      label: "Pendente",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.28)",
      text: "rgba(245,158,11,0.98)",
    };
    const info = {
      label: "Em análise",
      bg: "rgba(59,130,246,0.14)",
      border: "rgba(59,130,246,0.28)",
      text: "rgba(59,130,246,0.98)",
    };
    const bad = {
      label: "Cancelado",
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.28)",
      text: "rgba(239,68,68,0.98)",
    };

    if (!s || s === "null" || s === "none") return { ...warn, label: "Pendente" };

    // Status reais do backend de competições
    if (s === "not_applicable") return { ...ok, label: "Isento" };
    if (s === "pending_payment") return { ...warn, label: "Pendente" };
    if (s === "pending_confirmation") return { ...info, label: "Em análise" };
    if (s === "confirmed") return { ...ok, label: "Pago" };
    if (s === "rejected") return { ...bad, label: "Recusado" };

    // comuns no backend
    if (["paid", "approved", "succeeded", "success", "done"].includes(s)) return ok;
    if (["pending", "pending_payment", "unpaid", "awaiting_payment", "waiting_payment"].includes(s))
      return warn;
    if (["processing", "in_review", "review", "analyzing", "awaiting_confirmation"].includes(s))
      return info;
    if (["canceled", "cancelled", "failed", "rejected", "refused", "chargeback"].includes(s))
      return bad;

    // fallback: nunca exibe termos em inglês
    return {
      label: "Desconhecido",
      bg: "rgba(148,163,184,0.12)",
      border: "rgba(148,163,184,0.22)",
      text: "rgba(226,232,240,0.92)",
    };
  }

  function mapRegistrationStatusPt(
    raw: string | null | undefined,
  ): { label: string; bg: string; border: string; text: string } {
    const s = String(raw ?? "").trim().toLowerCase();

    const ok = {
      label: "Confirmado",
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.28)",
      text: "rgba(34,197,94,0.98)",
    };
    const warn = {
      label: "Pendente",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.28)",
      text: "rgba(245,158,11,0.98)",
    };
    const info = {
      label: "Em análise",
      bg: "rgba(59,130,246,0.14)",
      border: "rgba(59,130,246,0.28)",
      text: "rgba(59,130,246,0.98)",
    };
    const bad = {
      label: "Cancelado",
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.28)",
      text: "rgba(239,68,68,0.98)",
    };

    if (!s || s === "null" || s === "none") return warn;

    if (["registered"].includes(s)) return { ...warn, label: "Registrado" };
    if (["weighed_in"].includes(s)) return { ...ok, label: "Pesado" };
    if (["disqualified"].includes(s)) return { ...bad, label: "Desclassificado" };
    if (["created", "pending", "awaiting_payment"].includes(s)) return warn;
    if (["confirmed", "approved", "accepted"].includes(s)) return ok;
    if (["in_review", "review", "processing"].includes(s)) return info;
    if (["cancelled", "canceled", "rejected", "refused", "failed"].includes(s)) return bad;

    return {
      label: "Desconhecido",
      bg: "rgba(148,163,184,0.12)",
      border: "rgba(148,163,184,0.22)",
      text: "rgba(226,232,240,0.92)",
    };
  }

  function tryParsePtWeightInterval(label: string | null | undefined): { min: number | null; max: number | null } | null {
    const s = String(label ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!s) return null;

    const toNum = (v: string) => Number(v.replace(".", "").replace(",", "."));

    // "até 57,5 kg"
    {
      const m = /^até\s+(\d+(?:[.,]\d+)?)\s*kg/.exec(s);
      if (m) {
        const max = toNum(m[1]!);
        if (Number.isFinite(max)) return { min: null, max };
      }
    }

    // "100,5 kg ou mais" / "100,5kg ou mais"
    {
      const m = /^(\d+(?:[.,]\d+)?)\s*kg\s+ou\s+mais/.exec(s);
      if (m) {
        const min = toNum(m[1]!);
        if (Number.isFinite(min)) return { min, max: null };
      }
    }

    // "57,5–64 kg" / "57,5-64 kg" / "57,5 — 64 kg"
    {
      const m = /^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*kg/.exec(s);
      if (m) {
        const min = toNum(m[1]!);
        const max = toNum(m[2]!);
        if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
      }
    }

    return null;
  }

  const selectedRegs = selected ? regByCompetitionId.get(selected.id) ?? [] : [];
  // Preferimos usar a inscrição de categoria como "principal" para fluxos que dependem de age_division/weight_class
  // (ex.: “Sua chave”, comprovante de pagamento).
  const primaryReg = useMemo(() => {
    if (!selectedRegs.length) return null;
    return (
      selectedRegs.find((r) => String(r.kind ?? "").toLowerCase() !== "absolute") ??
      selectedRegs[0] ??
      null
    );
  }, [selectedRegs]);

  const clearedSelectedRegs = useMemo(
    () => selectedRegs.filter((r) => registrationPaymentCleared(r.payment_status)),
    [selectedRegs],
  );

  const allRegsPaymentCleared =
    selectedRegs.length > 0 && selectedRegs.every((r) => registrationPaymentCleared(r.payment_status));

  const clearedRegIdsKey = clearedSelectedRegs
    .map((r) => r.id)
    .sort((a, b) => a - b)
    .join(",");

  const {
    data: prizes,
    isLoading: prizesLoading,
    isError: prizesIsError,
    error: prizesError,
  } = useQuery({
    queryKey: ["competition-public-prizes", selected?.id],
    queryFn: async () => {
      if (!selected?.id) throw new Error("Evento inválido");
      const res = await api.get<PrizeRead[]>(`/api/competitions/public/${selected.id}/prizes`);
      return res.data;
    },
    enabled: !!selected?.id,
    retry: false,
  });

  const { data: myInitialMatch, isLoading: initialMatchLoading } = useQuery({
    queryKey: ["competition-my-initial-match", selected?.id, clearedRegIdsKey],
    queryFn: async () => {
      if (!selected?.id) throw new Error("Evento inválido");
      const res = await api.get<StudentInitialMatchRead>(`/api/competitions/${selected.id}/me/initial-match`);
      return res.data;
    },
    enabled: !!selected?.id && clearedSelectedRegs.length > 0,
    retry: false,
  });

  const { data: myBracketMatches, isLoading: myBracketMatchesLoading } = useQuery({
    queryKey: ["competition-my-bracket-matches", selected?.id, clearedRegIdsKey],
    queryFn: async () => {
      if (!selected?.id) throw new Error("Evento inválido");
      const res = await api.get<StudentBracketMatchRead[]>(`/api/competitions/${selected.id}/me/bracket-matches`);
      return res.data;
    },
    enabled: !!selected?.id && clearedSelectedRegs.length > 0,
    retry: false,
    staleTime: 4_000,
  });

  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["eligibility-options", selected?.id, gender, modality, birthYear],
    queryFn: async () => {
      if (!selected?.id) throw new Error("Seleção inválida");
      const qs = new URLSearchParams();
      qs.set("gender", gender);
      if (birthYear != null) qs.set("birth_year", String(birthYear));
      qs.set("modality", modality);
      const res = await api.get<EligibilityOptionsResponse>(`/api/competitions/${selected.id}/eligibility-options?${qs.toString()}`);
      return res.data;
    },
    enabled: !!selected?.id && user?.role === "aluno" && enrollOpen,
    retry: false,
  });

  // Auto-seleciona categoria (idade) quando houver apenas 1 opção.
  useEffect(() => {
    if (!enrollOpen) return;
    if (ageDivisionId != null) return;
    const opts = eligibility?.age_divisions ?? [];
    if (opts.length === 1) setAgeDivisionId(opts[0]!.age_division.id);
  }, [enrollOpen, eligibility?.age_divisions, ageDivisionId]);

  // Auto-seleciona categoria (peso) baseada no peso do aluno.
  useEffect(() => {
    if (!enrollOpen) return;
    if (weightClassId != null) return; // não sobrescreve escolha manual
    const w = student?.weight_kg;
    if (w === null || w === undefined || !Number.isFinite(w) || w <= 0) return;

    const list = (eligibility?.weight_classes ?? []).filter((it) =>
      ageDivisionId ? it.weight_class.age_division_id === ageDivisionId : true,
    );
    if (list.length === 0) return;

    const candidates = list
      .map((it) => {
        const iv = it.weight_class.weight_interval_label ?? it.weight_class.label;
        const parsed = tryParsePtWeightInterval(iv);
        return { id: it.weight_class.id, parsed };
      })
      .filter((x): x is { id: number; parsed: { min: number | null; max: number | null } } => !!x.parsed);

    if (candidates.length === 0) return;

    // Regra: pega a primeira classe que comporta o peso; em empate, menor max.
    const fits = candidates
      .filter(({ parsed }) => {
        const minOk = parsed.min == null ? true : w >= parsed.min;
        const maxOk = parsed.max == null ? true : w <= parsed.max;
        return minOk && maxOk;
      })
      .sort((a, b) => {
        const am = a.parsed.max ?? Infinity;
        const bm = b.parsed.max ?? Infinity;
        return am - bm;
      });

    if (fits[0]) {
      setWeightClassId(fits[0].id);
      return;
    }

    // Fallback: se não couber em nenhuma (labels inconsistentes), escolhe a menor classe com max >= w.
    const byUpper = candidates
      .filter(({ parsed }) => parsed.max != null && w <= parsed.max)
      .sort((a, b) => (a.parsed.max! - b.parsed.max!));
    if (byUpper[0]) setWeightClassId(byUpper[0].id);
  }, [enrollOpen, weightClassId, student?.weight_kg, eligibility?.weight_classes, ageDivisionId]);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.id) throw new Error("Evento inválido");
      if (!student?.id) throw new Error("Aluno não encontrado na sua conta");
      if (!ageDivisionId || !weightClassId) throw new Error("Selecione a categoria");
      const payload = {
        student_id: student.id,
        gender,
        modality,
        age_division_id: ageDivisionId,
        weight_class_id: weightClassId,
        also_absolute: alsoAbsolute,
      };
      const res = await api.post(`/api/competitions/${selected.id}/registrations`, payload);
      return res.data as RegistrationSummary;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-competition-registrations"] });
      setEnrollOpen(false);
      setAlsoAbsolute(false);
      Alert.alert(
        "Inscrição registrada",
        "Se houver taxa, envie o comprovante e aguarde a confirmação do pagamento pelo organizador. Só após isso você estará inscrito de fato e poderá seguir no fluxo do evento.",
      );
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.detail ??
        (err instanceof Error ? err.message : null) ??
        "Não foi possível concluir sua inscrição.";
      Alert.alert("Erro", String(detail));
    },
  });

  const uploadRegReceiptMutation = useMutation({
    mutationFn: async (payload: { competitionId: number; registrationId: number; formData: FormData }) => {
      await api.post(
        `/api/competitions/${payload.competitionId}/registrations/${payload.registrationId}/payment-receipt`,
        payload.formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-competition-registrations"] });
    },
  });

  async function handleAttachRegistrationReceipt(competitionId: number, registrationId: number) {
    if (isPickingReceipt || uploadingRegId !== null) return;
    setIsPickingReceipt(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const msg = "Permita acesso à galeria para anexar o comprovante de inscrição.";
        Alert.alert("Permissão necessária", msg);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploadingRegId(registrationId);
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

        await uploadRegReceiptMutation.mutateAsync({ competitionId, registrationId, formData: form });
        Alert.alert("Comprovante enviado", "Seu comprovante foi anexado e aguarda confirmação do organizador.");
      } catch (err: any) {
        const detail = err?.response?.data?.detail ?? (err instanceof Error ? err.message : null) ?? "Não foi possível enviar o comprovante.";
        Alert.alert("Erro ao enviar", String(detail));
      } finally {
        setUploadingRegId(null);
      }
    } finally {
      setIsPickingReceipt(false);
    }
  }

  const cardW = Math.min(520, width - 40);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
      <View
        style={{
          backgroundColor: tokens.color.bgCard,
          borderBottomLeftRadius: tokens.radius.lg * 2,
          borderBottomRightRadius: tokens.radius.lg * 2,
          paddingTop: insets.top + tokens.space.lg,
          paddingBottom: tokens.space.lg,
          paddingHorizontal: tokens.space.lg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 4,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
          alignItems: "center",
        }}
      >
        <Image
          source={arenaMasterLogo}
          style={{
            width: Math.min(260, width - tokens.space.lg * 4),
            height: Math.min(140, (width - tokens.space.lg * 4) * 0.5),
            resizeMode: "contain",
          }}
        />
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.color.textPrimary, letterSpacing: 0.2 }}>
          Eventos
        </Text>
        <Text style={{ color: "rgba(17,24,39,0.72)", marginTop: 6, fontSize: 13, lineHeight: 18 }}>
          Escolha um evento e faça sua inscrição com os dados da sua conta.
        </Text>

        <View
          style={{
            marginTop: 14,
            backgroundColor: tokens.color.bgCard,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Search size={18} color={"rgba(255,255,255,0.72)"} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar evento por nome ou ano"
            placeholderTextColor={"rgba(255,255,255,0.55)"}
            style={{
              flex: 1,
              color: tokens.color.textOnPrimary,
              fontSize: 14,
              paddingVertical: 0,
            }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator color={tokens.color.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24 + insets.bottom,
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text style={{ color: tokens.color.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                Nenhum evento encontrado.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const img = resolvePublicImage(item.banner_url);
            const dateLabel = fmtDate(item.event_starts_at);
            const regs = regByCompetitionId.get(item.id) ?? [];
            const enrolledConfirmed =
              regs.length > 0 && regs.every((r) => registrationPaymentCleared(r.payment_status));
            const hasEnrollment = regs.length > 0;
            const enrollmentPendingReview =
              hasEnrollment &&
              !enrolledConfirmed &&
              regs.some((r) => String(r.payment_status).toLowerCase() === "pending_confirmation");
            return (
              <Pressable
                onPress={() => {
                  setSelected(item);
                  setEnrollOpen(false);
                  setAgeDivisionId(null);
                  setWeightClassId(null);
                }}
                style={{
                  width: cardW,
                  alignSelf: "center",
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: tokens.color.bgCard,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  marginBottom: 12,
                }}
              >
                {img ? (
                  <Image
                    source={img}
                    resizeMode="cover"
                    style={{ height: 110, width: "100%", backgroundColor: tokens.color.borderSubtle }}
                  />
                ) : (
                  <View style={{ height: 12, backgroundColor: tokens.color.borderSubtle }} />
                )}
                <View style={{ padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "900", fontSize: 16, color: onCardText }} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" as any }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <CalendarDays size={14} color={onCardMuted} />
                          <Text style={{ color: onCardMuted, fontSize: 12 }}>
                            {dateLabel ?? `Ano ${item.reference_year}`}
                          </Text>
                        </View>
                        {item.organizer_dojo_name ? (
                          <Text style={{ color: onCardMuted, fontSize: 12 }}>· {item.organizer_dojo_name}</Text>
                        ) : null}
                      </View>
                    </View>

                    {enrolledConfirmed ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "rgba(184,158,93,0.12)",
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: "rgba(184,158,93,0.22)",
                        }}
                      >
                        <CheckCircle2 size={14} color={tokens.color.primary} />
                        <Text style={{ color: tokens.color.primary, fontSize: 12, fontWeight: "800" }}>Inscrito</Text>
                      </View>
                    ) : hasEnrollment ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: enrollmentPendingReview
                            ? "rgba(59,130,246,0.12)"
                            : "rgba(245,158,11,0.12)",
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: enrollmentPendingReview
                            ? "rgba(59,130,246,0.22)"
                            : "rgba(245,158,11,0.22)",
                        }}
                      >
                        <Clock size={14} color={enrollmentPendingReview ? "rgba(59,130,246,0.98)" : "rgba(245,158,11,0.98)"} />
                        <Text
                          style={{
                            color: enrollmentPendingReview ? "rgba(59,130,246,0.98)" : "rgba(245,158,11,0.98)",
                            fontSize: 11,
                            fontWeight: "800",
                            maxWidth: 120,
                          }}
                          numberOfLines={2}
                        >
                          {enrollmentPendingReview ? "Em análise" : "Pagamento pendente"}
                        </Text>
                      </View>
                    ) : (
                      <ChevronRight size={20} color={onCardMuted} />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={{ flex: 1, backgroundColor: tokens.color.bgBody }}>
          <View
            style={{
              backgroundColor: tokens.color.bgCard,
              borderBottomLeftRadius: tokens.radius.lg * 2,
              borderBottomRightRadius: tokens.radius.lg * 2,
              paddingTop: insets.top + tokens.space.sm,
              paddingBottom: tokens.space.lg,
              paddingHorizontal: tokens.space.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.14,
              shadowRadius: 10,
              elevation: 4,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Pressable onPress={() => setSelected(null)} style={{ paddingVertical: 10, alignSelf: "flex-start" }}>
              <Text style={{ color: tokens.color.primary, fontWeight: "900" }}>Voltar</Text>
            </Pressable>
            <Text style={{ fontSize: tokens.text.lg, fontWeight: "900", color: onCardText }} numberOfLines={2}>
              {selected?.name ?? ""}
            </Text>
            <Text style={{ color: onCardMuted, marginTop: tokens.space.xs, fontSize: tokens.text.xs }}>
              {fmtDateTime(selected?.event_starts_at ?? null) ?? `Ano ${selected?.reference_year ?? ""}`}
              {selected?.organizer_dojo_name ? ` · ${selected.organizer_dojo_name}` : ""}
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          >
            {selected?.banner_url ? (
              <Image
                source={resolvePublicImage(selected.banner_url) ?? undefined}
                resizeMode="cover"
                style={{
                  height: 160,
                  borderRadius: 18,
                  backgroundColor: tokens.color.borderSubtle,
                }}
              />
            ) : null}

            <View style={{ height: 14 }} />

            {/* Detalhes do evento */}
            <View
              style={{
                backgroundColor: tokens.color.bgCard,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: onCardSubtle,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: onCardText, fontWeight: "900" }}>
                Sobre o evento
              </Text>

              <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                Data e hora: {fmtDateTime(selected?.event_starts_at ?? null) ?? "—"}
              </Text>

              {(selected?.description ?? "").trim() ? (
                <Text style={{ color: onCardMuted, marginTop: 10, fontSize: 13, lineHeight: 18 }}>
                  {(selected?.description ?? "").trim()}
                </Text>
              ) : null}
            </View>

            {/* Premiação (sempre visível no evento) */}
            <View
              style={{
                backgroundColor: tokens.color.bgCard,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: onCardSubtle,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: onCardText, fontWeight: "900" }}>Premiação</Text>
              {prizesLoading ? (
                <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13 }}>Carregando…</Text>
              ) : prizesIsError ? (
                <Text style={{ color: tokens.color.error, marginTop: 6, fontSize: 13 }}>
                  Erro ao carregar premiação:{" "}
                  {(prizesError as any)?.response?.data?.detail ??
                    (prizesError as any)?.message ??
                    "Tente novamente."}
                </Text>
              ) : (prizes ?? []).length === 0 ? (
                <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13 }}>
                  Nenhuma premiação cadastrada.
                </Text>
              ) : (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {(prizes ?? [])
                    .slice()
                    .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
                    .map((p) => (
                      <View
                        key={p.id}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.10)",
                          backgroundColor: "rgba(255,255,255,0.06)",
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                        }}
                      >
                        <Text style={{ color: onCardText, fontWeight: "900", fontSize: 13 }}>
                          {p.place}º — {p.reward}
                        </Text>
                        <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 2 }}>
                          {fmtPrizeKindPt(p.kind)}
                          {" · "}
                          {fmtModalityPt(p.modality)}
                          {" · "}
                          {fmtGenderPt(p.gender)}
                          {p.faixa_label ? ` · ${p.faixa_label}` : ""}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>

            {selectedRegs.length > 0 ? (
              <View
                style={{
                  backgroundColor: tokens.color.bgCard,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: onCardSubtle,
                  padding: 14,
                }}
              >
                <Text style={{ color: onCardText, fontWeight: "900" }}>
                  {allRegsPaymentCleared ? "Você está inscrito" : "Inscrição em andamento"}
                </Text>
                {!allRegsPaymentCleared ? (
                  <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                    Você só estará inscrito de fato após a confirmação do pagamento pelo organizador. Até lá, pesagem e
                    chave não entram no fluxo do evento.
                  </Text>
                ) : null}
                {selected?.event_starts_at ? (
                  <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                    Início: {fmtDateTime(selected.event_starts_at) ?? "—"}
                  </Text>
                ) : null}
                <View style={{ marginTop: 8, gap: 6 }}>
                  {selectedRegs.map((r) => (
                    <Text key={r.id} style={{ color: onCardMuted, fontSize: 13, lineHeight: 18 }}>
                      {r.kind === "absolute" ? "Absoluto" : "Categoria"}{r.modality ? ` (${r.modality === "nogi" ? "No-Gi" : "Gi"})` : ""}:{" "}
                      {r.kind === "absolute"
                        ? (r.weight_class_label ?? "—")
                        : `${r.age_division_label ?? "—"} · ${r.weight_class_label ?? "—"}`}
                    </Text>
                  ))}
                </View>
                <View
                  style={{
                    marginTop: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: onCardMuted, fontSize: 13 }}>Status:</Text>
                  {(() => {
                    const st = mapRegistrationStatusPt(primaryReg?.status);
                    // Status fica simples (sem destaque). Mantemos destaque só no pagamento.
                    return <Text style={{ color: onCardText, fontWeight: "800", fontSize: 13 }}>{st.label}</Text>;
                  })()}

                  <Text style={{ color: onCardMuted, fontSize: 13 }}>Pagamento:</Text>
                  {(() => {
                    const p = mapPaymentStatusPt(primaryReg?.payment_status);
                    return (
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          backgroundColor: p.bg,
                          borderWidth: 1,
                          borderColor: p.border,
                        }}
                      >
                        <Text style={{ color: p.text, fontWeight: "900", fontSize: 12 }}>{p.label}</Text>
                      </View>
                    );
                  })()}
                </View>

                {(() => {
                  const fee = primaryReg?.registration_fee_amount ?? selected?.registration_fee_amount ?? 0;
                  const hasFee = Number(fee) > 0;
                  if (!hasFee) return null;
                  const ps = String(primaryReg?.payment_status ?? "").toLowerCase();
                  const canAttach = ps === "pending_payment" || ps === "rejected";
                  const inReview = ps === "pending_confirmation";
                  const receipt = receiptUrl(primaryReg?.payment_receipt_path ?? null);
                  const isUploading = uploadingRegId === primaryReg?.id || uploadRegReceiptMutation.isPending;
                  return (
                    <View style={{ marginTop: 12 }}>
                      {primaryReg?.registration_payment_instructions ? (
                        <Text style={{ color: onCardMuted, fontSize: 13, lineHeight: 18 }}>
                          {primaryReg.registration_payment_instructions}
                        </Text>
                      ) : null}

                      {inReview ? (
                        <Text style={{ color: onCardMuted, marginTop: 8, fontSize: 13 }}>
                          Comprovante enviado. Aguardando confirmação do organizador.
                        </Text>
                      ) : null}

                      {receipt ? (
                        <Pressable
                          onPress={() => Linking.openURL(receipt)}
                          style={{
                            marginTop: 10,
                            alignSelf: "flex-start",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(184,158,93,0.35)",
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: "rgba(184,158,93,0.10)",
                          }}
                        >
                          <Text style={{ color: tokens.color.primary, fontWeight: "900" }}>
                            Ver último comprovante
                          </Text>
                        </Pressable>
                      ) : null}

                      {canAttach ? (
                        <Pressable
                          disabled={isUploading}
                          onPress={() => {
                            if (!selected?.id) return;
                            if (!primaryReg?.id) return;
                            handleAttachRegistrationReceipt(selected.id, primaryReg.id);
                          }}
                          style={{
                            marginTop: 10,
                            borderRadius: 14,
                            paddingVertical: 12,
                            alignItems: "center",
                            backgroundColor: tokens.color.primary,
                            opacity: isUploading ? 0.75 : 1,
                          }}
                        >
                          <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>
                            {isUploading ? "Enviando…" : "Anexar comprovante"}
                          </Text>
                        </Pressable>
                      ) : null}

                      {ps === "confirmed" ? (
                        <Text style={{ color: onCardMuted, marginTop: 8, fontSize: 13 }}>
                          Pagamento confirmado.
                        </Text>
                      ) : null}
                    </View>
                  );
                })()}

                <View style={{ marginTop: 14, height: 1, backgroundColor: "rgba(255,255,255,0.10)" }} />

                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: onCardText, fontWeight: "900" }}>Sua chave</Text>
                  {clearedSelectedRegs.length === 0 ? (
                    <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                      Disponível após a confirmação do pagamento. Envie o comprovante (se houver taxa) e aguarde o
                      organizador.
                    </Text>
                  ) : initialMatchLoading || myBracketMatchesLoading ? (
                    <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13 }}>Carregando…</Text>
                  ) : (myBracketMatches ?? []).length === 0 && !myInitialMatch ? (
                    <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13 }}>
                      Chave ainda não gerada para sua categoria.
                    </Text>
                  ) : (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {(myBracketMatches ?? []).map((mm) => {
                        const totalRounds = (myBracketMatches ?? []).reduce((acc, x) => Math.max(acc, (x.round_index ?? 0) + 1), 1);
                        const stageLabel = bracketStageLabelFromTotalRounds(mm.round_index, totalRounds);
                        const resultLabel =
                          mm.my_result === "pending"
                            ? "Pendente"
                            : mm.my_result === "win"
                              ? "Vitória"
                              : mm.my_result === "loss"
                                ? "Derrota"
                                : mm.my_result === "draw"
                                  ? "Empate"
                                  : mm.my_result;

                        return (
                          <View
                            key={mm.match_id}
                            style={{
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: "rgba(184,158,93,0.28)",
                              backgroundColor: "rgba(184,158,93,0.10)",
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                            }}
                          >
                            <Text style={{ color: onCardText, fontWeight: "900", fontSize: 13 }}>
                              {stageLabel} · Oponente: {mm.opponent_name ?? "A definir"}
                            </Text>
                            <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                              Lado: {mm.my_side === "red" ? "Vermelho" : mm.my_side === "blue" ? "Azul" : mm.my_side}
                              {" · "}
                              Status: {mm.match_status}
                            </Text>
                            <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                              Resultado:{" "}
                              <Text
                                style={{
                                  fontWeight: "900",
                                  color:
                                    mm.my_result === "win"
                                      ? "#22c55e"
                                      : mm.my_result === "loss"
                                        ? "#ef4444"
                                        : mm.my_result === "draw"
                                          ? "#f59e0b"
                                          : onCardMuted,
                                }}
                              >
                                {resultLabel}
                              </Text>{" "}
                              · Placar: {mm.red_score}×{mm.blue_score}
                            </Text>
                            <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                              {mm.mat_name ? `Tatame: ${mm.mat_name}` : "Tatame: —"}
                              {" · "}
                              {mm.queue_order != null ? `Ordem: ${mm.queue_order}` : "Ordem: —"}
                            </Text>
                            <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                              Início previsto: {fmtDateTime(mm.estimated_start_at) ?? "—"}
                            </Text>
                          </View>
                        );
                      })}

                      {(myBracketMatches ?? []).length === 0 && myInitialMatch ? (
                        <View
                          style={{
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: "rgba(184,158,93,0.28)",
                            backgroundColor: "rgba(184,158,93,0.10)",
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                          }}
                        >
                          <Text style={{ color: onCardText, fontWeight: "900", fontSize: 13 }}>
                            Oponente: {myInitialMatch.opponent_name ?? "A definir"}
                          </Text>
                          <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                            Lado:{" "}
                            {myInitialMatch.my_side === "red"
                              ? "Vermelho"
                              : myInitialMatch.my_side === "blue"
                                ? "Azul"
                                : myInitialMatch.my_side}
                            {" · "}
                            Status: {myInitialMatch.match_status}
                          </Text>
                          <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                            Resultado:{" "}
                            {myInitialMatch.my_result === "pending"
                              ? "Pendente"
                              : myInitialMatch.my_result === "win"
                                ? "Vitória"
                                : myInitialMatch.my_result === "loss"
                                  ? "Derrota"
                                  : myInitialMatch.my_result === "draw"
                                    ? "Empate"
                                    : myInitialMatch.my_result}
                            {" · "}
                            Placar: {myInitialMatch.red_score}×{myInitialMatch.blue_score}
                          </Text>
                          <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                            {myInitialMatch.mat_name ? `Tatame: ${myInitialMatch.mat_name}` : "Tatame: —"}
                            {" · "}
                            {myInitialMatch.queue_order != null ? `Ordem: ${myInitialMatch.queue_order}` : "Ordem: —"}
                          </Text>
                          <Text style={{ color: onCardMuted, fontSize: 12, marginTop: 4 }}>
                            Início previsto: {fmtDateTime(myInitialMatch.estimated_start_at) ?? "—"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: tokens.color.bgCard,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: onCardSubtle,
                  padding: 14,
                }}
              >
                <Text style={{ color: onCardText, fontWeight: "900" }}>
                  Inscrição
                </Text>
                <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                  {selected?.registration_fee_amount && selected.registration_fee_amount > 0
                    ? `Taxa: R$ ${selected.registration_fee_amount.toFixed(2).replace(".", ",")}`
                    : "Sem taxa de inscrição."}
                </Text>
                {selected?.registration_payment_instructions ? (
                  <Text style={{ color: onCardMuted, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                    {selected.registration_payment_instructions}
                  </Text>
                ) : null}

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={() => {
                    if (user?.role !== "aluno") {
                      Alert.alert("Atenção", "A inscrição pelo app está disponível para contas de aluno.");
                      return;
                    }
                    setEnrollOpen(true);
                    setAgeDivisionId(null);
                    setWeightClassId(null);
                    setAlsoAbsolute(false);
                  }}
                  style={{
                    backgroundColor: tokens.color.primary,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ticket size={18} color={tokens.color.textOnPrimary} />
                  <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "900" }}>
                    {enrollOpen ? "Escolher categoria" : "Inscrever-se"}
                  </Text>
                </Pressable>
              </View>
            )}

            {enrollOpen && selectedRegs.length === 0 ? (
              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    backgroundColor: tokens.color.bgCard,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    padding: 14,
                  }}
                >
                  <Text style={{ color: tokens.color.textPrimary, fontWeight: "900", marginBottom: 10 }}>
                    Seus dados (conta)
                  </Text>
                  <Text style={{ color: tokens.color.textMuted, fontSize: 13 }}>
                    Aluno: {student?.name ?? "—"}
                  </Text>
                  <Text style={{ color: tokens.color.textMuted, marginTop: 4, fontSize: 13 }}>
                    Ano de nascimento: {birthYear ?? "—"}
                  </Text>

                  <View style={{ height: 12 }} />

                  <Text style={{ color: tokens.color.textPrimary, fontWeight: "800" }}>Sexo</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    {(["male", "female"] as const).map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setGender(g)}
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          paddingVertical: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: gender === g ? "rgba(184,158,93,0.5)" : tokens.color.borderSubtle,
                          backgroundColor: gender === g ? "rgba(184,158,93,0.12)" : tokens.color.bgBody,
                        }}
                      >
                        <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>
                          {g === "male" ? "Masculino" : "Feminino"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ height: 12 }} />

                  <Text style={{ color: tokens.color.textPrimary, fontWeight: "800" }}>Modalidade</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    {(["gi", "nogi"] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setModality(m)}
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          paddingVertical: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: modality === m ? "rgba(184,158,93,0.5)" : tokens.color.borderSubtle,
                          backgroundColor: modality === m ? "rgba(184,158,93,0.12)" : tokens.color.bgBody,
                        }}
                      >
                        <Text style={{ color: tokens.color.textPrimary, fontWeight: "900" }}>
                          {m === "gi" ? "Gi" : "No-Gi"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ height: 14 }} />

                  {eligibilityLoading ? (
                    <ActivityIndicator color={tokens.color.primary} />
                  ) : (
                    <>
                      <Text style={{ color: tokens.color.textPrimary, fontWeight: "900", fontSize: 14, letterSpacing: 0.2 }}>
                        Categoria (idade)
                      </Text>
                      <View style={{ marginTop: 10, gap: 10 }}>
                        {(eligibility?.age_divisions ?? []).map((opt) => (
                          <Pressable
                            key={opt.age_division.id}
                            onPress={() => {
                              setAgeDivisionId(opt.age_division.id);
                              setWeightClassId(null);
                            }}
                            style={{
                              borderRadius: 16,
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              borderWidth: 1,
                              borderColor:
                                ageDivisionId === opt.age_division.id
                                  ? "rgba(184,158,93,0.75)"
                                  : tokens.color.borderSubtle,
                              backgroundColor:
                                ageDivisionId === opt.age_division.id
                                  ? "rgba(184,158,93,0.16)"
                                  : "rgba(255,255,255,0.03)",
                              shadowColor: "rgba(0,0,0,0.6)",
                              shadowOpacity: ageDivisionId === opt.age_division.id ? 0.22 : 0.12,
                              shadowRadius: ageDivisionId === opt.age_division.id ? 16 : 10,
                              shadowOffset: { width: 0, height: 6 },
                              elevation: ageDivisionId === opt.age_division.id ? 6 : 3,
                            }}
                          >
                            <Text style={{ color: tokens.color.textPrimary, fontWeight: "950", fontSize: 15, letterSpacing: 0.1 }}>
                              {opt.age_division.label}
                            </Text>
                          </Pressable>
                        ))}
                        {(eligibility?.age_divisions ?? []).length === 0 ? (
                          <Text style={{ color: tokens.color.textMuted, fontSize: 13 }}>
                            Não há categorias compatíveis com seus dados.
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ height: 16 }} />

                      <Text style={{ color: tokens.color.textPrimary, fontWeight: "900", fontSize: 14, letterSpacing: 0.2 }}>
                        Categoria (peso)
                      </Text>
                      <View style={{ marginTop: 10, gap: 10 }}>
                        {(eligibility?.weight_classes ?? [])
                          .filter((w) => (ageDivisionId ? w.weight_class.age_division_id === ageDivisionId : true))
                          .map((w) => (
                            <Pressable
                              key={w.weight_class.id}
                              onPress={() => setWeightClassId(w.weight_class.id)}
                              style={{
                                borderRadius: 16,
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                borderWidth: 1,
                                borderColor:
                                  weightClassId === w.weight_class.id
                                    ? "rgba(184,158,93,0.75)"
                                    : tokens.color.borderSubtle,
                                backgroundColor:
                                  weightClassId === w.weight_class.id
                                    ? "rgba(184,158,93,0.16)"
                                    : "rgba(255,255,255,0.03)",
                                shadowColor: "rgba(0,0,0,0.6)",
                                shadowOpacity: weightClassId === w.weight_class.id ? 0.22 : 0.12,
                                shadowRadius: weightClassId === w.weight_class.id ? 16 : 10,
                                shadowOffset: { width: 0, height: 6 },
                                elevation: weightClassId === w.weight_class.id ? 6 : 3,
                              }}
                            >
                              <Text style={{ color: tokens.color.textPrimary, fontWeight: "950", fontSize: 15, letterSpacing: 0.1 }}>
                                {w.weight_class.weight_interval_label ?? w.weight_class.label}
                              </Text>
                              <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12.5, marginTop: 3, lineHeight: 16 }}>
                                {w.weight_class.label}
                              </Text>
                            </Pressable>
                          ))}
                      </View>

                      <View style={{ height: 16 }} />

                      <Pressable
                        onPress={() => setAlsoAbsolute((v) => !v)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          marginTop: 2,
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: alsoAbsolute ? "rgba(184,158,93,0.75)" : tokens.color.borderSubtle,
                          backgroundColor: alsoAbsolute ? "rgba(184,158,93,0.14)" : "rgba(255,255,255,0.02)",
                          shadowColor: "rgba(0,0,0,0.6)",
                          shadowOpacity: alsoAbsolute ? 0.18 : 0.1,
                          shadowRadius: alsoAbsolute ? 14 : 10,
                          shadowOffset: { width: 0, height: 6 },
                          elevation: alsoAbsolute ? 5 : 3,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: alsoAbsolute ? tokens.color.primary : tokens.color.borderSubtle,
                            backgroundColor: alsoAbsolute ? "rgba(184,158,93,0.18)" : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {alsoAbsolute ? (
                            <Text style={{ color: tokens.color.primary, fontWeight: "900", marginTop: -1 }}>✓</Text>
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: tokens.color.textPrimary, fontWeight: "950", fontSize: 14.5, letterSpacing: 0.1 }}>
                            Participar do absoluto da faixa
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 12.5, marginTop: 3, lineHeight: 16 }}>
                            Inscrição adicional (sem idade/peso) na modalidade selecionada.
                          </Text>
                        </View>
                      </Pressable>

                      <View style={{ height: 14 }} />

                      <Pressable
                        disabled={enrollMutation.isPending}
                        onPress={() => enrollMutation.mutate()}
                        style={{
                          backgroundColor: tokens.color.primary,
                          borderRadius: 16,
                          paddingVertical: 14,
                          alignItems: "center",
                          opacity: enrollMutation.isPending ? 0.85 : 1,
                          shadowColor: "rgba(0,0,0,0.7)",
                          shadowOpacity: 0.22,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 8,
                        }}
                      >
                        <Text style={{ color: tokens.color.textOnPrimary, fontWeight: "950", fontSize: 15, letterSpacing: 0.2 }}>
                          {enrollMutation.isPending ? "Inscrevendo…" : "Confirmar inscrição"}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
