import type { FormEvent } from "react";
import { Save } from "lucide-react";
import { statusOptions } from "../constants";
import type { ProductInput } from "../types";
import { scoreLabel } from "../utils/formatters";

export function ProductForm({
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
        <input
          list="categories"
          value={value.category}
          onChange={(event) =>
            onChange({ ...value, category: event.target.value })
          }
          required
        />
        <datalist id="categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </label>
      <label>
        商品名
        <input
          value={value.product_name}
          onChange={(event) =>
            onChange({ ...value, product_name: event.target.value })
          }
          required
        />
      </label>
      <label>
        ブランド
        <input
          value={value.brand}
          onChange={(event) =>
            onChange({ ...value, brand: event.target.value })
          }
        />
      </label>
      <label>
        価格
        <input
          type="number"
          min="0"
          value={value.price}
          onChange={(event) =>
            onChange({ ...value, price: event.target.value })
          }
        />
      </label>
      <label>
        発売日
        <input
          type="date"
          value={value.release_date}
          onChange={(event) =>
            onChange({ ...value, release_date: event.target.value })
          }
        />
      </label>
      <label>
        販売店
        <input
          value={value.sales_store}
          onChange={(event) =>
            onChange({ ...value, sales_store: event.target.value })
          }
        />
      </label>
      <label>
        ステータス
        <select
          value={value.status}
          onChange={(event) =>
            onChange({ ...value, status: event.target.value })
          }
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        情報源名
        <input
          value={value.source_name}
          onChange={(event) =>
            onChange({ ...value, source_name: event.target.value })
          }
        />
      </label>
      <label>
        情報源リンク
        <input
          type="url"
          value={value.source_url}
          onChange={(event) =>
            onChange({ ...value, source_url: event.target.value })
          }
        />
      </label>
      <label>
        注目度スコア
        <input
          type="range"
          min="0"
          max="100"
          value={value.trend_score}
          onChange={(event) =>
            onChange({ ...value, trend_score: Number(event.target.value) })
          }
        />
        <span className="range-value">
          {value.trend_score} / {scoreLabel(value.trend_score)}
        </span>
      </label>
      <label className="wide">
        メモ
        <textarea
          value={value.memo}
          onChange={(event) => onChange({ ...value, memo: event.target.value })}
        />
      </label>
      <div className="form-actions">
        <button className="primary-button">
          <Save size={16} /> 商品を保存
        </button>
      </div>
    </form>
  );
}
