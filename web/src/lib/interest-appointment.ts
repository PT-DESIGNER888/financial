import { addDaysISO } from './format';
import type { LoanCycle } from './enums';

export const CYCLE_STEP: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  TEN_DAY: 10,
};

export function cycleStepOf(cycle: LoanCycle | string): number | null {
  return CYCLE_STEP[cycle] ?? null;
}

export function nextRoundDue(
  currentDue: string,
  cycle: LoanCycle | string,
): string | null {
  const step = cycleStepOf(cycle);
  if (!step) return null;
  return addDaysISO(currentDue, step);
}

/** เลือกวันครบรอบถัดไปหรือไกลกว่า = รวมหลายรอบเป็นนัดชำระดอก */
export function crossesNextRound(
  selected: string,
  currentDue: string,
  cycle: LoanCycle | string,
): boolean {
  const next = nextRoundDue(currentDue, cycle);
  return !!next && selected >= next;
}

export function shortcutCollectDate(
  currentDue: string,
  cycle: LoanCycle | string,
  rounds: number,
): string | null {
  const step = cycleStepOf(cycle);
  if (!step || rounds < 1) return null;
  return addDaysISO(currentDue, (rounds - 1) * step);
}

export function previewCyclesUntil(input: {
  startDue: string;
  until: string;
  step: number;
  firstRemaining: number;
  perCycle: number;
}): { dueDate: string; remaining: number }[] {
  if (input.until < input.startDue) return [];
  const rows: { dueDate: string; remaining: number }[] = [];
  let d = input.startDue;
  let first = true;
  for (let i = 0; i < 60; i++) {
    if (d > input.until) break;
    rows.push({
      dueDate: d,
      remaining: first ? input.firstRemaining : input.perCycle,
    });
    first = false;
    d = addDaysISO(d, input.step);
  }
  return rows;
}
