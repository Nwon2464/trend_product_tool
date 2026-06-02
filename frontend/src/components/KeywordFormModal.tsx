import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import type { KeywordInput } from "../types";

type KeywordFormModalProps = {
  isEditing: boolean;
  keywordForm: KeywordInput;
  onChange: (keywordForm: KeywordInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function KeywordFormModal({
  isEditing,
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
          <h2 id="keyword-modal-title">
            {isEditing ? "注目キーワードを編集" : "注目キーワードを追加"}
          </h2>
          <button className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>
        <form className="keyword-modal-form" onSubmit={onSubmit}>
          <label>
            キーワード名
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
            優先度
            <select
              value={keywordForm.priority}
              onChange={(event) =>
                onChange({ ...keywordForm, priority: Number(event.target.value) })
              }
            >
              <option value={1}>最重要</option>
              <option value={2}>標準</option>
              <option value={3}>幅広め</option>
            </select>
          </label>
          <label>
            {isEditing ? "状態" : "初期状態"}
            <select
              value={keywordForm.is_active ? "on" : "off"}
              onChange={(event) =>
                onChange({
                  ...keywordForm,
                  is_active: event.target.value === "on",
                })
              }
            >
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </select>
          </label>
          <label className="wide">
            メモ
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
              <Plus size={16} />{" "}
              {isEditing ? "注目キーワードを保存" : "注目キーワードを追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
