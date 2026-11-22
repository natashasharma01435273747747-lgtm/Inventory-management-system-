import type {
  ExpenseRecord,
  Product,
  ProductCategory,
  SaleRecord,
  StoreSnapshot,
} from '../types/store.ts';
import { PRODUCT_CATEGORIES } from '../types/store.ts';

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeCategory(value: unknown): ProductCategory {
  if (
    typeof value === 'string' &&
    (PRODUCT_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as ProductCategory;
  }
  return 'Grocery';
}

export function getSafeMrp(product: Partial<Product> | null | undefined): number {
  const price = Math.max(0, toFiniteNumber(product?.price, 0));
  const rawMrp = toFiniteNumber(product?.mrp, 0);
  if (rawMrp > price && rawMrp > 0) {
    return rawMrp;
  }
  if (price <= 0) return 0;
  return Math.ceil((price * 1.1) / 2) * 2;
}

export function getSafeDiscount(
  product: Partial<Product> | null | undefined,
  priceOverride?: number,
  mrpOverride?: number
): number {
  const rawDiscount = product?.discount;
  if (rawDiscount !== undefined && rawDiscount !== null) {
    const parsed = toFiniteNumber(rawDiscount, -1);
    if (parsed >= 0 && parsed < 100) {
      return Math.round(parsed);
    }
  }
  const price =
    priceOverride !== undefined
      ? Math.max(0, toFiniteNumber(priceOverride, 0))
      : Math.max(0, toFiniteNumber(product?.price, 0));
  const mrp =
    mrpOverride !== undefined
      ? Math.max(0, toFiniteNumber(mrpOverride, 0))
      : getSafeMrp(product);
  if (mrp <= price || mrp <= 0) return 0;
  return Math.max(0, Math.min(99, Math.round(((mrp - price) / mrp) * 100)));
}

export function normalizeProduct(raw: Partial<Product> | null | undefined, idx = 0): Product {
  const price = Math.max(0, toFiniteNumber(raw?.price, 0));
  const mrp = getSafeMrp({ price, mrp: raw?.mrp });
  const discount = getSafeDiscount(raw, price, mrp);
  const costPrice = Math.max(
    0,
    toFiniteNumber(raw?.costPrice, Math.round(price * 0.8 * 100) / 100)
  );
  const stock = Math.max(0, Math.round(toFiniteNumber(raw?.stock, 0)));
  const minStock = Math.max(1, Math.round(toFiniteNumber(raw?.minStock, 10)));
  const avgDailySales = Math.max(0.5, toFiniteNumber(raw?.avgDailySales, 1));
  const rawExpiry = typeof raw?.expiryDate === 'string' ? raw.expiryDate.trim() : '';
  const expiryDate = /^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)
    ? rawExpiry
    : getLocalIsoDate(90);
  const image =
    typeof raw?.image === 'string' && raw.image.trim().length > 0
      ? raw.image.trim()
      : undefined;

  return {
    id:
      typeof raw?.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `prod-fallback-${idx}`,
    sku:
      typeof raw?.sku === 'string' && raw.sku.trim()
        ? raw.sku.trim()
        : `ITEM-${idx + 1}`,
    name:
      typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : 'Unnamed Product',
    category: normalizeCategory(raw?.category),
    unit:
      typeof raw?.unit === 'string' && raw.unit.trim()
        ? raw.unit.trim()
        : '1 pack',
    price,
    mrp,
    discount,
    image,
    costPrice,
    stock,
    minStock,
    expiryDate,
    supplier:
      typeof raw?.supplier === 'string' && raw.supplier.trim()
        ? raw.supplier.trim()
        : 'Store Distributor',
    avgDailySales,
  };
}

export function normalizeStoreSnapshot(
  raw: Partial<StoreSnapshot> | null | undefined
): StoreSnapshot {
  const rawProducts = Array.isArray(raw?.products) ? raw.products : [];
  return {
    products: rawProducts.map((p, idx) => normalizeProduct(p, idx)),
    sales: Array.isArray(raw?.sales) ? raw.sales : [],
    purchases: Array.isArray(raw?.purchases) ? raw.purchases : [],
    expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
    employees: Array.isArray(raw?.employees) ? raw.employees : [],
    adjustments: Array.isArray(raw?.adjustments) ? raw.adjustments : [],
  };
}

export function formatInr(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safe);
}

export function getLocalIsoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysUntilExpiry(expiryDate: string | undefined | null): number {
  if (!expiryDate || typeof expiryDate !== 'string') return 90;
  const todayStr = getLocalIsoDate(0);
  const today = new Date(`${todayStr}T00:00:00`);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return 90;
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export interface ExpiryStatusInfo {
  label: string;
  severity: 'expired' | 'critical' | 'warning' | 'healthy';
  daysLeft: number;
}

export function getExpiryStatus(expiryDate: string | undefined | null): ExpiryStatusInfo {
  const daysLeft = daysUntilExpiry(expiryDate);
  if (daysLeft < 0) {
    return {
      label: `Expired ${Math.abs(daysLeft)}d ago`,
      severity: 'expired',
      daysLeft,
    };
  }
  if (daysLeft === 0) {
    return { label: 'Expires today', severity: 'expired', daysLeft };
  }
  if (daysLeft <= 5) {
    return { label: `Expires in ${daysLeft}d`, severity: 'critical', daysLeft };
  }
  if (daysLeft <= 14) {
    return { label: `Expires in ${daysLeft}d`, severity: 'warning', daysLeft };
  }
  return { label: `${daysLeft}d left`, severity: 'healthy', daysLeft };
}

export function isLowStock(product: Partial<Product> | null | undefined): boolean {
  const stock = toFiniteNumber(product?.stock, 0);
  const minStock = Math.max(1, toFiniteNumber(product?.minStock, 10));
  return stock <= minStock;
}

export function isExpiringSoon(
  product: Partial<Product> | null | undefined,
  windowDays = 14
): boolean {
  return daysUntilExpiry(product?.expiryDate) <= windowDays;
}

export interface RestockSuggestion {
  product: Product;
  daysOfCover: number;
  targetStock: number;
  recommendedQty: number;
  estimatedCost: number;
  urgency: 'Urgent' | 'Reorder Soon' | 'Monitor';
  reason: string;
}

export function computeRestockSuggestions(products: Product[]): RestockSuggestion[] {
  const safeProducts = Array.isArray(products) ? products : [];
  const suggestions: RestockSuggestion[] = [];

  for (const rawProduct of safeProducts) {
    const product = normalizeProduct(rawProduct);
    const velocity = Math.max(0.5, Number(product.avgDailySales) || 1);
    const daysOfCover = Number((product.stock / velocity).toFixed(1));
    // Target 14 days of sales cover plus safety buffer (or 5 days for short-shelf Dairy)
    const targetDays = product.category === 'Dairy' ? 5 : 14;
    const targetStock = Math.max(
      product.minStock * 2,
      Math.ceil(velocity * targetDays)
    );
    const recommendedQty = Math.max(0, targetStock - product.stock);

    if (product.stock <= product.minStock || daysOfCover <= 5) {
      let urgency: RestockSuggestion['urgency'] = 'Monitor';
      let reason = `Covers ~${daysOfCover} days at ${velocity}/day sales pace`;

      if (product.stock === 0) {
        urgency = 'Urgent';
        reason = `Out of stock — losing ~${velocity} units/day`;
      } else if (product.stock <= Math.ceil(product.minStock * 0.5) || daysOfCover <= 2.5) {
        urgency = 'Urgent';
        reason = `Only ${daysOfCover} days cover left (${product.stock} vs min ${product.minStock})`;
      } else if (product.stock <= product.minStock || daysOfCover <= 5) {
        urgency = 'Reorder Soon';
        reason = `Below reorder level (${product.stock}/${product.minStock}) · ~${daysOfCover}d cover`;
      }

      suggestions.push({
        product,
        daysOfCover,
        targetStock,
        recommendedQty: Math.max(recommendedQty, product.minStock),
        estimatedCost: Math.max(recommendedQty, product.minStock) * product.costPrice,
        urgency,
        reason,
      });
    }
  }

  return suggestions.sort((a, b) => {
    const rank = { Urgent: 0, 'Reorder Soon': 1, Monitor: 2 };
    if (rank[a.urgency] !== rank[b.urgency]) {
      return rank[a.urgency] - rank[b.urgency];
    }
    return a.daysOfCover - b.daysOfCover;
  });
}

export interface DashboardMetrics {
  totalProducts: number;
  totalUnitsInStock: number;
  inventoryValue: number;
  todaysSales: number;
  todaysBillsCount: number;
  todaysGrossProfit: number;
  totalSales7d: number;
  totalGrossProfit7d: number;
  totalExpenses: number;
  todaysExpenses: number;
  netProfit: number;
  netProfitMarginPct: number;
  lowStockProducts: Product[];
  expiringSoonProducts: Product[];
  restockSuggestions: RestockSuggestion[];
}

export function computeDashboardMetrics(
  products: Product[],
  sales: SaleRecord[],
  expenses: ExpenseRecord[]
): DashboardMetrics {
  const safeProducts = Array.isArray(products) ? products.map((p, i) => normalizeProduct(p, i)) : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const today = getLocalIsoDate(0);

  const todaysSalesRecords = safeSales.filter((s) => s?.date === today);
  const todaysSales = todaysSalesRecords.reduce((sum, s) => sum + toFiniteNumber(s?.totalAmount, 0), 0);
  const todaysGrossProfit = todaysSalesRecords.reduce((sum, s) => sum + toFiniteNumber(s?.grossProfit, 0), 0);

  const totalSales7d = safeSales.reduce((sum, s) => sum + toFiniteNumber(s?.totalAmount, 0), 0);
  const totalGrossProfit7d = safeSales.reduce((sum, s) => sum + toFiniteNumber(s?.grossProfit, 0), 0);
  const totalExpenses = safeExpenses.reduce((sum, e) => sum + toFiniteNumber(e?.amount, 0), 0);
  const todaysExpenses = safeExpenses
    .filter((e) => e?.date === today)
    .reduce((sum, e) => sum + toFiniteNumber(e?.amount, 0), 0);

  const netProfit = totalGrossProfit7d - totalExpenses;
  const netProfitMarginPct =
    totalSales7d > 0 ? Number(((netProfit / totalSales7d) * 100).toFixed(1)) : 0;

  const lowStockProducts = safeProducts
    .filter((p) => isLowStock(p))
    .sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));

  const expiringSoonProducts = safeProducts
    .filter((p) => isExpiringSoon(p, 14))
    .sort((a, b) => daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate));

  const restockSuggestions = computeRestockSuggestions(safeProducts);

  return {
    totalProducts: safeProducts.length,
    totalUnitsInStock: safeProducts.reduce((sum, p) => sum + p.stock, 0),
    inventoryValue: safeProducts.reduce((sum, p) => sum + p.stock * p.costPrice, 0),
    todaysSales,
    todaysBillsCount: todaysSalesRecords.length,
    todaysGrossProfit,
    totalSales7d,
    totalGrossProfit7d,
    totalExpenses,
    todaysExpenses,
    netProfit,
    netProfitMarginPct,
    lowStockProducts,
    expiringSoonProducts,
    restockSuggestions,
  };
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  sales: number;
  expenses: number;
  profit: number;
}

export function buildSevenDayTrend(
  sales: SaleRecord[],
  expenses: ExpenseRecord[]
): DailyTrendPoint[] {
  const points: DailyTrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const iso = getLocalIsoDate(-i);
    const d = new Date(`${iso}T00:00:00`);
    const label =
      i === 0
        ? 'Today'
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    const daySales = sales
      .filter((s) => s.date === iso)
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const dayGrossProfit = sales
      .filter((s) => s.date === iso)
      .reduce((sum, s) => sum + s.grossProfit, 0);
    const dayExpenses = expenses
      .filter((e) => e.date === iso)
      .reduce((sum, e) => sum + e.amount, 0);

    points.push({
      date: iso,
      label,
      sales: Math.round(daySales),
      expenses: Math.round(dayExpenses),
      profit: Math.round(dayGrossProfit - dayExpenses),
    });
  }
  return points;
}

export interface CategoryBreakdownPoint {
  category: ProductCategory;
  revenue: number;
  stockValue: number;
  productCount: number;
  lowStockCount: number;
}

export function buildCategoryBreakdown(
  products: Product[],
  sales: SaleRecord[]
): CategoryBreakdownPoint[] {
  const revenueByCat: Record<string, number> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      revenueByCat[item.category] = (revenueByCat[item.category] || 0) + item.lineTotal;
    }
  }

  return PRODUCT_CATEGORIES.map((category) => {
    const catProducts = products.filter((p) => p.category === category);
    return {
      category,
      revenue: Math.round(revenueByCat[category] || 0),
      stockValue: Math.round(
        catProducts.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
      ),
      productCount: catProducts.length,
      lowStockCount: catProducts.filter((p) => isLowStock(p)).length,
    };
  });
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeAgo(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
