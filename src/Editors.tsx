import { useState } from "react";
import type { FormEvent } from "react";
import { shiftDuration } from "./calculations";
import type { AppData, DayRule, Preset, Shift, Workplace } from "./types";

function DaySelect({
  value,
  onChange,
}: {
  value: DayRule;
  onChange: (value: DayRule) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value === "end" ? "end" : Number(event.target.value),
        )
      }
    >
      {Array.from({ length: 31 }, (_, index) => (
        <option key={index + 1} value={index + 1}>
          {index + 1}日
        </option>
      ))}
      <option value="end">末日</option>
    </select>
  );
}

export function ShiftEditor({
  data,
  initial,
  onSave,
  onDelete,
  onClose,
  onDuplicate,
}: {
  data: AppData;
  initial: Shift;
  onSave: (shift: Shift) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onDuplicate: (shift: Shift, date: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [copyDate, setCopyDate] = useState("");
  const [showCopy, setShowCopy] = useState(false);
  const existing = data.shifts.some((item) => item.id === initial.id);
  const workplaces = data.workplaces.filter(
    (item) => !item.archived || item.id === draft.workplaceId,
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.workplaceId) return setError("勤務先を選択してください。");
    if (draft.breakMinutes >= shiftDuration(draft)) {
      return setError("休憩時間が勤務時間以上です。");
    }
    onSave(draft);
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <label>
        勤務日
        <input
          type="date"
          required
          value={draft.date}
          onChange={(event) => setDraft({ ...draft, date: event.target.value })}
        />
      </label>
      <label>
        プリセット
        <select
          value=""
          onChange={(event) => {
            const preset = data.presets.find(
              (item) => item.id === event.target.value,
            );
            if (preset)
              setDraft({
                ...draft,
                workplaceId: preset.workplaceId,
                start: preset.start,
                end: preset.end,
                breakMinutes: preset.breakMinutes,
                wage: preset.wage,
              });
          }}
        >
          <option value="">選択してください</option>
          {data.presets
            .filter((item) =>
              workplaces.some((place) => place.id === item.workplaceId),
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        勤務先
        <select
          required
          value={draft.workplaceId}
          onChange={(event) => {
            const place = data.workplaces.find(
              (item) => item.id === event.target.value,
            );
            setDraft({
              ...draft,
              workplaceId: event.target.value,
              wage: place?.wage ?? 0,
            });
          }}
        >
          <option value="">選択してください</option>
          {workplaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-pair">
        <label>
          出勤時刻
          <input
            type="time"
            required
            value={draft.start}
            onChange={(event) =>
              setDraft({ ...draft, start: event.target.value })
            }
          />
        </label>
        <label>
          退勤時刻
          <input
            type="time"
            required
            value={draft.end}
            onChange={(event) =>
              setDraft({ ...draft, end: event.target.value })
            }
          />
        </label>
      </div>
      <div className="form-pair">
        <label>
          休憩時間（分）
          <input
            type="number"
            min="0"
            max="1439"
            required
            value={draft.breakMinutes}
            onChange={(event) =>
              setDraft({ ...draft, breakMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          時給（円）
          <input
            type="number"
            min="0"
            step="1"
            required
            value={draft.wage}
            onChange={(event) =>
              setDraft({ ...draft, wage: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <label>
        メモ
        <textarea
          rows={3}
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {existing && showCopy && (
        <div className="form-pair">
          <label>
            複製先の日付
            <input
              type="date"
              value={copyDate}
              onChange={(event) => setCopyDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="secondary copy-confirm"
            disabled={!copyDate}
            onClick={() => onDuplicate(draft, copyDate)}
          >
            この日に複製
          </button>
        </div>
      )}
      <div className="form-actions">
        {existing && (
          <button
            type="button"
            className="text-button danger"
            onClick={() => {
              if (window.confirm("このシフトを削除しますか？"))
                onDelete(draft.id);
            }}
          >
            削除
          </button>
        )}
        {existing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setCopyDate(draft.date);
              setShowCopy(true);
            }}
          >
            別の日に複製
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className="primary">
          保存
        </button>
      </div>
    </form>
  );
}

export function WorkplaceEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: Workplace;
  onSave: (value: Workplace) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draft, name: draft.name.trim() });
      }}
    >
      <label>
        勤務先名
        <input
          required
          maxLength={60}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <div className="form-pair">
        <label>
          基本時給（円）
          <input
            type="number"
            min="0"
            step="1"
            required
            value={draft.wage}
            onChange={(event) =>
              setDraft({ ...draft, wage: Number(event.target.value) })
            }
          />
        </label>
        <label>
          識別カラー
          <input
            type="color"
            value={draft.color}
            onChange={(event) =>
              setDraft({ ...draft, color: event.target.value })
            }
          />
        </label>
      </div>
      <div className="form-pair">
        <label>
          給与締め日
          <DaySelect
            value={draft.closingDay}
            onChange={(value) => setDraft({ ...draft, closingDay: value })}
          />
        </label>
        <label>
          給料日
          <DaySelect
            value={draft.payday}
            onChange={(value) => setDraft({ ...draft, payday: value })}
          />
        </label>
      </div>
      <label>
        給料日の対象月
        <select
          value={draft.payOffset}
          onChange={(event) =>
            setDraft({ ...draft, payOffset: Number(event.target.value) })
          }
        >
          <option value={0}>締め月の当月</option>
          <option value={1}>締め月の翌月</option>
          <option value={2}>締め月の翌々月</option>
        </select>
      </label>
      <label>
        メモ
        <textarea
          rows={3}
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className="primary">
          保存
        </button>
      </div>
    </form>
  );
}

export function PresetEditor({
  initial,
  workplaces,
  onSave,
  onClose,
}: {
  initial: Preset;
  workplaces: Workplace[];
  onSave: (value: Preset) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...draft, name: draft.name.trim() });
      }}
    >
      <label>
        プリセット名
        <input
          required
          maxLength={60}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        勤務先
        <select
          required
          value={draft.workplaceId}
          onChange={(event) => {
            const place = workplaces.find(
              (item) => item.id === event.target.value,
            );
            setDraft({
              ...draft,
              workplaceId: event.target.value,
              wage: place?.wage ?? 0,
            });
          }}
        >
          <option value="">選択してください</option>
          {workplaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-pair">
        <label>
          出勤時刻
          <input
            type="time"
            required
            value={draft.start}
            onChange={(event) =>
              setDraft({ ...draft, start: event.target.value })
            }
          />
        </label>
        <label>
          退勤時刻
          <input
            type="time"
            required
            value={draft.end}
            onChange={(event) =>
              setDraft({ ...draft, end: event.target.value })
            }
          />
        </label>
      </div>
      <div className="form-pair">
        <label>
          休憩時間（分）
          <input
            type="number"
            min="0"
            max="1439"
            required
            value={draft.breakMinutes}
            onChange={(event) =>
              setDraft({ ...draft, breakMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          時給（円）
          <input
            type="number"
            min="0"
            step="1"
            required
            value={draft.wage}
            onChange={(event) =>
              setDraft({ ...draft, wage: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className="primary">
          保存
        </button>
      </div>
    </form>
  );
}
