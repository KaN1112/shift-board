import { useEffect, useMemo, useRef, useState } from "react";
import {
  dateKey,
  formatHours,
  formatYen,
  parseDate,
  payPeriods,
  workedMinutes,
} from "./calculations";
import { emptyData, loadData, saveData, validateData } from "./storage";
import type { AppData, DayRule, Preset, Shift, Workplace } from "./types";
import { ShiftEditor, WorkplaceEditor, PresetEditor } from "./Editors";

type Page = "calendar" | "pay" | "workplaces" | "presets" | "settings";
type Editor = {
  type: "shift" | "workplace" | "preset";
  id?: string;
  date?: string;
} | null;

const pageNames: Record<Page, string> = {
  calendar: "カレンダー",
  pay: "給与",
  workplaces: "勤務先",
  presets: "プリセット",
  settings: "設定",
};

const todayKey = () => dateKey(new Date());
const newId = () => crypto.randomUUID();
const dateLabel = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
const ruleLabel = (rule: DayRule) => (rule === "end" ? "末日" : `${rule}日`);
const shiftTemplate = (date: string, workplace?: Workplace): Shift => ({
  id: newId(),
  date,
  workplaceId: workplace?.id ?? "",
  start: "09:00",
  end: "17:00",
  breakMinutes: 60,
  wage: workplace?.wage ?? 0,
  note: "",
});

export function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [page, setPage] = useState<Page>("calendar");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [editor, setEditor] = useState<Editor>(null);
  const [notice, setNotice] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const periods = useMemo(() => payPeriods(data), [data]);
  const monthLabel = `${month.getFullYear()}年${month.getMonth() + 1}月`;

  useEffect(() => {
    saveData(data);
  }, [data]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!editor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  function update(next: AppData) {
    setData(next);
    setEditor(null);
    setNotice("保存しました");
  }

  function moveMonth(offset: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  const activePlaces = data.workplaces.filter((item) => !item.archived);
  const calendarStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (calendarStart.getDay() - data.settings.weekStart + 7) % 7;
  const cells = Array.from(
    {
      length:
        Math.ceil(
          (offset +
            new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
            7,
        ) * 7,
    },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - offset + 1),
  );
  const weekdays =
    data.settings.weekStart === 0
      ? ["日", "月", "火", "水", "木", "金", "土"]
      : ["月", "火", "水", "木", "金", "土", "日"];
  const visiblePeriods = periods.filter(
    (item) =>
      item.payment.getFullYear() === month.getFullYear() &&
      item.payment.getMonth() === month.getMonth(),
  );
  const monthlyShifts = data.shifts.filter((item) => {
    const date = parseDate(item.date);
    return (
      date.getFullYear() === month.getFullYear() &&
      date.getMonth() === month.getMonth()
    );
  });
  const nextPeriod = periods.find(
    (item) =>
      item.payment >=
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
      ),
  );
  const monthlyWorkYen = Math[data.settings.rounding](
    monthlyShifts.reduce(
      (sum, item) => sum + workedMinutes(item) * item.wage,
      0,
    ) / 60,
  );

  const workplaceDraft: Workplace = {
    id: newId(),
    name: "",
    wage: 1200,
    color: "#ea6b24",
    closingDay: "end",
    payday: 25,
    payOffset: 1,
    note: "",
    archived: false,
  };
  const presetDraft: Preset = {
    id: newId(),
    name: "",
    workplaceId: activePlaces[0]?.id ?? "",
    start: "09:00",
    end: "17:00",
    breakMinutes: 60,
    wage: activePlaces[0]?.wage ?? 0,
  };

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const imported = validateData(JSON.parse(await file.text()));
      if (!window.confirm("現在のデータをバックアップの内容で置き換えますか？"))
        return;
      update(imported);
      setNotice("バックアップを復元しました");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "読み込みに失敗しました",
      );
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shift-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">シフトと給与</div>
        <nav aria-label="主な画面">
          {(Object.keys(pageNames) as Page[]).map((item) => (
            <button
              key={item}
              className={page === item ? "nav-item active" : "nav-item"}
              onClick={() => setPage(item)}
              aria-current={page === item ? "page" : undefined}
            >
              {pageNames[item]}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <h1>{pageNames[page]}</h1>
          {page === "calendar" && (
            <button
              className="primary"
              onClick={() =>
                activePlaces.length
                  ? setEditor({ type: "shift", date: todayKey() })
                  : (setPage("workplaces"),
                    setNotice("先に勤務先を登録してください"))
              }
            >
              シフトを追加
            </button>
          )}
          {page === "workplaces" && (
            <button
              className="primary"
              onClick={() => setEditor({ type: "workplace" })}
            >
              勤務先を追加
            </button>
          )}
          {page === "presets" && (
            <button
              className="primary"
              onClick={() =>
                activePlaces.length
                  ? setEditor({ type: "preset" })
                  : (setPage("workplaces"),
                    setNotice("先に勤務先を登録してください"))
              }
            >
              プリセットを追加
            </button>
          )}
        </header>

        {(page === "calendar" || page === "pay") && (
          <div className="month-bar">
            <div className="month-controls">
              <button
                className="square-button"
                aria-label="前月"
                onClick={() => moveMonth(-1)}
              >
                ‹
              </button>
              <h2>{monthLabel}</h2>
              <button
                className="square-button"
                aria-label="翌月"
                onClick={() => moveMonth(1)}
              >
                ›
              </button>
            </div>
            <button
              className="secondary"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              今月
            </button>
          </div>
        )}

        {page === "calendar" && (
          <div
            className="calendar"
            role="grid"
            aria-label={`${monthLabel}のシフト`}
          >
            {weekdays.map((day) => (
              <div
                key={day}
                className={`weekday ${day === "日" ? "sunday" : day === "土" ? "saturday" : ""}`}
                role="columnheader"
              >
                {day}
              </div>
            ))}
            {cells.map((date) => {
              const key = dateKey(date);
              const inMonth = date.getMonth() === month.getMonth();
              const shifts = data.shifts.filter((item) => item.date === key);
              return (
                <div
                  key={key}
                  className={`day-cell ${inMonth ? "" : "outside"}`}
                  role="gridcell"
                >
                  <button
                    className={`day-number ${key === todayKey() ? "today" : ""}`}
                    onClick={() =>
                      activePlaces.length
                        ? setEditor({ type: "shift", date: key })
                        : (setPage("workplaces"),
                          setNotice("先に勤務先を登録してください"))
                    }
                    aria-label={`${key}にシフトを追加`}
                  >
                    {date.getDate()}
                  </button>
                  <div className="day-shifts">
                    {shifts.map((shift) => {
                      const place = data.workplaces.find(
                        (item) => item.id === shift.workplaceId,
                      );
                      return (
                        <button
                          key={shift.id}
                          className="shift-chip"
                          style={{ borderColor: place?.color }}
                          onClick={() =>
                            setEditor({ type: "shift", id: shift.id })
                          }
                          title={`${place?.name ?? "勤務先"} ${shift.start}〜${shift.end}`}
                        >
                          <span className="chip-name">
                            {place?.name ?? "勤務先"}
                          </span>
                          <span>
                            {shift.start}〜{shift.end}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {page === "pay" && (
          <section className="pay-content">
            <div className="pay-summary">
              <div>
                <span>今月の給与見込み</span>
                <strong>
                  {formatYen(
                    visiblePeriods.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
                <small>今月支払予定の合計</small>
              </div>
              <div>
                <span>次回支払予定日</span>
                <strong>
                  {nextPeriod
                    ? `${nextPeriod.payment.getFullYear()}年${dateLabel(nextPeriod.payment)}`
                    : "予定なし"}
                </strong>
                <small>
                  {nextPeriod
                    ? formatYen(
                        periods
                          .filter(
                            (item) =>
                              dateKey(item.payment) ===
                              dateKey(nextPeriod.payment),
                          )
                          .reduce((sum, item) => sum + item.amount, 0),
                      )
                    : ""}
                </small>
              </div>
              <div>
                <span>今月の勤務分</span>
                <strong>{formatYen(monthlyWorkYen)}</strong>
                <small>
                  {new Set(monthlyShifts.map((item) => item.date)).size}日・
                  {formatHours(
                    monthlyShifts.reduce(
                      (sum, item) => sum + workedMinutes(item),
                      0,
                    ),
                  )}
                </small>
              </div>
            </div>
            <h2 className="section-title">勤務先別の支払予定</h2>
            {visiblePeriods.length === 0 ? (
              <p className="empty-state">この月の支払予定はありません。</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>勤務先</th>
                      <th>給与対象期間</th>
                      <th>支払予定日</th>
                      <th>勤務日数</th>
                      <th>実働時間</th>
                      <th>給与見込み</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeriods.map((item) => (
                      <tr key={item.key}>
                        <td>
                          <span
                            className="color-dot"
                            style={{ background: item.workplace.color }}
                          />
                          {item.workplace.name}
                        </td>
                        <td>
                          {dateKey(item.start)} 〜 {dateKey(item.end)}
                        </td>
                        <td>{dateKey(item.payment)}</td>
                        <td>{item.workDates.size}日</td>
                        <td>{formatHours(item.minutes)}</td>
                        <td className="amount">{formatYen(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="note">
              金額は基本給のみの概算です。深夜・残業割増、税金、社会保険料、交通費は含みません。実際の支給額は勤務先の規定により異なります。
            </p>
          </section>
        )}

        {page === "workplaces" && (
          <section className="list-content">
            {data.workplaces.length === 0 ? (
              <p className="empty-state">
                勤務先がまだありません。勤務先を追加すると、シフトを登録できます。
              </p>
            ) : (
              data.workplaces.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="row-main">
                    <span
                      className="color-dot"
                      style={{ background: item.color }}
                    />
                    <strong>{item.name}</strong>
                    {item.archived && (
                      <span className="muted">アーカイブ済み</span>
                    )}
                  </div>
                  <div className="row-detail">
                    時給 {formatYen(item.wage)}　締め{" "}
                    {ruleLabel(item.closingDay)}　支払{" "}
                    {item.payOffset === 0
                      ? "当月"
                      : item.payOffset === 1
                        ? "翌月"
                        : "翌々月"}
                    {ruleLabel(item.payday)}
                  </div>
                  <div className="row-actions">
                    <button
                      className="text-button"
                      onClick={() =>
                        setEditor({ type: "workplace", id: item.id })
                      }
                    >
                      編集
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        update({
                          ...data,
                          workplaces: data.workplaces.map((place) =>
                            place.id === item.id
                              ? { ...place, archived: !place.archived }
                              : place,
                          ),
                        })
                      }
                    >
                      {item.archived ? "再開" : "アーカイブ"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {page === "presets" && (
          <section className="list-content">
            {data.presets.length === 0 ? (
              <p className="empty-state">
                プリセットがまだありません。よく使う勤務時間を登録できます。
              </p>
            ) : (
              data.presets.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="row-main">
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {
                        data.workplaces.find(
                          (place) => place.id === item.workplaceId,
                        )?.name
                      }
                    </span>
                  </div>
                  <div className="row-detail">
                    {item.start}〜{item.end}　休憩 {item.breakMinutes}分　時給{" "}
                    {formatYen(item.wage)}
                  </div>
                  <div className="row-actions">
                    <button
                      className="text-button"
                      onClick={() => setEditor({ type: "preset", id: item.id })}
                    >
                      編集
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        update({
                          ...data,
                          presets: [
                            ...data.presets,
                            {
                              ...item,
                              id: newId(),
                              name: `${item.name} のコピー`,
                            },
                          ],
                        })
                      }
                    >
                      複製
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (window.confirm("このプリセットを削除しますか？"))
                          update({
                            ...data,
                            presets: data.presets.filter(
                              (preset) => preset.id !== item.id,
                            ),
                          });
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {page === "settings" && (
          <section className="settings-content">
            <h2 className="section-title">表示と計算</h2>
            <div className="settings-row">
              <label htmlFor="rounding">給与の円未満の端数処理</label>
              <select
                id="rounding"
                value={data.settings.rounding}
                onChange={(event) =>
                  update({
                    ...data,
                    settings: {
                      ...data.settings,
                      rounding: event.target
                        .value as AppData["settings"]["rounding"],
                    },
                  })
                }
              >
                <option value="floor">切り捨て</option>
                <option value="round">四捨五入</option>
                <option value="ceil">切り上げ</option>
              </select>
            </div>
            <div className="settings-row">
              <label htmlFor="week-start">週の開始曜日</label>
              <select
                id="week-start"
                value={data.settings.weekStart}
                onChange={(event) =>
                  update({
                    ...data,
                    settings: {
                      ...data.settings,
                      weekStart: Number(event.target.value) as 0 | 1,
                    },
                  })
                }
              >
                <option value={0}>日曜日</option>
                <option value={1}>月曜日</option>
              </select>
            </div>
            <h2 className="section-title">データ管理</h2>
            <div className="settings-row">
              <div>
                <strong>バックアップを書き出す</strong>
                <p>勤務先・シフト・プリセット・設定をJSON形式で保存します。</p>
              </div>
              <button className="secondary" onClick={exportData}>
                エクスポート
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>バックアップを復元する</strong>
                <p>現在のデータは、選択したファイルの内容に置き換わります。</p>
              </div>
              <button
                className="secondary"
                onClick={() => importInput.current?.click()}
              >
                インポート
              </button>
              <input
                ref={importInput}
                className="visually-hidden"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            <div className="settings-row">
              <div>
                <strong>すべてのデータを削除</strong>
                <p>ブラウザに保存されたデータを初期状態に戻します。</p>
              </div>
              <button
                className="secondary danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "勤務先、シフト、プリセットを含む全データを削除しますか？",
                    )
                  )
                    update(structuredClone(emptyData));
                }}
              >
                全データを削除
              </button>
            </div>
            <p className="note">
              データはこのブラウザ内に保存されます。異なるPCやブラウザ間では自動同期されません。定期的にバックアップしてください。
            </p>
          </section>
        )}
      </main>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {editor && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditor(null);
          }}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="dialog-header">
              <h2 id="dialog-title">
                {editor.type === "shift"
                  ? editor.id
                    ? "シフトを編集"
                    : "シフトを追加"
                  : editor.type === "workplace"
                    ? editor.id
                      ? "勤務先を編集"
                      : "勤務先を追加"
                    : editor.id
                      ? "プリセットを編集"
                      : "プリセットを追加"}
              </h2>
              <button
                className="close-button"
                aria-label="閉じる"
                onClick={() => setEditor(null)}
              >
                ×
              </button>
            </div>
            {editor.type === "shift" && (
              <ShiftEditor
                key={editor.id ?? editor.date}
                data={data}
                initial={
                  data.shifts.find((item) => item.id === editor.id) ??
                  shiftTemplate(editor.date ?? todayKey(), activePlaces[0])
                }
                onSave={(shift) =>
                  update({
                    ...data,
                    shifts: data.shifts.some((item) => item.id === shift.id)
                      ? data.shifts.map((item) =>
                          item.id === shift.id ? shift : item,
                        )
                      : [...data.shifts, shift],
                  })
                }
                onDelete={(id) =>
                  update({
                    ...data,
                    shifts: data.shifts.filter((item) => item.id !== id),
                  })
                }
                onClose={() => setEditor(null)}
                onDuplicate={(shift, date) => {
                  if (
                    date &&
                    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
                    !Number.isNaN(parseDate(date).getTime()) &&
                    dateKey(parseDate(date)) === date
                  )
                    update({
                      ...data,
                      shifts: [...data.shifts, { ...shift, id: newId(), date }],
                    });
                  else if (date) setNotice("日付の形式が正しくありません");
                }}
              />
            )}
            {editor.type === "workplace" && (
              <WorkplaceEditor
                key={editor.id}
                initial={
                  data.workplaces.find((item) => item.id === editor.id) ??
                  workplaceDraft
                }
                onSave={(value) =>
                  update({
                    ...data,
                    workplaces: data.workplaces.some(
                      (item) => item.id === value.id,
                    )
                      ? data.workplaces.map((item) =>
                          item.id === value.id ? value : item,
                        )
                      : [...data.workplaces, value],
                  })
                }
                onClose={() => setEditor(null)}
              />
            )}
            {editor.type === "preset" && (
              <PresetEditor
                key={editor.id}
                initial={
                  data.presets.find((item) => item.id === editor.id) ??
                  presetDraft
                }
                workplaces={data.workplaces.filter(
                  (item) =>
                    !item.archived ||
                    item.id ===
                      data.presets.find((preset) => preset.id === editor.id)
                        ?.workplaceId,
                )}
                onSave={(value) =>
                  update({
                    ...data,
                    presets: data.presets.some((item) => item.id === value.id)
                      ? data.presets.map((item) =>
                          item.id === value.id ? value : item,
                        )
                      : [...data.presets, value],
                  })
                }
                onClose={() => setEditor(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
