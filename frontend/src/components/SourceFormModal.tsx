import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import type { SourceInput } from "../types";

type SourceFormModalProps = {
  sourceForm: SourceInput;
  sourceTypes: string[];
  sourceTypeLabels: Record<string, string>;
  onChange: (sourceForm: SourceInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function SourceFormModal({
  sourceForm,
  sourceTypes,
  sourceTypeLabels,
  onChange,
  onSubmit,
  onClose,
}: SourceFormModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="source-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="source-modal-title">情報源URLを登録</h2>
          <button className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>
        <form className="source-form source-modal-form" onSubmit={onSubmit}>
          <label>
            情報源名
            <input
              placeholder="情報源名"
              value={sourceForm.source_name}
              onChange={(event) =>
                onChange({ ...sourceForm, source_name: event.target.value })
              }
              required
            />
          </label>
          <label>
            URL
            <input
              placeholder="リンク"
              value={sourceForm.url}
              onChange={(event) =>
                onChange({ ...sourceForm, url: event.target.value })
              }
              required
            />
          </label>
          <label>
            対象カテゴリ
            <input
              placeholder="対象カテゴリ"
              value={sourceForm.target_category}
              onChange={(event) =>
                onChange({ ...sourceForm, target_category: event.target.value })
              }
              required
            />
          </label>
          <label>
            source_type
            <select
              value={sourceForm.source_type}
              onChange={(event) =>
                onChange({ ...sourceForm, source_type: event.target.value })
              }
            >
              {sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {sourceTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            priority
            <input
              type="number"
              min="1"
              max="3"
              value={sourceForm.priority}
              onChange={(event) =>
                onChange({ ...sourceForm, priority: Number(event.target.value) })
              }
            />
          </label>
          <label>
            memo
            <input
              placeholder="メモ"
              value={sourceForm.memo}
              onChange={(event) =>
                onChange({ ...sourceForm, memo: event.target.value })
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={sourceForm.is_active}
              onChange={(event) =>
                onChange({ ...sourceForm, is_active: event.target.checked })
              }
            />
            is_active
          </label>
          <div className="modal-actions wide">
            <button type="button" className="secondary-button" onClick={onClose}>
              キャンセル
            </button>
            <button className="primary-button">
              <Plus size={16} /> 情報源URLを登録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
