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

/**
 * The draw arranges all participants in one single loop: each gives to the
 * next, and the last gives to the first. This guarantees nobody draws
 * themselves and there are no mutual pairs (for n ≥ 3).
 *
 * Identities here are opaque strings — the service never sees names. The caller
 * keys history by whatever stable id it uses for a person across editions.
 */
@Injectable()
export class DrawService {
  /**
   * @param ids      Participant identifiers (3–50).
   * @param history  Past editions, most-recent-first. Up to the first 3 are used.
   */
  draw(ids: string[], history: HistoryEdition[] = []): DrawResult {
    if (ids.length < MIN_PARTICIPANTS) {
      throw new Error(`At least ${MIN_PARTICIPANTS} participants are needed`);
    }

    const maxLookback = Math.min(3, history.length);
    for (let lookback = maxLookback; lookback >= 1; lookback--) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_LOOKBACK; attempt++) {
        const loop = this.randomLoop(ids);
        if (!this.violatesNoRepeat(loop, history, lookback)) {
          return { assignments: loop, lookbackAchieved: lookback };
        }
      }
    }

    // No history, or no loop satisfied even a lookback of 1: accept any loop.
    return { assignments: this.randomLoop(ids), lookbackAchieved: 0 };
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
