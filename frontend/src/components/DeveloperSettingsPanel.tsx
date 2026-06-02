import type { Source } from "../types";
import { SimpleTable } from "./SimpleTable";

type DeveloperSettingsPanelProps = {
  sources: Source[];
  sourceTypeLabels: Record<string, string>;
  onToggleSource: (source: Source) => void;
  onSetAllSourcesActive: (isActive: boolean) => void;
};

export function DeveloperSettingsPanel({
  sources,
  sourceTypeLabels,
  onToggleSource,
  onSetAllSourcesActive,
}: DeveloperSettingsPanelProps) {
  const activeCount = sources.filter((source) => source.is_active).length;
  const inactiveCount = sources.length - activeCount;
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>開発設定</h2>
        <div className="heading-actions">
          <span>{sources.length}件</span>
          <div className="bulk-toggle-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={sources.length === 0 || inactiveCount === 0}
              onClick={() => onSetAllSourcesActive(true)}
            >
              全部ON
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={sources.length === 0 || activeCount === 0}
              onClick={() => onSetAllSourcesActive(false)}
            >
              全部OFF
            </button>
          </div>
        </div>
      </div>
      <p className="section-description source-management-description">
        この設定は開発・検証用です。有効な情報源のみスクレイピング準備
        モーダルに表示されます。通常の登録・削除は情報源管理で行います。
      </p>
      <h3 className="subheading">情報源の有効/無効</h3>
      <SimpleTable
        headers={["名前", "種類", "リンク", "カテゴリ", "状態", "操作"]}
        rows={sources.map((source) => [
          source.source_name,
          sourceTypeLabels[source.source_type] ?? source.source_type,
          <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
            {source.url}
          </a>,
          source.target_category,
          <span
            className={
              source.is_active
                ? "source-status-badge source-status-active"
                : "source-status-badge source-status-inactive"
            }
          >
            {source.is_active ? "有効" : "無効"}
          </span>,
          <button
            type="button"
            className="secondary-button source-toggle-button"
            aria-pressed={source.is_active}
            onClick={() => onToggleSource(source)}
          >
            {source.is_active ? "無効にする" : "有効にする"}
          </button>,
        ])}
      />
    </section>
  );
}
