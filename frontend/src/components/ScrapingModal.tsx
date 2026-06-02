import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Loader,
  X,
  XCircle,
} from "lucide-react";
import type { RefObject } from "react";
import type {
  ScrapingPrep,
  ScrapingStatusSummary,
  ScrapingTarget,
  ScrapingTargetProgress,
  ScrapingTargetStatus,
  TerminalLine,
} from "../appTypes";
import { statusOptions } from "../constants";
import type { ScrapingJob } from "../types";
import { formatTerminalTime } from "../utils/formatters";

type ScrapingModalProps = {
  isScrapingRunning: boolean;
  scrapingPrep: ScrapingPrep;
  categories: string[];
  scrapingUrls: ScrapingTarget[];
  runnableScrapingTargets: ScrapingTarget[];
  selectedScrapingKeys: string[];
  scrapingProgress: Record<string, ScrapingTargetProgress>;
  scrapingStatusSummary: ScrapingStatusSummary;
  scrapingProgressTotal: number;
  scrapingProgressPercent: number;
  activeScrapingJob: ScrapingJob | null;
  terminalLines: TerminalLine[];
  terminalBodyRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPrepChange: (scrapingPrep: ScrapingPrep) => void;
  onAppendTerminalLine: (message: string) => void;
  onToggleAllTargets: () => void;
  onToggleTarget: (key: string) => void;
  onStartScraping: () => void;
  onClearTerminal: () => void;
  onScrollTerminalToLatest: () => void;
};

function ScrapingStatusBadge({
  status,
}: {
  status: ScrapingTargetStatus | undefined;
}) {
  const normalizedStatus = status ?? "待機中";
  if (normalizedStatus === "実行中") {
    return (
      <span className="scraping-status-badge scraping-status-running">
        <Loader className="spin-icon" size={14} /> 取得中...
      </span>
    );
  }
  if (normalizedStatus === "完了") {
    return (
      <span className="scraping-status-badge scraping-status-completed">
        <CheckCircle size={14} /> 取得完了
      </span>
    );
  }
  if (normalizedStatus === "失敗") {
    return (
      <span className="scraping-status-badge scraping-status-failed">
        <XCircle size={14} /> 失敗
      </span>
    );
  }
  if (normalizedStatus === "スキップ") {
    return (
      <span className="scraping-status-badge scraping-status-skipped">
        <AlertTriangle size={14} /> スキップ
      </span>
    );
  }
  return (
    <span className="scraping-status-badge scraping-status-pending">
      <Clock size={14} /> 実行前
    </span>
  );
}

export function ScrapingModal({
  isScrapingRunning,
  scrapingPrep,
  categories,
  scrapingUrls,
  runnableScrapingTargets,
  selectedScrapingKeys,
  scrapingProgress,
  scrapingStatusSummary,
  scrapingProgressTotal,
  scrapingProgressPercent,
  activeScrapingJob,
  terminalLines,
  terminalBodyRef,
  onClose,
  onPrepChange,
  onAppendTerminalLine,
  onToggleAllTargets,
  onToggleTarget,
  onStartScraping,
  onClearTerminal,
  onScrollTerminalToLatest,
}: ScrapingModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal scraping-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scraping-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="scraping-modal-title">スクレイピング準備</h2>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={isScrapingRunning}
            title="閉じる"
          >
            <X size={16} />
          </button>
        </div>
        {isScrapingRunning && (
          <p className="scraping-lock-message">
            Scraping実行中は閉じられません
          </p>
        )}
        <div className="scraping-modal-layout">
          <div className="scraping-modal-left">
            <div className="scraping-prep-section">
              <div className="prep-grid scraping-filter-grid">
                <label>
                  カテゴリ
                  <select
                    value={scrapingPrep.category}
                    onChange={(event) => {
                      onPrepChange({
                        ...scrapingPrep,
                        category: event.target.value,
                      });
                      onAppendTerminalLine(
                        `Category selected: ${event.target.value}`,
                      );
                    }}
                  >
                    <option value="すべて">すべて</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ステータス
                  <select
                    value={scrapingPrep.status}
                    onChange={(event) => {
                      onPrepChange({
                        ...scrapingPrep,
                        status: event.target.value,
                      });
                      onAppendTerminalLine(
                        `Status selected: ${event.target.value}`,
                      );
                    }}
                  >
                    <option value="すべて">すべて</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  情報源名
                  <input
                    placeholder="例: 公式, 入荷Now, サンリオ"
                    value={scrapingPrep.sourceName}
                    onChange={(event) =>
                      onPrepChange({
                        ...scrapingPrep,
                        sourceName: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="url-panel">
                <div className="url-panel-header">
                  <h3 className="subheading">対象URL</h3>
                </div>
                {scrapingUrls.length > 0 ? (
                  <>
                    <div className="url-selection-bar">
                      <button
                        className="secondary-button select-all-button"
                        disabled={isScrapingRunning || scrapingUrls.length === 0}
                        onClick={onToggleAllTargets}
                      >
                        {selectedScrapingKeys.length === scrapingUrls.length
                          ? "選択解除"
                          : "すべて選択"}
                      </button>
                      <div className="scraping-summary">
                        <div className="scraping-summary-line">
                          <span>対象URL {scrapingStatusSummary.total}件</span>
                          <span>選択中 {scrapingStatusSummary.selected}件</span>
                          <span>
                            取得完了 {scrapingStatusSummary.completed}件
                          </span>
                          <span>失敗 {scrapingStatusSummary.failed}件</span>
                          <span>
                            スキップ {scrapingStatusSummary.skipped}件
                          </span>
                        </div>
                        <div className="scraping-progress-row">
                          <span>
                            進行状況: {scrapingStatusSummary.progressCount} /{" "}
                            {scrapingProgressTotal}
                          </span>
                          <div
                            className="scraping-progress-track"
                            aria-label="進行状況"
                          >
                            <div
                              className="scraping-progress-fill"
                              style={{ width: `${scrapingProgressPercent}%` }}
                            />
                          </div>
                        </div>
                        <span className="scraping-current-source">
                          現在処理中:{" "}
                          {scrapingStatusSummary.currentSourceName || "-"}
                        </span>
                      </div>
                    </div>
                    <ul className="url-list">
                      {scrapingUrls.map((source) => {
                        const progress = scrapingProgress[source.key];
                        const rowStatus = progress?.status ?? "待機中";
                        const isCurrent = rowStatus === "実行中";
                        return (
                          <li
                            className={
                              isCurrent
                                ? "url-list-item url-list-item-current"
                                : "url-list-item"
                            }
                            key={source.key}
                          >
                            <div className="url-row">
                              <label
                                className="url-checkbox"
                                title="一括Scrapingに含める"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedScrapingKeys.includes(
                                    source.key,
                                  )}
                                  disabled={isScrapingRunning}
                                  onChange={() => onToggleTarget(source.key)}
                                />
                              </label>
                              <div className="url-main">
                                <div className="url-title-row">
                                  <strong>{source.name}</strong>
                                  <span className="url-kind-label">
                                    {source.kind}
                                  </span>
                                </div>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {source.url}
                                </a>
                              </div>
                              <div className="url-progress">
                                <ScrapingStatusBadge status={progress?.status} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="muted-text">
                    このカテゴリの情報源URLはまだ登録されていません。
                  </p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className={`primary-button ${runnableScrapingTargets.length > 0 ? "scraping-bulk-ready" : "scraping-bulk-empty"}`}
                onClick={onStartScraping}
                disabled={
                  isScrapingRunning || runnableScrapingTargets.length === 0
                }
              >
                <Download size={16} />{" "}
                {isScrapingRunning ? "取得中..." : "選択したURLを一括Scraping"}
              </button>
              <button
                className="secondary-button"
                onClick={onClose}
                disabled={isScrapingRunning}
                title={
                  isScrapingRunning ? "Scraping実行中は閉じられません" : "閉じる"
                }
              >
                閉じる
              </button>
            </div>
          </div>
          <div className="scraping-modal-right">
            <div className="scraping-terminal">
              <div className="terminal-header">
                <div>
                  <span>terminal</span>
                  <small>上: 古いログ / 下: 最新ログ</small>
                </div>
                <strong>{isScrapingRunning ? "running" : "idle"}</strong>
              </div>
              <div className="terminal-job-status">
                <span>status: {activeScrapingJob?.status ?? "no job"}</span>
                <span>
                  sources:{" "}
                  {activeScrapingJob
                    ? `${activeScrapingJob.completed_sources}/${activeScrapingJob.total_sources}`
                    : "0/0"}
                </span>
                <span>
                  candidates: {activeScrapingJob?.created_candidates_count ?? 0}
                </span>
                <span>
                  failed/skipped:{" "}
                  {activeScrapingJob
                    ? `${activeScrapingJob.failed_sources}/${activeScrapingJob.skipped_sources}`
                    : "0/0"}
                </span>
              </div>
              <div className="terminal-body" ref={terminalBodyRef}>
                <div className="terminal-order-marker">ログ開始 ↑</div>
                {terminalLines.length > 0 ? (
                  terminalLines.map((line) => (
                    <div
                      className={`terminal-line terminal-line-${line.level}`}
                      key={line.id}
                    >
                      <span className="terminal-time">{line.time}</span>
                      <strong className="terminal-level">
                        [
                        {line.level === "success"
                          ? "DONE"
                          : line.level.toUpperCase()}
                        ]
                      </strong>
                      <p className="terminal-message">{line.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="terminal-line terminal-line-info">
                    <span className="terminal-time">
                      {formatTerminalTime()}
                    </span>
                    <strong className="terminal-level">[INFO]</strong>
                    <p className="terminal-message">
                      Scrapingを開始するとログが表示されます
                    </p>
                  </div>
                )}
                <div className="terminal-order-marker terminal-latest-marker">
                  最新ログ ↓
                </div>
              </div>
              <div className="terminal-actions">
                <button
                  className="secondary-button mini-button"
                  onClick={onClearTerminal}
                >
                  ログをクリア
                </button>
                <button
                  className="secondary-button mini-button"
                  onClick={onScrollTerminalToLatest}
                >
                  最新ログへ移動
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
