import { useCallback, useMemo } from "react";
import type {
  ScrapingPrep,
  ScrapingTarget,
  ScrapingTargetProgress,
} from "../appTypes";
import { SCRAPING_MIN_INTERVAL_SECONDS } from "../constants";
import type { Source, SourceLog } from "../types";
import { sortSourcesByNewest } from "../utils/formatters";

type UseScrapingTargetsInput = {
  sources: Source[];
  sourceLogs: SourceLog[];
  scrapingPrep: ScrapingPrep;
  selectedScrapingKeys: string[];
  scrapingProgress: Record<string, ScrapingTargetProgress>;
  nowMs: number;
};

export function useScrapingTargets({
  sources,
  sourceLogs,
  scrapingPrep,
  selectedScrapingKeys,
  scrapingProgress,
  nowMs,
}: UseScrapingTargetsInput) {
  const scrapingUrls = useMemo<ScrapingTarget[]>(() => {
    const sourceNameQuery = scrapingPrep.sourceName.trim().toLowerCase();
    return sortSourcesByNewest(sources)
      .filter((source) => {
        if (!source.is_active) return false;
        const matchesCategory =
          scrapingPrep.category === "すべて" ||
          source.target_category === scrapingPrep.category;
        const matchesSourceName =
          sourceNameQuery === "" ||
          source.source_name.toLowerCase().includes(sourceNameQuery);
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

  const selectedScrapingTargets = useMemo(
    () =>
      scrapingUrls.filter((source) =>
        selectedScrapingKeys.includes(source.key),
      ),
    [scrapingUrls, selectedScrapingKeys],
  );

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

  const getScrapingCooldownUntil = useCallback(
    (target: ScrapingTarget) => {
      const progressCooldownUntil =
        scrapingProgress[target.key]?.cooldownUntil ?? 0;
      const sourceCooldownUntil = sourceCooldownUntilById.get(target.id) ?? 0;
      return Math.max(progressCooldownUntil, sourceCooldownUntil);
    },
    [scrapingProgress, sourceCooldownUntilById],
  );

  const getScrapingRemainingSeconds = useCallback(
    (target: ScrapingTarget) => {
      const cooldownUntil = getScrapingCooldownUntil(target);
      return Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));
    },
    [getScrapingCooldownUntil, nowMs],
  );

  const runnableScrapingTargets = useMemo(
    () =>
      selectedScrapingTargets.filter(
        (target) => getScrapingRemainingSeconds(target) === 0,
      ),
    [getScrapingRemainingSeconds, selectedScrapingTargets],
  );

  const scrapingStatusSummary = useMemo(() => {
    const summary = {
      total: scrapingUrls.length,
      selected: selectedScrapingKeys.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      currentSourceName: "",
      progressCount: 0,
    };

    selectedScrapingTargets.forEach((source) => {
      const status = scrapingProgress[source.key]?.status ?? "待機中";
      if (status === "実行中") {
        summary.running += 1;
        if (!summary.currentSourceName) {
          summary.currentSourceName = source.name;
        }
      } else if (status === "完了") {
        summary.completed += 1;
      } else if (status === "失敗") {
        summary.failed += 1;
      } else if (status === "スキップ") {
        summary.skipped += 1;
      } else {
        summary.pending += 1;
      }
    });

    summary.progressCount =
      summary.completed + summary.failed + summary.skipped;
    return summary;
  }, [
    scrapingProgress,
    scrapingUrls.length,
    selectedScrapingKeys.length,
    selectedScrapingTargets,
  ]);

  const scrapingProgressTotal = scrapingStatusSummary.selected;
  const scrapingProgressPercent =
    scrapingProgressTotal === 0
      ? 0
      : Math.round(
          (scrapingStatusSummary.progressCount / scrapingProgressTotal) * 100,
        );

  return {
    scrapingUrls,
    runnableScrapingTargets,
    scrapingStatusSummary,
    scrapingProgressTotal,
    scrapingProgressPercent,
  };
}
