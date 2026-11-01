import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

/** One giver → recipient assignment. */
export interface Assignment {
  giverId: string;
  recipientId: string;
}

/**
 * A past edition's result, as giver → recipient pairs. Only the most recent
 * three are consulted; the caller passes them most-recent-first.
 */
export interface HistoryEdition {
  /** Map of giverParticipantUserId → recipientParticipantUserId. */
  pairs: Map<string, string>;
}

export interface DrawResult {
  assignments: Assignment[];
  /**
   * How many past editions the no-repeat rule actually avoided (0–3). 0 means
   * the rule was relaxed entirely (no valid loop found, or no history). Lower
   * than `min(3, history.length)` means it was relaxed and admins are told.
   */
  lookbackAchieved: number;
}

export const MIN_PARTICIPANTS = 3;
const MAX_ATTEMPTS_PER_LOOKBACK = 200;

/** Thrown when exclusion restrictions make any valid draw impossible. */
export class RestrictionsImpossibleError extends Error {
  constructor() {
    super('restrictions_impossible');
    this.name = 'RestrictionsImpossibleError';
  }
}

/** Build a symmetric forbidden set ("a|b" both ways) from unordered id pairs. */
export function forbiddenSet(pairs: Array<[string, string]>): Set<string> {
  const s = new Set<string>();
  for (const [a, b] of pairs) {
    s.add(`${a}|${b}`);
    s.add(`${b}|${a}`);
  }
  return s;
}

/**
 * A perfect giver→recipient matching avoiding self and forbidden pairs (Kuhn's
 * augmenting-path algorithm). Returns null if none exists. Candidate order is
 * shuffled so a draw built from it isn't deterministic across runs.
 */
export function findMatching(ids: string[], forbidden: Set<string>): Assignment[] | null {
  const shuffled = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const allowed = new Map<string, string[]>();
  for (const g of ids) {
    allowed.set(g, shuffled(ids.filter((r) => r !== g && !forbidden.has(`${g}|${r}`))));
  }

  const recipientToGiver = new Map<string, string>();
  const augment = (giver: string, seen: Set<string>): boolean => {
    for (const r of allowed.get(giver)!) {
      if (seen.has(r)) continue;
      seen.add(r);
      const taken = recipientToGiver.get(r);
      if (taken === undefined || augment(taken, seen)) {
        recipientToGiver.set(r, giver);
        return true;
      }
    }
    return false;
  };

  for (const g of shuffled(ids)) {
    if (!augment(g, new Set<string>())) return null;
  }

  const assignments: Assignment[] = [];
  for (const [recipientId, giverId] of recipientToGiver) {
    assignments.push({ giverId, recipientId });
  }
  return assignments;
}

/** Whether any valid draw exists for `ids` given `forbidden` (exact, polynomial). */
export function isFeasible(ids: string[], forbidden: Set<string> = new Set()): boolean {
  if (ids.length < MIN_PARTICIPANTS) return false;
  return findMatching(ids, forbidden) !== null;
}

/**
 * The draw arranges participants so each gives to exactly one person and
 * receives from exactly one, nobody draws themselves, and no forbidden pairing
 * occurs. Without restrictions it uses one single loop (no mutual pairs, n ≥ 3);
 * when restrictions make a single loop unreachable it falls back to a valid
 * derangement found by bipartite matching.
 *
 * Identities here are opaque strings — the service never sees names. The caller
 * keys history by whatever stable id it uses for a person across editions.
 */
@Injectable()
export class DrawService {
  /**
   * @param ids       Participant identifiers (3–50).
   * @param history   Past editions, most-recent-first. Up to the first 3 are used.
   * @param forbidden Symmetric giver→recipient pairs that must never occur (a HARD
   *                  constraint, never relaxed). Build with `forbiddenSet`.
   * @throws RestrictionsImpossibleError when `forbidden` admits no valid draw.
   */
  draw(ids: string[], history: HistoryEdition[] = [], forbidden: Set<string> = new Set()): DrawResult {
    if (ids.length < MIN_PARTICIPANTS) {
      throw new Error(`At least ${MIN_PARTICIPANTS} participants are needed`);
    }
    // A valid assignment must exist at all, or we can't draw.
    if (!isFeasible(ids, forbidden)) throw new RestrictionsImpossibleError();

    const maxLookback = Math.min(3, history.length);
    for (let lookback = maxLookback; lookback >= 1; lookback--) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_LOOKBACK; attempt++) {
        const loop = this.randomLoop(ids);
        if (!this.violatesNoRepeat(loop, history, lookback) && !violatesForbidden(loop, forbidden)) {
          return { assignments: loop, lookbackAchieved: lookback };
        }
      }
    }

    // Lookback 0: no-repeat relaxed, but forbidden pairs are still enforced.
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_LOOKBACK; attempt++) {
      const loop = this.randomLoop(ids);
      if (!violatesForbidden(loop, forbidden)) {
        return { assignments: loop, lookbackAchieved: 0 };
      }
    }

    // Restrictions too tight for a random single loop — fall back to a
    // deterministic valid derangement (feasibility is already guaranteed above).
    return { assignments: findMatching(ids, forbidden)!, lookbackAchieved: 0 };
  }

  /**
   * Shuffle with a cryptographically secure source (Fisher–Yates), then link
   * the shuffled order into a circle.
   */
  private randomLoop(ids: string[]): Assignment[] {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    const n = a.length;
    const loop: Assignment[] = [];
    for (let i = 0; i < n; i++) {
      loop.push({ giverId: a[i], recipientId: a[(i + 1) % n] });
    }
    return loop;
  }

  /** True if any giver would repeat a recipient from the last `lookback` editions. */
  private violatesNoRepeat(
    loop: Assignment[],
    history: HistoryEdition[],
    lookback: number,
  ): boolean {
    const recent = history.slice(0, lookback);
    for (const { giverId, recipientId } of loop) {
      for (const edition of recent) {
        if (edition.pairs.get(giverId) === recipientId) {
          return true;
        }
      }
    }
    return false;
  }
}

/** True if the loop contains any forbidden giver→recipient pairing. */
function violatesForbidden(loop: Assignment[], forbidden: Set<string>): boolean {
  if (forbidden.size === 0) return false;
  for (const { giverId, recipientId } of loop) {
    if (forbidden.has(`${giverId}|${recipientId}`)) return true;
  }
  return false;
}
