import { candidateStatusLabels } from "../constants";
import type { SourceLogStatus } from "../appTypes";
import type {
  Product,
  ProductCandidate,
  ProductCandidateStatus,
  ProductInput,
  ScrapingJobEvent,
  Source,
  SourceLog,
} from "../types";

export function toProductInput(product: Product): ProductInput {
  return {
    category: product.category,
    product_name: product.product_name,
    brand: product.brand ?? "",
    price: product.price === null ? "" : String(product.price),
    release_date: product.release_date ?? "",
    sales_store: product.sales_store ?? "",
    status: product.status,
    source_name: product.source_name ?? "",
    source_url: product.source_url ?? "",
    trend_score: product.trend_score,
    memo: product.memo ?? "",
  };
}

export function scoreLabel(score: number) {
  if (score >= 80) return "高優先度";
  if (score >= 60) return "注視";
  if (score >= 40) return "低";
  return "除外";
}

export function scoreClass(score: number) {
  if (score >= 80) return "high";
  if (score >= 60) return "watch";
  if (score >= 40) return "low";
  return "ignore";
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

export function formatPriceYen(value: number | null) {
  if (value === null) return "-";
  return `${value.toLocaleString("ja-JP")} 円`;
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatTerminalTime(date = new Date()) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function getPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

export function getPayloadNumber(
  payload: Record<string, unknown> | null,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "number" ? value : null;
}

export function messageForSkipEvent(event: ScrapingJobEvent) {
  const reason = getPayloadString(event.payload, "reason");
  const details = getPayloadString(event.payload, "details");
  if (reason === "minimum_interval") {
    const seconds = getPayloadNumber(event.payload, "next_retry_seconds");
    return seconds === null
      ? "直近で取得済みのためスキップ"
      : `直近で取得済みのためスキップ。次回取得まで ${formatDuration(seconds)}`;
  }
  if (reason === "robots_disallow") return "robots.txt によりスキップ";
  if (reason === "duplicate_url") return "重複URLのためスキップ";
  if (reason === "no_usable_items") return "対象候補なし";
  return details ?? event.message;
}

export function expectationLabel(score: number) {
  if (score >= 80) return "高期待";
  if (score >= 60) return "注目";
  if (score >= 40) return "低め";
  return "保留";
}

export function candidateStatusLabel(status: ProductCandidateStatus) {
  return candidateStatusLabels[status] ?? status;
}

export function categoryTone(category: string) {
  if (category.includes("ポケモン")) return "pokemon";
  if (category.includes("ワンピース")) return "onepiece";
  if (category.includes("ガチャ")) return "gacha";
  if (category.includes("サンリオ")) return "sanrio";
  if (category.includes("ちいかわ")) return "chiikawa";
  if (category.includes("スタバ")) return "starbucks";
  if (category.includes("アパレル")) return "apparel";
  if (category.includes("お菓子") || category.includes("廃盤")) return "snack";
  return "default";
}

export function formatDetectedKeywords(value: string | null) {
  if (!value) return "-";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.join(", ");
    }
  } catch {
    // Keep the raw detector output when it is not JSON.
  }
  return value;
}

export function detectedKeywordList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // Keep using the raw detector output when it is not JSON.
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sortSourcesByNewest(items: Source[]) {
  return [...items].sort((a, b) => {
    const createdDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return createdDiff || b.id - a.id;
  });
}

export function getSourceLogStatus(
  log: SourceLog,
  productSourceUrls: Set<string>,
  candidatesBySourceLogId: Map<number, ProductCandidate>,
): SourceLogStatus {
  if (productSourceUrls.has(log.url)) return "登録済み";
  if (candidatesBySourceLogId.has(log.id)) return "候補検出";
  return "未登録";
}
