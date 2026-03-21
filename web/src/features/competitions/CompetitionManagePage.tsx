import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { tokens } from "../../ui/tokens";
import type {
  AgeDivision,
  ApplyFederationPresetResponse,
  BeltEligibility,
  Competition,
  CompetitionMatch,
  CompetitionBracket,
  CompetitionMat,
  FederationPresetSummary,
  Registration,
  WeightClass,
} from "./types";
import { bracketStageLabel, totalRoundsByBracketIdFromMatches } from "./bracketLabels";

/** Em lutas completas com vencedor definido, destaca o nome do vencedor. */
function completedMatchAthleteStyles(m: CompetitionMatch): { red: CSSProperties; blue: CSSProperties } {
  if (m.match_status !== "completed" || m.winner_registration_id == null) {
    return { red: {}, blue: {} };
  }
  const wid = m.winner_registration_id;
  const redWon = m.red_registration_id != null && wid === m.red_registration_id;
  const blueWon = m.blue_registration_id != null && wid === m.blue_registration_id;
  const win: CSSProperties = {
    fontWeight: 800,
    color: tokens.color.textPrimary,
  };
  const lose: CSSProperties = {
    fontWeight: 500,
    color: tokens.color.textMuted,
    opacity: 0.82,
  };
  return {
    red: redWon ? win : lose,
    blue: blueWon ? win : lose,
  };
}

type Faixa = { id: number; name: string };

export function CompetitionManagePage() {
  const { id } = useParams<{ id: string }>();
  const competitionId = Number(id);
  const qc = useQueryClient();

  const [adLabel, setAdLabel] = useState("");
  const [adMin, setAdMin] = useState(2010);
  const [adMax, setAdMax] = useState(2012);
  const [wcAd, setWcAd] = useState<number | "">("");
  const [wcGender, setWcGender] = useState<"male" | "female">("male");
  const [wcModality, setWcModality] = useState<"gi" | "nogi">("gi");
  const [wcLabel, setWcLabel] = useState("");
  const [wcMax, setWcMax] = useState("");
  const [beltAd, setBeltAd] = useState<number | "">("");
  const [beltGender, setBeltGender] = useState<"male" | "female">("male");
  const [beltFaixa, setBeltFaixa] = useState<number | "">("");
  const [weighKg, setWeighKg] = useState("");
  const [selReg, setSelReg] = useState<Registration | null>(null);
  const [brAd, setBrAd] = useState<number | "">("");
  const [brWc, setBrWc] = useState<number | "">("");
  const [brGender, setBrGender] = useState<"male" | "female">("male");
  const [matName, setMatName] = useState("Tatame 1");
  const [coachData, setCoachData] = useState<{ fights: unknown[]; conflicts: unknown[] } | null>(null);
  const [presetCode, setPresetCode] = useState("");
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<"geral" | "inscritos" | "financeiro" | "operacao" | "podios">("geral");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeInstr, setFeeInstr] = useState("");
  const [inscritosQ, setInscritosQ] = useState("");
  const [opSubTab, setOpSubTab] = useState<"pesagem" | "chaves" | "tatames" | "lutas">("pesagem");
  const [eventStartsAtLocal, setEventStartsAtLocal] = useState<string>("");
  const [bracketsMsg, setBracketsMsg] = useState<string | null>(null);
  const [collapsedWeighGroups, setCollapsedWeighGroups] = useState<Record<string, boolean>>({});
  const [collapsedFaixaGroups, setCollapsedFaixaGroups] = useState<Set<string>>(new Set());
  const [podioSubTab, setPodioSubTab] = useState<"individual" | "equipes">("individual");
  const [weighGroupFilters, setWeighGroupFilters] = useState<
    Record<string, { q: string; weightClassId: number | "all" }>
  >({});
  const [fightFilterFaixa, setFightFilterFaixa] = useState<string>("all");
  const [fightFilterAgeDivision, setFightFilterAgeDivision] = useState<number | "all">("all");
  const [fightFilterWeightClass, setFightFilterWeightClass] = useState<number | "all">("all");

  const { data: comp } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: async () => {
      const res = await api.get<Competition>(`/api/competitions/${competitionId}`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: divisions } = useQuery({
    queryKey: ["comp-ad", competitionId],
    queryFn: async () => {
      const res = await api.get<AgeDivision[]>(`/api/competitions/${competitionId}/age-divisions`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: weights } = useQuery({
    queryKey: ["comp-wc", competitionId],
    queryFn: async () => {
      const res = await api.get<WeightClass[]>(`/api/competitions/${competitionId}/weight-classes`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: belts } = useQuery({
    queryKey: ["comp-belt", competitionId],
    queryFn: async () => {
      const res = await api.get<BeltEligibility[]>(`/api/competitions/${competitionId}/belt-eligibility`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: faixas } = useQuery({
    queryKey: ["faixas"],
    queryFn: async () => {
      const res = await api.get<Faixa[]>("/api/faixas/");
      return res.data;
    },
  });

  const { data: federationPresets } = useQuery({
    queryKey: ["federation-presets"],
    queryFn: async () => {
      const res = await api.get<FederationPresetSummary[]>("/api/competitions/federation-presets");
      return res.data;
    },
  });

  const {
    data: regs,
    isPending: regsPending,
    isFetching: regsFetching,
  } = useQuery({
    queryKey: ["comp-regs", competitionId],
    queryFn: async () => {
      const res = await api.get<Registration[]>(`/api/competitions/${competitionId}/registrations`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const weighFaixaGroups = useMemo(() => {
    // Para a operação, escondemos da lista quem já finalizou a pesagem.
    const list = (regs ?? []).filter((r) => !["weighed_in", "disqualified"].includes(r.status));
    type Group = { key: string; faixaId: number | null; label: string; items: Registration[] };
    const byKey = new Map<string, Group>();
    for (const r of list) {
      const faixaId = r.student_faixa_id ?? null;
      const label = r.student_faixa_label ?? r.student_external_faixa_label ?? "Sem faixa";
      const key = faixaId != null ? `id:${faixaId}` : `label:${label}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.items.push(r);
        continue;
      }
      byKey.set(key, { key, faixaId, label, items: [r] });
    }
    const groups = Array.from(byKey.values());
    groups.forEach((g) => {
      g.items.sort((a, b) => {
        const an = String(a.student_name ?? "");
        const bn = String(b.student_name ?? "");
        const anCmp = an.localeCompare(bn, "pt");
        if (anCmp !== 0) return anCmp;
        return String(a.registration_public_code).localeCompare(String(b.registration_public_code), "pt");
      });
    });
    groups.sort((a, b) => {
      if (a.faixaId == null && b.faixaId != null) return 1;
      if (a.faixaId != null && b.faixaId == null) return -1;
      if (a.faixaId != null && b.faixaId != null) return a.faixaId - b.faixaId;
      return a.label.localeCompare(b.label, "pt");
    });
    return groups;
  }, [regs]);

  // Por padrão, faixas na pesagem ficam minimizadas.
  // Mantém a interação do usuário: só inicializa grupos que ainda não existem no estado.
  useEffect(() => {
    if (!weighFaixaGroups.length) return;
    setCollapsedWeighGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of weighFaixaGroups) {
        if (next[g.key] === undefined) {
          next[g.key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [weighFaixaGroups]);

  function weighGroupKeyForRegistration(r: Registration): string {
    const faixaId = r.student_faixa_id ?? null;
    const label = r.student_faixa_label ?? r.student_external_faixa_label ?? "Sem faixa";
    return faixaId != null ? `id:${faixaId}` : `label:${label}`;
  }

  function registrationFaixaLabel(r: Registration | null | undefined): string {
    if (!r) return "—";
    return r.student_faixa_label ?? r.student_external_faixa_label ?? "Sem faixa";
  }

  function registrationFaixaKey(r: Registration | null | undefined): string {
    if (!r) return "—";
    return weighGroupKeyForRegistration(r);
  }

  function isoToDatetimeLocalValue(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalValueToIso(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed); // datetime-local => interpretação em hora local
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }

  function formatIsoAsPtBr(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  const weighedInCount = useMemo(() => {
    return (regs ?? []).filter((r) => r.status === "weighed_in").length;
  }, [regs]);

  // Garante que a lista de pesagem reflita mudanças feitas fora da UI
  // (ex.: script de seed, pesagem e outras operações no back).
  useEffect(() => {
    if (manageTab !== "operacao" || opSubTab !== "pesagem") return;
    qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] });
  }, [manageTab, opSubTab, competitionId, qc]);

  // Evita "cache vazio" após seed/alterações no back: ao abrir a aba Inscritos,
  // sempre refaz a busca das inscrições.
  useEffect(() => {
    if (!Number.isFinite(competitionId)) return;
    if (manageTab !== "inscritos" && manageTab !== "financeiro" && manageTab !== "operacao" && manageTab !== "podios") return;
    qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] });
  }, [manageTab, competitionId, qc]);

  useEffect(() => {
    if (manageTab !== "podios") return;
    qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] });
    qc.invalidateQueries({ queryKey: ["comp-brackets", competitionId] });
  }, [manageTab, competitionId, qc]);

  const { data: mats } = useQuery({
    queryKey: ["comp-mats", competitionId],
    queryFn: async () => {
      const res = await api.get<CompetitionMat[]>(`/api/competitions/${competitionId}/mats`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: matches } = useQuery({
    queryKey: ["comp-matches", competitionId],
    queryFn: async () => {
      const res = await api.get<CompetitionMatch[]>(`/api/competitions/${competitionId}/matches`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const { data: brackets } = useQuery({
    queryKey: ["comp-brackets", competitionId],
    queryFn: async () => {
      const res = await api.get<CompetitionBracket[]>(`/api/competitions/${competitionId}/brackets`);
      return res.data;
    },
    enabled: Number.isFinite(competitionId),
  });

  const regById = useMemo(() => {
    const m = new Map<number, Registration>();
    for (const r of regs ?? []) m.set(r.id, r);
    return m;
  }, [regs]);

  const matchById = useMemo(() => {
    const m = new Map<number, CompetitionMatch>();
    for (const mm of matches ?? []) m.set(mm.id, mm);
    return m;
  }, [matches]);

  const matchesByBracketId = useMemo(() => {
    const m = new Map<number, CompetitionMatch[]>();
    for (const mm of matches ?? []) {
      const arr = m.get(mm.bracket_id);
      if (arr) arr.push(mm);
      else m.set(mm.bracket_id, [mm]);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.round_index - b.round_index || a.position_in_round - b.position_in_round);
    }
    return m;
  }, [matches]);

  const totalRoundsByBracketId = useMemo(
    () => totalRoundsByBracketIdFromMatches(matches ?? []),
    [matches],
  );

  /** Mesma ideia do backend (weighed_in): define a profundidade real da chave para rótulos (ex.: 2 atletas = só Final). */
  const bracketAthleteCountByBracketId = useMemo(() => {
    const map = new Map<number, number>();
    for (const br of brackets ?? []) {
      const n = (regs ?? []).filter(
        (r) =>
          r.age_division_id === br.age_division_id &&
          r.weight_class_id === br.weight_class_id &&
          r.gender === br.gender &&
          r.status === "weighed_in",
      ).length;
      map.set(br.id, n);
    }
    return map;
  }, [brackets, regs]);

  const bracketById = useMemo(() => {
    const m = new Map<number, CompetitionBracket>();
    for (const br of brackets ?? []) m.set(br.id, br);
    return m;
  }, [brackets]);

  /** Dados de pódio por bracket: Ouro, Prata e Bronzes (duplo) derivados das lutas. */
  /** Pódios agrupados por faixa. Cada grupo contém os brackets em que aquela faixa tem atletas. */
  const podiumByFaixa = useMemo(() => {
    type MedalEntry = {
      medal: "gold" | "silver" | "bronze";
      regId: number;
      name: string;
      dojo: string;
      code: string;
    };
    type BracketPodium = {
      bracketId: number;
      catLabel: string;
      entries: MedalEntry[];
      pendingFinal: boolean;
      pendingSemiCount: number;
    };
    type FaixaGroup = {
      faixaKey: string;
      faixaLabel: string;
      brackets: BracketPodium[];
    };

    // Passo 1: calcular placementos a partir das lutas
    const placements = new Map<number, "gold" | "silver" | "bronze">();
    for (const br of brackets ?? []) {
      const brMatches = matchesByBracketId.get(br.id) ?? [];
      if (!brMatches.length) {
        // WO: único atleta pesado
        const woReg = (regs ?? []).find(
          (r) =>
            r.age_division_id === br.age_division_id &&
            r.weight_class_id === br.weight_class_id &&
            r.gender === br.gender &&
            r.status === "weighed_in",
        );
        if (woReg) placements.set(woReg.id, "gold");
        continue;
      }
      const maxRound = Math.max(...brMatches.map((m) => m.round_index));
      const finalMatch = brMatches.find((m) => m.round_index === maxRound);
      if (finalMatch?.match_status === "completed") {
        if (finalMatch.winner_registration_id) placements.set(finalMatch.winner_registration_id, "gold");
        const silverId =
          finalMatch.winner_registration_id === finalMatch.red_registration_id
            ? finalMatch.blue_registration_id
            : finalMatch.red_registration_id;
        if (silverId) placements.set(silverId, "silver");
      }
      if (maxRound >= 1) {
        for (const sf of brMatches.filter((m) => m.round_index === maxRound - 1 && m.match_status === "completed")) {
          const loserId =
            sf.winner_registration_id === sf.red_registration_id
              ? sf.blue_registration_id
              : sf.red_registration_id;
          if (loserId) placements.set(loserId, "bronze");
        }
      }
    }

    // Passo 2: agrupar brackets por faixa
    const faixaGroupMap = new Map<string, { label: string; brackets: Map<number, BracketPodium> }>();

    for (const br of brackets ?? []) {
      const brMatches = matchesByBracketId.get(br.id) ?? [];
      const adLbl = (divisions ?? []).find((d) => d.id === br.age_division_id)?.label ?? `Div ${br.age_division_id}`;
      const wc = (weights ?? []).find((w) => w.id === br.weight_class_id);
      const wcLbl = wc ? `[${wc.modality ?? "gi"}] ${wc.label}` : `Peso ${br.weight_class_id}`;
      const genderLbl = br.gender === "male" ? "Masculino" : br.gender === "female" ? "Feminino" : br.gender;
      const catLabel = `${adLbl} — ${wcLbl} (${genderLbl})`;

      // Atletas pesados neste bracket
      const brRegs = (regs ?? []).filter(
        (r) =>
          r.age_division_id === br.age_division_id &&
          r.weight_class_id === br.weight_class_id &&
          r.gender === br.gender &&
          r.status === "weighed_in",
      );

      // Contadores de pendência
      let pendingFinal = false;
      let pendingSemiCount = 0;
      if (brMatches.length > 0) {
        const maxRound = Math.max(...brMatches.map((m) => m.round_index));
        const finalMatch = brMatches.find((m) => m.round_index === maxRound);
        pendingFinal = !finalMatch || finalMatch.match_status !== "completed";
        if (maxRound >= 1) {
          pendingSemiCount = brMatches.filter(
            (m) => m.round_index === maxRound - 1 && m.match_status !== "completed",
          ).length;
        }
      }

      // Agrupa atletas por faixa
      const faixaToRegs = new Map<string, { label: string; regs: typeof brRegs }>();
      for (const reg of brRegs) {
        const fk = registrationFaixaKey(reg);
        const fl = registrationFaixaLabel(reg);
        if (!faixaToRegs.has(fk)) faixaToRegs.set(fk, { label: fl, regs: [] });
        faixaToRegs.get(fk)!.regs.push(reg);
      }

      for (const [faixaKey, { label: faixaLabel, regs: faixaRegs }] of faixaToRegs) {
        if (!faixaGroupMap.has(faixaKey)) faixaGroupMap.set(faixaKey, { label: faixaLabel, brackets: new Map() });
        const group = faixaGroupMap.get(faixaKey)!;

        const entries: MedalEntry[] = [];
        for (const reg of faixaRegs) {
          const medal = placements.get(reg.id);
          if (medal) {
            entries.push({
              medal,
              regId: reg.id,
              name: reg.student_name ?? `Atleta #${reg.id}`,
              dojo: reg.student_dojo_name ?? reg.student_external_dojo_name ?? "—",
              code: reg.registration_public_code,
            });
          }
        }
        const medalOrder = { gold: 0, silver: 1, bronze: 2 };
        entries.sort((a, b) => medalOrder[a.medal] - medalOrder[b.medal]);

        group.brackets.set(br.id, { bracketId: br.id, catLabel, entries, pendingFinal, pendingSemiCount });
      }
    }

    // Ordem padrão de faixas BJJ
    const FAIXA_ORDER = ["branca", "cinza", "amarela", "laranja", "verde", "azul", "roxa", "marrom", "preta", "coral", "vermelha"];
    const faixaOrderFn = (label: string) => {
      const lower = label.toLowerCase();
      const idx = FAIXA_ORDER.findIndex((f) => lower.includes(f));
      return idx === -1 ? 99 : idx;
    };

    const groups: FaixaGroup[] = Array.from(faixaGroupMap.entries())
      .map(([faixaKey, { label, brackets }]) => ({
        faixaKey,
        faixaLabel: label,
        brackets: Array.from(brackets.values()).sort((a, b) => a.catLabel.localeCompare(b.catLabel, "pt")),
      }))
      .sort((a, b) => faixaOrderFn(a.faixaLabel) - faixaOrderFn(b.faixaLabel));

    return groups;
  }, [brackets, matchesByBracketId, regById, divisions, weights, regs]);

  /**
   * Classificação por equipes: pontos acumulados de todas as medalhas conquistadas em lutas reais.
   * WO direto (bracket sem lutas) não soma pontos para o ranking de equipes.
   * Pontuação padrão: Ouro = 9, Prata = 3, Bronze = 1 (bronze duplo: 1 pt cada).
   */
  const teamStandings = useMemo(() => {
    type TeamEntry = {
      name: string;
      points: number;
      golds: number;
      silvers: number;
      bronzes: number;
    };

    const POINTS = { gold: 9, silver: 3, bronze: 1 } as const;

    // Apenas brackets com lutas reais contam pontos
    const bracketHasMatches = new Set<number>();
    for (const br of brackets ?? []) {
      if ((matchesByBracketId.get(br.id) ?? []).length > 0) bracketHasMatches.add(br.id);
    }

    const teamMap = new Map<string, TeamEntry>();

    const addMedal = (regId: number | null | undefined, medal: keyof typeof POINTS) => {
      if (!regId) return;
      const reg = regById.get(regId);
      if (!reg) return;
      const name = reg.student_dojo_name ?? reg.student_external_dojo_name ?? "Sem equipe";
      if (!teamMap.has(name)) teamMap.set(name, { name, points: 0, golds: 0, silvers: 0, bronzes: 0 });
      const e = teamMap.get(name)!;
      e.points += POINTS[medal];
      if (medal === "gold") e.golds++;
      else if (medal === "silver") e.silvers++;
      else e.bronzes++;
    };

    for (const br of brackets ?? []) {
      if (!bracketHasMatches.has(br.id)) continue;

      const brMatches = matchesByBracketId.get(br.id) ?? [];
      const maxRound = Math.max(...brMatches.map((m) => m.round_index));
      const finalMatch = brMatches.find((m) => m.round_index === maxRound);

      if (finalMatch?.match_status === "completed") {
        addMedal(finalMatch.winner_registration_id, "gold");
        const silverId =
          finalMatch.winner_registration_id === finalMatch.red_registration_id
            ? finalMatch.blue_registration_id
            : finalMatch.red_registration_id;
        addMedal(silverId, "silver");
      }

      if (maxRound >= 1) {
        for (const sf of brMatches.filter((m) => m.round_index === maxRound - 1 && m.match_status === "completed")) {
          const loserId =
            sf.winner_registration_id === sf.red_registration_id
              ? sf.blue_registration_id
              : sf.red_registration_id;
          addMedal(loserId, "bronze");
        }
      }
    }

    return Array.from(teamMap.values()).sort(
      (a, b) =>
        b.points - a.points ||
        b.golds - a.golds ||
        b.silvers - a.silvers ||
        b.bronzes - a.bronzes,
    );
  }, [brackets, matchesByBracketId, regById]);

  const bracketsFaixaGroups = useMemo(() => {
    type Group = {
      key: string;
      label: string;
      byBracketId: Map<number, CompetitionMatch[]>;
    };

    const out = new Map<string, Group>();

    const ensureGroup = (faixaKey: string, label: string) => {
      const existing = out.get(faixaKey);
      if (existing) return existing;
      const g: Group = { key: faixaKey, label, byBracketId: new Map<number, CompetitionMatch[]>() };
      out.set(faixaKey, g);
      return g;
    };

    for (const br of brackets ?? []) {
      const brMatches = matchesByBracketId.get(br.id) ?? [];

      for (const m of brMatches) {
        const red = m.red_registration_id != null ? regById.get(m.red_registration_id) ?? null : null;
        const blue = m.blue_registration_id != null ? regById.get(m.blue_registration_id) ?? null : null;

        const faixaKeyToLabelLocal = new Map<string, string>();
        if (red) {
          const k = registrationFaixaKey(red);
          faixaKeyToLabelLocal.set(k, registrationFaixaLabel(red));
        }
        if (blue) {
          const k = registrationFaixaKey(blue);
          faixaKeyToLabelLocal.set(k, registrationFaixaLabel(blue));
        }

        if (faixaKeyToLabelLocal.size === 0) {
          faixaKeyToLabelLocal.set("label:Sem faixa", "Sem faixa");
        }

        for (const [fk, lbl] of faixaKeyToLabelLocal.entries()) {
          const g = ensureGroup(fk, lbl);
          const arr = g.byBracketId.get(br.id) ?? [];
          arr.push(m);
          g.byBracketId.set(br.id, arr);
        }
      }
    }

    const groups = Array.from(out.values());
    groups.sort((a, b) => a.label.localeCompare(b.label, "pt"));
    // Ordena cada lista para garantir estabilidade caso tenha sido incluída em múltiplas faixas.
    for (const g of groups) {
      for (const arr of g.byBracketId.values()) {
        arr.sort((a, b) => a.round_index - b.round_index || a.position_in_round - b.position_in_round);
      }
    }
    return groups;
  }, [brackets, matchesByBracketId, regById]);

  const matchViews = useMemo(() => {
    const regById = new Map<number, Registration>();
    for (const r of regs ?? []) regById.set(r.id, r);

    type MatchView = {
      match: CompetitionMatch;
      red: Registration | null;
      blue: Registration | null;
      faixaKeys: string[];
      faixaLabels: string[];
      faixaKeyToLabel: Record<string, string>;
      age_division_id: number | null;
      age_division_label: string;
      weight_class_id: number | null;
      weight_class_label: string;
      catKey: string;
      catLabel: string;
    };

    const list: MatchView[] = [];
    for (const m of matches ?? []) {
      const red = m.red_registration_id != null ? regById.get(m.red_registration_id) ?? null : null;
      const blue = m.blue_registration_id != null ? regById.get(m.blue_registration_id) ?? null : null;

      let age_division_id = red?.age_division_id ?? blue?.age_division_id ?? null;
      let age_division_label =
        red?.age_division_label ?? blue?.age_division_label ?? (age_division_id != null ? `Div ${age_division_id}` : "—");

      let weight_class_id = red?.weight_class_id ?? blue?.weight_class_id ?? null;
      let weight_class_label =
        red?.weight_class_label ?? blue?.weight_class_label ?? (weight_class_id != null ? `Peso ${weight_class_id}` : "—");

      let faixaKeyToLabel: Record<string, string> = {};
      if (red) {
        const k = registrationFaixaKey(red);
        faixaKeyToLabel[k] = registrationFaixaLabel(red);
      }
      if (blue) {
        const k = registrationFaixaKey(blue);
        faixaKeyToLabel[k] = registrationFaixaLabel(blue);
      }

      if (!red && !blue) {
        const br = bracketById.get(m.bracket_id);
        if (!br) continue;
        age_division_id = br.age_division_id;
        weight_class_id = br.weight_class_id;
        age_division_label =
          (divisions ?? []).find((d) => d.id === br.age_division_id)?.label ?? `Div ${br.age_division_id}`;
        const wc = (weights ?? []).find((w) => w.id === br.weight_class_id);
        weight_class_label = wc ? `[${wc.modality ?? "gi"}] ${wc.label}` : `Peso ${br.weight_class_id}`;

        // Para lutas sem atletas atribuídos: derivar faixa dos vencedores já conhecidos
        // dos feeders (para o atleta avançar visualmente). NÃO herdar todas as faixas do
        // bracket — isso causaria que uma luta vazia aparecesse em todos os filtros de faixa,
        // fazendo parecer que vários atletas estão em muitas lutas.
        for (const feederId of [m.feeder_red_match_id, m.feeder_blue_match_id]) {
          if (feederId == null) continue;
          const feeder = matchById.get(feederId);
          if (!feeder?.winner_registration_id) continue;
          const winner = regById.get(feeder.winner_registration_id);
          if (!winner) continue;
          const k = registrationFaixaKey(winner);
          faixaKeyToLabel[k] = registrationFaixaLabel(winner);
        }

        // Nenhum vencedor de feeder ainda: marca como "A definir" para aparecer apenas
        // no filtro "Todas as faixas" e não poluir filtros de faixa específicos.
        if (Object.keys(faixaKeyToLabel).length === 0) {
          faixaKeyToLabel["label:A definir"] = "A definir";
        }
      }

      const catKey = `age:${age_division_id ?? "na"}|wc:${weight_class_id ?? "na"}`;
      const catLabel = `${age_division_label} — ${weight_class_label}`;

      list.push({
        match: m,
        red,
        blue,
        faixaKeys: Object.keys(faixaKeyToLabel),
        faixaLabels: Array.from(new Set(Object.values(faixaKeyToLabel))),
        faixaKeyToLabel,
        age_division_id,
        age_division_label,
        weight_class_id,
        weight_class_label,
        catKey,
        catLabel,
      });
    }

    return list;
  }, [matches, regs, bracketById, matchById, divisions, weights]);

  const filteredMatchViews = useMemo(() => {
    return matchViews.filter((v) => {
      if (fightFilterFaixa !== "all" && !v.faixaKeys.includes(fightFilterFaixa)) return false;
      if (fightFilterAgeDivision !== "all" && v.age_division_id !== fightFilterAgeDivision) return false;
      if (fightFilterWeightClass !== "all" && v.weight_class_id !== fightFilterWeightClass) return false;
      return true;
    });
  }, [matchViews, fightFilterFaixa, fightFilterAgeDivision, fightFilterWeightClass]);

  const faixaFilterOptions = useMemo(() => {
    const out = new Map<string, string>();
    for (const v of matchViews) {
      for (const [k, label] of Object.entries(v.faixaKeyToLabel)) {
        // "A definir" não é uma faixa real — não adicionar como opção de filtro
        if (k === "label:A definir") continue;
        out.set(k, label);
      }
    }
    return Array.from(out.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt"));
  }, [matchViews]);

  const faixaKeyToLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of faixaFilterOptions) m.set(o.key, o.label);
    return m;
  }, [faixaFilterOptions]);

  const ageDivisionOptions = useMemo(() => {
    const out = new Map<number, string>();
    for (const v of matchViews) {
      if (v.age_division_id != null) out.set(v.age_division_id, v.age_division_label);
    }
    return Array.from(out.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.id - b.id);
  }, [matchViews]);

  const weightClassOptions = useMemo(() => {
    const out = new Map<number, string>();
    for (const v of matchViews) {
      if (v.weight_class_id != null) out.set(v.weight_class_id, v.weight_class_label);
    }
    return Array.from(out.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.id - b.id);
  }, [matchViews]);

  const groupedMatches = useMemo(() => {
    const out = new Map<string, Map<string, { catKey: string; catLabel: string; items: any[] }>>();

    for (const v of filteredMatchViews) {
      const assignFaixas =
        fightFilterFaixa === "all" ? v.faixaKeys : [fightFilterFaixa];

      // Dedup por faixa e luta
      const dedupFaixaKeys = Array.from(new Set(assignFaixas));
      for (const fk of dedupFaixaKeys) {
        if (!out.has(fk)) out.set(fk, new Map());
        const catMap = out.get(fk)!;
        if (!catMap.has(v.catKey)) catMap.set(v.catKey, { catKey: v.catKey, catLabel: v.catLabel, items: [] });
        catMap.get(v.catKey)!.items.push(v);
      }
    }
    return out;
  }, [filteredMatchViews, fightFilterFaixa]);

  const uploadBannerMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<Competition>(`/api/competitions/${competitionId}/banner`, fd);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", competitionId] }),
  });

  const publishMut = useMutation({
    mutationFn: async (is_published: boolean) => {
      await api.patch(`/api/competitions/${competitionId}`, { is_published });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competition", competitionId] }),
  });

  const applyPresetMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post<ApplyFederationPresetResponse>(
        `/api/competitions/${competitionId}/apply-federation-preset`,
        { preset_code: code },
      );
      return res.data;
    },
    onSuccess: (data) => {
      const skip =
        data.skipped_belt_keys?.length ?
          ` Faixas sem correspondência no dojo (adicione manualmente na secção «Faixas permitidas»): ${data.skipped_belt_keys.join(", ")}.`
          : "";
      setPresetMsg(
        `Modelo aplicado (${data.preset_code}). Ano de referência: ${data.reference_year_used}. ` +
          `Idades: ${data.age_divisions_created}, pesos: ${data.weight_classes_created}, faixas: ${data.belt_eligibility_created}.${skip}`,
      );
      qc.invalidateQueries({ queryKey: ["comp-ad", competitionId] });
      qc.invalidateQueries({ queryKey: ["comp-wc", competitionId] });
      qc.invalidateQueries({ queryKey: ["comp-belt", competitionId] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { detail?: string | Record<string, unknown> } } };
      const d = ax.response?.data?.detail;
      if (typeof d === "string") setPresetMsg(d);
      else if (d && typeof d === "object") {
        const msg = "message" in d ? String((d as { message: string }).message) : "Não foi possível aplicar o modelo.";
        const miss = (d as { missing_belt_keys?: string[] }).missing_belt_keys;
        setPresetMsg(miss?.length ? `${msg} Faltam faixas: ${miss.join(", ")}.` : msg);
      } else setPresetMsg("Não foi possível aplicar o modelo.");
    },
  });

  const addAd = useMutation({
    mutationFn: async () => {
      await api.post(`/api/competitions/${competitionId}/age-divisions`, {
        label: adLabel,
        birth_year_min: adMin,
        birth_year_max: adMax,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-ad", competitionId] }),
  });

  const addWc = useMutation({
    mutationFn: async () => {
      if (wcAd === "") return;
      await api.post(`/api/competitions/${competitionId}/weight-classes`, {
        age_division_id: wcAd,
        gender: wcGender,
        modality: wcModality,
        label: wcLabel,
        max_weight_kg: wcMax === "" ? null : Number(wcMax),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-wc", competitionId] }),
  });

  const addBelt = useMutation({
    mutationFn: async () => {
      if (beltAd === "" || beltFaixa === "") return;
      await api.post(`/api/competitions/${competitionId}/belt-eligibility`, {
        age_division_id: beltAd,
        gender: beltGender,
        faixa_id: beltFaixa,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-belt", competitionId] }),
  });

  const genBracket = useMutation({
    mutationFn: async () => {
      if (brAd === "" || brWc === "") return;
      await api.post(`/api/competitions/${competitionId}/brackets/generate`, {}, {
        params: { age_division_id: brAd, weight_class_id: brWc, gender: brGender },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] });
      qc.invalidateQueries({ queryKey: ["comp-brackets", competitionId] });
    },
  });

  const genAllBrackets = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/competitions/${competitionId}/brackets/generate-all`, {});
      return res.data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] });
      qc.invalidateQueries({ queryKey: ["comp-brackets", competitionId] });
      setBracketsMsg(`Chaves geradas: ${d.generated_brackets}. Classes sem chave (menos de 2 pesados): ${d.skipped_weight_classes}.`);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { detail?: string } } };
      const detail = ax.response?.data?.detail;
      setBracketsMsg(detail ? String(detail) : "Não foi possível gerar todas as chaves.");
    },
  });

  const addMat = useMutation({
    mutationFn: async () => {
      await api.post(`/api/competitions/${competitionId}/mats`, { name: matName, display_order: (mats?.length ?? 0) + 1 });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-mats", competitionId] }),
  });

  const recompute = useMutation({
    mutationFn: async () => {
      await api.post(`/api/competitions/${competitionId}/schedule/recompute`);
    },
  });

  const weighIn = useMutation({
    mutationFn: async () => {
      if (!selReg) return;
      const baseBody = {
        actual_weight_kg: Number(weighKg),
      };

      try {
        const res = await api.patch<Registration>(`/api/competitions/${competitionId}/registrations/${selReg.id}/weigh-in`, baseBody);
        return res.data;
      } catch (err: unknown) {
        const ax = err as { response?: { status?: number; data?: { detail?: unknown } } };
        const status = ax.response?.status;
        const detail = ax.response?.data?.detail;

        // Peso fora do limite: back retorna 409 pedindo decisão do usuário.
        if (status === 409 && detail && typeof detail === "object") {
          const suggestedLabel = "suggested_weight_class_label" in detail ? String((detail as any).suggested_weight_class_label ?? "") : "";
          const currentLabel =
            "current_weight_class_label" in detail ? String((detail as any).current_weight_class_label ?? "") : "";

          const msg = suggestedLabel
            ? `Peso fora do limite da categoria atual (${currentLabel}).\n\nProsseguir com a reclassificação para ${suggestedLabel}? (OK = reclassificar, Cancelar = desclassificar)`
            : `Peso fora do limite da categoria atual (${currentLabel}).\n\nProsseguir com a reclassificação? (OK = reclassificar, Cancelar = desclassificar)`;

          const doReclassify = window.confirm(msg);
          const decision = doReclassify ? "reclassify" : "disqualify";

          const res2 = await api.patch<Registration>(
            `/api/competitions/${competitionId}/registrations/${selReg.id}/weigh-in`,
            { ...baseBody, reclassify_decision: decision }
          );
          return res2.data;
        }

        throw err;
      }
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] });
      // Após confirmar a pesagem (e eventual reclassificação), o atleta não deve mais aparecer na lista.
      setSelReg(null);
      setWeighKg("");
    },
  });

  const setPoints = useMutation({
    mutationFn: async ({ rid, points }: { rid: number; points: number }) => {
      await api.patch(`/api/competitions/${competitionId}/registrations/${rid}/ranking-points`, { points });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] }),
  });

  const assignMat = useMutation({
    mutationFn: async ({ mid, matId, qo }: { mid: number; matId: number | null; qo: number }) => {
      await api.patch(`/api/competitions/${competitionId}/matches/${mid}/mat`, {
        mat_id: matId,
        queue_order: qo,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] }),
  });

  const displayStatus = useMutation({
    mutationFn: async ({ mid, st }: { mid: number; st: string }) => {
      await api.patch(`/api/competitions/${competitionId}/matches/${mid}/display-status?display_status=${encodeURIComponent(st)}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comp-matches", competitionId] }),
  });

  const loadCoach = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/api/competitions/${competitionId}/coach/dashboard`);
      return res.data;
    },
    onSuccess: (d) => setCoachData(d),
  });

  useEffect(() => {
    if (!comp) return;
    setFeeAmount(
      comp.registration_fee_amount != null && comp.registration_fee_amount > 0
        ? String(comp.registration_fee_amount)
        : "",
    );
    setFeeInstr(comp.registration_payment_instructions ?? "");
    setEventStartsAtLocal(comp.event_starts_at ? isoToDatetimeLocalValue(comp.event_starts_at) : "");
  }, [comp?.id, comp?.registration_fee_amount, comp?.registration_payment_instructions, comp?.event_starts_at]);

  const saveFeeMut = useMutation({
    mutationFn: async () => {
      const v = feeAmount.trim() === "" ? null : Number(feeAmount.replace(",", "."));
      await api.patch(`/api/competitions/${competitionId}`, {
        registration_fee_amount: v != null && !Number.isNaN(v) && v > 0 ? v : null,
        registration_payment_instructions: feeInstr.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition", competitionId] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
    },
  });

  const saveEventStartsAtMut = useMutation({
    mutationFn: async () => {
      const trimmed = eventStartsAtLocal.trim();
      if (trimmed === "") {
        await api.patch(`/api/competitions/${competitionId}`, { event_starts_at: null });
        return;
      }
      const iso = datetimeLocalValueToIso(trimmed);
      if (!iso) throw new Error("Data/hora inválida");
      await api.patch(`/api/competitions/${competitionId}`, { event_starts_at: iso });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });

  const confirmPayMut = useMutation({
    mutationFn: async (registrationId: number) => {
      await api.post(`/api/competitions/${competitionId}/registrations/${registrationId}/confirm-payment`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] });
      qc.invalidateQueries({ queryKey: ["competitions", "organizer-kpis"] });
      qc.invalidateQueries({ queryKey: ["competitions", "pending-reg-payments"] });
    },
  });

  const rejectPayMut = useMutation({
    mutationFn: async ({ registrationId, notes }: { registrationId: number; notes: string }) => {
      await api.post(`/api/competitions/${competitionId}/registrations/${registrationId}/reject-payment`, {
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comp-regs", competitionId] });
      qc.invalidateQueries({ queryKey: ["competitions", "organizer-kpis"] });
      qc.invalidateQueries({ queryKey: ["competitions", "pending-reg-payments"] });
    },
  });

  const regsFiltered = useMemo(() => {
    const q = inscritosQ.trim().toLowerCase();
    if (!q) return regs ?? [];
    return (regs ?? []).filter(
      (r) =>
        String(r.student_name ?? "").toLowerCase().includes(q) ||
        String(r.registration_public_code ?? "").toLowerCase().includes(q) ||
        String(r.student_id).includes(q),
    );
  }, [regs, inscritosQ]);

  const receiptBase = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
  function receiptHref(path: string | null | undefined) {
    if (!path) return null;
    return path.startsWith("http") ? path : `${receiptBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function paymentLabel(st: string | undefined) {
    switch (st) {
      case "not_applicable":
        return "Isento / ok";
      case "pending_payment":
        return "Aguardando pagamento";
      case "pending_confirmation":
        return "Comprovante enviado";
      case "confirmed":
        return "Pago ✓";
      case "rejected":
        return "Recusado";
      default:
        return st ?? "—";
    }
  }

  if (!Number.isFinite(competitionId)) return <p>ID inválido</p>;

  const publicUrl = `${window.location.origin}/competicao-ao-vivo/${comp?.public_display_token ?? ""}`;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", fontFamily: "system-ui" }}>
      <Link to="/competicoes" style={{ color: tokens.color.primary }}>
        ← Lista
      </Link>
      <h1 style={{ fontSize: tokens.text["2xl"], fontWeight: 700, marginTop: 12 }}>{comp?.name ?? "…"}</h1>
      <p style={{ color: tokens.color.textMuted, marginBottom: 16 }}>
        Token público: <code>{comp?.public_display_token}</code>
      </p>
      <p style={{ marginBottom: 24 }}>
        <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: tokens.color.primary }}>
          Abrir painel ao vivo
        </a>
      </p>
      <button
        type="button"
        onClick={() => publishMut.mutate(!comp?.is_published)}
        style={{ marginBottom: 24, padding: "10px 16px", fontWeight: 600 }}
      >
        {comp?.is_published ? "Despublicar" : "Publicar"} competição
      </button>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 24,
          padding: 4,
          backgroundColor: tokens.color.bgBody,
          borderRadius: tokens.radius.md,
          border: `1px solid ${tokens.color.borderSubtle}`,
        }}
      >
        {(
          [
            ["geral", "Geral & categorias"],
            ["inscritos", "Inscritos"],
            ["financeiro", "Financeiro"],
            ["operacao", "Pesagem & chaves"],
            ["podios", "Pódios"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setManageTab(key)}
            style={{
              padding: "10px 16px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: manageTab === key ? "white" : "transparent",
              boxShadow: manageTab === key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              color: tokens.color.textPrimary,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {manageTab === "geral" && (
        <>
      <Section title="Identidade visual do evento">
        <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          Envie a imagem de capa ou banner do evento. Ela será exibida na página pública de inscrições e no painel do evento.
          Formatos aceitos: JPG, PNG, WEBP (recomendado 1200×400 px).
        </p>

        {/* Preview do banner atual */}
        {comp?.banner_url && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: "hidden", maxHeight: 200, border: `1px solid ${tokens.color.borderSubtle}` }}>
            <img
              src={(() => {
                const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
                const url = comp.banner_url ?? "";
                return url.startsWith("http") ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
              })()}
              alt="Banner do evento"
              style={{ width: "100%", objectFit: "cover", display: "block", maxHeight: 200 }}
            />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: tokens.radius.sm,
              border: `1px dashed ${tokens.color.borderSubtle}`,
              cursor: "pointer",
              fontSize: tokens.text.sm,
              fontWeight: 600,
              color: tokens.color.textPrimary,
              background: tokens.color.bgBody,
            }}
          >
            {uploadBannerMut.isPending ? "Enviando..." : comp?.banner_url ? "Trocar imagem" : "Selecionar imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadBannerMut.mutate(file);
                e.target.value = "";
              }}
              disabled={uploadBannerMut.isPending}
            />
          </label>
          {uploadBannerMut.isSuccess && (
            <span style={{ fontSize: 13, color: "#16A34A" }}>Imagem salva com sucesso.</span>
          )}
          {uploadBannerMut.isError && (
            <span style={{ fontSize: 13, color: tokens.color.error }}>Erro ao enviar a imagem.</span>
          )}
        </div>
      </Section>

      <Section title="Data e horário do evento">
        <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
          Defina o início do evento para o organizador estimar os horários (após “Recalcular horários” na operação).
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Início do evento</span>
            <input
              type="datetime-local"
              value={eventStartsAtLocal}
              onChange={(e) => setEventStartsAtLocal(e.target.value)}
              style={{
                padding: 8,
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.borderSubtle}`,
                minWidth: 260,
              }}
            />
          </label>

          <button
            type="button"
            disabled={saveEventStartsAtMut.isPending}
            onClick={() => saveEventStartsAtMut.mutate()}
            style={{
              padding: "10px 16px",
              fontWeight: 600,
              backgroundColor: tokens.color.primary,
              color: "white",
              border: "none",
              borderRadius: 8,
              height: 40,
            }}
          >
            {saveEventStartsAtMut.isPending ? "Guardando..." : "Guardar data/hora"}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: tokens.color.textMuted }}>
          Atual: {comp?.event_starts_at ? formatIsoAsPtBr(comp.event_starts_at) : "—"}
        </div>
      </Section>

      <Section title="Taxa de inscrição (PIX / comprovante)">
        <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
          Defina o valor para exigir envio de comprovante, como na mensalidade do dojo. Valor vazio ou zero = evento sem cobrança (inscrições ficam
          automaticamente ok para pesagem). Use o{" "}
          <Link to="/financeiro" style={{ color: tokens.color.primary, fontWeight: 700 }}>
            Financeiro do dojo
          </Link>{" "}
          para cadastrar chave PIX e QR.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Valor (R$)</span>
            <input
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="Ex.: 120"
              style={{ padding: 8, width: 120, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.borderSubtle}` }}
            />
          </label>
          <button
            type="button"
            disabled={saveFeeMut.isPending}
            onClick={() => saveFeeMut.mutate()}
            style={{ padding: "10px 16px", fontWeight: 600, backgroundColor: tokens.color.primary, color: "white", border: "none", borderRadius: 8 }}
          >
            Guardar taxa
          </button>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
          <span style={{ fontSize: tokens.text.sm, color: tokens.color.textMuted }}>Instruções para o atleta (opcional)</span>
          <textarea
            value={feeInstr}
            onChange={(e) => setFeeInstr(e.target.value)}
            rows={3}
            placeholder="Ex.: enviar comprovante com nome completo no campo «Adicionar informação»."
            style={{ padding: 10, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.borderSubtle}`, fontFamily: "inherit" }}
          />
        </label>
      </Section>

      <Section title="Modelo oficial (IBJJF / CBJJ)">
        <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 12 }}>
          Copia divisões de idade, categorias de peso e faixas. Use <strong>Kimono + No-Gi</strong> para um único evento com
          ambas as tabelas de peso; use só Gi ou só No-Gi se o evento for de uma modalidade. Ano de referência:{" "}
          <strong>{comp?.reference_year ?? "—"}</strong>. Substitui categorias existentes; não funciona com inscrições. O dojo
          precisa de faixas reconhecíveis (Branca, Azul, …).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select
            value={presetCode}
            onChange={(e) => {
              setPresetCode(e.target.value);
              setPresetMsg(null);
            }}
            style={{ minWidth: 220 }}
          >
            <option value="">Escolher modelo…</option>
            {(federationPresets ?? []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!presetCode || applyPresetMut.isPending}
            onClick={() => {
              setPresetMsg(null);
              applyPresetMut.mutate(presetCode);
            }}
          >
            Aplicar modelo
          </button>
        </div>
        {presetCode && (federationPresets ?? []).find((p) => p.code === presetCode) && (
          <p style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 8 }}>
            {(federationPresets ?? []).find((p) => p.code === presetCode)?.description}
          </p>
        )}
        {presetMsg && (
          <p style={{ marginTop: 12, fontSize: 14, color: tokens.color.textMuted }} role="status">
            {presetMsg}
          </p>
        )}
      </Section>

      <Section title="Divisões de idade">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <input placeholder="Label" value={adLabel} onChange={(e) => setAdLabel(e.target.value)} />
          <input type="number" value={adMin} onChange={(e) => setAdMin(Number(e.target.value))} />
          <input type="number" value={adMax} onChange={(e) => setAdMax(Number(e.target.value))} />
          <button type="button" onClick={() => addAd.mutate()} disabled={!adLabel}>
            Adicionar
          </button>
        </div>
        <ul>
          {(divisions ?? []).map((d) => (
            <li key={d.id}>
              {d.label} ({d.birth_year_min}–{d.birth_year_max})
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Categorias de peso">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <select value={wcAd === "" ? "" : String(wcAd)} onChange={(e) => setWcAd(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Idade…</option>
            {(divisions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select value={wcGender} onChange={(e) => setWcGender(e.target.value as "male" | "female")}>
            <option value="male">Masc</option>
            <option value="female">Fem</option>
          </select>
          <select value={wcModality} onChange={(e) => setWcModality(e.target.value as "gi" | "nogi")}>
            <option value="gi">Gi</option>
            <option value="nogi">No-Gi</option>
          </select>
          <input placeholder="Label" value={wcLabel} onChange={(e) => setWcLabel(e.target.value)} />
          <input placeholder="Max kg" value={wcMax} onChange={(e) => setWcMax(e.target.value)} />
          <button type="button" onClick={() => addWc.mutate()}>
            Adicionar
          </button>
        </div>
        <ul>
          {(weights ?? []).map((w) => (
            <li key={w.id}>
              [{w.modality ?? "gi"}] {w.label}
              {w.weight_interval_label ? ` — ${w.weight_interval_label}` : ""} — {w.gender} (div {w.age_division_id})
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Faixas permitidas">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <select value={beltAd === "" ? "" : String(beltAd)} onChange={(e) => setBeltAd(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Idade…</option>
            {(divisions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select value={beltGender} onChange={(e) => setBeltGender(e.target.value as "male" | "female")}>
            <option value="male">Masc</option>
            <option value="female">Fem</option>
          </select>
          <select value={beltFaixa === "" ? "" : String(beltFaixa)} onChange={(e) => setBeltFaixa(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Faixa…</option>
            {(faixas ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => addBelt.mutate()}>
            Adicionar
          </button>
        </div>
      </Section>
        </>
      )}

      {manageTab === "inscritos" && (
        <Section title="Gestão de inscritos">
          <input
            placeholder="Filtrar por nome, código ou ID do aluno…"
            value={inscritosQ}
            onChange={(e) => setInscritosQ(e.target.value)}
            style={{
              marginBottom: 16,
              padding: 10,
              width: "100%",
              maxWidth: 400,
              borderRadius: tokens.radius.sm,
              border: `1px solid ${tokens.color.borderSubtle}`,
            }}
          />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr>
                  <th align="left">Aluno</th>
                  <th align="left">Categoria</th>
                  <th align="left">Dojo / faixa</th>
                  <th>Peso decl.</th>
                  <th>Pagamento</th>
                  <th>Evento</th>
                  <th>Código</th>
                  <th>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {regsFiltered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.student_name ?? r.student_id}</td>
                    <td style={{ fontSize: 12 }}>
                      <div>{r.age_division_label ?? `Div ${r.age_division_id}`}</div>
                      <div style={{ color: tokens.color.textMuted }}>{r.weight_class_label ?? `Peso ${r.weight_class_id}`}</div>
                    </td>
                    <td style={{ fontSize: 12, color: "#4b5563" }}>
                      {r.student_external_dojo_name || r.student_external_faixa_label ? (
                        <>
                          {r.student_external_dojo_name ? <div>{r.student_external_dojo_name}</div> : null}
                          {r.student_external_faixa_label ? <div>Faixa: {r.student_external_faixa_label}</div> : null}
                        </>
                      ) : r.student_dojo_name || r.student_faixa_label ? (
                        <>
                          {r.student_dojo_name ? <div>{r.student_dojo_name}</div> : null}
                          {r.student_faixa_label ? <div>Faixa: {r.student_faixa_label}</div> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{r.declared_weight_kg != null ? `${r.declared_weight_kg} kg` : "—"}</td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{paymentLabel(r.payment_status)}</td>
                    <td style={{ fontSize: 12 }}>{r.status}</td>
                    <td>{r.registration_public_code}</td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={r.ranking_points}
                        style={{ width: 72 }}
                        onBlur={(e) => setPoints.mutate({ rid: r.id, points: Number(e.target.value) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {regsPending || regsFetching ? (
            <p style={{ color: tokens.color.textMuted }}>Carregando inscritos…</p>
          ) : (regsFiltered?.length ?? 0) === 0 ? (
            <p style={{ color: tokens.color.textMuted }}>Nenhum inscrito encontrado.</p>
          ) : null}
        </Section>
      )}

      {manageTab === "financeiro" && (
        <Section title="Financeiro — comprovantes de inscrição">
          <p style={{ fontSize: 14, color: tokens.color.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
            Confirme ou recuse o comprovante como no fluxo de mensalidade. Enquanto o pagamento não estiver <strong>Pago ✓</strong>, a pesagem do atleta
            fica bloqueada.
          </p>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Aguardando sua confirmação</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 28 }}>
            <thead>
              <tr>
                <th align="left">Aluno</th>
                <th align="left">Comprovante</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(regs ?? [])
                .filter((r) => r.payment_status === "pending_confirmation")
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.student_name ?? r.student_id}
                      <div style={{ fontSize: 12, color: tokens.color.textMuted }}>
                        {r.registration_fee_amount != null ? `Taxa R$ ${r.registration_fee_amount}` : ""}
                      </div>
                    </td>
                    <td>
                      {r.payment_receipt_path ? (
                        <a href={receiptHref(r.payment_receipt_path) ?? "#"} target="_blank" rel="noreferrer" style={{ color: tokens.color.primary }}>
                          Abrir arquivo
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={confirmPayMut.isPending}
                        onClick={() => confirmPayMut.mutate(r.id)}
                        style={{ marginRight: 8, padding: "6px 12px", fontWeight: 700 }}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        disabled={rejectPayMut.isPending}
                        onClick={() => {
                          const notes = window.prompt("Motivo da recusa (opcional):") ?? "";
                          rejectPayMut.mutate({ registrationId: r.id, notes });
                        }}
                        style={{ padding: "6px 12px" }}
                      >
                        Recusar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {(regs ?? []).filter((r) => r.payment_status === "pending_confirmation").length === 0 && (
            <p style={{ color: tokens.color.textMuted, marginBottom: 24 }}>Nenhum comprovante pendente neste evento.</p>
          )}

          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ainda sem comprovante enviado</h3>
          <ul style={{ fontSize: 14, color: tokens.color.textPrimary }}>
            {(regs ?? [])
              .filter((r) => r.payment_status === "pending_payment")
              .map((r) => (
                <li key={r.id}>
                  {r.student_name ?? r.student_id} — código {r.registration_public_code}
                </li>
              ))}
          </ul>
          {(regs ?? []).filter((r) => r.payment_status === "pending_payment").length === 0 && (
            <p style={{ color: tokens.color.textMuted }}>Ninguém neste estado.</p>
          )}
        </Section>
      )}

      {manageTab === "operacao" && (
        <>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
            padding: 4,
            backgroundColor: tokens.color.bgBody,
            borderRadius: tokens.radius.md,
            border: `1px solid ${tokens.color.borderSubtle}`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpSubTab("pesagem");
              setBracketsMsg(null);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: opSubTab === "pesagem" ? "white" : "transparent",
              boxShadow: opSubTab === "pesagem" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              color: tokens.color.textPrimary,
            }}
          >
            Pesagem
          </button>
          <button
            type="button"
            onClick={() => {
              setOpSubTab("chaves");
              setBracketsMsg(null);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: opSubTab === "chaves" ? "white" : "transparent",
              boxShadow: opSubTab === "chaves" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              color: tokens.color.textPrimary,
            }}
          >
            Chaves
          </button>
          <button
            type="button"
            onClick={() => {
              setOpSubTab("tatames");
              setBracketsMsg(null);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: opSubTab === "tatames" ? "white" : "transparent",
              boxShadow: opSubTab === "tatames" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              color: tokens.color.textPrimary,
            }}
          >
            Tatames
          </button>
          <button
            type="button"
            onClick={() => {
              setOpSubTab("lutas");
              setBracketsMsg(null);
            }}
            style={{
              padding: "10px 16px",
              borderRadius: tokens.radius.sm,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: tokens.text.sm,
              backgroundColor: opSubTab === "lutas" ? "white" : "transparent",
              boxShadow: opSubTab === "lutas" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              color: tokens.color.textPrimary,
            }}
          >
            Lutas
          </button>
        </div>

        {opSubTab === "pesagem" && (
          <Section title="Pesagem">
            <p style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 0, marginBottom: 12 }}>
              Pesos confirmados: <strong>{weighedInCount}</strong>. Selecione um atleta por faixa, informe o peso conferido e confirme a pesagem
              (o sistema reclassifica automaticamente).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(weighFaixaGroups ?? []).map((g) => (
                <div
                  key={g.key}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    background: tokens.color.bgBody,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedWeighGroups((prev) => {
                          // Quando o grupo ainda não existe no estado, tratamos como "minimizado".
                          const cur = prev[g.key] ?? true;
                          return { ...prev, [g.key]: !cur };
                        })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        color: tokens.color.textPrimary,
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                      aria-expanded={!(collapsedWeighGroups[g.key] ?? true)}
                    >
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: tokens.color.bgBody,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: 14,
                        }}
                      >
                      {(collapsedWeighGroups[g.key] ?? true) ? "+" : "−"}
                      </span>
                      <span>{g.label}</span>
                    </button>
                    <span style={{ fontSize: 12, color: tokens.color.textMuted }}>{g.items.length} atleta(s)</span>
                  </div>

                  {!(collapsedWeighGroups[g.key] ?? true) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                      {(() => {
                        const flt =
                          weighGroupFilters[g.key] ?? ({
                            q: "",
                            weightClassId: "all" as const,
                          } as const);

                        const uniqueWc = Array.from(
                          new Map(g.items.map((r) => [r.weight_class_id, r.weight_class_label ?? `Peso id ${r.weight_class_id}`]))
                        ).sort((a, b) => Number(a[0]) - Number(b[0]));

                        const filteredItems = g.items.filter((r) => {
                          const q = flt.q.trim().toLowerCase();
                          const matchQ = !q
                            ? true
                            : String(r.student_name ?? "").toLowerCase().includes(q) ||
                              String(r.registration_public_code ?? "").toLowerCase().includes(q) ||
                              String(r.student_id).includes(q);
                          const matchWc = flt.weightClassId === "all" ? true : r.weight_class_id === flt.weightClassId;
                          return matchQ && matchWc;
                        });

                        return (
                          <>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <input
                                placeholder="Filtrar por nome ou código"
                                value={flt.q}
                                onChange={(e) =>
                                  setWeighGroupFilters((prev) => {
                                    const cur = prev[g.key] ?? { q: "", weightClassId: "all" as const };
                                    return { ...prev, [g.key]: { ...cur, q: e.target.value } };
                                  })
                                }
                                style={{ minWidth: 260 }}
                              />
                              <select
                                value={flt.weightClassId}
                                onChange={(e) =>
                                  setWeighGroupFilters((prev) => {
                                    const cur = prev[g.key] ?? { q: "", weightClassId: "all" as const };
                                    return {
                                      ...prev,
                                      [g.key]: {
                                        ...cur,
                                        weightClassId: e.target.value === "all" ? "all" : Number(e.target.value),
                                      },
                                    };
                                  })
                                }
                              >
                                <option value="all">Todos os pesos</option>
                                {uniqueWc.map(([id, label]) => (
                                  <option key={String(id)} value={id}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  setWeighGroupFilters((prev) => ({
                                    ...prev,
                                    [g.key]: { q: "", weightClassId: "all" },
                                  }))
                                }
                                style={{ padding: "8px 12px", fontWeight: 700 }}
                              >
                                Limpar
                              </button>
                              <span style={{ fontSize: 12, color: tokens.color.textMuted }}>
                                {filteredItems.length} resultado(s)
                              </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {filteredItems.map((r) => {
                                const isSel = selReg?.id === r.id;
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => {
                                      setSelReg(r);
                                      setWeighKg("");
                                      setCollapsedWeighGroups((prev) => ({
                                        ...prev,
                                        [g.key]: false,
                                      }));
                                    }}
                                    style={{
                                      textAlign: "left",
                                      padding: "10px 12px",
                                      borderRadius: 10,
                                      border: `1px solid ${
                                        isSel ? tokens.color.primary : tokens.color.borderSubtle
                                      }`,
                                      background: isSel ? "#ffffff" : "transparent",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                      <div>
                                        <div style={{ fontWeight: 800 }}>{r.student_name ?? `Atleta ${r.student_id}`}</div>
                                        <div style={{ fontSize: 12, color: tokens.color.textMuted }}>
                                          Código {r.registration_public_code}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 12, fontWeight: 800 }}>
                                          {r.weight_class_label ?? `Peso id ${r.weight_class_id}`}
                                        </div>
                                        <div style={{ fontSize: 12, color: tokens.color.textMuted }}>
                                          status: {r.status}
                                          {r.actual_weight_kg != null ? ` • ${r.actual_weight_kg}kg` : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                              {filteredItems.length === 0 && (
                                <p style={{ color: tokens.color.textMuted, margin: 0 }}>
                                  Nenhum atleta para os filtros desta faixa.
                                </p>
                              )}
                            </div>

                            {selReg &&
                              !["weighed_in", "disqualified"].includes(selReg.status) &&
                              weighGroupKeyForRegistration(selReg) === g.key && (
                              <div style={{ marginTop: 12, padding: 12, background: "#f3f4f6", borderRadius: 8 }}>
                                <div>Inscrição #{selReg.id} — {selReg.student_name}</div>
                                <div style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 4 }}>
                                  Faixa: {selReg.student_faixa_label ?? selReg.student_external_faixa_label ?? "Sem faixa"} •{" "}
                                  {selReg.weight_class_label ?? `Peso (id ${selReg.weight_class_id})`} — status: {selReg.status}
                                  {selReg.actual_weight_kg != null ? ` • ${selReg.actual_weight_kg} kg` : ""}
                                </div>
                                {selReg.payment_status &&
                                  !["not_applicable", "confirmed"].includes(selReg.payment_status) && (
                                    <p style={{ color: tokens.color.error, fontWeight: 800, fontSize: 13, marginTop: 8 }}>
                                      Pagamento ainda não confirmado ({paymentLabel(selReg.payment_status)}). Confirme o comprovante na aba Financeiro
                                      antes de pesar.
                                    </p>
                                  )}
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Peso kg"
                                  value={weighKg}
                                  onChange={(e) => setWeighKg(e.target.value)}
                                />
                                <button
                                  type="button"
                                  disabled={weighKg.trim() === "" || weighIn.isPending}
                                  onClick={() => weighIn.mutate()}
                                  style={{ marginLeft: 8 }}
                                >
                                  Confirmar pesagem
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
              {(weighFaixaGroups ?? []).length === 0 && <p style={{ color: tokens.color.textMuted }}>Nenhum atleta encontrado neste evento.</p>}
            </div>
          </Section>
        )}

        {opSubTab === "chaves" && (
          <Section title="Chave (após pesagem)">
            {bracketsMsg && (
              <p style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 0, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {bracketsMsg}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <select value={brAd === "" ? "" : String(brAd)} onChange={(e) => setBrAd(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Idade…</option>
                {(divisions ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <select value={brWc === "" ? "" : String(brWc)} onChange={(e) => setBrWc(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Peso…</option>
                {(weights ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    [{w.modality ?? "gi"}] {w.label}
                    {w.weight_interval_label ? ` — ${w.weight_interval_label}` : ""}
                  </option>
                ))}
              </select>
              <select value={brGender} onChange={(e) => setBrGender(e.target.value as "male" | "female")}>
                <option value="male">Masc</option>
                <option value="female">Fem</option>
              </select>
              <button type="button" onClick={() => genBracket.mutate()}>
                Gerar chave
              </button>
              <button
                type="button"
                disabled={genAllBrackets.isPending}
                onClick={() => genAllBrackets.mutate()}
                style={{ marginLeft: 4 }}
              >
                {genAllBrackets.isPending ? "Gerando..." : "Gerar todas as chaves"}
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              {(brackets ?? []).length === 0 ? (
                <p style={{ fontSize: 13, color: tokens.color.textMuted, margin: 0 }}>Nenhuma chave gerada ainda.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {bracketsFaixaGroups.length === 0 ? (
                    <p style={{ fontSize: 13, color: tokens.color.textMuted, margin: 0 }}>Nenhuma luta encontrada nas chaves.</p>
                  ) : (
                    bracketsFaixaGroups.map((fg) => {
                      const bracketEntries = Array.from(fg.byBracketId.entries())
                        .map(([brId, brFaixaMatches]) => {
                          const br = bracketById.get(brId);
                          return br ? { br, brFaixaMatches } : null;
                        })
                        .filter((x): x is { br: CompetitionBracket; brFaixaMatches: CompetitionMatch[] } => x !== null)
                        .sort(
                          (a, b) =>
                            a.br.age_division_id - b.br.age_division_id ||
                            a.br.weight_class_id - b.br.weight_class_id ||
                            a.br.gender.localeCompare(b.br.gender, "pt"),
                        );

                      const totalMatches = bracketEntries.reduce((acc, x) => acc + x.brFaixaMatches.length, 0);

                      return (
                        <details
                          key={fg.key}
                          style={{ border: `1px solid ${tokens.color.borderSubtle}`, borderRadius: 12, padding: 12, background: tokens.color.bgBody }}
                        >
                          <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                            Faixa: {fg.label}
                            <span style={{ fontSize: 12, fontWeight: 700, color: tokens.color.textMuted, marginLeft: 10 }}>
                              {totalMatches} luta(s)
                            </span>
                          </summary>

                          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
                            {bracketEntries.map(({ br, brFaixaMatches }) => {
                              const adLbl =
                                (divisions ?? []).find((d) => d.id === br.age_division_id)?.label ?? `Div ${br.age_division_id}`;
                              const wc = (weights ?? []).find((w) => w.id === br.weight_class_id);
                              const wcLbl = wc ? `[${wc.modality ?? "gi"}] ${wc.label}` : `Peso ${br.weight_class_id}`;
                              const roundIndexes = Array.from(new Set(brFaixaMatches.map((m) => m.round_index))).sort((a, b) => a - b);
                              const totalRounds = totalRoundsByBracketId.get(br.id) ?? 1;
                              const ath = bracketAthleteCountByBracketId.get(br.id);
                              const athForLabel = ath != null && ath >= 2 ? ath : undefined;

                              return (
                                <details
                                  key={`${fg.key}|${br.id}`}
                                  style={{
                                    border: `1px solid ${tokens.color.borderSubtle}`,
                                    borderRadius: 12,
                                    padding: 12,
                                    background: tokens.color.bgBody,
                                  }}
                                >
                                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                                    {adLbl} — {wcLbl} ({br.gender})
                                    <span style={{ fontSize: 12, fontWeight: 700, color: tokens.color.textMuted, marginLeft: 10 }}>
                                      {brFaixaMatches.length} luta(s)
                                    </span>
                                  </summary>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: `repeat(${Math.max(1, roundIndexes.length)}, minmax(220px, 1fr))`,
                                      gap: 12,
                                      marginTop: 12,
                                    }}
                                  >
                                    {roundIndexes.map((ri) => {
                                      const roundMatches = brFaixaMatches
                                        .filter((m) => m.round_index === ri)
                                        .sort((a, b) => a.position_in_round - b.position_in_round);

                                      return (
                                        <div key={ri}>
                                          <div style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: 900, marginBottom: 8 }}>
                                            {bracketStageLabel(ri, totalRounds, athForLabel)}
                                            <span style={{ fontWeight: 600, marginLeft: 6, opacity: 0.85 }}>(rodada {ri + 1})</span>
                                          </div>
                                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {roundMatches.map((m) => {
                                              const red = m.red_registration_id ? regById.get(m.red_registration_id) : undefined;
                                              const blue = m.blue_registration_id ? regById.get(m.blue_registration_id) : undefined;
                                              const redTxt = red ? `${red.student_name ?? red.student_id} (${red.registration_public_code})` : "—";
                                              const blueTxt = blue ? `${blue.student_name ?? blue.student_id} (${blue.registration_public_code})` : "—";
                                              const nameStyles = completedMatchAthleteStyles(m);

                                              return (
                                                <div
                                                  key={m.id}
                                                  style={{
                                                    border: `1px solid ${tokens.color.borderSubtle}`,
                                                    borderRadius: 10,
                                                    padding: 10,
                                                    background: "white",
                                                  }}
                                                >
                                                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                                                    <span style={{ color: tokens.color.primary, fontWeight: 800 }}>
                                                      {bracketStageLabel(m.round_index, totalRounds, athForLabel)}
                                                    </span>
                                                    <span style={{ color: tokens.color.textMuted, fontWeight: 700 }}> · </span>
                                                    Luta #{m.id}
                                                  </div>
                                                  <div style={{ fontSize: 12, color: tokens.color.textMuted, marginBottom: 6 }}>
                                                    <strong style={{ color: "#ef4444" }}>Vermelho:</strong>{" "}
                                                    <span style={nameStyles.red}>{redTxt}</span>
                                                  </div>
                                                  <div style={{ fontSize: 12, color: tokens.color.textMuted, marginBottom: 8 }}>
                                                    <strong style={{ color: "#3b82f6" }}>Azul:</strong>{" "}
                                                    <span style={nameStyles.blue}>{blueTxt}</span>
                                                  </div>
                                                  <div style={{ fontSize: 12, fontWeight: 800, color: tokens.color.textMuted }}>
                                                    {m.match_status}
                                                  </div>
                                                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <Link to={`/competicoes/${competitionId}/mesa/${m.id}`} style={{ fontWeight: 700 }}>
                                                      Mesa
                                                    </Link>
                                                    <button
                                                      type="button"
                                                      onClick={() => displayStatus.mutate({ mid: m.id, st: "warm_up" })}
                                                    >
                                                      Aquec.
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

      {opSubTab === "tatames" && (
        <Section title="Tatames e fila">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={matName} onChange={(e) => setMatName(e.target.value)} />
            <button type="button" onClick={() => addMat.mutate()}>
              Novo tatame
            </button>
            <button type="button" onClick={() => recompute.mutate()}>
              Recalcular horários
            </button>
          </div>
          <p style={{ fontSize: 13, color: tokens.color.textMuted }}>
            Defina “Data e horário do evento” em “Geral & categorias” e clique em “Recalcular horários” para atualizar as estimativas.
          </p>
          <ul>
            {(mats ?? []).map((m) => (
              <li key={m.id}>
                {m.name} (id {m.id})
              </li>
            ))}
          </ul>
        </Section>
      )}

      {opSubTab === "lutas" && (
        <Section title="Lutas — mesa e fila">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select
              value={fightFilterFaixa}
              onChange={(e) => setFightFilterFaixa(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="all">Todas as faixas</option>
              {faixaFilterOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={fightFilterAgeDivision === "all" ? "all" : String(fightFilterAgeDivision)}
              onChange={(e) => setFightFilterAgeDivision(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Todas as divisões de idade</option>
              {ageDivisionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={fightFilterWeightClass === "all" ? "all" : String(fightFilterWeightClass)}
              onChange={(e) => setFightFilterWeightClass(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Todas as categorias de peso</option>
              {weightClassOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: tokens.color.textMuted, alignSelf: "center" }}>
              {filteredMatchViews.length} luta(s) no filtro
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from(groupedMatches.entries()).map(([faixaKey, catMap]) => {
              const faixaLabel = faixaKeyToLabel.get(faixaKey) ?? faixaKey;
              const cats = Array.from(catMap.entries());
              return (
                <div
                  key={faixaKey}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    background: tokens.color.bgBody,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{faixaLabel}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                    {cats.map(([catKey, group]) => (
                      <div key={catKey}>
                        <h4
                          style={{
                            margin: "0 0 8px 0",
                            fontSize: 14,
                            fontWeight: 800,
                            color: tokens.color.textPrimary,
                          }}
                        >
                          {group.catLabel}
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(group.items as any[]).map((v) => {
                            const m = v.match as CompetitionMatch;
                            const red = v.red as Registration | null;
                            const blue = v.blue as Registration | null;
                            const redText = red ? `${red.student_name ?? red.student_id} (${red.registration_public_code})` : "—";
                            const blueText = blue ? `${blue.student_name ?? blue.student_id} (${blue.registration_public_code})` : "—";
                            const nameStyles = completedMatchAthleteStyles(m);
                            const tr = totalRoundsByBracketId.get(m.bracket_id) ?? 1;
                            const ath = bracketAthleteCountByBracketId.get(m.bracket_id);
                            const athForLabel = ath != null && ath >= 2 ? ath : undefined;
                            const stage = bracketStageLabel(m.round_index, tr, athForLabel);

                            return (
                              <div
                                key={m.id}
                                style={{
                                  padding: 10,
                                  borderRadius: 10,
                                  border: `1px solid ${tokens.color.borderSubtle}`,
                                  background: "white",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                  <div>
                                    <div style={{ fontWeight: 900 }}>
                                      <span style={{ color: tokens.color.primary }}>{stage}</span>
                                      <span style={{ color: tokens.color.textMuted, fontWeight: 700 }}> · </span>
                                      Luta #{m.id}
                                    </div>
                                    <div style={{ fontSize: 12, color: tokens.color.textMuted }}>
                                      <span style={nameStyles.red}>{redText}</span>
                                      <span style={{ opacity: 0.65, margin: "0 4px" }}>×</span>
                                      <span style={nameStyles.blue}>{blueText}</span>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: 800 }}>
                                    {m.match_status}
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                                  <select
                                    value={m.mat_id ?? ""}
                                    onChange={(e) =>
                                      assignMat.mutate({
                                        mid: m.id,
                                        matId: e.target.value ? Number(e.target.value) : null,
                                        qo: m.queue_order ?? 0,
                                      })
                                    }
                                    style={{ minWidth: 180 }}
                                  >
                                    <option value="">—</option>
                                    {(mats ?? []).map((mat) => (
                                      <option key={mat.id} value={mat.id}>
                                        {mat.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    style={{ width: 60 }}
                                    defaultValue={m.queue_order ?? 0}
                                    onBlur={(e) =>
                                      assignMat.mutate({
                                        mid: m.id,
                                        matId: m.mat_id,
                                        qo: Number(e.target.value),
                                      })
                                    }
                                  />
                                  <Link to={`/competicoes/${competitionId}/mesa/${m.id}`} style={{ fontWeight: 700 }}>
                                    Mesa
                                  </Link>
                                  <button type="button" style={{ marginLeft: 2 }} onClick={() => displayStatus.mutate({ mid: m.id, st: "warm_up" })}>
                                    Aquec.
                                  </button>
                                  <button type="button" onClick={() => displayStatus.mutate({ mid: m.id, st: "on_deck" })}>
                                    Deck
                                  </button>
                                  <button type="button" onClick={() => displayStatus.mutate({ mid: m.id, st: "on_mat" })}>
                                    Tatame
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredMatchViews.length === 0 && <p style={{ color: tokens.color.textMuted }}>Nenhuma luta com esse filtro.</p>}
          </div>
        </Section>
      )}

        </>
      )}

      {manageTab === "podios" && (
        <Section title="Pódios">
          {/* Sub-tabs */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 20,
              padding: 4,
              background: tokens.color.bgBody,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.borderSubtle}`,
              width: "fit-content",
            }}
          >
            {(
              [
                ["individual", "Medalhas individuais"],
                ["equipes", "Ranking por equipes"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPodioSubTab(key)}
                style={{
                  padding: "8px 14px",
                  borderRadius: tokens.radius.sm,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: tokens.text.sm,
                  background: podioSubTab === key ? "white" : "transparent",
                  boxShadow: podioSubTab === key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  color: tokens.color.textPrimary,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Sub-tab: Ranking por equipes ── */}
          {podioSubTab === "equipes" && (
            <>
              <p style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 0, marginBottom: 16 }}>
                Pontuação acumulada por equipe com base em lutas realizadas (WO sem adversário não pontua).
                Critérios de desempate: total de pontos → ouros → pratas → bronzes.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "6px 12px",
                  marginBottom: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: tokens.color.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <span style={{ width: 32, flexShrink: 0 }}>#</span>
                <span style={{ flex: 1 }}>Equipe</span>
                <span style={{ width: 56, textAlign: "center" }}>Pts</span>
                <span style={{ width: 36, textAlign: "center" }}>Ouros</span>
                <span style={{ width: 36, textAlign: "center" }}>Pratas</span>
                <span style={{ width: 36, textAlign: "center" }}>Bronzes</span>
              </div>

              {teamStandings.length === 0 && (
                <p style={{ color: tokens.color.textMuted }}>Nenhum resultado registrado ainda.</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {teamStandings.map((team, idx) => {
                  const pos = idx + 1;
                  const isTop3 = pos <= 3;
                  const rowBg =
                    pos === 1 ? "#FFFBEB" : pos === 2 ? "#F8FAFC" : pos === 3 ? "#FFF7ED" : "white";
                  const rowBorder =
                    pos === 1 ? "#FDE68A" : pos === 2 ? "#E2E8F0" : pos === 3 ? "#FED7AA" : tokens.color.borderSubtle;
                  const posBadgeCfg =
                    pos === 1
                      ? { bg: "#F59E0B", color: "white" }
                      : pos === 2
                        ? { bg: "#94A3B8", color: "white" }
                        : pos === 3
                          ? { bg: "#C2410C", color: "white" }
                          : { bg: tokens.color.bgBody, color: tokens.color.textMuted };

                  return (
                    <div
                      key={team.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 12px",
                        borderRadius: 9,
                        border: `1px solid ${rowBorder}`,
                        background: rowBg,
                        fontWeight: isTop3 ? 700 : 400,
                      }}
                    >
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: posBadgeCfg.bg,
                          color: posBadgeCfg.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 800,
                          flexShrink: 0,
                          border: isTop3 ? "none" : `1px solid ${tokens.color.borderSubtle}`,
                        }}
                      >
                        {pos}
                      </span>
                      <span style={{ flex: 1, fontSize: 13 }}>{team.name}</span>
                      <span
                        style={{
                          width: 56,
                          textAlign: "center",
                          fontSize: 15,
                          fontWeight: 800,
                          color: isTop3 ? tokens.color.textPrimary : tokens.color.textMuted,
                        }}
                      >
                        {team.points}
                        <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>pts</span>
                      </span>
                      <span
                        style={{
                          width: 36,
                          textAlign: "center",
                          fontSize: 12,
                          color: "#92400E",
                          fontWeight: team.golds > 0 ? 700 : 400,
                        }}
                      >
                        {team.golds}
                      </span>
                      <span
                        style={{
                          width: 36,
                          textAlign: "center",
                          fontSize: 12,
                          color: "#374151",
                          fontWeight: team.silvers > 0 ? 700 : 400,
                        }}
                      >
                        {team.silvers}
                      </span>
                      <span
                        style={{
                          width: 36,
                          textAlign: "center",
                          fontSize: 12,
                          color: "#7C2D12",
                          fontWeight: team.bronzes > 0 ? 700 : 400,
                        }}
                      >
                        {team.bronzes}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Sub-tab: Medalhas individuais ── */}
          {podioSubTab === "individual" && (
            <>
              {podiumByFaixa.length === 0 && (
                <p style={{ color: tokens.color.textMuted }}>Nenhuma chave gerada ainda.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {podiumByFaixa.map((group) => {
              const isCollapsed = collapsedFaixaGroups.has(group.faixaKey);
              const totalCats = group.brackets.length;
              const completedCats = group.brackets.filter((b) => !b.pendingFinal).length;

              return (
                <div
                  key={group.faixaKey}
                  style={{
                    border: `1px solid ${tokens.color.borderSubtle}`,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {/* Cabeçalho do grupo (clicável) */}
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedFaixaGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.faixaKey)) next.delete(group.faixaKey);
                        else next.add(group.faixaKey);
                        return next;
                      })
                    }
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: tokens.color.bgBody,
                      border: "none",
                      cursor: "pointer",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: tokens.text.sm, fontWeight: 800, color: tokens.color.textPrimary }}>
                        {group.faixaLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: tokens.color.textMuted,
                          background: tokens.color.bgBody,
                          border: `1px solid ${tokens.color.borderSubtle}`,
                          borderRadius: 999,
                          padding: "1px 8px",
                        }}
                      >
                        {completedCats}/{totalCats} concluída{totalCats !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: tokens.color.textMuted, flexShrink: 0 }}>
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                  </button>

                  {/* Conteúdo do grupo */}
                  {!isCollapsed && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: "0 12px 12px 12px",
                        background: "#FAFAFA",
                      }}
                    >
                      {group.brackets.map((bp) => {
                        const hasResult = bp.entries.length > 0;
                        const medalCfg = {
                          gold:   { bg: "#FFFBEB", border: "#FDE68A", badgeBg: "#FEF3C7", badgeBorder: "#F59E0B", badgeColor: "#92400E", dot: "#F59E0B", label: "Ouro" },
                          silver: { bg: "#F8FAFC", border: "#E2E8F0", badgeBg: "#F1F5F9", badgeBorder: "#94A3B8", badgeColor: "#374151", dot: "#94A3B8", label: "Prata" },
                          bronze: { bg: "#FFF7ED", border: "#FED7AA", badgeBg: "#FFEDD5", badgeBorder: "#C2410C", badgeColor: "#7C2D12", dot: "#C2410C", label: "Bronze" },
                        } as const;

                        return (
                          <div
                            key={bp.bracketId}
                            style={{
                              marginTop: 10,
                              padding: 12,
                              borderRadius: 10,
                              border: `1px solid ${tokens.color.borderSubtle}`,
                              background: "white",
                              opacity: hasResult ? 1 : 0.6,
                            }}
                          >
                            {/* Título da categoria */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 8,
                                gap: 8,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: tokens.color.textPrimary }}>
                                {bp.catLabel}
                              </span>
                              {bp.pendingFinal && bp.entries.length === 0 && (
                                <span style={{ fontSize: 11, color: tokens.color.textMuted, fontStyle: "italic" }}>
                                  Aguardando resultado
                                </span>
                              )}
                              {bp.pendingFinal && bp.entries.length > 0 && (
                                <span style={{ fontSize: 11, color: "#B45309", fontStyle: "italic" }}>
                                  Final pendente
                                </span>
                              )}
                            </div>

                            {/* Linhas de medalhas */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {/* Medalhas confirmadas */}
                              {bp.entries.map((entry) => {
                                const cfg = medalCfg[entry.medal];
                                return (
                                  <div
                                    key={entry.regId}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "6px 8px",
                                      borderRadius: 7,
                                      background: cfg.bg,
                                      border: `1px solid ${cfg.border}`,
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "1px 7px",
                                        borderRadius: 999,
                                        background: cfg.badgeBg,
                                        border: `1px solid ${cfg.badgeBorder}`,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: cfg.badgeColor,
                                        whiteSpace: "nowrap",
                                        minWidth: 56,
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                    >
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                                      {cfg.label}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{entry.name}</span>
                                    <span style={{ fontSize: 12, color: tokens.color.textMuted }}>{entry.dojo}</span>
                                    <span style={{ fontSize: 10, color: tokens.color.textMuted, opacity: 0.55, fontFamily: "monospace" }}>
                                      #{entry.code}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* Ouro e Prata pendentes */}
                              {bp.pendingFinal && (
                                <>
                                  {!bp.entries.find((e) => e.medal === "gold") && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 8px",
                                        borderRadius: 7,
                                        background: medalCfg.gold.bg,
                                        border: `1px solid ${medalCfg.gold.border}`,
                                        opacity: 0.6,
                                      }}
                                    >
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "1px 7px",
                                          borderRadius: 999,
                                          background: medalCfg.gold.badgeBg,
                                          border: `1px solid ${medalCfg.gold.badgeBorder}`,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: medalCfg.gold.badgeColor,
                                          whiteSpace: "nowrap",
                                          minWidth: 56,
                                          justifyContent: "center",
                                          flexShrink: 0,
                                        }}
                                      >
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: medalCfg.gold.dot, flexShrink: 0 }} />
                                        Ouro
                                      </span>
                                      <span style={{ fontSize: 12, color: tokens.color.textMuted, fontStyle: "italic" }}>A definir</span>
                                    </div>
                                  )}
                                  {!bp.entries.find((e) => e.medal === "silver") && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 8px",
                                        borderRadius: 7,
                                        background: medalCfg.silver.bg,
                                        border: `1px solid ${medalCfg.silver.border}`,
                                        opacity: 0.6,
                                      }}
                                    >
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "1px 7px",
                                          borderRadius: 999,
                                          background: medalCfg.silver.badgeBg,
                                          border: `1px solid ${medalCfg.silver.badgeBorder}`,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: medalCfg.silver.badgeColor,
                                          whiteSpace: "nowrap",
                                          minWidth: 56,
                                          justifyContent: "center",
                                          flexShrink: 0,
                                        }}
                                      >
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: medalCfg.silver.dot, flexShrink: 0 }} />
                                        Prata
                                      </span>
                                      <span style={{ fontSize: 12, color: tokens.color.textMuted, fontStyle: "italic" }}>A definir</span>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Bronzes pendentes (semis ainda não disputadas) */}
                              {Array.from({ length: bp.pendingSemiCount }).map((_, i) => (
                                <div
                                  key={`pending-bronze-${i}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 8px",
                                    borderRadius: 7,
                                    background: medalCfg.bronze.bg,
                                    border: `1px solid ${medalCfg.bronze.border}`,
                                    opacity: 0.6,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "1px 7px",
                                      borderRadius: 999,
                                      background: medalCfg.bronze.badgeBg,
                                      border: `1px solid ${medalCfg.bronze.badgeBorder}`,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: medalCfg.bronze.badgeColor,
                                      whiteSpace: "nowrap",
                                      minWidth: 56,
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: medalCfg.bronze.dot, flexShrink: 0 }} />
                                    Bronze
                                  </span>
                                  <span style={{ fontSize: 12, color: tokens.color.textMuted, fontStyle: "italic" }}>A definir</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid ${tokens.color.borderSubtle}` }}>
      <h2 style={{ fontSize: tokens.text.lg, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}
