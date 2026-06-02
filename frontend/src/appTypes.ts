import type { ReactNode } from "react";

export type ScrapingTargetStatus =
  | "待機中"
  | "実行中"
  | "完了"
  | "失敗"
  | "スキップ";

export type ScrapingTargetProgress = {
  status: ScrapingTargetStatus;
  message: string;
  cooldownUntil?: number;
};

export type ScrapingPrep = {
  category: string;
  status: string;
  sourceName: string;
};

export type ScrapingTarget = {
  key: string;
  id: number;
  name: string;
  url: string;
  category: string;
  kind: string;
};

export type ScrapingStatusSummary = {
  total: number;
  selected: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number;
  currentSourceName: string;
  progressCount: number;
};

export type TerminalLogLevel =
  | "info"
  | "start"
  | "fetch"
  | "parse"
  | "detail"
  | "keyword"
  | "candidate"
  | "success"
  | "warn"
  | "error";

export type TerminalLine = {
  id: string;
  time: string;
  level: TerminalLogLevel;
  message: string;
};

export type ToastType = "success" | "info" | "warning" | "error";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

export type TableRow =
  | Array<ReactNode>
  | {
      cells: Array<ReactNode>;
      className?: string;
    };

export type SourceLogFilter = "すべて" | "候補検出" | "登録済み" | "未登録";
export type SourceLogStatus = "候補検出" | "登録済み" | "未登録";
export type CandidateSort =
  | "newest"
  | "price_desc"
  | "price_asc"
  | "expectation_desc"
  | "expectation_asc";

export type ProductFilters = {
  category: string;
  keyword: string;
  status: string;
  sales_store: string;
  min_score: string;
  sort: string;
};

export type Tab =
  | "products"
  | "collection"
  | "source-management"
  | "developer-settings"
  | "keywords"
  | "notifications";
