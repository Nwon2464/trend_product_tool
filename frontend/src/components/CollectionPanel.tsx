import { Search } from "lucide-react";
import type { CandidateSort, SourceLogFilter } from "../appTypes";
import type { ProductCandidate, ProductCandidateStatus } from "../types";
import {
  ProductCandidateTable,
  type ProductCandidateGroup,
} from "./ProductCandidateTable";

type CollectionPanelProps = {
  productCandidateCount: number;
  sourceLogCount: number;
  deletableUnregisteredLogCount: number;
  sourceLogFilter: SourceLogFilter;
  candidateSort: CandidateSort;
  candidateGroups: ProductCandidateGroup[];
  updatingCandidateIds: Set<number>;
  onOpenScrapingModal: () => void;
  onOpenDeleteLogsModal: () => void;
  onSourceLogFilterChange: (sourceLogFilter: SourceLogFilter) => void;
  onCandidateSortChange: (candidateSort: CandidateSort) => void;
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
  sourceLogCount,
  deletableUnregisteredLogCount,
  sourceLogFilter,
  candidateSort,
  candidateGroups,
  updatingCandidateIds,
  onOpenScrapingModal,
  onOpenDeleteLogsModal,
  onSourceLogFilterChange,
  onCandidateSortChange,
  onShowEvidence,
  onUpdateStatus,
  onPrefillProduct,
  onDeleteCandidate,
}: CollectionPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>情報収集</h2>
        <span>
          商品候補 {productCandidateCount}件 / 補助ログ {sourceLogCount}件
        </span>
      </div>
      <div className="toolbar-row">
        <button className="primary-button" onClick={onOpenScrapingModal}>
          <Search size={16} /> スクレイピング準備
        </button>
        <div className="toolbar-actions">
          <button
            className="secondary-button"
            disabled={deletableUnregisteredLogCount === 0}
            onClick={onOpenDeleteLogsModal}
          >
            表示中の未登録を削除
          </button>
          <label className="compact-filter">
            表示
            <select
              value={sourceLogFilter}
              onChange={(event) =>
                onSourceLogFilterChange(event.target.value as SourceLogFilter)
              }
            >
              <option value="すべて">すべて</option>
              <option value="候補検出">候補検出</option>
              <option value="登録済み">登録済み</option>
              <option value="未登録">未登録</option>
            </select>
          </label>
          <label className="compact-filter candidate-sort-filter">
            並び替え
            <select
              value={candidateSort}
              onChange={(event) =>
                onCandidateSortChange(event.target.value as CandidateSort)
              }
            >
              <option value="newest">新しい順</option>
              <option value="price_desc">価格が高い順</option>
              <option value="price_asc">価格が低い順</option>
              <option value="expectation_desc">利益期待度が高い順</option>
              <option value="expectation_asc">利益期待度が低い順</option>
            </select>
          </label>
        </div>
      </div>
      <ProductCandidateTable
        candidateGroups={candidateGroups}
        updatingCandidateIds={updatingCandidateIds}
        onShowEvidence={onShowEvidence}
        onUpdateStatus={onUpdateStatus}
        onPrefillProduct={onPrefillProduct}
        onDeleteCandidate={onDeleteCandidate}
      />
    </section>
  );
}
