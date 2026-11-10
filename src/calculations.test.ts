import { describe, expect, it } from "vitest";
import { dateKey, payPeriods, periodFor, workedMinutes } from "./calculations";
import type { AppData, Shift, Workplace } from "./types";

const workplace: Workplace = {
  id: "w",
  name: "勤務先",
  wage: 1200,
  color: "#f97316",
  closingDay: 15,
  payday: 25,
  payOffset: 0,
  note: "",
  archived: false,
};

const shift = (
  id: string,
  date: string,
  start: string,
  end: string,
  wage = 1200,
): Shift => ({
  id,
  date,
  start,
  end,
  wage,
  workplaceId: "w",
  breakMinutes: 0,
  note: "",
});

const data = (shifts: Shift[], place = workplace): AppData => ({
  version: 1,
  workplaces: [place],
  shifts,
  presets: [],
  settings: { rounding: "floor", weekStart: 0 },
});

describe("給与期間", () => {
  it("15日締めの期間と支払日を年越しで求める", () => {
    const period = periodFor(new Date(2026, 0, 1), workplace);
    expect(dateKey(period.start)).toBe("2025-12-16");
    expect(dateKey(period.end)).toBe("2026-01-15");
    expect(dateKey(period.payment)).toBe("2026-01-25");
  });

  it("末日締めはうるう年を処理する", () => {
    const period = periodFor(new Date(2028, 1, 29), {
      ...workplace,
      closingDay: "end",
      payday: "end",
    });
    expect(dateKey(period.end)).toBe("2028-02-29");
    expect(dateKey(period.payment)).toBe("2028-02-29");
  });

  it("境界をまたぐ夜勤を期間に配分する", () => {
    const result = payPeriods(
      data([shift("a", "2026-10-15", "22:00", "02:00")]),
    );
    expect(result.map((item) => item.amount)).toEqual([2400, 2400]);
    expect(result.map((item) => dateKey(item.payment))).toEqual([
      "2026-10-25",
      "2026-11-25",
    ]);
  });

  it("休憩とシフト別時給を反映する", () => {
    const first = {
      ...shift("a", "2026-10-20", "09:00", "17:00", 1000),
      breakMinutes: 60,
    };
    const second = shift("b", "2026-10-20", "18:00", "20:00", 1500);
    expect(workedMinutes(first)).toBe(420);
    expect(payPeriods(data([first, second]))[0].amount).toBe(10000);
    expect(payPeriods(data([first, second]))[0].workDates.size).toBe(1);
  });

  it("翌月払いと月末日を処理する", () => {
    const place = {
      ...workplace,
      closingDay: "end" as const,
      payday: 31,
      payOffset: 1,
    };
    const result = payPeriods(
      data([shift("a", "2027-01-31", "10:00", "11:00")], place),
    );
    expect(dateKey(result[0].payment)).toBe("2027-02-28");
  });

  it("給与期間の合計に端数処理を適用する", () => {
    const first = shift("a", "2026-10-20", "10:00", "10:01", 100);
    const second = shift("b", "2026-10-21", "10:00", "10:01", 100);
    expect(payPeriods(data([first, second]))[0].amount).toBe(3);
  });
});
