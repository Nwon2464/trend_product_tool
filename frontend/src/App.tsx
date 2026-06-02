import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshCw, Trash2, X } from "lucide-react";
import { API_BASE_URL, api } from "./api";
import type {
  ProductFilters,
  ScrapingPrep,
  ScrapingTargetProgress,
  SourceLogFilter,
  Tab,
  TerminalLogLevel,
  TerminalLine,
  ToastMessage,
  ToastType,
} from "./appTypes";
import { CollectionPanel } from "./components/CollectionPanel";
import { ConfirmDeleteLogsModal } from "./components/ConfirmDeleteLogsModal";
import { EvidenceModal } from "./components/EvidenceModal";
import { KeywordFormModal } from "./components/KeywordFormModal";
import { KeywordManagementPanel } from "./components/KeywordManagementPanel";
import { ProductForm } from "./components/ProductForm";
import { ProductListPanel } from "./components/ProductListPanel";
import { ScrapingModal } from "./components/ScrapingModal";
import { SimpleTable } from "./components/SimpleTable";
import { SourceFormModal } from "./components/SourceFormModal";
import { SourceManagementPanel } from "./components/SourceManagementPanel";
import { ToastContainer } from "./components/ToastContainer";
import {
  DEFAULT_CANDIDATE_LIMIT,
  SCRAPING_MIN_INTERVAL_SECONDS,
  emptyKeyword,
  emptyProduct,
  emptySource,
  sourceTypeLabels,
  sourceTypes,
} from "./constants";
import { useScrapingTargets } from "./hooks/useScrapingTargets";
import type {
  Keyword,
  KeywordInput,
  NotificationLog,
  Product,
  ProductCandidate,
  ProductCandidateStatus,
  ProductInput,
  ScrapingJob,
  ScrapingJobEvent,
  Source,
  SourceInput,
  SourceLog,
} from "./types";
import { candidateStatusLabel } from "./utils/candidateStatus";
import {
  expectationLabel,
  formatDate,
  formatDetectedKeywords,
  formatTerminalTime,
  getPayloadNumber,
  getPayloadString,
  getSourceLogStatus,
  messageForSkipEvent,
  scoreLabel,
  sortSourcesByNewest,
  toProductInput,
} from "./utils/formatters";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("collection");
  const [products, setProducts] = useState<Product[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceLogs, setSourceLogs] = useState<SourceLog[]>([]);
  const [productCandidates, setProductCandidates] = useState<
    ProductCandidate[]
  >([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(
    [],
  );
  const [filters, setFilters] = useState<ProductFilters>({
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
  const [loading, setLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const [isDeleteLogsModalOpen, setIsDeleteLogsModalOpen] = useState(false);
  const [evidenceCandidate, setEvidenceCandidate] =
    useState<ProductCandidate | null>(null);
  const [scrapingPrep, setScrapingPrep] = useState<ScrapingPrep>({
    category: "すべて",
    status: "すべて",
    sourceName: "",
  });
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<
    Record<string, ScrapingTargetProgress>
  >({});
  const [selectedScrapingKeys, setSelectedScrapingKeys] = useState<string[]>(
    [],
  );
  const [sourceLogFilter, setSourceLogFilter] =
    useState<SourceLogFilter>("すべて");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [highlightedNotificationLogId, setHighlightedNotificationLogId] =
    useState<number | null>(null);
  const [activeScrapingJob, setActiveScrapingJob] =
    useState<ScrapingJob | null>(null);
  const [updatingCandidateIds, setUpdatingCandidateIds] = useState<Set<number>>(
    new Set(),
  );
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
    return new Set(
      products
        .map((product) => product.source_url)
        .filter((url): url is string => Boolean(url)),
    );
  }, [products]);

  const candidatesBySourceLogId = useMemo(() => {
    return new Map(
      productCandidates.map((candidate) => [
        candidate.source_log_id,
        candidate,
      ]),
    );
  }, [productCandidates]);

  const filteredSourceLogs = useMemo(() => {
    return sourceLogs.filter((log) => {
      const status = getSourceLogStatus(
        log,
        productSourceUrls,
        candidatesBySourceLogId,
      );
      if (sourceLogFilter !== "すべて") return status === sourceLogFilter;
      return true;
    });
  }, [candidatesBySourceLogId, productSourceUrls, sourceLogFilter, sourceLogs]);

  const sortedProductCandidates = useMemo(
    () =>
      [...productCandidates].sort((a, b) => {
        const scoreDiff = b.profit_expectation - a.profit_expectation;
        return (
          scoreDiff ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }),
    [productCandidates],
  );

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
        highCount: candidates.filter(
          (candidate) => candidate.profit_expectation >= 80,
        ).length,
        averageExpectation: Math.round(
          candidates.reduce(
            (total, candidate) => total + candidate.profit_expectation,
            0,
          ) / candidates.length,
        ),
      }))
      .sort((a, b) => {
        const topScoreDiff =
          (b.candidates[0]?.profit_expectation ?? 0) -
          (a.candidates[0]?.profit_expectation ?? 0);
        return topScoreDiff || b.candidates.length - a.candidates.length;
      });
  }, [sortedProductCandidates]);

  const deletableUnregisteredLogs = useMemo(
    () =>
      filteredSourceLogs.filter(
        (log) =>
          getSourceLogStatus(
            log,
            productSourceUrls,
            candidatesBySourceLogId,
          ) === "未登録",
      ),
    [candidatesBySourceLogId, filteredSourceLogs, productSourceUrls],
  );

  const {
    scrapingUrls,
    runnableScrapingTargets,
    scrapingStatusSummary,
    scrapingProgressTotal,
    scrapingProgressPercent,
  } = useScrapingTargets({
    sources,
    sourceLogs,
    scrapingPrep,
    selectedScrapingKeys,
    scrapingProgress,
    nowMs,
  });

  const appendTerminalLine = useCallback(
    (level: TerminalLogLevel, message: string) => {
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
    },
    [],
  );

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [
      { id, type, message, createdAt: Date.now() },
      ...current,
    ]);
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
    const level =
      levelByEventType[event.event_type] ??
      (event.level === "error"
        ? "error"
        : event.level === "warn"
          ? "warn"
          : event.level === "success"
            ? "success"
            : "info");
    const eventTime = new Date(event.created_at);
    terminalLineSeq.current += 1;
    setTerminalLines((current) => [
      ...current,
      {
        id: `sse-${event.id}-${terminalLineSeq.current}`,
        time: Number.isNaN(eventTime.getTime())
          ? formatTerminalTime()
          : formatTerminalTime(eventTime),
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

  const resetScrapingModalState = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setSelectedScrapingKeys([]);
    setScrapingProgress({});
    setTerminalLines([]);
    setActiveScrapingJob(null);
    setIsScrapingRunning(false);
    setNowMs(Date.now());
  }, []);

  const closeScrapingModal = useCallback(() => {
    if (isScrapingRunning) {
      addToast("warning", "Scraping実行中は閉じられません");
      return;
    }
    resetScrapingModalState();
    setIsScrapingModalOpen(false);
  }, [addToast, isScrapingRunning, resetScrapingModalState]);

  const openScrapingModal = useCallback(() => {
    resetScrapingModalState();
    setScrapingPrep({
      category: "すべて",
      status: "すべて",
      sourceName: "",
    });
    setIsScrapingModalOpen(true);
  }, [resetScrapingModalState]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || key === "sort") return;
        params.set(key, value);
      });
      const [sortBy, sortOrder] = filters.sort.split(":");
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      const [
        nextProducts,
        nextKeywords,
        nextSources,
        nextSourceLogs,
        nextProductCandidates,
        nextNotificationLogs,
      ] = await Promise.all([
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
      const errorMessage =
        err instanceof Error ? err.message : "データの取得に失敗しました";
      addToast("error", errorMessage);
    } finally {
      setLoading(false);
    }
  }, [addToast, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    if (
      !isProductModalOpen &&
      !isSourceModalOpen &&
      !isKeywordModalOpen &&
      !isScrapingModalOpen &&
      !isDeleteLogsModalOpen &&
      evidenceCandidate === null
    ) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [
    evidenceCandidate,
    isDeleteLogsModalOpen,
    isKeywordModalOpen,
    isProductModalOpen,
    isScrapingModalOpen,
    isSourceModalOpen,
  ]);

  useEffect(() => {
    if (!isScrapingModalOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isScrapingModalOpen]);

  useEffect(() => {
    if (!isScrapingModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeScrapingModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeScrapingModal, isScrapingModalOpen]);

  useEffect(() => {
    scrollTerminalToLatest();
  }, [scrollTerminalToLatest, terminalLines]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setSelectedScrapingKeys((current) =>
      current.filter((key) =>
        scrapingUrls.some((source) => source.key === key),
      ),
    );
  }, [scrapingUrls]);

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    try {
      const successMessage =
        editingProductId === null ? "商品を登録しました" : "商品を更新しました";
      if (editingProductId === null) {
        await api.createProduct(productForm);
      } else {
        await api.updateProduct(editingProductId, productForm);
      }
      addToast("success", successMessage);
      setProductForm(emptyProduct);
      setEditingProductId(null);
      setIsProductModalOpen(false);
      setActiveTab("products");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "商品の保存に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function deleteProduct(id: number) {
    if (!window.confirm("この商品を削除しますか？")) return;
    try {
      await api.deleteProduct(id);
      addToast("success", "商品を削除しました");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "商品の削除に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function submitKeyword(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createKeyword(keywordForm);
      setKeywordForm(emptyKeyword);
      setIsKeywordModalOpen(false);
      addToast("success", "キーワードを登録しました");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "キーワードの保存に失敗しました";
      addToast("error", errorMessage);
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
    try {
      await api.updateKeyword(keyword.id, { is_active: !keyword.is_active });
      addToast(
        "success",
        keyword.is_active
          ? "キーワードを無効化しました"
          : "キーワードを有効化しました",
      );
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "キーワードの更新に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    try {
      const createdSource = await api.createSource(sourceForm);
      setSources((current) =>
        sortSourcesByNewest([
          createdSource,
          ...current.filter((source) => source.id !== createdSource.id),
        ]),
      );
      setSourceForm(emptySource);
      setIsSourceModalOpen(false);
      addToast("success", "情報源URLを登録しました");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "情報源の保存に失敗しました";
      addToast("error", errorMessage);
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
    try {
      await api.updateSource(source.id, { is_active: !source.is_active });
      addToast(
        "success",
        source.is_active ? "情報源を無効化しました" : "情報源を有効化しました",
      );
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "情報源の更新に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function deleteSource(source: Source) {
    try {
      await api.deleteSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      addToast("success", "情報源を削除しました");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "情報源の削除に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function deleteVisibleUnregisteredLogs() {
    if (deletableUnregisteredLogs.length === 0) return;

    try {
      for (const log of deletableUnregisteredLogs) {
        await api.deleteSourceLog(log.id);
      }
      addToast(
        "success",
        `未登録ログを${deletableUnregisteredLogs.length}件削除しました`,
      );
      setIsDeleteLogsModalOpen(false);
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "未登録ログの削除に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function deleteSourceLog(log: SourceLog) {
    const status = getSourceLogStatus(
      log,
      productSourceUrls,
      candidatesBySourceLogId,
    );
    if (status !== "未登録") {
      const errorMessage = "候補検出済み、登録済みの取得ログは削除できません";
      addToast("error", errorMessage);
      return;
    }

    try {
      await api.deleteSourceLog(log.id);
      addToast("success", "未登録ログを削除しました");
      await loadAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "取得ログの削除に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function runCollector(source: Source) {
    try {
      const result = await api.runCollector(source.id);
      if (result.skipped_reason === "minimum_interval") {
        addToast("warning", "直近で取得済みのためスキップ");
      } else if (result.skipped_reason === "robots_disallow") {
        addToast("warning", "robots.txt により取得をスキップしました");
      } else if (result.skipped_reason === "no_usable_items") {
        addToast("warning", "保存できる対象URLが見つかりませんでした");
      } else {
        addToast(
          "success",
          `取得完了: ${result.candidates.length}件候補作成 / ${result.created_count}件ログ保存 / ${result.skipped_count}件スキップ`,
        );
      }
      await loadAll();
      setActiveTab("collection");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "取得に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function startScrapingFromPrep() {
    const targets = runnableScrapingTargets;
    if (targets.length === 0) {
      return;
    }
    await startScrapingJob(targets);
  }

  function toggleScrapingTarget(key: string) {
    setSelectedScrapingKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function toggleAllScrapingTargets() {
    setSelectedScrapingKeys((current) =>
      current.length === scrapingUrls.length
        ? []
        : scrapingUrls.map((source) => source.key),
    );
  }

  async function startScrapingJob(targets: (typeof scrapingUrls)[number][]) {
    setIsScrapingRunning(true);
    setActiveScrapingJob(null);
    setTerminalLines([]);
    eventSourceRef.current?.close();
    setScrapingProgress(() => ({
      ...Object.fromEntries(
        targets.map((target) => [
          target.key,
          { status: "待機中" as const, message: "" },
        ]),
      ),
    }));
    try {
      const sourceIds = targets.map((target) => target.id);
      const selectedStatuses =
        scrapingPrep.status === "すべて" ? null : [scrapingPrep.status];
      appendTerminalLine("info", "POST /scraping-jobs");
      const job = await api.createScrapingJob({
        source_ids: sourceIds,
        target_category:
          scrapingPrep.category === "すべて" ? null : scrapingPrep.category,
        selected_statuses: selectedStatuses,
        max_items_per_source: 10,
        max_candidates_per_source: DEFAULT_CANDIDATE_LIMIT,
        respect_robots: true,
        minimum_interval_seconds: SCRAPING_MIN_INTERVAL_SECONDS,
      });
      setActiveScrapingJob({
        job_id: job.job_id,
        status: job.status,
        target_category:
          scrapingPrep.category === "すべて" ? null : scrapingPrep.category,
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
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Scraping job の作成に失敗しました";
      appendTerminalLine("error", errorMessage);
      addToast("error", errorMessage);
      setIsScrapingRunning(false);
    }
  }

  function connectScrapingJobEvents(
    jobId: string,
    targets: (typeof scrapingUrls)[number][],
  ) {
    const targetBySourceId = new Map(
      targets.map((target) => [target.id, target]),
    );
    const eventSource = new EventSource(
      `${API_BASE_URL}/scraping-jobs/${jobId}/events`,
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      const jobEvent = JSON.parse(
        (event as MessageEvent).data,
      ) as ScrapingJobEvent;
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
            if (
              jobEvent.event_type === "source_start" ||
              jobEvent.event_type === "fetch" ||
              jobEvent.event_type === "parse"
            ) {
              nextProgress.status = "実行中";
              nextProgress.message = "取得中";
            } else if (jobEvent.event_type === "skip") {
              nextProgress.status = "スキップ";
              nextProgress.message = messageForSkipEvent(jobEvent);
              const reason = getPayloadString(jobEvent.payload, "reason");
              const nextRetrySeconds = getPayloadNumber(
                jobEvent.payload,
                "next_retry_seconds",
              );
              nextProgress.cooldownUntil =
                reason === "minimum_interval" && nextRetrySeconds !== null
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
      void api
        .getScrapingJob(jobId)
        .then(setActiveScrapingJob)
        .catch(() => undefined);
    });

    eventSource.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        status?: string;
        message?: string;
      };
      appendTerminalLine(
        data.status === "completed" ? "success" : "error",
        data.message ?? "Scraping job completed",
      );
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
      setIsScrapingRunning(false);
      appendTerminalLine("info", "Refreshing candidates and logs");
      void api
        .getScrapingJob(jobId)
        .then((job) => {
          setActiveScrapingJob(job);
          if (data.status === "completed" && job.skipped_sources > 0) {
            addToast("warning", "一部の情報源がスキップされました");
          } else if (data.status === "completed") {
            addToast("success", "Scraping Job が完了しました");
          } else {
            addToast("error", "Scraping Job に失敗しました");
          }
        })
        .catch(() => {
          addToast(
            data.status === "completed" ? "success" : "error",
            data.status === "completed"
              ? "Scraping Job が完了しました"
              : "Scraping Job に失敗しました",
          );
        });
      void loadAll().then(() => {
        setActiveTab("collection");
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
      category:
        candidate?.category ?? source?.target_category ?? emptyProduct.category,
      product_name: candidate?.product_name ?? log.title,
      price:
        candidate?.price === null || candidate?.price === undefined
          ? ""
          : String(candidate.price),
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
        candidate
          ? `利益期待度: ${candidate.profit_expectation} / ${expectationLabel(candidate.profit_expectation)}`
          : "",
        log.raw_text ? `取得内容: ${log.raw_text}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    addToast(
      "info",
      candidate
        ? "商品候補の内容を商品登録フォームに反映しました"
        : "取得ログの内容を商品登録フォームに反映しました",
    );
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
      ]
        .filter(Boolean)
        .join("\n"),
    });
    addToast("info", "商品候補の内容を商品登録フォームに反映しました");
    setIsProductModalOpen(true);
  }

  async function updateCandidateStatus(
    candidate: ProductCandidate,
    candidateStatus: ProductCandidateStatus,
  ) {
    const nextStatus =
      candidate.candidate_status === candidateStatus ? "new" : candidateStatus;
    setUpdatingCandidateIds((current) => new Set(current).add(candidate.id));
    try {
      const updatedCandidate = await api.updateProductCandidate(candidate.id, {
        candidate_status: nextStatus,
      });
      setProductCandidates((current) =>
        current.map((item) =>
          item.id === updatedCandidate.id ? updatedCandidate : item,
        ),
      );
      setEvidenceCandidate((current) =>
        current?.id === updatedCandidate.id ? updatedCandidate : current,
      );
      addToast(
        "success",
        `商品候補を「${candidateStatusLabel(nextStatus)}」に更新しました`,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "商品候補の状態更新に失敗しました";
      addToast("error", errorMessage);
    } finally {
      setUpdatingCandidateIds((current) => {
        const next = new Set(current);
        next.delete(candidate.id);
        return next;
      });
    }
  }

  async function deleteProductCandidate(candidate: ProductCandidate) {
    const confirmed = window.confirm(
      "この商品候補を削除しますか？\nこの操作は元に戻せません。",
    );
    if (!confirmed) return;

    try {
      await api.deleteProductCandidate(candidate.id);
      setProductCandidates((current) =>
        current.filter((item) => item.id !== candidate.id),
      );
      setEvidenceCandidate((current) =>
        current?.id === candidate.id ? null : current,
      );
      addToast("success", "商品候補を削除しました");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "商品候補の削除に失敗しました";
      addToast("error", errorMessage);
    }
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
    const store = product.sales_store
      ? ` / 販売店: ${product.sales_store}`
      : "";
    const releaseDate = product.release_date
      ? ` / 発売日: ${product.release_date}`
      : "";
    return `【${product.category}】${product.product_name} / 状態: ${product.status}${store}${releaseDate} / スコア: ${product.trend_score}`;
  }

  async function createManualNotification(product: Product) {
    try {
      const result = await api.createNotificationLog({
        product_id: product.id,
        message: buildNotificationMessage(product),
        channel: "manual",
        status: "pending",
        sent_at: null,
      });
      const notificationMessage = result.duplicated
        ? "同じ通知ログがすでに存在します"
        : "通知ログを作成しました";
      if (result.duplicated) {
        setHighlightedNotificationLogId(result.notification_log.id);
        window.setTimeout(() => {
          setHighlightedNotificationLogId((current) =>
            current === result.notification_log.id ? null : current,
          );
        }, 9000);
      }
      addToast(
        result.duplicated ? "warning" : "success",
        result.duplicated
          ? `${notificationMessage}（ID: ${result.notification_log.id}）`
          : notificationMessage,
      );
      await loadAll();
      setActiveTab("notifications");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "通知ログの作成に失敗しました";
      addToast("error", errorMessage);
    }
  }

  async function refreshAll() {
    await loadAll();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ローカルMVP</p>
          <h1>話題商品・最新情報収集ツール</h1>
        </div>
        <button
          className="secondary-button topbar-refresh"
          onClick={() => void refreshAll()}
          disabled={loading}
          title="データ更新"
        >
          <RefreshCw size={18} />
          データ更新
        </button>
      </header>

      <nav className="tabs" aria-label="メインナビゲーション">
        <button
          className={activeTab === "collection" ? "active" : ""}
          onClick={() => setActiveTab("collection")}
        >
          情報収集
        </button>
        <button
          className={activeTab === "products" ? "active" : ""}
          onClick={() => setActiveTab("products")}
        >
          商品一覧
        </button>
        <button
          className={activeTab === "source-management" ? "active" : ""}
          onClick={() => setActiveTab("source-management")}
        >
          情報源管理
        </button>
        <button
          className={activeTab === "keywords" ? "active" : ""}
          onClick={() => setActiveTab("keywords")}
        >
          キーワード
        </button>
        <button
          className={activeTab === "notifications" ? "active" : ""}
          onClick={() => setActiveTab("notifications")}
        >
          通知ログ
        </button>
      </nav>

      <ToastContainer toasts={toasts} />

      <main>
        {activeTab === "products" && (
          <ProductListPanel
            products={products}
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            stores={stores}
            onRefresh={loadAll}
            onCreateProduct={openProductCreateModal}
            onEditProduct={editProduct}
            onCreateNotification={(product) =>
              void createManualNotification(product)
            }
            onDeleteProduct={(productId) => void deleteProduct(productId)}
          />
        )}

        {activeTab === "keywords" && (
          <KeywordManagementPanel
            keywords={keywords}
            onCreateKeyword={openKeywordCreateModal}
            onToggleKeyword={(keyword) => void toggleKeyword(keyword)}
            onDeleteKeyword={(keywordId) =>
              void api.deleteKeyword(keywordId).then(loadAll)
            }
          />
        )}

        {activeTab === "collection" && (
          <CollectionPanel
            productCandidateCount={sortedProductCandidates.length}
            sourceLogCount={filteredSourceLogs.length}
            deletableUnregisteredLogCount={deletableUnregisteredLogs.length}
            sourceLogFilter={sourceLogFilter}
            candidateGroups={candidateGroups}
            updatingCandidateIds={updatingCandidateIds}
            onOpenScrapingModal={openScrapingModal}
            onOpenDeleteLogsModal={() => setIsDeleteLogsModalOpen(true)}
            onSourceLogFilterChange={setSourceLogFilter}
            onShowEvidence={setEvidenceCandidate}
            onUpdateStatus={(candidate, candidateStatus) =>
              void updateCandidateStatus(candidate, candidateStatus)
            }
            onPrefillProduct={prefillProductFromCandidate}
            onDeleteCandidate={(candidate) =>
              void deleteProductCandidate(candidate)
            }
          />
        )}

        {activeTab === "source-management" && (
          <SourceManagementPanel
            sources={sources}
            sourceTypeLabels={sourceTypeLabels}
            onCreateSource={openSourceCreateModal}
            onToggleSource={(source) => void toggleSource(source)}
            onDeleteSource={(source) => void deleteSource(source)}
          />
        )}

        {activeTab === "notifications" && (
          <section className="panel">
            <div className="section-heading">
              <h2>通知ログ</h2>
              <span>{notificationLogs.length}件</span>
            </div>
            <SimpleTable
              headers={[
                "ID",
                "商品ID",
                "チャンネル",
                "状態",
                "メッセージ",
                "作成日",
                "操作",
              ]}
              rows={notificationLogs.map((log) => ({
                className:
                  highlightedNotificationLogId === log.id
                    ? "duplicate-highlight-row"
                    : undefined,
                cells: [
                  <span className="notification-log-id" key={log.id}>
                    {log.id}
                  </span>,
                  String(log.product_id),
                  log.channel === "manual" ? "手動" : log.channel,
                  log.status === "pending" ? "未送信" : log.status,
                  log.message,
                  formatDate(log.created_at),
                  <div className="actions" key={log.id}>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void api
                          .updateNotificationLog(log.id, {
                            status: "sent",
                            sent_at: new Date().toISOString(),
                          })
                          .then(loadAll)
                      }
                    >
                      送信済みにする
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() =>
                        void api.deleteNotificationLog(log.id).then(loadAll)
                      }
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>,
                ],
              }))}
            />
          </section>
        )}
      </main>

      {isProductModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeProductModal}
        >
          <div
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="product-modal-title">
                {editingProductId === null
                  ? "商品情報を登録"
                  : "商品情報を編集"}
              </h2>
              <button
                className="icon-button"
                onClick={closeProductModal}
                title="閉じる"
              >
                <X size={16} />
              </button>
            </div>
            <div className="product-modal-content">
              <ProductForm
                value={productForm}
                onChange={setProductForm}
                onSubmit={submitProduct}
                categories={categories}
              />
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeProductModal}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {isSourceModalOpen && (
        <SourceFormModal
          sourceForm={sourceForm}
          sourceTypes={sourceTypes}
          sourceTypeLabels={sourceTypeLabels}
          onChange={setSourceForm}
          onSubmit={submitSource}
          onClose={closeSourceModal}
        />
      )}

      {isKeywordModalOpen && (
        <KeywordFormModal
          keywordForm={keywordForm}
          onChange={setKeywordForm}
          onSubmit={submitKeyword}
          onClose={closeKeywordModal}
        />
      )}

      {isDeleteLogsModalOpen && (
        <ConfirmDeleteLogsModal
          deletableCount={deletableUnregisteredLogs.length}
          onClose={() => setIsDeleteLogsModalOpen(false)}
          onDelete={() => void deleteVisibleUnregisteredLogs()}
        />
      )}

      {evidenceCandidate && (
        <EvidenceModal
          candidate={evidenceCandidate}
          sourceLogs={sourceLogs}
          updatingCandidateIds={updatingCandidateIds}
          onClose={() => setEvidenceCandidate(null)}
          onUpdateStatus={(candidate, candidateStatus) =>
            void updateCandidateStatus(candidate, candidateStatus)
          }
          onPrefillProduct={prefillProductFromCandidate}
        />
      )}

      {isScrapingModalOpen && (
        <ScrapingModal
          isScrapingRunning={isScrapingRunning}
          scrapingPrep={scrapingPrep}
          categories={categories}
          scrapingUrls={scrapingUrls}
          runnableScrapingTargets={runnableScrapingTargets}
          selectedScrapingKeys={selectedScrapingKeys}
          scrapingProgress={scrapingProgress}
          scrapingStatusSummary={scrapingStatusSummary}
          scrapingProgressTotal={scrapingProgressTotal}
          scrapingProgressPercent={scrapingProgressPercent}
          activeScrapingJob={activeScrapingJob}
          terminalLines={terminalLines}
          terminalBodyRef={terminalBodyRef}
          onClose={closeScrapingModal}
          onPrepChange={setScrapingPrep}
          onAppendTerminalLine={(message) => appendTerminalLine("info", message)}
          onToggleAllTargets={toggleAllScrapingTargets}
          onToggleTarget={toggleScrapingTarget}
          onStartScraping={() => void startScrapingFromPrep()}
          onClearTerminal={() => setTerminalLines([])}
          onScrollTerminalToLatest={scrollTerminalToLatest}
        />
      )}
    </div>
  );
}
