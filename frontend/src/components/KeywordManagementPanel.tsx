import { Plus, Trash2 } from "lucide-react";
import type { Keyword } from "../types";
import { SimpleTable } from "./SimpleTable";

type KeywordManagementPanelProps = {
  keywords: Keyword[];
  onCreateKeyword: () => void;
  onToggleKeyword: (keyword: Keyword) => void;
  onDeleteKeyword: (keywordId: number) => void;
};

export function KeywordManagementPanel({
  keywords,
  onCreateKeyword,
  onToggleKeyword,
  onDeleteKeyword,
}: KeywordManagementPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div className="section-title-group">
          <h2>検出キーワード管理</h2>
          <span className="count-badge">現在 {keywords.length} 件</span>
        </div>
        <div className="heading-actions">
          <button className="primary-button" onClick={onCreateKeyword}>
            <Plus size={16} /> キーワードを追加
          </button>
        </div>
      </div>
      <p className="section-description">
        有効なキーワードはスクレイピング時の商品候補検出・カテゴリ判定・スコアリングに使われます。無効なキーワードは保存されますが、検出には使われません。
      </p>
      <SimpleTable
        headers={["カテゴリ", "キーワード", "優先度", "有効", "メモ", "操作"]}
        rows={keywords.map((keyword) => [
          keyword.category,
          keyword.keyword,
          String(keyword.priority),
          keyword.is_active ? "有効" : "無効",
          keyword.memo ?? "",
          <div className="actions" key={keyword.id}>
            <button
              className="secondary-button"
              onClick={() => onToggleKeyword(keyword)}
            >
              {keyword.is_active ? "検出から外す" : "検出に使う"}
            </button>
            <button
              className="icon-button danger"
              onClick={() => onDeleteKeyword(keyword.id)}
              title="削除"
            >
              <Trash2 size={16} />
            </button>
          </div>,
        ])}
      />
    </section>
  );
}
