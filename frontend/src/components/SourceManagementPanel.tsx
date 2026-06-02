import { Plus, Trash2 } from "lucide-react";
import type { Source } from "../types";
import { SimpleTable } from "./SimpleTable";

type SourceManagementPanelProps = {
  sources: Source[];
  sourceTypeLabels: Record<string, string>;
  onCreateSource: () => void;
  onToggleSource: (source: Source) => void;
  onDeleteSource: (source: Source) => void;
};

export function SourceManagementPanel({
  sources,
  sourceTypeLabels,
  onCreateSource,
  onToggleSource,
  onDeleteSource,
}: SourceManagementPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>情報源管理</h2>
        <div className="heading-actions">
          <span>{sources.length}件</span>
          <button className="primary-button" onClick={onCreateSource}>
            <Plus size={16} /> 情報源URLを登録
          </button>
        </div>
      </div>
      <h3 className="subheading">登録済み情報源</h3>
      <SimpleTable
        headers={[
          "名前",
          "種類",
          "リンク",
          "カテゴリ",
          "優先度",
          "有効",
          "メモ",
          "操作",
        ]}
        rows={sources.map((source) => [
          source.source_name,
          sourceTypeLabels[source.source_type] ?? source.source_type,
          <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
            {source.url}
          </a>,
          source.target_category,
          String(source.priority),
          source.is_active ? "有効" : "無効",
          source.memo ?? "",
          <div className="actions" key={source.id}>
            <button
              className="secondary-button"
              onClick={() => onToggleSource(source)}
            >
              {source.is_active ? "無効化" : "有効化"}
            </button>
            <button
              className="icon-button danger"
              onClick={() => onDeleteSource(source)}
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
