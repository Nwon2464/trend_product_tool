import { SendToBack, X } from "lucide-react";
import type {
  ProductCandidate,
  ProductCandidateStatus,
  SourceLog,
} from "../types";
import { candidateStatusLabel } from "../utils/candidateStatus";
import {
  expectationLabel,
  formatDate,
  formatDetectedKeywords,
} from "../utils/formatters";
import { CandidateStatusButtons } from "./ProductCandidateTable";

type EvidenceModalProps = {
  candidate: ProductCandidate;
  sourceLogs: SourceLog[];
  updatingCandidateIds: Set<number>;
  onClose: () => void;
  onUpdateStatus: (
    candidate: ProductCandidate,
    candidateStatus: ProductCandidateStatus,
  ) => void;
  onPrefillProduct: (candidate: ProductCandidate) => void;
};

export function EvidenceModal({
  candidate,
  sourceLogs,
  updatingCandidateIds,
  onClose,
  onUpdateStatus,
  onPrefillProduct,
}: EvidenceModalProps) {
  const log = sourceLogs.find((item) => item.id === candidate.source_log_id);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="evidence-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="evidence-modal-title">候補の根拠</h2>
          <button className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>
        <div className="evidence-content">
          <div className="evidence-grid">
            <div>
              <span>ページタイトル</span>
              <strong>{log?.title ?? candidate.product_name}</strong>
            </div>
            <div>
              <span>情報元URL</span>
              <a
                href={log?.url ?? candidate.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {log?.url ?? candidate.source_url}
              </a>
            </div>
            <div>
              <span>検出日</span>
              <strong>{formatDate(log?.detected_at ?? null)}</strong>
            </div>
            <div>
              <span>source_id</span>
              <strong>{log?.source_id ?? "-"}</strong>
            </div>
            <div>
              <span>検出理由</span>
              <strong>{candidate.detected_reason}</strong>
            </div>
            <div>
              <span>検出キーワード</span>
              <strong>{formatDetectedKeywords(candidate.detected_keywords)}</strong>
            </div>
            <div>
              <span>利益期待度</span>
              <strong>
                {candidate.profit_expectation} /{" "}
                {expectationLabel(candidate.profit_expectation)}
              </strong>
            </div>
            <div>
              <span>候補状態</span>
              <strong>{candidateStatusLabel(candidate.candidate_status)}</strong>
            </div>
          </div>
          <div className="evidence-raw">
            <span>raw_text</span>
            <pre>{log?.raw_text ?? "対応する取得ログが見つかりません。"}</pre>
          </div>
        </div>
        <div className="modal-actions">
          <CandidateStatusButtons
            candidate={candidate}
            updatingCandidateIds={updatingCandidateIds}
            onUpdateStatus={onUpdateStatus}
          />
          <button className="secondary-button" onClick={onClose}>
            閉じる
          </button>
          <button
            className="primary-button"
            onClick={() => {
              onPrefillProduct(candidate);
              onClose();
            }}
          >
            <SendToBack size={16} /> 商品登録へ
          </button>
        </div>
      </div>
    </div>
  );
}
