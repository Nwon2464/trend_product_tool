import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  CheckCircle2,
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
import { api } from "./api";
import type {
  Keyword,
  KeywordInput,
  NotificationLog,
  Product,
  ProductCandidate,
  ProductInput,
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
type ScrapingTargetStatus = "待機中" | "実行中" | "完了" | "失敗";
type ScrapingTargetProgress = {
  status: ScrapingTargetStatus;
  message: string;
};
type SourceLogFilter = "すべて" | "候補検出" | "登録済み" | "未登録";
type SourceLogStatus = "候補検出" | "登録済み" | "未登録";

const defaultScrapingUrls: Record<string, Array<{ name: string; url: string }>> = {
  "すべて": [{ name: "Google ニュース", url: "https://news.google.com/" }],
  "話題の商品": [{ name: "Google ニュース", url: "https://news.google.com/" }],
  "ポケモンカード": [{ name: "ポケモンカードゲーム公式サイト", url: "https://www.pokemon-card.com/" }],
  "ワンピースカード": [{ name: "ONE PIECEカードゲーム公式サイト", url: "https://www.onepiece-cardgame.com/" }],
  "アニメ系ガチャ": [{ name: "ガシャポン公式", url: "https://gashapon.jp/" }],
  "ボンボンドロップシール": [{ name: "文具ニュース検索", url: "https://www.google.com/search?q=%E3%83%9C%E3%83%B3%E3%83%9C%E3%83%B3%E3%83%89%E3%83%AD%E3%83%83%E3%83%97%E3%82%B7%E3%83%BC%E3%83%AB" }],
  "ちいかわ系グッズ": [{ name: "ちいかわ公式", url: "https://www.chiikawa-info.jp/" }],
  "サンリオ系グッズ": [{ name: "サンリオ公式", url: "https://www.sanrio.co.jp/" }],
  "ポケモン系グッズ": [{ name: "ポケモンセンターオンライン", url: "https://www.pokemoncenter-online.com/" }],
  "スタバ コラボ商品": [{ name: "スターバックス公式", url: "https://www.starbucks.co.jp/" }],
  "スタバ 季節限定商品": [{ name: "スターバックス公式", url: "https://www.starbucks.co.jp/" }],
  "アパレルコラボ商品": [{ name: "ユニクロ公式", url: "https://www.uniqlo.com/jp/ja/" }],
  "有名メーカーのお菓子の廃盤商品": [{ name: "食品産業新聞社", url: "https://www.ssnp.co.jp/" }],
  "共通": [{ name: "Google ニュース", url: "https://news.google.com/" }],
};

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

type Tab = "products" | "collection" | "add-product" | "source-management" | "keywords" | "notifications";

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

function expectationLabel(score: number) {
  if (score >= 80) return "高期待";
  if (score >= 60) return "注目";
  if (score >= 40) return "低め";
  return "保留";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const [isDeleteLogsModalOpen, setIsDeleteLogsModalOpen] = useState(false);
  const [scrapingPrep, setScrapingPrep] = useState({
    category: "すべて",
    status: "すべて",
    sourceName: "",
  });
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<Record<string, ScrapingTargetProgress>>({});
  const [sourceLogFilter, setSourceLogFilter] = useState<SourceLogFilter>("すべて");

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

  const deletableUnregisteredLogs = useMemo(() => (
    filteredSourceLogs.filter((log) => getSourceLogStatus(log, productSourceUrls, candidatesBySourceLogId) === "未登録")
  ), [candidatesBySourceLogId, filteredSourceLogs, productSourceUrls]);

  const scrapingUrls = useMemo(() => {
    const registeredSources = sortSourcesByNewest(sources)
      .filter((source) => scrapingPrep.category === "すべて" || source.target_category === scrapingPrep.category)
      .map((source) => ({
        key: `registered-${source.id}`,
        id: source.id,
        name: source.source_name,
        url: source.url,
        category: source.target_category,
        kind: "登録済み",
      }));
    const mockUrlSources = scrapingPrep.category === "すべて"
      ? Object.entries(defaultScrapingUrls).flatMap(([category, urls]) => (
          category === "すべて" ? [] : urls.map((source) => ({
            ...source,
            category,
          }))
        ))
      : (defaultScrapingUrls[scrapingPrep.category] ?? defaultScrapingUrls["共通"]).map((source) => ({
          ...source,
          category: scrapingPrep.category,
        }));
    const categoryUrls = mockUrlSources.map((source) => ({
      key: `mock-${source.category}-${source.url}`,
      id: source.url,
      name: `${source.category} / ${source.name}`,
      url: source.url,
      category: source.category,
      kind: "Mock URL",
    }));
    return [...registeredSources, ...categoryUrls];
  }, [scrapingPrep.category, sources]);

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
    if (!isScrapingModalOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isScrapingModalOpen]);

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
    try {
      await api.createKeyword(keywordForm);
      setKeywordForm(emptyKeyword);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "キーワードの保存に失敗しました");
    }
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
      setMessage("情報源を登録しました。スクレイピング準備にも反映されています。");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "情報源の保存に失敗しました");
    }
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
        setMessage("取得間隔が短いためスキップしました");
      } else if (result.skipped_reason === "robots_disallow") {
        setMessage("robots.txt により取得をスキップしました");
      } else if (result.skipped_reason === "no_usable_items") {
        setMessage("保存できる対象URLが見つかりませんでした");
      } else {
        setMessage(`取得完了: ${result.created_count}件作成 / ${result.skipped_count}件重複`);
      }
      await loadAll();
      setActiveTab("collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    }
  }

  async function startScrapingFromPrep() {
    const target = scrapingUrls[0];
    if (!target) {
      setError("対象URLがありません");
      return;
    }

    setError("");
    setMessage("");
    setIsScrapingRunning(true);
    setScrapingProgress({
      [target.key]: { status: "待機中", message: "" },
    });
    try {
      const resultMessage = await runScrapingTarget(target);
      await loadAll();
      setActiveTab("collection");
      setMessage(`スクレイピング完了: ${resultMessage}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "スクレイピング開始に失敗しました";
      setScrapingProgress({
        [target.key]: { status: "失敗", message: errorMessage },
      });
      setError(errorMessage);
    } finally {
      setIsScrapingRunning(false);
    }
  }

  async function retryScrapingTarget(target: (typeof scrapingUrls)[number]) {
    setError("");
    setMessage("");
    setIsScrapingRunning(true);
    try {
      const resultMessage = await runScrapingTarget(target);
      await loadAll();
      setMessage(`再実行完了: ${resultMessage}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再実行に失敗しました");
    } finally {
      setIsScrapingRunning(false);
    }
  }

  async function runScrapingTarget(target: (typeof scrapingUrls)[number]) {
    setScrapingProgress((current) => ({
      ...current,
      [target.key]: { status: "実行中", message: "取得中" },
    }));
    try {
      const sourceId = typeof target.id === "number"
        ? target.id
        : (await api.createSource({
            source_name: scrapingPrep.sourceName.trim() || target.name,
            source_type: "manual",
            url: target.url,
            target_category: target.category === "すべて" ? "共通" : target.category,
            priority: 2,
            is_active: true,
            memo: `スクレイピング準備から追加 / ステータス: ${scrapingPrep.status}`,
          })).id;
      const result = await api.runCollector(sourceId);
      const resultMessage = result.skipped_reason === "minimum_interval"
        ? "取得間隔でスキップ"
        : result.skipped_reason === "robots_disallow"
          ? "robots.txt でスキップ"
          : result.skipped_reason === "no_usable_items"
            ? "保存対象なし"
            : `${result.created_count}件作成 / ${result.skipped_count}件重複`;
      setScrapingProgress((current) => ({
        ...current,
        [target.key]: { status: "完了", message: resultMessage },
      }));
      return resultMessage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "失敗";
      setScrapingProgress((current) => ({
        ...current,
        [target.key]: { status: "失敗", message: errorMessage },
      }));
      throw err;
    }
  }

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm(toProductInput(product));
    setActiveTab("add-product");
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
    setActiveTab("add-product");
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
      await api.createNotificationLog({
        product_id: product.id,
        message: buildNotificationMessage(product),
        channel: "manual",
        status: "pending",
        sent_at: null,
      });
      setMessage("通知ログを作成しました");
      await loadAll();
      setActiveTab("notifications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知ログの作成に失敗しました");
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
        <button className={activeTab === "add-product" ? "active" : ""} onClick={() => setActiveTab("add-product")}>
          <Plus size={16} /> 商品登録
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

      {message && <div className="notice success"><CheckCircle2 size={16} />{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <main>
        {activeTab === "products" && (
          <section className="panel">
            <div className="section-heading">
              <h2>商品一覧</h2>
              <span>{products.length}件</span>
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

        {activeTab === "add-product" && (
          <section className="panel">
            <div className="section-heading">
              <h2>{editingProductId === null ? "商品登録" : "商品編集"}</h2>
              {editingProductId !== null && (
                <button className="secondary-button" onClick={() => { setEditingProductId(null); setProductForm(emptyProduct); }}>
                  <X size={16} /> キャンセル
                </button>
              )}
            </div>
            <ProductForm value={productForm} onChange={setProductForm} onSubmit={submitProduct} categories={categories} />
          </section>
        )}

        {activeTab === "keywords" && (
          <section className="panel">
            <div className="section-heading">
              <h2>キーワード</h2>
              <span>{keywords.length}件</span>
            </div>
            <form className="inline-form" onSubmit={submitKeyword}>
              <input placeholder="カテゴリ" value={keywordForm.category} onChange={(event) => setKeywordForm({ ...keywordForm, category: event.target.value })} required />
              <input placeholder="キーワード" value={keywordForm.keyword} onChange={(event) => setKeywordForm({ ...keywordForm, keyword: event.target.value })} required />
              <input type="number" min="1" max="3" value={keywordForm.priority} onChange={(event) => setKeywordForm({ ...keywordForm, priority: Number(event.target.value) })} />
              <input placeholder="メモ" value={keywordForm.memo} onChange={(event) => setKeywordForm({ ...keywordForm, memo: event.target.value })} />
              <button className="primary-button"><Save size={16} /> 保存</button>
            </form>
            <SimpleTable
              headers={["カテゴリ", "キーワード", "優先度", "有効", "メモ", "操作"]}
              rows={keywords.map((keyword) => [
                keyword.category,
                keyword.keyword,
                String(keyword.priority),
                keyword.is_active ? "有効" : "無効",
                keyword.memo ?? "",
                <div className="actions" key={keyword.id}>
                  <button className="secondary-button" onClick={() => void toggleKeyword(keyword)}>{keyword.is_active ? "無効化" : "有効化"}</button>
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
              <span>取得ログ {filteredSourceLogs.length} / {sourceLogs.length}件</span>
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
            <h3 className="subheading">取得ログ</h3>
            <SimpleTable
              headers={["ID", "タイトル", "リンク", "状態", "感知理由", "利益期待度", "検出日", "操作"]}
              rows={filteredSourceLogs.map((log) => {
                const candidate = candidatesBySourceLogId.get(log.id);
                const status = getSourceLogStatus(log, productSourceUrls, candidatesBySourceLogId);
                return [
                  String(log.id),
                  log.title,
                  <a href={log.url} target="_blank" rel="noreferrer" key={log.id}>{log.url}</a>,
                  status,
                  candidate?.detected_reason ?? "-",
                  candidate ? <span className={`score score-${scoreClass(candidate.profit_expectation)}`} key={candidate.id}>{candidate.profit_expectation} / {expectationLabel(candidate.profit_expectation)}</span> : "-",
                  formatDate(log.detected_at),
                  <div className="actions" key={log.id}>
                    <button className="secondary-button" onClick={() => prefillProductFromSourceLog(log)}><SendToBack size={16} /> 商品候補にする</button>
                    <button className="icon-button danger" disabled={status !== "未登録"} onClick={() => void deleteSourceLog(log)} title={status === "未登録" ? "削除" : "保護中"}><Trash2 size={16} /></button>
                  </div>,
                ];
              })}
            />
          </section>
        )}

        {activeTab === "source-management" && (
          <section className="panel">
            <div className="section-heading">
              <h2>情報源管理</h2>
              <span>{sources.length}件</span>
            </div>
            <h3 className="subheading">新規情報源</h3>
            <form className="source-form" onSubmit={submitSource}>
              <input placeholder="情報源名" value={sourceForm.source_name} onChange={(event) => setSourceForm({ ...sourceForm, source_name: event.target.value })} required />
              <select value={sourceForm.source_type} onChange={(event) => setSourceForm({ ...sourceForm, source_type: event.target.value })}>
                {sourceTypes.map((type) => <option key={type} value={type}>{sourceTypeLabels[type]}</option>)}
              </select>
              <input placeholder="リンク" value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} required />
              <input placeholder="対象カテゴリ" value={sourceForm.target_category} onChange={(event) => setSourceForm({ ...sourceForm, target_category: event.target.value })} required />
              <input type="number" min="1" max="3" value={sourceForm.priority} onChange={(event) => setSourceForm({ ...sourceForm, priority: Number(event.target.value) })} />
              <input placeholder="メモ" value={sourceForm.memo} onChange={(event) => setSourceForm({ ...sourceForm, memo: event.target.value })} />
              <button className="primary-button"><Plus size={16} /> 情報源を追加</button>
            </form>
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
              rows={notificationLogs.map((log) => [
                String(log.id),
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
              ])}
            />
          </section>
        )}
      </main>

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

      {isScrapingModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsScrapingModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scraping-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="scraping-modal-title">スクレイピング準備</h2>
              <button className="icon-button" onClick={() => setIsScrapingModalOpen(false)} title="閉じる"><X size={16} /></button>
            </div>
            <div className="prep-grid">
              <label>
                カテゴリ
                <select value={scrapingPrep.category} onChange={(event) => setScrapingPrep({ ...scrapingPrep, category: event.target.value })}>
                  <option value="すべて">すべて</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                ステータス
                <select value={scrapingPrep.status} onChange={(event) => setScrapingPrep({ ...scrapingPrep, status: event.target.value })}>
                  <option value="すべて">すべて</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                情報源名
                <input value={scrapingPrep.sourceName} onChange={(event) => setScrapingPrep({ ...scrapingPrep, sourceName: event.target.value })} />
              </label>
              <div className="url-panel">
                <h3 className="subheading">対象URL</h3>
                {scrapingUrls.length > 0 ? (
                  <ul className="url-list">
                    {scrapingUrls.map((source) => (
                      <li key={source.key}>
                        <div className="url-row">
                          <div className="url-main">
                            <strong>{source.name} / {source.kind}</strong>
                            <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                          </div>
                          <div className="url-progress">
                            <span className={`status-text status-${scrapingProgress[source.key]?.status ?? "実行前"}`}>{scrapingProgress[source.key]?.status ?? "実行前"}</span>
                            <small>{scrapingProgress[source.key]?.message ?? ""}</small>
                            <button className="secondary-button mini-button" disabled={isScrapingRunning || scrapingProgress[source.key]?.status !== "失敗"} onClick={() => void retryScrapingTarget(source)}>
                              再実行
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-text">このカテゴリの情報源URLはまだ登録されていません。</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="primary-button" onClick={() => void startScrapingFromPrep()} disabled={isScrapingRunning}><Download size={16} /> スクレイピング開始</button>
              <button className="secondary-button" onClick={() => setIsScrapingModalOpen(false)} disabled={isScrapingRunning}>閉じる</button>
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

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
