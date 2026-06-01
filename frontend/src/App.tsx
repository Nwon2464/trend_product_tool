import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Download,
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  SendToBack,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { API_BASE_URL, api } from "./api";
import type {
  Keyword,
  KeywordInput,
  NotificationLog,
  Product,
  ProductCandidate,
  ProductInput,
  ScrapingJob,
  ScrapingJobEvent,
  Source,
  SourceInput,
  SourceLog,
} from "./types";

const statusOptions = ["予約開始", "発売予定", "発売中", "再販", "抽選販売", "売り切れ", "完売", "廃盤", "不明"];
const sourceTypes = ["official", "retail", "summary", "sns_x", "sns_instagram", "news", "manual", "other"];
const sourceTypeLabels: Record<string, string> = {
  official: "公式",
  retail: "小売・EC",
  summary: "まとめ",
  sns_x: "X",
  sns_instagram: "Instagram",
  news: "ニュース",
  manual: "手動",
  other: "その他",
};
const sortOptions = [
  { value: "created_at:desc", label: "登録日が新しい順" },
  { value: "release_date:asc", label: "発売日が近い順" },
  { value: "trend_score:desc", label: "スコアが高い順" },
];
const SCRAPING_MIN_INTERVAL_SECONDS = 300;
type ScrapingTargetStatus = "待機中" | "実行中" | "完了" | "失敗";
type ScrapingTargetProgress = {
  status: ScrapingTargetStatus;
  message: string;
  cooldownUntil?: number;
};
type TerminalLogLevel = "info" | "start" | "fetch" | "parse" | "detail" | "keyword" | "candidate" | "success" | "warn" | "error";
type TerminalLine = {
  id: string;
  time: string;
  level: TerminalLogLevel;
  message: string;
};
type ToastType = "success" | "info" | "warning" | "error";
type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};
type TableRow = Array<ReactNode> | {
  cells: Array<ReactNode>;
  className?: string;
};
type SourceLogFilter = "すべて" | "候補検出" | "登録済み" | "未登録";
type SourceLogStatus = "候補検出" | "登録済み" | "未登録";

const emptyProduct: ProductInput = {
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

const emptyKeyword: KeywordInput = {
  category: "ポケモンカード",
  keyword: "",
  priority: 2,
  is_active: true,
  memo: "",
};

const emptySource: SourceInput = {
  source_name: "",
  source_type: "manual",
  url: "",
  target_category: "ポケモンカード",
  priority: 2,
  is_active: true,
  memo: "",
};

type Tab = "products" | "collection" | "source-management" | "keywords" | "notifications";

function toProductInput(product: Product): ProductInput {
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

function scoreLabel(score: number) {
  if (score >= 80) return "高優先度";
  if (score >= 60) return "注視";
  if (score >= 40) return "低";
  return "除外";
}

function scoreClass(score: number) {
  if (score >= 80) return "high";
  if (score >= 60) return "watch";
  if (score >= 40) return "low";
  return "ignore";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function formatPriceYen(value: number | null) {
  if (value === null) return "-";
  return `${value.toLocaleString("ja-JP")} 円`;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatTerminalTime(date = new Date()) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getPayloadString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function getPayloadNumber(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "number" ? value : null;
}

function messageForSkipEvent(event: ScrapingJobEvent) {
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

function expectationLabel(score: number) {
  if (score >= 80) return "高期待";
  if (score >= 60) return "注目";
  if (score >= 40) return "低め";
  return "保留";
}

function categoryTone(category: string) {
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

function formatDetectedKeywords(value: string | null) {
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

function sortSourcesByNewest(items: Source[]) {
  return [...items].sort((a, b) => {
    const createdDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return createdDiff || b.id - a.id;
  });
}

function getSourceLogStatus(
  log: SourceLog,
  productSourceUrls: Set<string>,
  candidatesBySourceLogId: Map<number, ProductCandidate>,
): SourceLogStatus {
  if (productSourceUrls.has(log.url)) return "登録済み";
  if (candidatesBySourceLogId.has(log.id)) return "候補検出";
  return "未登録";
}

function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          <span className="toast-type">{toast.type}</span>
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("collection");
  const [products, setProducts] = useState<Product[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceLogs, setSourceLogs] = useState<SourceLog[]>([]);
  const [productCandidates, setProductCandidates] = useState<ProductCandidate[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [filters, setFilters] = useState({
    category: "",
    keyword: "",
    status: "",
    sales_store: "",
    min_score: "",
    sort: "created_at:desc",
  });
  const [productForm, setProductForm] = useState<ProductInput>(emptyProduct);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [keywordForm, setKeywordForm] = useState<KeywordInput>(emptyKeyword);
  const [sourceForm, setSourceForm] = useState<SourceInput>(emptySource);
  const [, setMessage] = useState("");
  const [, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const [isDeleteLogsModalOpen, setIsDeleteLogsModalOpen] = useState(false);
  const [evidenceCandidate, setEvidenceCandidate] = useState<ProductCandidate | null>(null);
  const [scrapingPrep, setScrapingPrep] = useState({
    category: "すべて",
    status: "すべて",
    sourceName: "",
  });
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<Record<string, ScrapingTargetProgress>>({});
  const [selectedScrapingKeys, setSelectedScrapingKeys] = useState<string[]>([]);
  const [sourceLogFilter, setSourceLogFilter] = useState<SourceLogFilter>("すべて");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [highlightedNotificationLogId, setHighlightedNotificationLogId] = useState<number | null>(null);
  const [activeScrapingJob, setActiveScrapingJob] = useState<ScrapingJob | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement | null>(null);
  const terminalLineSeq = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const categories = useMemo(() => {
    const values = new Set<string>();
    products.forEach((product) => values.add(product.category));
    keywords.forEach((keyword) => values.add(keyword.category));
    sources.forEach((source) => values.add(source.target_category));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ja"));
  }, [products, keywords, sources]);

  const stores = useMemo(() => {
    const values = new Set<string>();
    products.forEach((product) => {
      if (product.sales_store) values.add(product.sales_store);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ja"));
  }, [products]);

  const productSourceUrls = useMemo(() => {
    return new Set(products.map((product) => product.source_url).filter((url): url is string => Boolean(url)));
  }, [products]);

  const candidatesBySourceLogId = useMemo(() => {
    return new Map(productCandidates.map((candidate) => [candidate.source_log_id, candidate]));
  }, [productCandidates]);

  const filteredSourceLogs = useMemo(() => {
    return sourceLogs.filter((log) => {
      const status = getSourceLogStatus(log, productSourceUrls, candidatesBySourceLogId);
      if (sourceLogFilter !== "すべて") return status === sourceLogFilter;
      return true;
    });
  }, [candidatesBySourceLogId, productSourceUrls, sourceLogFilter, sourceLogs]);

  const sortedProductCandidates = useMemo(() => (
    [...productCandidates].sort((a, b) => {
      const scoreDiff = b.profit_expectation - a.profit_expectation;
      return scoreDiff || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
  ), [productCandidates]);

  const candidateGroups = useMemo(() => {
    const groups = new Map<string, ProductCandidate[]>();
    sortedProductCandidates.forEach((candidate) => {
      const group = groups.get(candidate.category) ?? [];
      group.push(candidate);
      groups.set(candidate.category, group);
    });
    return Array.from(groups.entries())
      .map(([category, candidates]) => ({
        category,
        candidates,
        highCount: candidates.filter((candidate) => candidate.profit_expectation >= 80).length,
        averageExpectation: Math.round(candidates.reduce((total, candidate) => total + candidate.profit_expectation, 0) / candidates.length),
      }))
      .sort((a, b) => {
        const topScoreDiff = (b.candidates[0]?.profit_expectation ?? 0) - (a.candidates[0]?.profit_expectation ?? 0);
        return topScoreDiff || b.candidates.length - a.candidates.length;
      });
  }, [sortedProductCandidates]);

  const deletableUnregisteredLogs = useMemo(() => (
    filteredSourceLogs.filter((log) => getSourceLogStatus(log, productSourceUrls, candidatesBySourceLogId) === "未登録")
  ), [candidatesBySourceLogId, filteredSourceLogs, productSourceUrls]);

  const scrapingUrls = useMemo(() => {
    const sourceNameQuery = scrapingPrep.sourceName.trim().toLowerCase();
    return sortSourcesByNewest(sources)
      .filter((source) => {
        const matchesCategory = scrapingPrep.category === "すべて" || source.target_category === scrapingPrep.category;
        const matchesSourceName = sourceNameQuery === "" || source.source_name.toLowerCase().includes(sourceNameQuery);
        return matchesCategory && matchesSourceName;
      })
      .map((source) => ({
        key: `registered-${source.id}`,
        id: source.id,
        name: source.source_name,
        url: source.url,
        category: source.target_category,
        kind: "登録済み",
      }));
  }, [scrapingPrep.category, scrapingPrep.sourceName, sources]);

  const selectedScrapingTargets = useMemo(() => (
    scrapingUrls.filter((source) => selectedScrapingKeys.includes(source.key))
  ), [scrapingUrls, selectedScrapingKeys]);

  const sourceCooldownUntilById = useMemo(() => {
    const values = new Map<number, number>();
    sourceLogs.forEach((log) => {
      const detectedAt = new Date(log.detected_at).getTime();
      if (Number.isNaN(detectedAt)) return;
      const cooldownUntil = detectedAt + SCRAPING_MIN_INTERVAL_SECONDS * 1000;
      const current = values.get(log.source_id) ?? 0;
      if (cooldownUntil > current) {
        values.set(log.source_id, cooldownUntil);
      }
    });
    return values;
  }, [sourceLogs]);

  const getScrapingCooldownUntil = useCallback((target: (typeof scrapingUrls)[number]) => {
    const progressCooldownUntil = scrapingProgress[target.key]?.cooldownUntil ?? 0;
    const sourceCooldownUntil = typeof target.id === "number" ? sourceCooldownUntilById.get(target.id) ?? 0 : 0;
    return Math.max(progressCooldownUntil, sourceCooldownUntil);
  }, [scrapingProgress, sourceCooldownUntilById]);

  const getScrapingRemainingSeconds = useCallback((target: (typeof scrapingUrls)[number]) => {
    const cooldownUntil = getScrapingCooldownUntil(target);
    return Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));
  }, [getScrapingCooldownUntil, nowMs]);

  const runnableScrapingTargets = useMemo(() => (
    selectedScrapingTargets.filter((target) => getScrapingRemainingSeconds(target) === 0)
  ), [getScrapingRemainingSeconds, selectedScrapingTargets]);

  const appendTerminalLine = useCallback((level: TerminalLogLevel, message: string) => {
    terminalLineSeq.current += 1;
    setTerminalLines((current) => [
      ...current,
      {
        id: `${Date.now()}-${terminalLineSeq.current}`,
        time: formatTerminalTime(),
        level,
        message,
      },
    ]);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [{ id, type, message, createdAt: Date.now() }, ...current]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const appendScrapingJobEvent = useCallback((event: ScrapingJobEvent) => {
    const levelByEventType: Record<string, TerminalLogLevel> = {
      start: "start",
      source_start: "start",
      fetch: "fetch",
      parse: "parse",
      detail_fetch: "detail",
      keyword: "keyword",
      candidate: "candidate",
      skip: "warn",
      warn: "warn",
      error: "error",
      source_done: "success",
      done: "success",
    };
    const level = levelByEventType[event.event_type] ?? (event.level === "error" ? "error" : event.level === "warn" ? "warn" : event.level === "success" ? "success" : "info");
    const eventTime = new Date(event.created_at);
    terminalLineSeq.current += 1;
    setTerminalLines((current) => [
      ...current,
      {
        id: `sse-${event.id}-${terminalLineSeq.current}`,
        time: Number.isNaN(eventTime.getTime()) ? formatTerminalTime() : formatTerminalTime(eventTime),
        level,
        message: event.message,
      },
    ]);
  }, []);

  const scrollTerminalToLatest = useCallback(() => {
    const body = terminalBodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || key === "sort") return;
        params.set(key, value);
      });
      const [sortBy, sortOrder] = filters.sort.split(":");
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      const [nextProducts, nextKeywords, nextSources, nextSourceLogs, nextProductCandidates, nextNotificationLogs] = await Promise.all([
        api.listProducts(params),
        api.listKeywords(),
        api.listSources(),
        api.listSourceLogs(),
        api.listProductCandidates(),
        api.listNotificationLogs(),
      ]);
      setProducts(nextProducts);
      setKeywords(nextKeywords);
      setSources(sortSourcesByNewest(nextSources));
      setSourceLogs(nextSourceLogs);
      setProductCandidates(nextProductCandidates);
      setNotificationLogs(nextNotificationLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    if (!isProductModalOpen && !isSourceModalOpen && !isKeywordModalOpen && !isScrapingModalOpen && !isDeleteLogsModalOpen && evidenceCandidate === null) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [evidenceCandidate, isDeleteLogsModalOpen, isKeywordModalOpen, isProductModalOpen, isScrapingModalOpen, isSourceModalOpen]);

  useEffect(() => {
    if (!isScrapingModalOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isScrapingModalOpen]);

  useEffect(() => {
    if (!isScrapingModalOpen) return;
    appendTerminalLine("info", "Scraping modal opened");
  }, [appendTerminalLine, isScrapingModalOpen]);

  useEffect(() => {
    if (!isScrapingModalOpen) return;
    appendTerminalLine("info", `Sources loaded: ${scrapingUrls.length}`);
  }, [appendTerminalLine, isScrapingModalOpen, scrapingUrls.length]);

  useEffect(() => {
    scrollTerminalToLatest();
  }, [scrollTerminalToLatest, terminalLines]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setSelectedScrapingKeys((current) => (
      current.filter((key) => scrapingUrls.some((source) => source.key === key))
    ));
  }, [scrapingUrls]);

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingProductId === null) {
        await api.createProduct(productForm);
      } else {
        await api.updateProduct(editingProductId, productForm);
        setMessage("商品を更新しました");
      }
      if (editingProductId === null) {
        setMessage("商品を登録しました");
      }
      setProductForm(emptyProduct);
      setEditingProductId(null);
      setIsProductModalOpen(false);
      setActiveTab("products");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "商品の保存に失敗しました");
    }
  }

  async function deleteProduct(id: number) {
    if (!window.confirm("この商品を削除しますか？")) return;
    await api.deleteProduct(id);
    await loadAll();
  }

  async function submitKeyword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createKeyword(keywordForm);
      setKeywordForm(emptyKeyword);
      setIsKeywordModalOpen(false);
      setMessage("キーワードを登録しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キーワードの保存に失敗しました");
    }
  }

  function openKeywordCreateModal() {
    setKeywordForm(emptyKeyword);
    setIsKeywordModalOpen(true);
  }

  function closeKeywordModal() {
    setIsKeywordModalOpen(false);
    setKeywordForm(emptyKeyword);
  }

  async function toggleKeyword(keyword: Keyword) {
    await api.updateKeyword(keyword.id, { is_active: !keyword.is_active });
    await loadAll();
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const createdSource = await api.createSource(sourceForm);
      setSources((current) => sortSourcesByNewest([createdSource, ...current.filter((source) => source.id !== createdSource.id)]));
      setSourceForm(emptySource);
      setIsSourceModalOpen(false);
      setMessage("情報源を登録しました。スクレイピング準備にも反映されています。");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "情報源の保存に失敗しました");
    }
  }

  function openSourceCreateModal() {
    setSourceForm(emptySource);
    setIsSourceModalOpen(true);
  }

  function closeSourceModal() {
    setIsSourceModalOpen(false);
    setSourceForm(emptySource);
  }

  async function toggleSource(source: Source) {
    setError("");
    setMessage("");
    try {
      await api.updateSource(source.id, { is_active: !source.is_active });
      setMessage(source.is_active ? "情報源を無効化しました" : "情報源を有効化しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "情報源の更新に失敗しました");
    }
  }

  async function deleteSource(source: Source) {
    setError("");
    setMessage("");
    try {
      await api.deleteSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      setMessage("情報源を削除しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "情報源の削除に失敗しました");
    }
  }

  async function deleteVisibleUnregisteredLogs() {
    if (deletableUnregisteredLogs.length === 0) return;

    setError("");
    setMessage("");
    try {
      for (const log of deletableUnregisteredLogs) {
        await api.deleteSourceLog(log.id);
      }
      setMessage(`未登録ログを${deletableUnregisteredLogs.length}件削除しました`);
      setIsDeleteLogsModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未登録ログの削除に失敗しました");
    }
  }

  async function deleteSourceLog(log: SourceLog) {
    const status = getSourceLogStatus(log, productSourceUrls, candidatesBySourceLogId);
    setError("");
    setMessage("");
    if (status !== "未登録") {
      setError("候補検出済み、登録済みの取得ログは削除できません");
      return;
    }

    try {
      await api.deleteSourceLog(log.id);
      setMessage("未登録ログを削除しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得ログの削除に失敗しました");
    }
  }

  async function runCollector(source: Source) {
    setError("");
    setMessage("");
    try {
      const result = await api.runCollector(source.id);
      if (result.skipped_reason === "minimum_interval") {
        setMessage("直近で取得済みのためスキップ");
      } else if (result.skipped_reason === "robots_disallow") {
        setMessage("robots.txt により取得をスキップしました");
      } else if (result.skipped_reason === "no_usable_items") {
        setMessage("保存できる対象URLが見つかりませんでした");
      } else {
        setMessage(`取得完了: ${result.candidates.length}件候補作成 / ${result.created_count}件ログ保存 / ${result.skipped_count}件スキップ`);
      }
      await loadAll();
      setActiveTab("collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    }
  }

  async function startScrapingFromPrep() {
    const targets = runnableScrapingTargets;
    if (targets.length === 0) {
      return;
    }
    await startScrapingJob(targets);
  }

  async function runSingleScrapingTarget(target: (typeof scrapingUrls)[number]) {
    if (getScrapingRemainingSeconds(target) > 0) {
      return;
    }
    await startScrapingJob([target]);
  }

  function toggleScrapingTarget(key: string) {
    setSelectedScrapingKeys((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  }

  function toggleAllScrapingTargets() {
    setSelectedScrapingKeys((current) => (
      current.length === scrapingUrls.length ? [] : scrapingUrls.map((source) => source.key)
    ));
  }

  async function retryScrapingTarget(target: (typeof scrapingUrls)[number]) {
    if (getScrapingRemainingSeconds(target) > 0) {
      return;
    }
    await startScrapingJob([target]);
  }

  async function startScrapingJob(targets: (typeof scrapingUrls)[number][]) {
    setError("");
    setMessage("");
    setIsScrapingRunning(true);
    setActiveScrapingJob(null);
    eventSourceRef.current?.close();
    setScrapingProgress((current) => ({
      ...current,
      ...Object.fromEntries(targets.map((target) => [target.key, { status: "待機中" as const, message: "" }])),
    }));
    try {
      const sourceIds = targets.map((target) => target.id);
      const selectedStatuses = scrapingPrep.status === "すべて" ? null : [scrapingPrep.status];
      appendTerminalLine("info", "POST /scraping-jobs");
      const job = await api.createScrapingJob({
        source_ids: sourceIds,
        target_category: scrapingPrep.category === "すべて" ? null : scrapingPrep.category,
        selected_statuses: selectedStatuses,
        max_items_per_source: 10,
        respect_robots: true,
        minimum_interval_seconds: SCRAPING_MIN_INTERVAL_SECONDS,
      });
      setActiveScrapingJob({
        job_id: job.job_id,
        status: job.status,
        target_category: scrapingPrep.category === "すべて" ? null : scrapingPrep.category,
        selected_statuses: selectedStatuses,
        total_sources: job.total_sources,
        completed_sources: 0,
        failed_sources: 0,
        skipped_sources: 0,
        created_logs_count: 0,
        created_candidates_count: 0,
        started_at: null,
        finished_at: null,
        error_message: null,
      });
      appendTerminalLine("info", `Scraping job created: ${job.job_id}`);
      connectScrapingJobEvents(job.job_id, targets);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Scraping job の作成に失敗しました";
      appendTerminalLine("error", errorMessage);
      addToast("error", errorMessage);
      setError(errorMessage);
      setIsScrapingRunning(false);
    }
  }

  function connectScrapingJobEvents(jobId: string, targets: (typeof scrapingUrls)[number][]) {
    const targetBySourceId = new Map(targets.map((target) => [target.id, target]));
    const eventSource = new EventSource(`${API_BASE_URL}/scraping-jobs/${jobId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      const jobEvent = JSON.parse((event as MessageEvent).data) as ScrapingJobEvent;
      appendScrapingJobEvent(jobEvent);
      if (jobEvent.source_id !== null) {
        const target = targetBySourceId.get(jobEvent.source_id);
        if (target) {
          setScrapingProgress((current) => {
            const nextProgress: ScrapingTargetProgress = {
              status: current[target.key]?.status ?? "待機中",
              message: current[target.key]?.message ?? "",
              cooldownUntil: current[target.key]?.cooldownUntil,
            };
            if (jobEvent.event_type === "source_start" || jobEvent.event_type === "fetch" || jobEvent.event_type === "parse") {
              nextProgress.status = "実行中";
              nextProgress.message = "取得中";
            } else if (jobEvent.event_type === "skip") {
              nextProgress.status = "完了";
              nextProgress.message = messageForSkipEvent(jobEvent);
              const reason = getPayloadString(jobEvent.payload, "reason");
              const nextRetrySeconds = getPayloadNumber(jobEvent.payload, "next_retry_seconds");
              nextProgress.cooldownUntil = reason === "minimum_interval" && nextRetrySeconds !== null
                ? Date.now() + nextRetrySeconds * 1000
                : undefined;
            } else if (jobEvent.event_type === "error") {
              nextProgress.status = "失敗";
              nextProgress.message = jobEvent.message;
              nextProgress.cooldownUntil = undefined;
            } else if (jobEvent.event_type === "candidate") {
              nextProgress.status = "実行中";
              nextProgress.message = "商品候補を作成";
            } else if (jobEvent.event_type === "source_done") {
              nextProgress.status = "完了";
              nextProgress.message = "取得完了";
              nextProgress.cooldownUntil = undefined;
            }
            return { ...current, [target.key]: nextProgress };
          });
        }
      }
      void api.getScrapingJob(jobId).then(setActiveScrapingJob).catch(() => undefined);
    });

    eventSource.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { status?: string; message?: string };
      appendTerminalLine(data.status === "completed" ? "success" : "error", data.message ?? "Scraping job completed");
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
      setIsScrapingRunning(false);
      appendTerminalLine("info", "Refreshing candidates and logs");
      void api.getScrapingJob(jobId).then((job) => {
        setActiveScrapingJob(job);
        if (data.status === "completed" && job.skipped_sources > 0) {
          addToast("warning", "一部の情報源がスキップされました");
        } else if (data.status === "completed") {
          addToast("success", "Scraping Job が完了しました");
        } else {
          addToast("error", "Scraping Job に失敗しました");
        }
      }).catch(() => {
        addToast(data.status === "completed" ? "success" : "error", data.status === "completed" ? "Scraping Job が完了しました" : "Scraping Job に失敗しました");
      });
      void loadAll().then(() => {
        setActiveTab("collection");
        setMessage(data.status === "completed" ? "Scraping job が完了しました" : "Scraping job が失敗しました");
      });
    });

    eventSource.onerror = () => {
      appendTerminalLine("error", "SSE connection error");
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
      setIsScrapingRunning(false);
      addToast("error", "Scraping Job に失敗しました");
      setError("SSE接続に失敗しました");
    };
  }

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm(toProductInput(product));
    setIsProductModalOpen(true);
  }

  function prefillProductFromSourceLog(log: SourceLog) {
    const source = sources.find((item) => item.id === log.source_id);
    const candidate = candidatesBySourceLogId.get(log.id);
    setEditingProductId(null);
    setProductForm({
      ...emptyProduct,
      category: candidate?.category ?? source?.target_category ?? emptyProduct.category,
      product_name: candidate?.product_name ?? log.title,
      price: candidate?.price === null || candidate?.price === undefined ? "" : String(candidate.price),
      release_date: candidate?.release_date ?? "",
      sales_store: candidate?.sales_store ?? "",
      status: "不明",
      source_name: candidate?.sales_store ?? source?.source_name ?? "",
      source_url: candidate?.source_url ?? log.url,
      trend_score: candidate?.profit_expectation ?? emptyProduct.trend_score,
      memo: [
        candidate ? "商品候補から作成" : "取得ログから作成",
        `取得ログID: ${log.id}`,
        candidate ? `候補ID: ${candidate.id}` : "",
        candidate ? `感知理由: ${candidate.detected_reason}` : "",
        candidate ? `利益期待度: ${candidate.profit_expectation} / ${expectationLabel(candidate.profit_expectation)}` : "",
        log.raw_text ? `取得内容: ${log.raw_text}` : "",
      ].filter(Boolean).join("\n"),
    });
    setMessage(candidate ? "商品候補の内容を商品登録フォームに反映しました" : "取得ログの内容を商品登録フォームに反映しました");
    setIsProductModalOpen(true);
  }

  function prefillProductFromCandidate(candidate: ProductCandidate) {
    const log = sourceLogs.find((item) => item.id === candidate.source_log_id);
    setEditingProductId(null);
    setProductForm({
      ...emptyProduct,
      category: candidate.category,
      product_name: candidate.product_name,
      price: candidate.price === null ? "" : String(candidate.price),
      release_date: candidate.release_date ?? "",
      sales_store: candidate.sales_store ?? "",
      status: "不明",
      source_name: candidate.sales_store ?? "",
      source_url: candidate.source_url,
      trend_score: candidate.profit_expectation,
      memo: [
        "商品候補から作成",
        `候補ID: ${candidate.id}`,
        `取得ログID: ${candidate.source_log_id}`,
        `検出理由: ${candidate.detected_reason}`,
        `検出キーワード: ${formatDetectedKeywords(candidate.detected_keywords)}`,
        `利益期待度: ${candidate.profit_expectation} / ${expectationLabel(candidate.profit_expectation)}`,
        log?.raw_text ? `取得内容: ${log.raw_text}` : "",
      ].filter(Boolean).join("\n"),
    });
    setMessage("商品候補の内容を商品登録フォームに反映しました");
    setIsProductModalOpen(true);
  }

  function openProductCreateModal() {
    setEditingProductId(null);
    setProductForm(emptyProduct);
    setIsProductModalOpen(true);
  }

  function closeProductModal() {
    setIsProductModalOpen(false);
    setEditingProductId(null);
    setProductForm(emptyProduct);
  }

  function buildNotificationMessage(product: Product) {
    const store = product.sales_store ? ` / 販売店: ${product.sales_store}` : "";
    const releaseDate = product.release_date ? ` / 発売日: ${product.release_date}` : "";
    return `【${product.category}】${product.product_name} / 状態: ${product.status}${store}${releaseDate} / スコア: ${product.trend_score}`;
  }

  async function createManualNotification(product: Product) {
    setError("");
    setMessage("");
    try {
      const result = await api.createNotificationLog({
        product_id: product.id,
        message: buildNotificationMessage(product),
        channel: "manual",
        status: "pending",
        sent_at: null,
      });
      const notificationMessage = result.duplicated ? "同じ通知ログがすでに存在します" : "通知ログを作成しました";
      setMessage(notificationMessage);
      if (result.duplicated) {
        setHighlightedNotificationLogId(result.notification_log.id);
        window.setTimeout(() => {
          setHighlightedNotificationLogId((current) => current === result.notification_log.id ? null : current);
        }, 9000);
      }
      addToast(
        result.duplicated ? "warning" : "success",
        result.duplicated ? `${notificationMessage}（ID: ${result.notification_log.id}）` : notificationMessage,
      );
      await loadAll();
      setActiveTab("notifications");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "通知ログの作成に失敗しました";
      setError(errorMessage);
      addToast("error", errorMessage);
    }
  }

  async function refreshAll() {
    setMessage("");
    await loadAll();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ローカルMVP</p>
          <h1>話題商品・最新情報収集ツール</h1>
        </div>
        <button className="secondary-button topbar-refresh" onClick={() => void refreshAll()} disabled={loading} title="データ更新">
          <RefreshCw size={18} />
          データ更新
        </button>
      </header>

      <nav className="tabs" aria-label="メインナビゲーション">
        <button className={activeTab === "collection" ? "active" : ""} onClick={() => setActiveTab("collection")}>
          情報収集
        </button>
        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>
          商品一覧
        </button>
        <button className={activeTab === "source-management" ? "active" : ""} onClick={() => setActiveTab("source-management")}>
          情報源管理
        </button>
        <button className={activeTab === "keywords" ? "active" : ""} onClick={() => setActiveTab("keywords")}>
          キーワード
        </button>
        <button className={activeTab === "notifications" ? "active" : ""} onClick={() => setActiveTab("notifications")}>
          通知ログ
        </button>
      </nav>

      <ToastContainer toasts={toasts} />

      <main>
        {activeTab === "products" && (
          <section className="panel">
            <div className="section-heading">
              <div className="section-title-group">
                <h2>商品一覧</h2>
                <span className="count-badge">現在 {products.length} 件</span>
              </div>
              <div className="heading-actions">
                <button className="primary-button" onClick={openProductCreateModal}>
                  <Plus size={16} /> 商品情報を登録
                </button>
              </div>
            </div>
            <div className="filters">
              <label>
                カテゴリ
                <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                  <option value="">すべて</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                キーワード
                <div className="input-with-icon">
                  <Search size={16} />
                  <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} />
                </div>
              </label>
              <label>
                ステータス
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <option value="">すべて</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                販売店
                <input list="stores" value={filters.sales_store} onChange={(event) => setFilters({ ...filters, sales_store: event.target.value })} />
                <datalist id="stores">
                  {stores.map((store) => <option key={store} value={store} />)}
                </datalist>
              </label>
              <label>
                最小スコア
                <input type="number" min="0" max="100" value={filters.min_score} onChange={(event) => setFilters({ ...filters, min_score: event.target.value })} />
              </label>
              <label>
                並び替え
                <div className="input-with-icon">
                  <ArrowDownUp size={16} />
                  <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </label>
              <button className="primary-button" onClick={loadAll}>更新</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>カテゴリ</th>
                    <th>商品</th>
                    <th>価格</th>
                    <th>発売日</th>
                    <th>販売店</th>
                    <th>状態</th>
                    <th>情報源</th>
                    <th>スコア</th>
                    <th>登録日</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.id}</td>
                      <td>{product.category}</td>
                      <td>
                        <strong>{product.product_name}</strong>
                        <small>{product.brand ?? "-"}</small>
                      </td>
                      <td>{product.price === null ? "-" : product.price.toLocaleString("ja-JP")}</td>
                      <td>{formatDate(product.release_date)}</td>
                      <td>{product.sales_store ?? "-"}</td>
                      <td>{product.status}</td>
                      <td>{product.source_name ?? "-"}</td>
                      <td><span className={`score score-${scoreClass(product.trend_score)}`}>{product.trend_score} / {scoreLabel(product.trend_score)}</span></td>
                      <td>{formatDate(product.created_at)}</td>
                      <td className="actions">
                        <button className="icon-button" onClick={() => editProduct(product)} title="編集"><Pencil size={16} /></button>
                        <button className="icon-button" onClick={() => void createManualNotification(product)} title="通知ログ作成"><Megaphone size={16} /></button>
                        {product.source_url && (
                          <a className="icon-button" href={product.source_url} target="_blank" rel="noreferrer" title="情報源を開く"><ExternalLink size={16} /></a>
                        )}
                        <button className="icon-button danger" onClick={() => void deleteProduct(product.id)} title="削除"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={11} className="empty-cell">商品がありません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "keywords" && (
          <section className="panel">
            <div className="section-heading">
              <div className="section-title-group">
                <h2>検出キーワード管理</h2>
                <span className="count-badge">現在 {keywords.length} 件</span>
              </div>
              <div className="heading-actions">
                <button className="primary-button" onClick={openKeywordCreateModal}>
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
                  <button className="secondary-button" onClick={() => void toggleKeyword(keyword)}>{keyword.is_active ? "検出から外す" : "検出に使う"}</button>
                  <button className="icon-button danger" onClick={() => void api.deleteKeyword(keyword.id).then(loadAll)} title="削除"><Trash2 size={16} /></button>
                </div>,
              ])}
            />
          </section>
        )}

        {activeTab === "collection" && (
          <section className="panel">
            <div className="section-heading">
              <h2>情報収集</h2>
              <span>商品候補 {sortedProductCandidates.length}件 / 補助ログ {filteredSourceLogs.length}件</span>
            </div>
            <div className="toolbar-row">
              <button className="primary-button" onClick={() => {
                setScrapingPrep({ category: "すべて", status: "すべて", sourceName: "" });
                setIsScrapingModalOpen(true);
              }}>
                <Search size={16} /> スクレイピング準備
              </button>
              <div className="toolbar-actions">
                <button className="secondary-button" disabled={deletableUnregisteredLogs.length === 0} onClick={() => setIsDeleteLogsModalOpen(true)}>
                  表示中の未登録を削除
                </button>
                <label className="compact-filter">
                  表示
                  <select value={sourceLogFilter} onChange={(event) => setSourceLogFilter(event.target.value as SourceLogFilter)}>
                    <option value="すべて">すべて</option>
                    <option value="候補検出">候補検出</option>
                    <option value="登録済み">登録済み</option>
                    <option value="未登録">未登録</option>
                  </select>
                </label>
              </div>
            </div>
            {candidateGroups.length > 0 ? (
              <div className="candidate-board">
                {candidateGroups.map((group) => (
                  <section className={`candidate-category category-${categoryTone(group.category)}`} key={group.category}>
                    <div className="candidate-category-header">
                      <div>
                        <h3>{group.category}</h3>
                        <span>{group.candidates.length}件 / 高期待 {group.highCount}件 / 平均 {group.averageExpectation}</span>
                      </div>
                    </div>
                    <SimpleTable
                      headers={["商品名候補", "価格", "発売日", "販売元", "利益期待度", "検出理由", "キーワード", "情報元", "操作"]}
                      rows={group.candidates.map((candidate) => [
                        <strong key={candidate.id}>{candidate.product_name}</strong>,
                        formatPriceYen(candidate.price),
                        formatDate(candidate.release_date),
                        candidate.sales_store ?? "-",
                        <span className={`score score-${scoreClass(candidate.profit_expectation)}`} key={candidate.id}>{candidate.profit_expectation} / {expectationLabel(candidate.profit_expectation)}</span>,
                        candidate.detected_reason,
                        formatDetectedKeywords(candidate.detected_keywords),
                        <a className="source-link-button" href={candidate.source_url} target="_blank" rel="noreferrer" key={candidate.id}><ExternalLink size={14} /> 開く</a>,
                        <div className="actions candidate-actions" key={candidate.id}>
                          <button className="secondary-button" onClick={() => setEvidenceCandidate(candidate)}><Search size={16} /> 根拠を見る</button>
                          <button className="primary-button" onClick={() => prefillProductFromCandidate(candidate)}><SendToBack size={16} /> 商品登録へ</button>
                        </div>,
                      ])}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>商品候補がありません</h3>
                <p>スクレイピング準備から情報源を選択して候補を収集してください。</p>
              </div>
            )}
          </section>
        )}

        {activeTab === "source-management" && (
          <section className="panel">
            <div className="section-heading">
              <h2>情報源管理</h2>
              <div className="heading-actions">
                <span>{sources.length}件</span>
                <button className="primary-button" onClick={openSourceCreateModal}>
                  <Plus size={16} /> 情報源URLを登録
                </button>
              </div>
            </div>
            <h3 className="subheading">登録済み情報源</h3>
            <SimpleTable
              headers={["名前", "種類", "リンク", "カテゴリ", "優先度", "有効", "メモ", "操作"]}
              rows={sources.map((source) => [
                source.source_name,
                sourceTypeLabels[source.source_type] ?? source.source_type,
                <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.url}</a>,
                source.target_category,
                String(source.priority),
                source.is_active ? "有効" : "無効",
                source.memo ?? "",
                <div className="actions" key={source.id}>
                  <button className="secondary-button" onClick={() => void toggleSource(source)}>{source.is_active ? "無効化" : "有効化"}</button>
                  <button className="icon-button danger" onClick={() => void deleteSource(source)} title="削除"><Trash2 size={16} /></button>
                </div>,
              ])}
            />
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="panel">
            <div className="section-heading">
              <h2>通知ログ</h2>
              <span>{notificationLogs.length}件</span>
            </div>
            <SimpleTable
              headers={["ID", "商品ID", "チャンネル", "状態", "メッセージ", "作成日", "操作"]}
              rows={notificationLogs.map((log) => ({
                className: highlightedNotificationLogId === log.id ? "duplicate-highlight-row" : undefined,
                cells: [
                  <span className="notification-log-id" key={log.id}>{log.id}</span>,
                  String(log.product_id),
                  log.channel === "manual" ? "手動" : log.channel,
                  log.status === "pending" ? "未送信" : log.status,
                  log.message,
                  formatDate(log.created_at),
                  <div className="actions" key={log.id}>
                    <button className="secondary-button" onClick={() => void api.updateNotificationLog(log.id, { status: "sent", sent_at: new Date().toISOString() }).then(loadAll)}>
                      送信済みにする
                    </button>
                    <button className="icon-button danger" onClick={() => void api.deleteNotificationLog(log.id).then(loadAll)} title="削除"><Trash2 size={16} /></button>
                  </div>,
                ],
              }))}
            />
          </section>
        )}
      </main>

      {isProductModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeProductModal}>
          <div className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="product-modal-title">{editingProductId === null ? "商品情報を登録" : "商品情報を編集"}</h2>
              <button className="icon-button" onClick={closeProductModal} title="閉じる"><X size={16} /></button>
            </div>
            <div className="product-modal-content">
              <ProductForm value={productForm} onChange={setProductForm} onSubmit={submitProduct} categories={categories} />
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeProductModal}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {isSourceModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeSourceModal}>
          <div className="source-modal" role="dialog" aria-modal="true" aria-labelledby="source-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="source-modal-title">情報源URLを登録</h2>
              <button className="icon-button" onClick={closeSourceModal} title="閉じる"><X size={16} /></button>
            </div>
            <form className="source-form source-modal-form" onSubmit={submitSource}>
              <label>
                情報源名
                <input placeholder="情報源名" value={sourceForm.source_name} onChange={(event) => setSourceForm({ ...sourceForm, source_name: event.target.value })} required />
              </label>
              <label>
                URL
                <input placeholder="リンク" value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} required />
              </label>
              <label>
                対象カテゴリ
                <input placeholder="対象カテゴリ" value={sourceForm.target_category} onChange={(event) => setSourceForm({ ...sourceForm, target_category: event.target.value })} required />
              </label>
              <label>
                source_type
                <select value={sourceForm.source_type} onChange={(event) => setSourceForm({ ...sourceForm, source_type: event.target.value })}>
                  {sourceTypes.map((type) => <option key={type} value={type}>{sourceTypeLabels[type]}</option>)}
                </select>
              </label>
              <label>
                priority
                <input type="number" min="1" max="3" value={sourceForm.priority} onChange={(event) => setSourceForm({ ...sourceForm, priority: Number(event.target.value) })} />
              </label>
              <label>
                memo
                <input placeholder="メモ" value={sourceForm.memo} onChange={(event) => setSourceForm({ ...sourceForm, memo: event.target.value })} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={sourceForm.is_active} onChange={(event) => setSourceForm({ ...sourceForm, is_active: event.target.checked })} />
                is_active
              </label>
              <div className="modal-actions wide">
                <button type="button" className="secondary-button" onClick={closeSourceModal}>キャンセル</button>
                <button className="primary-button"><Plus size={16} /> 情報源URLを登録</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isKeywordModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeKeywordModal}>
          <div className="keyword-modal" role="dialog" aria-modal="true" aria-labelledby="keyword-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="keyword-modal-title">検出キーワードを追加</h2>
              <button className="icon-button" onClick={closeKeywordModal} title="閉じる"><X size={16} /></button>
            </div>
            <form className="keyword-modal-form" onSubmit={submitKeyword}>
              <label>
                カテゴリ
                <input placeholder="例: ポケモンカード" value={keywordForm.category} onChange={(event) => setKeywordForm({ ...keywordForm, category: event.target.value })} required />
              </label>
              <label>
                キーワード
                <input placeholder="例: ポケカ 再販" value={keywordForm.keyword} onChange={(event) => setKeywordForm({ ...keywordForm, keyword: event.target.value })} required />
              </label>
              <label>
                priority
                <input type="number" min="1" max="3" value={keywordForm.priority} onChange={(event) => setKeywordForm({ ...keywordForm, priority: Number(event.target.value) })} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={keywordForm.is_active} onChange={(event) => setKeywordForm({ ...keywordForm, is_active: event.target.checked })} />
                検出に使う
              </label>
              <label className="wide">
                memo
                <input placeholder="メモ" value={keywordForm.memo} onChange={(event) => setKeywordForm({ ...keywordForm, memo: event.target.value })} />
              </label>
              <div className="modal-actions wide">
                <button type="button" className="secondary-button" onClick={closeKeywordModal}>キャンセル</button>
                <button className="primary-button"><Plus size={16} /> キーワードを追加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteLogsModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsDeleteLogsModalOpen(false)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-logs-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="delete-logs-modal-title">未登録ログの削除</h2>
              <button className="icon-button" onClick={() => setIsDeleteLogsModalOpen(false)} title="閉じる"><X size={16} /></button>
            </div>
            <p className="confirm-text">表示中の未登録ログ {deletableUnregisteredLogs.length}件を削除しますか？</p>
            <p className="muted-text">候補検出済み、登録済みの取得ログは削除されません。</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setIsDeleteLogsModalOpen(false)}>キャンセル</button>
              <button className="primary-button danger-button" onClick={() => void deleteVisibleUnregisteredLogs()}>削除</button>
            </div>
          </div>
        </div>
      )}

      {evidenceCandidate && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEvidenceCandidate(null)}>
          <div className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="evidence-modal-title">候補の根拠</h2>
              <button className="icon-button" onClick={() => setEvidenceCandidate(null)} title="閉じる"><X size={16} /></button>
            </div>
            {(() => {
              const log = sourceLogs.find((item) => item.id === evidenceCandidate.source_log_id);
              return (
                <div className="evidence-content">
                  <div className="evidence-grid">
                    <div>
                      <span>ページタイトル</span>
                      <strong>{log?.title ?? evidenceCandidate.product_name}</strong>
                    </div>
                    <div>
                      <span>情報元URL</span>
                      <a href={log?.url ?? evidenceCandidate.source_url} target="_blank" rel="noreferrer">{log?.url ?? evidenceCandidate.source_url}</a>
                    </div>
                    <div>
                      <span>検出日</span>
                      <strong>{formatDate(log?.detected_at ?? null)}</strong>
                    </div>
                    <div>
                      <span>source_id</span>
                      <strong>{log?.source_id ?? "-"}</strong>
                    </div>
                    <div>
                      <span>検出理由</span>
                      <strong>{evidenceCandidate.detected_reason}</strong>
                    </div>
                    <div>
                      <span>検出キーワード</span>
                      <strong>{formatDetectedKeywords(evidenceCandidate.detected_keywords)}</strong>
                    </div>
                    <div>
                      <span>利益期待度</span>
                      <strong>{evidenceCandidate.profit_expectation} / {expectationLabel(evidenceCandidate.profit_expectation)}</strong>
                    </div>
                  </div>
                  <div className="evidence-raw">
                    <span>raw_text</span>
                    <pre>{log?.raw_text ?? "対応する取得ログが見つかりません。"}</pre>
                  </div>
                </div>
              );
            })()}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setEvidenceCandidate(null)}>閉じる</button>
              <button className="primary-button" onClick={() => { prefillProductFromCandidate(evidenceCandidate); setEvidenceCandidate(null); }}><SendToBack size={16} /> 商品登録へ</button>
            </div>
          </div>
        </div>
      )}

      {isScrapingModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsScrapingModalOpen(false)}>
          <div className="modal scraping-modal" role="dialog" aria-modal="true" aria-labelledby="scraping-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="scraping-modal-title">スクレイピング準備</h2>
              <button className="icon-button" onClick={() => setIsScrapingModalOpen(false)} title="閉じる"><X size={16} /></button>
            </div>
            <div className="scraping-modal-layout">
              <div className="scraping-modal-left">
                <div className="prep-grid">
                  <label>
                    カテゴリ
                    <select
                      value={scrapingPrep.category}
                      onChange={(event) => {
                        setScrapingPrep({ ...scrapingPrep, category: event.target.value });
                        appendTerminalLine("info", `Category selected: ${event.target.value}`);
                      }}
                    >
                      <option value="すべて">すべて</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ステータス
                    <select
                      value={scrapingPrep.status}
                      onChange={(event) => {
                        setScrapingPrep({ ...scrapingPrep, status: event.target.value });
                        appendTerminalLine("info", `Status selected: ${event.target.value}`);
                      }}
                    >
                      <option value="すべて">すべて</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    情報源名
                    <input
                      placeholder="例: 公式, 入荷Now, サンリオ"
                      value={scrapingPrep.sourceName}
                      onChange={(event) => setScrapingPrep({ ...scrapingPrep, sourceName: event.target.value })}
                    />
                  </label>
                  <div className="url-panel">
                    <div className="url-panel-header">
                      <h3 className="subheading">対象URL</h3>
                    </div>
                    {scrapingUrls.length > 0 ? (
                      <>
                        <div className="url-selection-bar">
                          <button className="secondary-button select-all-button" disabled={isScrapingRunning || scrapingUrls.length === 0} onClick={toggleAllScrapingTargets}>
                            {selectedScrapingKeys.length === scrapingUrls.length ? "選択解除" : "すべて選択"}
                          </button>
                          <span>{selectedScrapingKeys.length} / {scrapingUrls.length} 件選択中</span>
                        </div>
                        <ul className="url-list">
                          {scrapingUrls.map((source) => {
                            const progress = scrapingProgress[source.key];
                            const remainingSeconds = getScrapingRemainingSeconds(source);
                            const isCoolingDown = remainingSeconds > 0;
                            const displayStatus = progress?.status === "完了" && progress.message === "取得完了"
                              ? "取得完了"
                              : progress?.status ?? "実行前";
                            return (
                              <li key={source.key}>
                                <div className="url-row">
                                  <label className="url-checkbox" title="一括Scrapingに含める">
                                    <input
                                      type="checkbox"
                                      checked={selectedScrapingKeys.includes(source.key)}
                                      disabled={isScrapingRunning}
                                      onChange={() => toggleScrapingTarget(source.key)}
                                    />
                                  </label>
                                  <div className="url-main">
                                    <strong>{source.name} / {source.kind}</strong>
                                    <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                                  </div>
                                  <div className="url-progress">
                                    <span className={`status-text status-${progress?.status ?? "実行前"}`}>{displayStatus}</span>
                                    <small>{progress?.message ?? ""}</small>
                                    {isCoolingDown && (
                                      <small>次回取得まで {formatDuration(remainingSeconds)}</small>
                                    )}
                                    <button className="secondary-button mini-button" disabled={isScrapingRunning || isCoolingDown} onClick={() => void runSingleScrapingTarget(source)}>
                                      このURLをScraping
                                    </button>
                                    {progress?.status === "失敗" && (
                                      <button className="secondary-button mini-button" disabled={isScrapingRunning || isCoolingDown} onClick={() => void retryScrapingTarget(source)}>
                                        再試行
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="muted-text">このカテゴリの情報源URLはまだ登録されていません。</p>
                    )}
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className={`primary-button ${runnableScrapingTargets.length > 0 ? "scraping-bulk-ready" : "scraping-bulk-empty"}`}
                    onClick={() => void startScrapingFromPrep()}
                    disabled={isScrapingRunning || runnableScrapingTargets.length === 0}
                  >
                    <Download size={16} /> 選択したURLを一括Scraping
                  </button>
                  <button className="secondary-button" onClick={() => setIsScrapingModalOpen(false)} disabled={isScrapingRunning}>閉じる</button>
                </div>
              </div>
              <div className="scraping-modal-right">
                <div className="scraping-terminal">
                  <div className="terminal-header">
                    <div>
                      <span>terminal</span>
                      <small>上: 古いログ / 下: 最新ログ</small>
                    </div>
                    <strong>{isScrapingRunning ? "running" : "idle"}</strong>
                  </div>
                  <div className="terminal-job-status">
                    <span>status: {activeScrapingJob?.status ?? "no job"}</span>
                    <span>sources: {activeScrapingJob ? `${activeScrapingJob.completed_sources}/${activeScrapingJob.total_sources}` : "0/0"}</span>
                    <span>candidates: {activeScrapingJob?.created_candidates_count ?? 0}</span>
                    <span>failed/skipped: {activeScrapingJob ? `${activeScrapingJob.failed_sources}/${activeScrapingJob.skipped_sources}` : "0/0"}</span>
                  </div>
                  <div className="terminal-body" ref={terminalBodyRef}>
                    <div className="terminal-order-marker">ログ開始 ↑</div>
                    {terminalLines.length > 0 ? terminalLines.map((line) => (
                      <div className={`terminal-line terminal-line-${line.level}`} key={line.id}>
                        <span className="terminal-time">{line.time}</span>
                        <strong className="terminal-level">[{line.level === "success" ? "DONE" : line.level.toUpperCase()}]</strong>
                        <p className="terminal-message">{line.message}</p>
                      </div>
                    )) : (
                      <div className="terminal-line terminal-line-info">
                        <span className="terminal-time">{formatTerminalTime()}</span>
                        <strong className="terminal-level">[INFO]</strong>
                        <p className="terminal-message">Waiting for scraping actions</p>
                      </div>
                    )}
                    <div className="terminal-order-marker terminal-latest-marker">最新ログ ↓</div>
                  </div>
                  <div className="terminal-actions">
                    <button className="secondary-button mini-button" onClick={() => setTerminalLines([])}>ログをクリア</button>
                    <button className="secondary-button mini-button" onClick={scrollTerminalToLatest}>最新ログへ移動</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  value,
  onChange,
  onSubmit,
  categories,
}: {
  value: ProductInput;
  onChange: (value: ProductInput) => void;
  onSubmit: (event: FormEvent) => void;
  categories: string[];
}) {
  return (
    <form className="product-form" onSubmit={onSubmit}>
      <label>
        カテゴリ
        <input list="categories" value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} required />
        <datalist id="categories">
          {categories.map((category) => <option key={category} value={category} />)}
        </datalist>
      </label>
      <label>
        商品名
        <input value={value.product_name} onChange={(event) => onChange({ ...value, product_name: event.target.value })} required />
      </label>
      <label>
        ブランド
        <input value={value.brand} onChange={(event) => onChange({ ...value, brand: event.target.value })} />
      </label>
      <label>
        価格
        <input type="number" min="0" value={value.price} onChange={(event) => onChange({ ...value, price: event.target.value })} />
      </label>
      <label>
        発売日
        <input type="date" value={value.release_date} onChange={(event) => onChange({ ...value, release_date: event.target.value })} />
      </label>
      <label>
        販売店
        <input value={value.sales_store} onChange={(event) => onChange({ ...value, sales_store: event.target.value })} />
      </label>
      <label>
        ステータス
        <select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}>
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label>
        情報源名
        <input value={value.source_name} onChange={(event) => onChange({ ...value, source_name: event.target.value })} />
      </label>
      <label>
        情報源リンク
        <input type="url" value={value.source_url} onChange={(event) => onChange({ ...value, source_url: event.target.value })} />
      </label>
      <label>
        注目度スコア
        <input type="range" min="0" max="100" value={value.trend_score} onChange={(event) => onChange({ ...value, trend_score: Number(event.target.value) })} />
        <span className="range-value">{value.trend_score} / {scoreLabel(value.trend_score)}</span>
      </label>
      <label className="wide">
        メモ
        <textarea value={value.memo} onChange={(event) => onChange({ ...value, memo: event.target.value })} />
      </label>
      <div className="form-actions">
        <button className="primary-button"><Save size={16} /> 商品を保存</button>
      </div>
    </form>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: TableRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const cells = Array.isArray(row) ? row : row.cells;
            const className = Array.isArray(row) ? undefined : row.className;
            return (
            <tr className={className} key={index}>
              {cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
