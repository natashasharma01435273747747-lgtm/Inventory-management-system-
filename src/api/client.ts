import type {
  AdjustmentReasonType,
  AuthUser,
  EmployeeRecord,
  ExpenseCategory,
  PaymentMethod,
  Product,
  ProductCategory,
  PublicCatalogResponse,
  SaleRecord,
  StockAdjustmentRequest,
  StoreSnapshot,
  UserRole,
} from '../types/store.ts';
import { normalizeCategory, normalizeStoreSnapshot } from '../utils/storeMetrics.ts';

const STORAGE_VERSION_KEY = 'smartstock_storage_version';
const CURRENT_STORAGE_VERSION = '3';
const TOKEN_STORAGE_KEY = 'smartstock_auth_token';
export const REMEMBERED_USER_KEY = 'smartstock_remembered_user';
export const PUBLIC_STORE_URL_KEY = 'smartstock_public_store_url';

const ALLOWED_STORAGE_KEYS = new Set([
  STORAGE_VERSION_KEY,
  TOKEN_STORAGE_KEY,
  REMEMBERED_USER_KEY,
  PUBLIC_STORE_URL_KEY,
]);

function isValidStoredToken(value: string | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  // Tokens are opaque hex/alphanumeric strings without whitespace or JSON braces
  return /^[A-Za-z0-9._-]{16,256}$/.test(trimmed);
}

function isValidRememberedUser(value: string | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.length > 160 || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }
  return true;
}

export function migrateAndSanitizeStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    if (version !== CURRENT_STORAGE_VERSION) {
      // Remove any legacy or incompatible cached keys from earlier builds
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && !ALLOWED_STORAGE_KEYS.has(key)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token !== null && !isValidStoredToken(token)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    const remembered = localStorage.getItem(REMEMBERED_USER_KEY);
    if (remembered !== null && !isValidRememberedUser(remembered)) {
      localStorage.removeItem(REMEMBERED_USER_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted iframes/private browsing
  }
}

export function clearAllAppStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.clear();
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
  } catch {
    // Ignore storage access errors
  }
}

export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!isValidStoredToken(raw)) {
      if (raw !== null) localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return raw.trim();
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token && isValidStoredToken(token)) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeAuthUser(raw: Partial<AuthUser> | null | undefined): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const role: UserRole | null =
    raw.role === 'Admin' || raw.role === 'Employee' ? raw.role : null;
  if (!role) return null;
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : 'user',
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : role === 'Admin'
          ? 'Store Admin'
          : 'Store Staff',
    email: typeof raw.email === 'string' ? raw.email.trim() : '',
    role,
    designation:
      typeof raw.designation === 'string' && raw.designation.trim()
        ? raw.designation.trim()
        : role,
  };
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function loginWithPassword(
  email: string,
  password: string,
  role?: UserRole
): Promise<{ token: string; user: AuthUser }> {
  const data = await apiFetch<{ token?: string; user?: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
  const user = normalizeAuthUser(data?.user);
  if (!data?.token || !user) {
    throw new Error('Unexpected login response from server.');
  }
  return { token: data.token, user };
}

export async function fetchCurrentUser(): Promise<{ user: AuthUser }> {
  const data = await apiFetch<{ user?: AuthUser }>('/api/auth/me');
  const user = normalizeAuthUser(data?.user);
  if (!user) {
    throw new Error('Invalid session.');
  }
  return { user };
}

export async function logoutSession(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Always clear client token even if server already expired
  } finally {
    setStoredToken(null);
  }
}

export async function fetchStoreSnapshot(): Promise<StoreSnapshot> {
  const data = await apiFetch<Partial<StoreSnapshot>>('/api/store');
  return normalizeStoreSnapshot(data);
}

export async function resetDemoStore(): Promise<StoreSnapshot> {
  const data = await apiFetch<Partial<StoreSnapshot>>('/api/store/reset', { method: 'POST' });
  return normalizeStoreSnapshot(data);
}

export async function fetchPublicCatalog(): Promise<PublicCatalogResponse> {
  const res = await fetch('/api/public/catalog', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Unable to load store product availability.');
  }
  const rawList = Array.isArray(data?.products) ? data.products : [];
  return {
    storeName:
      typeof data?.storeName === 'string' && data.storeName.trim()
        ? data.storeName.trim()
        : 'SmartStock General Store',
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    products: rawList.map((p: Record<string, unknown>, idx: number) => ({
      id: typeof p?.id === 'string' && p.id ? p.id : `pub-${idx}`,
      name: typeof p?.name === 'string' && p.name ? p.name : 'Store Item',
      category: normalizeCategory(p?.category),
      unit: typeof p?.unit === 'string' && p.unit ? p.unit : '1 pack',
      price: Number.isFinite(Number(p?.price)) ? Number(p?.price) : 0,
      available: Boolean(p?.available),
    })),
  };
}

export interface ProductInput {
  sku?: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  expiryDate: string;
  supplier: string;
  avgDailySales: number;
}

export async function createProduct(
  input: ProductInput
): Promise<{ product: Product; store: StoreSnapshot }> {
  const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { product: res.product, store: normalizeStoreSnapshot(res.store) };
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<{ product: Product; store: StoreSnapshot }> {
  const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return { product: res.product, store: normalizeStoreSnapshot(res.store) };
}

export async function deleteProduct(id: string): Promise<{ ok: boolean; store: StoreSnapshot }> {
  const res = await apiFetch<{ ok: boolean; store: Partial<StoreSnapshot> }>(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  return { ok: Boolean(res.ok), store: normalizeStoreSnapshot(res.store) };
}

export async function restockProduct(
  id: string,
  quantity: number,
  expiryDate?: string
): Promise<{ product: Product; store: StoreSnapshot }> {
  const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>(
    `/api/products/${encodeURIComponent(id)}/restock`,
    {
      method: 'POST',
      body: JSON.stringify({ quantity, expiryDate }),
    }
  );
  return { product: res.product, store: normalizeStoreSnapshot(res.store) };
}

export interface CreateSaleInput {
  customerName: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  includeGst: boolean;
  discount: number;
  items: Array<{ productId: string; quantity: number }>;
}

export async function createSale(
  input: CreateSaleInput
): Promise<{ sale: SaleRecord; store: StoreSnapshot }> {
  const res = await apiFetch<{ sale: SaleRecord; store: Partial<StoreSnapshot> }>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { sale: res.sale, store: normalizeStoreSnapshot(res.store) };
}

export interface CreateExpenseInput {
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod | 'Bank Transfer';
  notes?: string;
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<{ store: StoreSnapshot }> {
  const res = await apiFetch<{ store: Partial<StoreSnapshot> }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { store: normalizeStoreSnapshot(res.store) };
}

export async function deleteExpense(id: string): Promise<{ store: StoreSnapshot }> {
  const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
    `/api/expenses/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  return { store: normalizeStoreSnapshot(res.store) };
}

export type EmployeeInput = Omit<EmployeeRecord, 'id' | 'joinedDate'>;

export async function createEmployee(
  input: EmployeeInput
): Promise<{ store: StoreSnapshot }> {
  const res = await apiFetch<{ store: Partial<StoreSnapshot> }>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { store: normalizeStoreSnapshot(res.store) };
}

export async function updateEmployee(
  id: string,
  input: Partial<EmployeeInput>
): Promise<{ store: StoreSnapshot }> {
  const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
    `/api/employees/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return { store: normalizeStoreSnapshot(res.store) };
}

export async function deleteEmployee(id: string): Promise<{ store: StoreSnapshot }> {
  const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
    `/api/employees/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  return { store: normalizeStoreSnapshot(res.store) };
}

export interface CreateAdjustmentInput {
  productId: string;
  requestedDelta: number;
  reasonType: AdjustmentReasonType;
  notes: string;
}

export async function submitStockAdjustment(
  input: CreateAdjustmentInput
): Promise<{ request: StockAdjustmentRequest; store: StoreSnapshot }> {
  const res = await apiFetch<{
    request: StockAdjustmentRequest;
    store: Partial<StoreSnapshot>;
  }>('/api/approvals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { request: res.request, store: normalizeStoreSnapshot(res.store) };
}

export async function reviewStockAdjustment(
  id: string,
  decision: 'Approved' | 'Rejected',
  reviewNote?: string
): Promise<{ request: StockAdjustmentRequest; store: StoreSnapshot }> {
  const res = await apiFetch<{
    request: StockAdjustmentRequest;
    store: Partial<StoreSnapshot>;
  }>(`/api/approvals/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, reviewNote }),
  });
  return { request: res.request, store: normalizeStoreSnapshot(res.store) };
}
