import { Ban, Check, Heart, ShoppingBag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  KeywordInput,
  ProductCandidateStatus,
  ProductInput,
  SourceInput,
} from "./types";

export const statusOptions = [
  "予約開始",
  "発売予定",
  "発売中",
  "再販",
  "抽選販売",
  "売り切れ",
  "完売",
  "廃盤",
  "不明",
];

export const sourceTypes = [
  "official",
  "retail",
  "summary",
  "sns_x",
  "sns_instagram",
  "news",
  "manual",
  "other",
];

export const sourceTypeLabels: Record<string, string> = {
  official: "公式",
  retail: "小売・EC",
  summary: "まとめ",
  sns_x: "X",
  sns_instagram: "Instagram",
  news: "ニュース",
  manual: "手動",
  other: "その他",
};

export const sortOptions = [
  { value: "created_at:desc", label: "登録日が新しい順" },
  { value: "release_date:asc", label: "発売日が近い順" },
  { value: "trend_score:desc", label: "スコアが高い順" },
];

export const SCRAPING_MIN_INTERVAL_SECONDS = 300;

export type CandidateStatusAction = {
  status: ProductCandidateStatus;
  label: string;
  activeLabel: string;
  icon: LucideIcon;
  className: string;
};

export const candidateStatusLabels: Record<ProductCandidateStatus, string> = {
  new: "新規",
  watching: "いいね済み",
  confirmed: "確認済み",
  ignored: "無視",
  purchased: "購入済み",
};

export const candidateStatusActions: CandidateStatusAction[] = [
  {
    status: "watching",
    label: "いいねする",
    activeLabel: "いいねを解除する",
    icon: Heart,
    className: "like",
  },
  {
    status: "confirmed",
    label: "確認済みにする",
    activeLabel: "確認済みを解除する",
    icon: Check,
    className: "confirmed",
  },
  {
    status: "ignored",
    label: "無視する",
    activeLabel: "無視を解除する",
    icon: Ban,
    className: "ignored",
  },
  {
    status: "purchased",
    label: "購入済みにする",
    activeLabel: "購入済みを解除する",
    icon: ShoppingBag,
    className: "purchased",
  },
];

export const emptyProduct: ProductInput = {
  category: "ポケモンカード",
  product_name: "",
  brand: "",
  price: "",
  release_date: "",
  sales_store: "",
  status: "不明",
  source_name: "",
  source_url: "",
  trend_score: 0,
  memo: "",
};

export const emptyKeyword: KeywordInput = {
  category: "ポケモンカード",
  keyword: "",
  priority: 2,
  is_active: true,
  memo: "",
};

export const emptySource: SourceInput = {
  source_name: "",
  source_type: "manual",
  url: "",
  target_category: "ポケモンカード",
  priority: 2,
  is_active: true,
  memo: "",
};
