import {
  ArrowDownUp,
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { ProductFilters } from "../appTypes";
import { sortOptions, statusOptions } from "../constants";
import type { Product } from "../types";
import { formatDate, scoreClass, scoreLabel } from "../utils/formatters";

type ProductListPanelProps = {
  products: Product[];
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  categories: string[];
  stores: string[];
  onRefresh: () => void;
  onCreateProduct: () => void;
  onEditProduct: (product: Product) => void;
  onCreateNotification: (product: Product) => void;
  onDeleteProduct: (productId: number) => void;
};

export function ProductListPanel({
  products,
  filters,
  setFilters,
  categories,
  stores,
  onRefresh,
  onCreateProduct,
  onEditProduct,
  onCreateNotification,
  onDeleteProduct,
}: ProductListPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div className="section-title-group">
          <h2>商品一覧</h2>
          <span className="count-badge">現在 {products.length} 件</span>
        </div>
        <div className="heading-actions">
          <button className="primary-button" onClick={onCreateProduct}>
            <Plus size={16} /> 商品情報を登録
          </button>
        </div>
      </div>
      <div className="filters">
        <label>
          カテゴリ
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters({ ...filters, category: event.target.value })
            }
          >
            <option value="">すべて</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          キーワード
          <div className="input-with-icon">
            <Search size={16} />
            <input
              value={filters.keyword}
              onChange={(event) =>
                setFilters({ ...filters, keyword: event.target.value })
              }
            />
          </div>
        </label>
        <label>
          ステータス
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">すべて</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          販売店
          <input
            list="stores"
            value={filters.sales_store}
            onChange={(event) =>
              setFilters({ ...filters, sales_store: event.target.value })
            }
          />
          <datalist id="stores">
            {stores.map((store) => (
              <option key={store} value={store} />
            ))}
          </datalist>
        </label>
        <label>
          最小スコア
          <input
            type="number"
            min="0"
            max="100"
            value={filters.min_score}
            onChange={(event) =>
              setFilters({ ...filters, min_score: event.target.value })
            }
          />
        </label>
        <label>
          並び替え
          <div className="input-with-icon">
            <ArrowDownUp size={16} />
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters({ ...filters, sort: event.target.value })
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <button className="primary-button" onClick={onRefresh}>
          更新
        </button>
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
                <td>
                  {product.price === null
                    ? "-"
                    : product.price.toLocaleString("ja-JP")}
                </td>
                <td>{formatDate(product.release_date)}</td>
                <td>{product.sales_store ?? "-"}</td>
                <td>{product.status}</td>
                <td>{product.source_name ?? "-"}</td>
                <td>
                  <span
                    className={`score score-${scoreClass(product.trend_score)}`}
                  >
                    {product.trend_score} / {scoreLabel(product.trend_score)}
                  </span>
                </td>
                <td>{formatDate(product.created_at)}</td>
                <td className="actions">
                  <button
                    className="icon-button"
                    onClick={() => onEditProduct(product)}
                    title="編集"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => onCreateNotification(product)}
                    title="通知ログ作成"
                  >
                    <Megaphone size={16} />
                  </button>
                  {product.source_url && (
                    <a
                      className="icon-button"
                      href={product.source_url}
                      target="_blank"
                      rel="noreferrer"
                      title="情報源を開く"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    className="icon-button danger"
                    onClick={() => onDeleteProduct(product.id)}
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={11} className="empty-cell">
                  商品がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
