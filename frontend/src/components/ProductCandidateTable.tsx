import { ExternalLink, FileText, PackagePlus, Trash2 } from "lucide-react";
import type { CandidateSort, CandidateViewMode } from "../appTypes";
import type { ProductCandidate, ProductCandidateStatus } from "../types";
import {
  candidateStatusActionTitle,
  candidateStatusActions,
  candidateStatusIconFill,
  candidateStatusLabel,
} from "../utils/candidateStatus";
import {
  categoryTone,
  expectationLabel,
  formatDate,
  formatPriceYen,
  scoreClass,
} from "../utils/formatters";
import { SimpleTable } from "./SimpleTable";

export type ProductCandidateGroup = {
  category: string;
  candidates: ProductCandidate[];
  highCount: number;
  averageExpectation: number;
};

type ProductCandidateTableProps = {
  candidateGroups: ProductCandidateGroup[];
  allCandidates: ProductCandidate[];
  candidateSort: CandidateSort;
  candidateViewMode: CandidateViewMode;
  updatingCandidateIds: Set<number>;
  onShowEvidence: (candidate: ProductCandidate) => void;
  onCandidateSortChange: (candidateSort: CandidateSort) => void;
  onUpdateStatus: (
    candidate: ProductCandidate,
    candidateStatus: ProductCandidateStatus,
  ) => void;
  onPrefillProduct: (candidate: ProductCandidate) => void;
  onDeleteCandidate: (candidate: ProductCandidate) => void;
};

export function CandidateStatusButtons({
  candidate,
  updatingCandidateIds,
  onUpdateStatus,
}: {
  candidate: ProductCandidate;
  updatingCandidateIds: Set<number>;
  onUpdateStatus: (
    candidate: ProductCandidate,
    candidateStatus: ProductCandidateStatus,
  ) => void;
}) {
  return (
    <>
      {candidateStatusActions.map((action) => {
        const Icon = action.icon;
        const isActive = candidate.candidate_status === action.status;
        const isUpdating = updatingCandidateIds.has(candidate.id);
        return (
          <button
            className={`candidate-icon-button candidate-icon-${action.className}${isActive ? " active" : ""}`}
            disabled={isUpdating}
            key={action.status}
            onClick={() => onUpdateStatus(candidate, action.status)}
            title={candidateStatusActionTitle(action, isActive)}
            type="button"
          >
            <Icon
              size={16}
              fill={candidateStatusIconFill(action.status, isActive)}
            />
          </button>
        );
      })}
    </>
  );
}

export function ProductCandidateTable({
  candidateGroups,
  allCandidates,
  candidateSort,
  candidateViewMode,
  updatingCandidateIds,
  onShowEvidence,
  onCandidateSortChange,
  onUpdateStatus,
  onPrefillProduct,
  onDeleteCandidate,
}: ProductCandidateTableProps) {
  if (candidateGroups.length === 0) {
    return (
      <div className="empty-state">
        <h3>商品候補がありません</h3>
        <p>スクレイピング準備から情報源を選択して候補を収集してください。</p>
      </div>
    );
  }

  const headers = (includeCategory: boolean) => [
    ...(includeCategory ? ["カテゴリ"] : []),
    "商品名候補",
    <HeaderSortGroup
      activeSort={candidateSort}
      field="price"
      label="価格"
      onChange={onCandidateSortChange}
      key="price"
    />,
    "発売日",
    <HeaderSortGroup
      activeSort={candidateSort}
      field="expectation"
      label="利益期待度"
      onChange={onCandidateSortChange}
      key="expectation"
    />,
    "状態",
    "操作",
  ];

  const renderCandidateRow = (
    candidate: ProductCandidate,
    includeCategory: boolean,
  ) => ({
    className: `candidate-row candidate-row-${candidate.candidate_status}`,
    cells: [
      ...(includeCategory
        ? [
            <span
              className={`category-badge category-${categoryTone(candidate.category)}`}
              key={`category-${candidate.id}`}
            >
              {candidate.category}
            </span>,
          ]
        : []),
      <span
        className="candidate-title-clamp"
        key={`title-${candidate.id}`}
        title={candidate.product_name}
      >
        {candidate.product_name}
      </span>,
      formatPriceYen(candidate.price),
      formatDate(candidate.release_date),
      <span
        className={`score score-${scoreClass(candidate.profit_expectation)}`}
        key={`expectation-${candidate.id}`}
      >
        {candidate.profit_expectation} /{" "}
        {expectationLabel(candidate.profit_expectation)}
      </span>,
      <span
        className={`candidate-status-badge candidate-status-${candidate.candidate_status}`}
        key={`status-${candidate.id}`}
      >
        {candidateStatusLabel(candidate.candidate_status)}
      </span>,
      <div className="candidate-actions" key={`actions-${candidate.id}`}>
        <a
          className="candidate-icon-button"
          href={candidate.source_url}
          target="_blank"
          rel="noreferrer"
          title="情報元を開く"
        >
          <ExternalLink size={16} />
        </a>
        <button
          className="candidate-icon-button"
          onClick={() => onShowEvidence(candidate)}
          title="根拠を見る"
          type="button"
        >
          <FileText size={16} />
        </button>
        <CandidateStatusButtons
          candidate={candidate}
          updatingCandidateIds={updatingCandidateIds}
          onUpdateStatus={onUpdateStatus}
        />
        <button
          className="candidate-icon-button candidate-register-button"
          onClick={() => onPrefillProduct(candidate)}
          title="商品登録へ"
          type="button"
        >
          <PackagePlus size={16} />
        </button>
        <button
          className="candidate-icon-button candidate-delete-button"
          onClick={() => onDeleteCandidate(candidate)}
          title="商品候補を削除"
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>,
    ],
  });

  if (candidateViewMode === "all") {
    return (
      <div className="candidate-board">
        <section className="candidate-category candidate-category-all">
          <SimpleTable
            headers={headers(true)}
            rows={allCandidates.map((candidate) =>
              renderCandidateRow(candidate, true),
            )}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="candidate-board">
      {candidateGroups.map((group) => (
        <section
          className={`candidate-category category-${categoryTone(group.category)}`}
          key={group.category}
        >
          <div className="candidate-category-header">
            <div>
              <h3>{group.category}</h3>
              <span>
                {group.candidates.length}件 / 高期待 {group.highCount}件 / 平均{" "}
                {group.averageExpectation}
              </span>
            </div>
          </div>
          <SimpleTable
            headers={headers(false)}
            rows={group.candidates.map((candidate) =>
              renderCandidateRow(candidate, false),
            )}
          />
        </section>
      ))}
    </div>
  );
}

function resolveNextCandidateSort(
  current: CandidateSort,
  field: "price" | "expectation",
  direction: "asc" | "desc",
): CandidateSort {
  const target =
    field === "price"
      ? direction === "asc"
        ? "price_asc"
        : "price_desc"
      : direction === "asc"
        ? "expectation_asc"
        : "expectation_desc";
  return current === target ? "newest" : target;
}

function HeaderSortGroup({
  activeSort,
  field,
  label,
  onChange,
}: {
  activeSort: CandidateSort;
  field: "price" | "expectation";
  label: string;
  onChange: (candidateSort: CandidateSort) => void;
}) {
  return (
    <div className="sortable-header">
      <span>{label}</span>
      <span className="sort-buttons" aria-label={`${label}の並び替え`}>
        <button
          aria-pressed={
            activeSort === (field === "price" ? "price_asc" : "expectation_asc")
          }
          className={`sort-button ${
            activeSort === (field === "price" ? "price_asc" : "expectation_asc")
              ? "active"
              : ""
          }`}
          onClick={() => onChange(resolveNextCandidateSort(activeSort, field, "asc"))}
          title={`${label}を昇順で並び替え`}
          type="button"
        >
          ▲
        </button>
        <button
          aria-pressed={
            activeSort === (field === "price" ? "price_desc" : "expectation_desc")
          }
          className={`sort-button ${
            activeSort === (field === "price" ? "price_desc" : "expectation_desc")
              ? "active"
              : ""
          }`}
          onClick={() =>
            onChange(resolveNextCandidateSort(activeSort, field, "desc"))
          }
          title={`${label}を降順で並び替え`}
          type="button"
        >
          ▼
        </button>
      </span>
    </div>
  );
}
