export type DayRule = number | "end";
export type Rounding = "floor" | "round" | "ceil";

export interface Workplace {
  id: string;
  name: string;
  wage: number;
  color: string;
  closingDay: DayRule;
  payday: DayRule;
  payOffset: number;
  note: string;
  archived: boolean;
}

export interface Shift {
  id: string;
  date: string;
  workplaceId: string;
  start: string;
  end: string;
  breakMinutes: number;
  wage: number;
  note: string;
}

export interface Preset {
  id: string;
  name: string;
  workplaceId: string;
  start: string;
  end: string;
  breakMinutes: number;
  wage: number;
}

export interface AppData {
  version: 1;
  workplaces: Workplace[];
  shifts: Shift[];
  presets: Preset[];
  settings: {
    rounding: Rounding;
    weekStart: 0 | 1;
  };
}
