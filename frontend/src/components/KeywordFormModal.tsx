import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import type { KeywordInput } from "../types";

type KeywordFormModalProps = {
  keywordForm: KeywordInput;
  onChange: (keywordForm: KeywordInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function KeywordFormModal({
  keywordForm,
  onChange,
  onSubmit,
  onClose,
}: KeywordFormModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="keyword-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyword-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="keyword-modal-title">検出キーワードを追加</h2>
          <button className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>
        <form className="keyword-modal-form" onSubmit={onSubmit}>
          <label>
            カテゴリ
            <input
              placeholder="例: ポケモンカード"
              value={keywordForm.category}
              onChange={(event) =>
                onChange({ ...keywordForm, category: event.target.value })
              }
              required
            />
          </label>
          <label>
            キーワード
            <input
              placeholder="例: ポケカ 再販"
              value={keywordForm.keyword}
              onChange={(event) =>
                onChange({ ...keywordForm, keyword: event.target.value })
              }
              required
            />
          </label>
          <label>
            priority
            <input
              type="number"
              min="1"
              max="3"
              value={keywordForm.priority}
              onChange={(event) =>
                onChange({ ...keywordForm, priority: Number(event.target.value) })
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={keywordForm.is_active}
              onChange={(event) =>
                onChange({ ...keywordForm, is_active: event.target.checked })
              }
            />
            検出に使う
          </label>
          <label className="wide">
            memo
            <input
              placeholder="メモ"
              value={keywordForm.memo}
              onChange={(event) =>
                onChange({ ...keywordForm, memo: event.target.value })
              }
            />
          </label>
          <div className="modal-actions wide">
            <button type="button" className="secondary-button" onClick={onClose}>
              キャンセル
            </button>
            <button className="primary-button">
              <Plus size={16} /> キーワードを追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
