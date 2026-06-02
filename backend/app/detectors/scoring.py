DETECTION_RULES = [
    (
        "予約開始",
        22,
        ["予約開始", "予約受付", "予約販売", "先行予約", "抽選予約", "予約"],
    ),
    (
        "販売予定",
        15,
        ["販売予定", "発売予定", "新発売", "発売日", "発売決定", "登場予定"],
    ),
    ("再販売", 22, ["再販売", "再販", "再入荷", "再登場", "追加販売"]),
    ("入荷", 14, ["入荷", "入荷予定", "在庫あり", "販売中", "在庫復活"]),
    (
        "限定",
        20,
        ["限定", "数量限定", "期間限定", "店舗限定", "オンライン限定", "受注限定"],
    ),
    ("コラボ", 18, ["コラボ", "コラボレーション", "タイアップ", "別注"]),
    ("廃盤", 24, ["廃盤", "終売", "販売終了", "生産終了", "販売休止"]),
    ("抽選販売", 18, ["抽選", "抽選販売", "抽選受付", "抽選申込"]),
]

NEGATIVE_AVAILABILITY_KEYWORDS = [
    "販売終了",
    "完売",
    "在庫なし",
    "受付終了",
    "販売休止",
    "予定数終了",
    "終了しました",
    "終了いたしました",
]

STATUS_KEYWORD_GROUPS = {
    "予約開始": ["予約開始", "予約受付", "予約販売", "先行予約", "抽選予約", "予約"],
    "発売予定": ["販売予定", "発売予定", "新発売", "発売日", "発売決定", "登場予定"],
    "発売中": ["発売中", "販売中", "在庫あり"],
    "再販": ["再販売", "再販", "再入荷", "再登場", "追加販売"],
    "入荷": ["入荷", "入荷予定", "在庫あり", "在庫復活"],
    "抽選販売": ["抽選", "抽選販売", "抽選受付", "抽選申込"],
    "限定": ["限定", "数量限定", "期間限定", "店舗限定", "オンライン限定", "受注限定"],
    "コラボ": ["コラボ", "コラボレーション", "タイアップ", "別注"],
    "廃盤": ["廃盤", "終売", "販売終了", "生産終了", "販売休止"],
}

HIGH_VALUE_CATEGORIES = [
    "ポケモンカード",
    "ワンピースカード",
    "ちいかわ",
    "サンリオ",
    "ポケモン系グッズ",
    "スタバ",
    "アパレルコラボ",
    "廃盤",
]


def score_keyword_matches(text: str) -> tuple[list[str], int, list[str]]:
    matched: list[str] = []
    score = 0
    reasons: list[str] = []
    for label, points, keywords in DETECTION_RULES:
        rule_matches = [
            keyword
            for keyword in keywords
            if keyword in text and keyword not in NEGATIVE_AVAILABILITY_KEYWORDS
        ]
        if rule_matches:
            matched.extend(rule_matches)
            score += points
            reasons.append(f"{label}: {', '.join(rule_matches)}")
    return matched, score, reasons


def score_sales_signals(source_type: str, matched: list[str]) -> tuple[int, str | None]:
    if source_type == "retail":
        retail_bonus = (
            8
            if any(
                keyword in matched
                for keyword in ["入荷", "在庫あり", "在庫復活", "再入荷", "再販"]
            )
            else 4
        )
        return retail_bonus, "小売・EC情報源"
    if source_type == "official":
        return 12, "公式情報源"
    return 0, None


def score_product_url_pattern(profile: dict) -> tuple[int, str]:
    return int(profile.get("catalog_base_score", 42)), str(
        profile.get("product_url_reason", "商品ページURL")
    )


def score_release_date() -> tuple[int, str]:
    return 6, "発売日文脈から日付抽出"


def score_price() -> tuple[int, str]:
    return 6, "価格情報あり"


def score_for_keyword_priority(priority: int) -> int:
    if priority <= 1:
        return 15
    if priority == 2:
        return 10
    return 5
