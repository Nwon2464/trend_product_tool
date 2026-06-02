import { X } from "lucide-react";

type ConfirmDeleteLogsModalProps = {
  deletableCount: number;
  onClose: () => void;
  onDelete: () => void;
};

export function ConfirmDeleteLogsModal({
  deletableCount,
  onClose,
  onDelete,
}: ConfirmDeleteLogsModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-logs-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="delete-logs-modal-title">未登録ログの削除</h2>
          <button className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>
        <p className="confirm-text">
          表示中の未登録ログ {deletableCount}件を削除しますか？
        </p>
        <p className="muted-text">
          候補検出済み、登録済みの取得ログは削除されません。
        </p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            キャンセル
          </button>
          <button className="primary-button danger-button" onClick={onDelete}>
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
