import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Keyword } from "../types";

export type KeywordDetectionMode = "focused" | "balanced" | "wide";

type KeywordManagementPanelProps = {
  keywords: Keyword[];
  activeDetectionMode: KeywordDetectionMode | null;
  onCreateKeyword: () => void;
  onEditKeyword: (keyword: Keyword) => void;
  onToggleKeyword: (keyword: Keyword) => void;
  onSetKeywordsActive: (keywords: Keyword[], isActive: boolean) => void;
  onApplyDetectionMode: (mode: KeywordDetectionMode) => void;
  onDeleteKeyword: (keywordId: number) => void;
};

const detectionModes: Array<{
  mode: KeywordDetectionMode;
  label: string;
  description: string;
  enabledRule: string;
  disabledRule: string;
  note: string;
}> = [
  {
    mode: "focused",
    label: "絞り込み重視",
    description: "最重要キーワード中心",
    enabledRule: "ON: 最重要のみ",
    disabledRule: "OFF: 標準 / 幅広め",
    note: "候補数を抑えて、見込みの強い言葉だけで検出します。",
  },
  {
    mode: "balanced",
    label: "バランス",
    description: "通常利用向け",
    enabledRule: "ON: 最重要 / 標準",
    disabledRule: "OFF: 幅広め",
    note: "普段使い向けに、重要語と補助語を組み合わせます。",
  },
  {
    mode: "wide",
    label: "広く収集",
    description: "幅広く候補を拾う",
    enabledRule: "ON: すべて",
    disabledRule: "OFF: なし",
    note: "見逃しを減らすため、登録済みキーワードをすべて使います。",
  },
];

function priorityLabel(priority: number) {
  if (priority === 1) return "最重要";
  if (priority === 2) return "標準";
  return "幅広め";
}

function trendLabel(activeKeywords: Keyword[]) {
  if (activeKeywords.length === 0) return "絞り込み型";
  const priority1 = activeKeywords.filter((keyword) => keyword.priority === 1).length;
  const priority3 = activeKeywords.filter((keyword) => keyword.priority === 3).length;
  const highPriorityRatio = priority1 / activeKeywords.length;
  const lowPriorityRatio = priority3 / activeKeywords.length;

  if (highPriorityRatio >= 0.7 && lowPriorityRatio === 0) return "絞り込み型";
  if (lowPriorityRatio >= 0.25 || activeKeywords.length >= 24) {
    return "広く収集型";
  }
  return "バランス型";
}

function matchingDetectionMode(keywords: Keyword[]): KeywordDetectionMode | null {
  if (keywords.length === 0) return null;
  const matchesFocused = keywords.every(
    (keyword) => keyword.is_active === (keyword.priority === 1),
  );
  if (matchesFocused) return "focused";

  const matchesBalanced = keywords.every(
    (keyword) => keyword.is_active === (keyword.priority <= 2),
  );
  if (matchesBalanced) return "balanced";

  const matchesWide = keywords.every((keyword) => keyword.is_active);
  if (matchesWide) return "wide";

  return null;
}

export function KeywordManagementPanel({
  keywords,
  activeDetectionMode,
  onCreateKeyword,
  onEditKeyword,
  onToggleKeyword,
  onSetKeywordsActive,
  onApplyDetectionMode,
  onDeleteKeyword,
}: KeywordManagementPanelProps) {
  const activeKeywords = keywords.filter((keyword) => keyword.is_active);
  const currentDetectionMode = activeDetectionMode ?? matchingDetectionMode(keywords);
  const priorityCounts = [1, 2, 3].map((priority) => ({
    priority,
    count: activeKeywords.filter((keyword) => keyword.priority === priority).length,
    total: keywords.filter((keyword) => keyword.priority === priority).length,
  }));
  const activeRatio =
    keywords.length === 0 ? 0 : Math.round((activeKeywords.length / keywords.length) * 100);
  const categories = Array.from(
    keywords.reduce((groups, keyword) => {
      const group = groups.get(keyword.category) ?? [];
      group.push(keyword);
      groups.set(keyword.category, group);
      return groups;
    }, new Map<string, Keyword[]>()),
  )
    .map(([category, items]) => ({
      category,
      items: [...items].sort(
        (a, b) =>
          a.priority - b.priority ||
          Number(b.is_active) - Number(a.is_active) ||
          a.keyword.localeCompare(b.keyword, "ja"),
      ),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "ja"));

  return (
    <section className="panel keyword-management-panel">
      <div className="section-heading">
        <div className="section-title-group">
          <h2>注目キーワード管理</h2>
          <span className="count-badge">ON率 {activeRatio}%</span>
        </div>
        <div className="heading-actions">
          <button className="primary-button" onClick={onCreateKeyword}>
            <Plus size={16} /> キーワードを追加
          </button>
        </div>
      </div>

      <p className="section-description keyword-sensitivity-description">
        注目キーワードは、商品候補をどれくらい広く検出するかを調整する設定です。
        多くONにすると広く拾えますが、ノイズも増える可能性があります。
        少なくONにすると絞り込めますが、見逃しが増える可能性があります。
      </p>

      <div className="keyword-sensitivity-grid">
        <div className="keyword-mode-panel">
          <div className="keyword-panel-heading">
            <h3>検出モード</h3>
            <span>クリックするとON/OFFを一括調整します</span>
          </div>
          <div className="keyword-mode-buttons">
            {detectionModes.map((item) => (
              <button
                className={`keyword-mode-button ${
                  currentDetectionMode === item.mode ? "active" : ""
                }`}
                key={item.mode}
                onClick={() => onApplyDetectionMode(item.mode)}
                type="button"
              >
                <span className="keyword-mode-kicker">{item.description}</span>
                <strong>{item.label}</strong>
                <span className="keyword-mode-note">{item.note}</span>
                <span className="keyword-mode-rule">{item.enabledRule}</span>
                <span className="keyword-mode-rule muted-rule">
                  {item.disabledRule}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="keyword-status-panel">
          <div className="keyword-panel-heading">
            <h3>現在の状態</h3>
            <span>{trendLabel(activeKeywords)}</span>
          </div>
          <div className="keyword-status-grid">
            <div>
              <span>有効キーワード</span>
              <strong>
                {activeKeywords.length} / {keywords.length}件
              </strong>
            </div>
            {priorityCounts.map(({ priority, count }) => (
              <div key={priority}>
                <span>{priorityLabel(priority)}</span>
                <strong>
                  {count} / {priorityCounts.find((item) => item.priority === priority)?.total}
                  件
                </strong>
              </div>
            ))}
            <div>
              <span>現在のモード</span>
              <strong>
                {currentDetectionMode
                  ? detectionModes.find((item) => item.mode === currentDetectionMode)
                      ?.label
                  : "手動調整中"}
              </strong>
            </div>
          </div>
          <div className="keyword-active-meter" aria-label="有効キーワード比率">
            <span style={{ width: `${activeRatio}%` }} />
          </div>
        </div>
      </div>

      <div className="keyword-list-heading">
        <div>
          <h3>カテゴリ別キーワード</h3>
          <span>カテゴリ単位でもON/OFFを調整できます</span>
        </div>
      </div>

      <div className="keyword-category-list">
        {categories.map(({ category, items }) => {
          const activeCount = items.filter((keyword) => keyword.is_active).length;
          return (
            <section className="keyword-category-card" key={category}>
              <div className="keyword-category-header">
                <div>
                  <h3>{category}</h3>
                  <span>
                    有効 {activeCount} / {items.length}
                  </span>
                </div>
                <div className="keyword-card-actions">
                  <button
                    className="secondary-button mini-button"
                    disabled={activeCount === items.length}
                    onClick={() => onSetKeywordsActive(items, true)}
                    type="button"
                  >
                    すべてON
                  </button>
                  <button
                    className="secondary-button mini-button"
                    disabled={activeCount === 0}
                    onClick={() => onSetKeywordsActive(items, false)}
                    type="button"
                  >
                    すべてOFF
                  </button>
                </div>
              </div>

              <div className="keyword-row-list">
                {items.map((keyword) => (
                  <div className="keyword-control-row" key={keyword.id}>
                    <button
                      className={`keyword-switch ${keyword.is_active ? "active" : ""}`}
                      onClick={() => onToggleKeyword(keyword)}
                      type="button"
                    >
                      {keyword.is_active ? "ON" : "OFF"}
                    </button>
                    <span
                      className={`keyword-priority-badge keyword-priority-${keyword.priority}`}
                    >
                      {priorityLabel(keyword.priority)}
                    </span>
                    <div className="keyword-row-main">
                      <strong>{keyword.keyword}</strong>
                      {keyword.memo && <span>{keyword.memo}</span>}
                    </div>
                    <div className="keyword-row-actions">
                      <button
                        className="secondary-button mini-button"
                        onClick={() => onEditKeyword(keyword)}
                        type="button"
                      >
                        <Pencil size={14} /> 編集
                      </button>
                      <button
                        className="icon-button danger"
                        onClick={() => onDeleteKeyword(keyword.id)}
                        title="削除"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
