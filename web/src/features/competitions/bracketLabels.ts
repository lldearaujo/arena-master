/**
 * Nome da fase eliminatória em português (a partir da distância até a Final).
 */
const STAGE_FROM_FINAL = [
  "Final",
  "Semi-final",
  "Quartas de final",
  "Oitavas de final",
  "16ª de final",
  "32ª de final",
  "64ª de final",
] as const;

/** Quantidade de rodadas necessária para n atletas (potência de 2). */
export function bracketEffectiveRoundsFromAthleteCount(athleteCount: number): number {
  if (athleteCount < 2) return 1;
  return Math.ceil(Math.log2(athleteCount));
}

/**
 * @param roundIndex — primeira rodada da chave = 0
 * @param totalRoundsFromMatches — quantidade de rodadas inferida das lutas (max round_index + 1)
 * @param athleteCount — opcional: nº de atletas pesados na categoria (mesma lógica da geração da chave).
 *   Com 2 atletas, a profundidade real é 1 (só a Final), mesmo que exista uma 2ª rodada vazia no BD.
 */
export function bracketStageLabel(
  roundIndex: number,
  totalRoundsFromMatches: number,
  athleteCount?: number,
): string {
  const trFallback = Math.max(1, totalRoundsFromMatches);
  let tr = trFallback;
  let ri = Math.max(0, roundIndex);

  if (athleteCount != null && athleteCount >= 2) {
    tr = bracketEffectiveRoundsFromAthleteCount(athleteCount);
    ri = Math.min(ri, tr - 1);
  }

  const stepsFromFinal = tr - 1 - ri;
  if (stepsFromFinal < 0) return `Rodada ${roundIndex + 1}`;
  if (stepsFromFinal < STAGE_FROM_FINAL.length) return STAGE_FROM_FINAL[stepsFromFinal];
  return `Rodada ${roundIndex + 1}`;
}

/** Mapa bracket_id → total de rodadas (para uso com lista de lutas). */
export function totalRoundsByBracketIdFromMatches<T extends { bracket_id: number; round_index: number }>(
  matches: T[] | undefined,
): Map<number, number> {
  const maxR = new Map<number, number>();
  for (const mm of matches ?? []) {
    const cur = maxR.get(mm.bracket_id) ?? 0;
    maxR.set(mm.bracket_id, Math.max(cur, mm.round_index));
  }
  const out = new Map<number, number>();
  for (const [bid, r] of maxR.entries()) {
    out.set(bid, r + 1);
  }
  return out;
}
