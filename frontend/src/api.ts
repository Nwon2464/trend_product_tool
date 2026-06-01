import type {
  CollectorRunResponse,
  Keyword,
  KeywordInput,
  NotificationLog,
  NotificationLogCreateResponse,
  NotificationLogInput,
  Product,
  ProductCandidate,
  ProductCandidateStatus,
  ProductInput,
  ScrapingJob,
  ScrapingJobCreateRequest,
  ScrapingJobCreateResponse,
  Source,
  SourceInput,
  SourceLog,
} from "./types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type ApiErrorDetail = {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
};

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return typeof value === "object" && value !== null;
}

function normalizeErrorDetail(detail: unknown, status: number) {
  if (Array.isArray(detail)) {
    const details = detail.filter(isApiErrorDetail);
    const hasUrlError = details.some((item) => {
      const location = item.loc?.map(String) ?? [];
      return location.includes("url") || item.type?.startsWith("url_");
    });

    if (hasUrlError) {
      return "URL形式を確認してください。例: https://example.com/";
    }

    const hasRequiredError = details.some((item) =>
      item.type?.includes("missing"),
    );
    if (hasRequiredError) {
      return "必須項目を入力してください。";
    }

    return "入力内容を確認してください。";
  }

  if (typeof detail === "string") {
    const messageMap: Record<string, string> = {
      "Source not found": "情報源が見つかりません。",
      "Source is inactive": "無効な情報源です。",
      "Product not found": "商品が見つかりません。",
      "Keyword not found": "キーワードが見つかりません。",
      "Keyword already exists": "このキーワードはすでに登録されています。",
    };

    if (messageMap[detail]) {
      return messageMap[detail];
    }

    if (detail.startsWith("Collector failed:")) {
      return "取得に失敗しました。対象URLまたはアクセス条件を確認してください。";
    }

    return detail;
  }

  if (status === 422) {
    return "入力内容を確認してください。";
  }

  return `リクエストに失敗しました: ${status}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = `リクエストに失敗しました: ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) {
        message = normalizeErrorDetail(body.detail, response.status);
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function cleanProduct(input: ProductInput) {
  return {
    category: input.category.trim(),
    product_name: input.product_name.trim(),
    brand: input.brand.trim() || null,
    price: input.price.trim() ? Number(input.price) : null,
    release_date: input.release_date || null,
    sales_store: input.sales_store.trim() || null,
    status: input.status,
    source_name: input.source_name.trim() || null,
    source_url: input.source_url.trim() || null,
    trend_score: input.trend_score,
    memo: input.memo.trim() || null,
  };
}

function cleanSource(input: SourceInput) {
  return {
    source_name: input.source_name.trim(),
    source_type: input.source_type,
    url: input.url.trim(),
    target_category: input.target_category.trim(),
    priority: input.priority,
    is_active: input.is_active,
    memo: input.memo.trim() || null,
  };
}

export const api = {
  listProducts: (params: URLSearchParams) =>
    request<Product[]>(`/products?${params.toString()}`),
  createProduct: (input: ProductInput) =>
    request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(cleanProduct(input)),
    }),
  updateProduct: (id: number, input: ProductInput) =>
    request<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(cleanProduct(input)),
    }),
  deleteProduct: (id: number) =>
    request<void>(`/products/${id}`, {
      method: "DELETE",
    }),
  listKeywords: () => request<Keyword[]>("/keywords"),
  createKeyword: (input: KeywordInput) =>
    request<Keyword>("/keywords", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateKeyword: (id: number, input: Partial<KeywordInput>) =>
    request<Keyword>(`/keywords/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteKeyword: (id: number) =>
    request<void>(`/keywords/${id}`, {
      method: "DELETE",
    }),
  listSources: () => request<Source[]>("/sources"),
  createSource: (input: SourceInput) =>
    request<Source>("/sources", {
      method: "POST",
      body: JSON.stringify(cleanSource(input)),
    }),
  updateSource: (id: number, input: Partial<SourceInput>) =>
    request<Source>(`/sources/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteSource: (id: number) =>
    request<void>(`/sources/${id}`, {
      method: "DELETE",
    }),
  listSourceLogs: () => request<SourceLog[]>("/source-logs"),
  deleteSourceLog: (id: number) =>
    request<void>(`/source-logs/${id}`, {
      method: "DELETE",
    }),
  runCollector: (sourceId: number, selectedStatuses?: string[]) =>
    request<CollectorRunResponse>("/collectors/run", {
      method: "POST",
      body: JSON.stringify({
        source_id: sourceId,
        max_items: 10,
        respect_robots: true,
        minimum_interval_seconds: 300,
        selected_statuses: selectedStatuses?.length ? selectedStatuses : null,
      }),
    }),
  createScrapingJob: (input: ScrapingJobCreateRequest) =>
    request<ScrapingJobCreateResponse>("/scraping-jobs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getScrapingJob: (jobId: string) =>
    request<ScrapingJob>(`/scraping-jobs/${jobId}`),
  listScrapingJobs: () => request<ScrapingJob[]>("/scraping-jobs"),
  listProductCandidates: () =>
    request<ProductCandidate[]>("/product-candidates"),
  updateProductCandidate: (
    id: number,
    input: { candidate_status: ProductCandidateStatus },
  ) =>
    request<ProductCandidate>(`/product-candidates/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteProductCandidate: (id: number) =>
    request<void>(`/product-candidates/${id}`, {
      method: "DELETE",
    }),
  listNotificationLogs: () => request<NotificationLog[]>("/notification-logs"),
  createNotificationLog: (input: NotificationLogInput) =>
    request<NotificationLogCreateResponse>("/notification-logs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateNotificationLog: (id: number, input: Partial<NotificationLogInput>) =>
    request<NotificationLog>(`/notification-logs/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteNotificationLog: (id: number) =>
    request<void>(`/notification-logs/${id}`, {
      method: "DELETE",
    }),
};
