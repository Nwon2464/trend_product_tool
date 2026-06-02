import { Search } from "lucide-react";
import type {
  CandidateSort,
  CandidateStatusFilter,
  CandidateViewMode,
} from "../appTypes";
import type { ProductCandidate, ProductCandidateStatus } from "../types";
import { candidateStatusLabels } from "../utils/candidateStatus";
import {
  ProductCandidateTable,
  type ProductCandidateGroup,
} from "./ProductCandidateTable";

type CollectionPanelProps = {
  productCandidateCount: number;
  candidateStatusFilter: CandidateStatusFilter;
  candidateSort: CandidateSort;
  candidateViewMode: CandidateViewMode;
  candidateGroups: ProductCandidateGroup[];
  allCandidates: ProductCandidate[];
  updatingCandidateIds: Set<number>;
  onOpenScrapingModal: () => void;
  onCandidateStatusFilterChange: (
    candidateStatusFilter: CandidateStatusFilter,
  ) => void;
  onCandidateSortChange: (candidateSort: CandidateSort) => void;
  onCandidateViewModeChange: (candidateViewMode: CandidateViewMode) => void;
  onShowEvidence: (candidate: ProductCandidate) => void;
  onUpdateStatus: (
    candidate: ProductCandidate,
    candidateStatus: ProductCandidateStatus,
  ) => void;
  onPrefillProduct: (candidate: ProductCandidate) => void;
  onDeleteCandidate: (candidate: ProductCandidate) => void;
};

export function CollectionPanel({
  productCandidateCount,
  candidateStatusFilter,
  candidateSort,
  candidateViewMode,
  candidateGroups,
  allCandidates,
  updatingCandidateIds,
  onOpenScrapingModal,
  onCandidateStatusFilterChange,
  onCandidateSortChange,
  onCandidateViewModeChange,
  onShowEvidence,
  onUpdateStatus,
  onPrefillProduct,
  onDeleteCandidate,
}: CollectionPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>情報収集</h2>
        <span>商品候補 {productCandidateCount}件</span>
      </div>
      <div className="toolbar-row">
        <button className="primary-button" onClick={onOpenScrapingModal}>
          <Search size={16} /> スクレイピング準備
        </button>
        <div className="toolbar-actions">
          <label className="compact-filter">
            状態
            <select
              value={candidateStatusFilter}
              onChange={(event) =>
                onCandidateStatusFilterChange(
                  event.target.value as CandidateStatusFilter,
                )
              }
            >
              <option value="すべて">すべて</option>
              <option value="new">{candidateStatusLabels.new}</option>
              <option value="watching">{candidateStatusLabels.watching}</option>
              <option value="confirmed">
                {candidateStatusLabels.confirmed}
              </option>
              <option value="ignored">{candidateStatusLabels.ignored}</option>
              <option value="purchased">
                {candidateStatusLabels.purchased}
              </option>
            </select>
          </label>
          <div className="view-mode-control" aria-label="候補表示切替">
            <button
              className={candidateViewMode === "category" ? "active" : ""}
              onClick={() => onCandidateViewModeChange("category")}
              type="button"
            >
              カテゴリ別
            </button>
            <button
              className={candidateViewMode === "all" ? "active" : ""}
              onClick={() => onCandidateViewModeChange("all")}
              type="button"
            >
              全体表示
            </button>
          </div>
        </div>
      </div>
      <ProductCandidateTable
        candidateGroups={candidateGroups}
        allCandidates={allCandidates}
        candidateSort={candidateSort}
        candidateViewMode={candidateViewMode}
        updatingCandidateIds={updatingCandidateIds}
        onShowEvidence={onShowEvidence}
        onCandidateSortChange={onCandidateSortChange}
        onUpdateStatus={onUpdateStatus}
        onPrefillProduct={onPrefillProduct}
        onDeleteCandidate={onDeleteCandidate}
      />
    </section>
  );
}
