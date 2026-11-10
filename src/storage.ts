import { dateKey, parseDate, shiftDuration } from "./calculations";
import type { AppData, Preset, Shift, Workplace } from "./types";

const storageKey = "shift-pay-manager-v1";

export const emptyData: AppData = {
  version: 1,
  workplaces: [],
  shifts: [],
  presets: [],
  settings: { rounding: "floor", weekStart: 0 },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validDay = (value: unknown): boolean =>
  value === "end" ||
  (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31);

const validWorkplace = (value: unknown): value is Workplace =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.wage === "number" &&
  Number.isInteger(value.wage) &&
  value.wage >= 0 &&
  typeof value.color === "string" &&
  /^#[0-9a-fA-F]{6}$/.test(value.color) &&
  validDay(value.closingDay) &&
  validDay(value.payday) &&
  Number.isInteger(value.payOffset) &&
  Number(value.payOffset) >= 0 &&
  Number(value.payOffset) <= 2 &&
  typeof value.note === "string" &&
  typeof value.archived === "boolean";

const validTime = (value: unknown): boolean =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const validShift = (value: unknown): value is Shift =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.date === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
  dateKey(parseDate(value.date)) === value.date &&
  typeof value.workplaceId === "string" &&
  validTime(value.start) &&
  validTime(value.end) &&
  Number.isInteger(value.breakMinutes) &&
  Number(value.breakMinutes) >= 0 &&
  Number(value.breakMinutes) < 1440 &&
  typeof value.wage === "number" &&
  Number.isInteger(value.wage) &&
  value.wage >= 0 &&
  typeof value.note === "string";

const validPreset = (value: unknown): value is Preset =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.workplaceId === "string" &&
  validTime(value.start) &&
  validTime(value.end) &&
  Number.isInteger(value.breakMinutes) &&
  Number(value.breakMinutes) >= 0 &&
  Number(value.breakMinutes) < 1440 &&
  typeof value.wage === "number" &&
  Number.isInteger(value.wage) &&
  value.wage >= 0;

export function validateData(value: unknown): AppData {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.workplaces) ||
    !value.workplaces.every(validWorkplace) ||
    !Array.isArray(value.shifts) ||
    !value.shifts.every(validShift) ||
    !Array.isArray(value.presets) ||
    !value.presets.every(validPreset) ||
    !isRecord(value.settings) ||
    !["floor", "round", "ceil"].includes(String(value.settings.rounding)) ||
    (value.settings.weekStart !== 0 && value.settings.weekStart !== 1)
  ) {
    throw new Error("バックアップの形式が正しくありません。");
  }
  const workplaces = value.workplaces as Workplace[];
  const shifts = value.shifts as Shift[];
  const presets = value.presets as Preset[];
  const workplaceIds = new Set(workplaces.map((item) => item.id));
  if (
    new Set(workplaces.map((item) => item.id)).size !== workplaces.length ||
    new Set(shifts.map((item) => item.id)).size !== shifts.length ||
    new Set(presets.map((item) => item.id)).size !== presets.length ||
    shifts.some(
      (item) =>
        !workplaceIds.has(item.workplaceId) ||
        item.breakMinutes >= shiftDuration(item),
    ) ||
    presets.some((item) => !workplaceIds.has(item.workplaceId))
  ) {
    throw new Error("勤務先との関連付けが正しくありません。");
  }
  return value as unknown as AppData;
}

export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? validateData(JSON.parse(stored)) : emptyData;
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
