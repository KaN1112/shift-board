import type { AppData, DayRule, Shift, Workplace } from "./types";

export const pad = (value: number) => String(value).padStart(2, "0");

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function monthDay(year: number, month: number, rule: DayRule): number {
  const last = new Date(year, month + 1, 0).getDate();
  return rule === "end" ? last : Math.min(rule, last);
}

export function closingDate(year: number, month: number, rule: DayRule): Date {
  return new Date(year, month, monthDay(year, month, rule));
}

export function periodFor(date: Date, workplace: Workplace) {
  let year = date.getFullYear();
  let month = date.getMonth();
  let end = closingDate(year, month, workplace.closingDay);
  if (date.getTime() > new Date(year, month, end.getDate() + 1).getTime() - 1) {
    month += 1;
    end = closingDate(year, month, workplace.closingDay);
  }
  year = end.getFullYear();
  month = end.getMonth();
  const previousEnd = closingDate(year, month - 1, workplace.closingDay);
  const start = new Date(
    previousEnd.getFullYear(),
    previousEnd.getMonth(),
    previousEnd.getDate() + 1,
  );
  const paymentMonth = month + workplace.payOffset;
  const paymentAnchor = new Date(year, paymentMonth, 1);
  const payment = new Date(
    paymentAnchor.getFullYear(),
    paymentAnchor.getMonth(),
    monthDay(
      paymentAnchor.getFullYear(),
      paymentAnchor.getMonth(),
      workplace.payday,
    ),
  );
  return { start, end, payment };
}

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function shiftDuration(shift: Shift): number {
  const start = minutes(shift.start);
  let end = minutes(shift.end);
  if (end <= start) end += 1440;
  return end - start;
}

export function workedMinutes(shift: Shift): number {
  return Math.max(0, shiftDuration(shift) - shift.breakMinutes);
}

export interface PayPeriod {
  key: string;
  workplace: Workplace;
  start: Date;
  end: Date;
  payment: Date;
  minutes: number;
  shiftIds: Set<string>;
  workDates: Set<string>;
  wageMinutes: number;
  amount: number;
}

export function payPeriods(data: AppData): PayPeriod[] {
  const periods = new Map<string, PayPeriod>();
  for (const shift of data.shifts) {
    const workplace = data.workplaces.find(
      (item) => item.id === shift.workplaceId,
    );
    if (!workplace) continue;
    const startMinute = minutes(shift.start);
    const duration = shiftDuration(shift);
    const work = workedMinutes(shift);
    if (work === 0) continue;
    const shiftStart = parseDate(shift.date).getTime() + startMinute * 60000;
    const shiftEnd = shiftStart + duration * 60000;
    let cursor = shiftStart;
    while (cursor < shiftEnd) {
      const period = periodFor(new Date(cursor), workplace);
      const boundary = new Date(
        period.end.getFullYear(),
        period.end.getMonth(),
        period.end.getDate() + 1,
      ).getTime();
      const segmentEnd = Math.min(boundary, shiftEnd);
      const segmentMinutes = (segmentEnd - cursor) / 60000;
      const allocatedMinutes =
        segmentEnd === shiftEnd
          ? work -
            Math.round(work * ((cursor - shiftStart) / (shiftEnd - shiftStart)))
          : Math.round(work * (segmentMinutes / duration));
      const key = `${workplace.id}:${dateKey(period.end)}`;
      const current = periods.get(key) ?? {
        key,
        workplace,
        ...period,
        minutes: 0,
        shiftIds: new Set<string>(),
        workDates: new Set<string>(),
        wageMinutes: 0,
        amount: 0,
      };
      current.minutes += allocatedMinutes;
      current.wageMinutes += allocatedMinutes * shift.wage;
      current.shiftIds.add(shift.id);
      current.workDates.add(dateKey(new Date(cursor)));
      periods.set(key, current);
      cursor = segmentEnd;
    }
  }
  return [...periods.values()]
    .map((period) => ({
      ...period,
      amount: Math[data.settings.rounding](period.wageMinutes / 60),
    }))
    .sort((a, b) => a.payment.getTime() - b.payment.getTime());
}

export function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export function formatHours(value: number): string {
  return `${Math.floor(value / 60)}時間${value % 60 ? `${value % 60}分` : ""}`;
}
