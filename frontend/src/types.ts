export type Product = {
  id: number;
  category: string;
  product_name: string;
  brand: string | null;
  price: number | null;
  release_date: string | null;
  sales_store: string | null;
  status: string;
  source_name: string | null;
  source_url: string | null;
  trend_score: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  category: string;
  product_name: string;
  brand: string;
  price: string;
  release_date: string;
  sales_store: string;
  status: string;
  source_name: string;
  source_url: string;
  trend_score: number;
  memo: string;
};

export type Keyword = {
  id: number;
  category: string;
  keyword: string;
  priority: number;
  is_active: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type KeywordInput = {
  category: string;
  keyword: string;
  priority: number;
  is_active: boolean;
  memo: string;
};

export type Source = {
  id: number;
  source_name: string;
  source_type: string;
  url: string;
  target_category: string;
  priority: number;
  is_active: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceInput = {
  source_name: string;
  source_type: string;
  url: string;
  target_category: string;
  priority: number;
  is_active: boolean;
  memo: string;
};

export type SourceLog = {
  id: number;
  source_id: number;
  title: string;
  url: string;
  raw_text: string | null;
  detected_at: string;
  created_at: string;
};

export type ProductCandidate = {
  id: number;
  source_log_id: number;
  category: string;
  product_name: string;
  price: number | null;
  release_date: string | null;
  sales_store: string | null;
  source_url: string;
  detected_reason: string;
  detected_keywords: string | null;
  profit_expectation: number;
  candidate_status: string;
  created_at: string;
  updated_at: string;
};

export type CollectorRunResponse = {
  source_id: number;
  fetched_url: string;
  created_count: number;
  skipped_count: number;
  skipped_reason: string | null;
  skipped_details: string[];
  logs: SourceLog[];
};

export type NotificationLog = {
  id: number;
  product_id: number;
  message: string;
  channel: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

export type NotificationLogInput = {
  product_id: number;
  message: string;
  channel: string;
  status: string;
  sent_at: string | null;
};
