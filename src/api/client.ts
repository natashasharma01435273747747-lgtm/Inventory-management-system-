import { createSeedStore } from '../data/seedStore.ts';
import type {
  AdjustmentReasonType,
  AuthUser,
  EmployeeRecord,
  ExpenseCategory,
  ExpenseRecord,
  PaymentMethod,
  Product,
  ProductCategory,
  PublicCatalogResponse,
  PurchaseRecord,
  SaleItem,
  SaleRecord,
  StockAdjustmentRequest,
  StoreSnapshot,
  UserRole,
} from '../types/store.ts';
import {
  computeDashboardMetrics,
  daysUntilExpiry,
  formatInr,
  getLocalIsoDate,
  normalizeCategory,
  normalizeProduct,
  normalizeStoreSnapshot,
} from '../utils/storeMetrics.ts';

const STORAGE_VERSION_KEY = 'smartstock_storage_version';
const CURRENT_STORAGE_VERSION = '4';
const TOKEN_STORAGE_KEY = 'smartstock_auth_token';
export const REMEMBERED_USER_KEY = 'smartstock_remembered_user';
export const PUBLIC_STORE_URL_KEY = 'smartstock_public_store_url';
const LOCAL_STORE_KEY = 'smartstock_local_store_v1';
const LOCAL_SESSION_KEY = 'smartstock_local_session_v1';
const LOCAL_INVOICE_KEY = 'smartstock_local_invoice_seq';

const ALLOWED_STORAGE_KEYS = new Set([
  STORAGE_VERSION_KEY,
  TOKEN_STORAGE_KEY,
  REMEMBERED_USER_KEY,
  PUBLIC_STORE_URL_KEY,
  LOCAL_STORE_KEY,
  LOCAL_SESSION_KEY,
  LOCAL_INVOICE_KEY,
]);

// Tracks whether /api backend is unavailable (e.g., static hosting / Vercel)
let useLocalBackendFallback = false;

class BackendUnavailableError extends Error {
  constructor(message = 'Backend API unavailable') {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

interface LocalAccount {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  designation: string;
}

const LOCAL_ACCOUNTS: LocalAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Rajesh Sharma',
    email: 'admin@smartstock.in',
    username: 'admin',
    password: 'admin123',
    role: 'Admin',
    designation: 'Store Owner & Manager',
  },
  {
    id: 'usr-emp-1',
    name: 'Priya Verma',
    email: 'cashier@smartstock.in',
    username: 'cashier',
    password: 'staff123',
    role: 'Employee',
    designation: 'Senior Billing Cashier',
  },
  {
    id: 'usr-emp-2',
    name: 'Rohan Joshi',
    email: 'rohan.joshi@smartstock.in',
    username: 'rohan.joshi',
    password: 'staff123',
    role: 'Employee',
    designation: 'POS & Floor Associate',
  },
];

function isValidStoredToken(value: string | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  return /^[A-Za-z0-9._-]{12,256}$/.test(trimmed);
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

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createLocalToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return `local_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

// ---------------------------------------------------------------------------
// LocalStorage Engine (Pre-seeded Store + Session Persistence)
// ---------------------------------------------------------------------------

function readLocalStore(): StoreSnapshot {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;
        const normalized = normalizeStoreSnapshot(parsed);
        if (normalized.products.length > 0) {
          return normalized;
        }
      }
    } catch {
      // Corrupt cache — re-seed cleanly below
    }
  }
  const seeded = normalizeStoreSnapshot(createSeedStore());
  writeLocalStore(seeded);
  return seeded;
}

function writeLocalStore(snapshot: StoreSnapshot): StoreSnapshot {
  const normalized = normalizeStoreSnapshot(snapshot);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore quota errors
    }
  }
  return normalized;
}

function nextLocalInvoiceNumber(): string {
  let seq = 1055;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = Number(localStorage.getItem(LOCAL_INVOICE_KEY));
      if (Number.isFinite(stored) && stored >= 1000) {
        seq = Math.round(stored);
      }
      localStorage.setItem(LOCAL_INVOICE_KEY, String(seq + 1));
    } catch {
      // Ignore storage errors
    }
  }
  return `INV-${new Date().getFullYear()}-${seq}`;
}

function readLocalSession(): { token: string; user: AuthUser } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; user?: Partial<AuthUser> };
    const user = normalizeAuthUser(parsed?.user);
    if (!parsed?.token || !isValidStoredToken(parsed.token) || !user) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      return null;
    }
    return { token: parsed.token, user };
  } catch {
    return null;
  }
}

function writeLocalSession(session: { token: string; user: AuthUser } | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (session) {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function getActiveLocalUser(): AuthUser {
  const session = readLocalSession();
  if (session?.user) return session.user;
  return {
    id: 'usr-admin-1',
    name: 'Rajesh Sharma',
    email: 'admin@smartstock.in',
    role: 'Admin',
    designation: 'Store Owner & Manager',
  };
}

export function migrateAndSanitizeStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    if (version !== CURRENT_STORAGE_VERSION) {
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

    // Validate local store JSON if present so malformed data never breaks render
    const rawStore = localStorage.getItem(LOCAL_STORE_KEY);
    if (rawStore !== null) {
      try {
        const parsed = JSON.parse(rawStore) as Partial<StoreSnapshot>;
        if (!parsed || !Array.isArray(parsed.products)) {
          localStorage.removeItem(LOCAL_STORE_KEY);
        }
      } catch {
        localStorage.removeItem(LOCAL_STORE_KEY);
      }
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

// ---------------------------------------------------------------------------
// API Fetch with Automatic Static-Hosting / 404 Fallback Detection
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (useLocalBackendFallback) {
    throw new BackendUnavailableError();
  }

  const token = getStoredToken();
  if (token && token.startsWith('local_')) {
    useLocalBackendFallback = true;
    throw new BackendUnavailableError();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    useLocalBackendFallback = true;
    throw new BackendUnavailableError();
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  // Static hosts (e.g. Vercel without serverless routes) return 404/405/502/503 or HTML SPA fallback
  if (res.status === 404 || res.status === 405 || res.status === 502 || res.status === 503) {
    if (!isJson) {
      useLocalBackendFallback = true;
      throw new BackendUnavailableError();
    }
    const maybeErr = await res.json().catch(() => null);
    // Express returns JSON `{ error: "Product not found." }` for real resource 404s;
    // static hosts return empty/platform 404s without our API error structure
    if (!maybeErr || typeof maybeErr.error !== 'string') {
      useLocalBackendFallback = true;
      throw new BackendUnavailableError();
    }
    throw new Error(maybeErr.error);
  }

  if (!isJson) {
    useLocalBackendFallback = true;
    throw new BackendUnavailableError();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

async function withLocalFallback<T>(
  remoteCall: () => Promise<T>,
  localFallback: () => T
): Promise<T> {
  try {
    return await remoteCall();
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localFallback();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Authentication APIs (Express Backend + Instant Client-Side Fallback)
// ---------------------------------------------------------------------------

function localLogin(
  emailOrUsername: string,
  password: string,
  role?: UserRole
): { token: string; user: AuthUser } {
  const identifier = emailOrUsername.trim().toLowerCase();
  const account = LOCAL_ACCOUNTS.find(
    (acc) => acc.email === identifier || acc.username === identifier
  );

  if (!account || account.password !== password) {
    throw new Error(
      'Invalid username/email or password. Please check your credentials and try again.'
    );
  }

  if (role && account.role !== role) {
    throw new Error(
      `This account is registered for ${account.role} Login. Please switch to the ${account.role} Login tab.`
    );
  }

  const user: AuthUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    designation: account.designation,
  };
  const token = createLocalToken();
  writeLocalSession({ token, user });
  setStoredToken(token);
  // Ensure pre-seeded store exists in localStorage immediately upon sign-in
  readLocalStore();
  return { token, user };
}

export async function loginWithPassword(
  email: string,
  password: string,
  role?: UserRole
): Promise<{ token: string; user: AuthUser }> {
  // Always attempt remote Express login first unless static fallback is already confirmed
  if (useLocalBackendFallback) {
    return localLogin(email, password, role);
  }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');

    if (
      res.status === 404 ||
      res.status === 405 ||
      res.status === 502 ||
      res.status === 503 ||
      !isJson
    ) {
      useLocalBackendFallback = true;
      return localLogin(email, password, role);
    }

    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: AuthUser;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || `Login failed (${res.status})`);
    }

    const user = normalizeAuthUser(data?.user);
    if (!data?.token || !user) {
      useLocalBackendFallback = true;
      return localLogin(email, password, role);
    }

    writeLocalSession(null);
    return { token: data.token, user };
  } catch (err) {
    if (err instanceof TypeError) {
      useLocalBackendFallback = true;
      return localLogin(email, password, role);
    }
    throw err;
  }
}

export async function fetchCurrentUser(): Promise<{ user: AuthUser }> {
  return withLocalFallback(
    async () => {
      const data = await apiFetch<{ user?: AuthUser }>('/api/auth/me');
      const user = normalizeAuthUser(data?.user);
      if (!user) {
        throw new Error('Invalid session.');
      }
      return { user };
    },
    () => {
      const session = readLocalSession();
      const token = getStoredToken();
      if (session && token && session.token === token) {
        return { user: session.user };
      }
      throw new Error('Authentication required. Please sign in.');
    }
  );
}

export async function logoutSession(): Promise<void> {
  try {
    if (!useLocalBackendFallback) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
  } catch {
    // Always clear client session cleanly
  } finally {
    setStoredToken(null);
    writeLocalSession(null);
  }
}

// ---------------------------------------------------------------------------
// Store Snapshot & Public Customer Catalog
// ---------------------------------------------------------------------------

export async function fetchStoreSnapshot(): Promise<StoreSnapshot> {
  return withLocalFallback(
    async () => {
      const data = await apiFetch<Partial<StoreSnapshot>>('/api/store');
      return normalizeStoreSnapshot(data);
    },
    () => readLocalStore()
  );
}

export async function resetDemoStore(): Promise<StoreSnapshot> {
  return withLocalFallback(
    async () => {
      const data = await apiFetch<Partial<StoreSnapshot>>('/api/store/reset', {
        method: 'POST',
      });
      return normalizeStoreSnapshot(data);
    },
    () => {
      const seeded = normalizeStoreSnapshot(createSeedStore());
      return writeLocalStore(seeded);
    }
  );
}

export async function fetchPublicCatalog(): Promise<PublicCatalogResponse> {
  const buildLocalCatalog = (): PublicCatalogResponse => {
    const snapshot = readLocalStore();
    return {
      storeName: 'Shree Ganesh General Store',
      updatedAt: new Date().toISOString(),
      products: snapshot.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: p.price,
        available: p.stock > 0,
      })),
    };
  };

  if (useLocalBackendFallback) {
    return buildLocalCatalog();
  }

  try {
    const res = await fetch('/api/public/catalog', { cache: 'no-store' });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('application/json')) {
      useLocalBackendFallback = true;
      return buildLocalCatalog();
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.products)) {
      useLocalBackendFallback = true;
      return buildLocalCatalog();
    }
    return {
      storeName:
        typeof data.storeName === 'string' && data.storeName.trim()
          ? data.storeName.trim()
          : 'Shree Ganesh General Store',
      updatedAt:
        typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      products: data.products.map((p: Record<string, unknown>, idx: number) => ({
        id: typeof p?.id === 'string' && p.id ? p.id : `pub-${idx}`,
        name: typeof p?.name === 'string' && p.name ? p.name : 'Store Item',
        category: normalizeCategory(p?.category),
        unit: typeof p?.unit === 'string' && p.unit ? p.unit : '1 pack',
        price: Number.isFinite(Number(p?.price)) ? Number(p?.price) : 0,
        available: Boolean(p?.available),
      })),
    };
  } catch {
    useLocalBackendFallback = true;
    return buildLocalCatalog();
  }
}

// ---------------------------------------------------------------------------
// Products CRUD & Restock
// ---------------------------------------------------------------------------

export interface ProductInput {
  sku?: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  mrp?: number;
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
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>(
        '/api/products',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return { product: normalizeProduct(res.product), store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const roundedPrice = Math.round(Number(input.price) * 100) / 100;
      const newProduct = normalizeProduct({
        id: randomId('prod'),
        sku: input.sku?.trim().toUpperCase() || `ITEM-${randomId('sk').slice(-6).toUpperCase()}`,
        name: input.name.trim(),
        category: input.category,
        unit: input.unit.trim() || '1 pack',
        price: roundedPrice,
        mrp: input.mrp,
        costPrice: Math.round(Number(input.costPrice) * 100) / 100,
        stock: Math.max(0, Math.round(Number(input.stock) || 0)),
        minStock: Math.max(1, Math.round(Number(input.minStock) || 10)),
        expiryDate: input.expiryDate,
        supplier: input.supplier.trim(),
        avgDailySales: Math.max(0.5, Number(input.avgDailySales) || 3),
      });

      const nextPurchases = [...store.purchases];
      if (newProduct.stock > 0) {
        const purchase: PurchaseRecord = {
          id: randomId('pur'),
          date: getLocalIsoDate(0),
          productId: newProduct.id,
          productName: newProduct.name,
          category: newProduct.category,
          supplier: newProduct.supplier,
          quantity: newProduct.stock,
          unitCost: newProduct.costPrice,
          totalCost: Math.round(newProduct.stock * newProduct.costPrice),
          recordedBy: getActiveLocalUser().name,
        };
        nextPurchases.unshift(purchase);
      }

      const nextStore = writeLocalStore({
        ...store,
        products: [newProduct, ...store.products],
        purchases: nextPurchases,
      });
      return { product: newProduct, store: nextStore };
    }
  );
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<{ product: Product; store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>(
        `/api/products/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      );
      return { product: normalizeProduct(res.product), store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const existing = store.products.find((p) => p.id === id);
      if (!existing) {
        throw new Error('Product not found.');
      }
      const updated = normalizeProduct({
        ...existing,
        ...input,
        id: existing.id,
        sku: input.sku?.trim().toUpperCase() || existing.sku,
        name: input.name?.trim() || existing.name,
        unit: input.unit?.trim() || existing.unit,
        supplier: input.supplier?.trim() || existing.supplier,
      });
      const nextStore = writeLocalStore({
        ...store,
        products: store.products.map((p) => (p.id === id ? updated : p)),
      });
      return { product: updated, store: nextStore };
    }
  );
}

export async function deleteProduct(id: string): Promise<{ ok: boolean; store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ ok: boolean; store: Partial<StoreSnapshot> }>(
        `/api/products/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
      return { ok: Boolean(res.ok), store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const nextStore = writeLocalStore({
        ...store,
        products: store.products.filter((p) => p.id !== id),
      });
      return { ok: true, store: nextStore };
    }
  );
}

export async function restockProduct(
  id: string,
  quantity: number,
  expiryDate?: string
): Promise<{ product: Product; store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ product: Product; store: Partial<StoreSnapshot> }>(
        `/api/products/${encodeURIComponent(id)}/restock`,
        {
          method: 'POST',
          body: JSON.stringify({ quantity, expiryDate }),
        }
      );
      return { product: normalizeProduct(res.product), store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const existing = store.products.find((p) => p.id === id);
      if (!existing) {
        throw new Error('Product not found.');
      }
      const safeQty = Math.max(1, Math.round(Number(quantity) || 1));
      const updated = normalizeProduct({
        ...existing,
        stock: existing.stock + safeQty,
        expiryDate:
          expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
            ? expiryDate
            : existing.expiryDate,
      });
      const purchase: PurchaseRecord = {
        id: randomId('pur'),
        date: getLocalIsoDate(0),
        productId: updated.id,
        productName: updated.name,
        category: updated.category,
        supplier: updated.supplier,
        quantity: safeQty,
        unitCost: updated.costPrice,
        totalCost: Math.round(safeQty * updated.costPrice),
        recordedBy: getActiveLocalUser().name,
      };
      const nextStore = writeLocalStore({
        ...store,
        products: store.products.map((p) => (p.id === id ? updated : p)),
        purchases: [purchase, ...store.purchases],
      });
      return { product: updated, store: nextStore };
    }
  );
}

// ---------------------------------------------------------------------------
// POS Billing / Sales (Automatic Stock Deduction)
// ---------------------------------------------------------------------------

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
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ sale: SaleRecord; store: Partial<StoreSnapshot> }>(
        '/api/sales',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return { sale: res.sale, store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new Error('Add at least one item to generate a customer bill.');
      }

      const productMap = new Map(store.products.map((p) => [p.id, p]));
      const qtyByProduct = new Map<string, number>();
      for (const item of input.items) {
        const qty = Math.round(Number(item.quantity));
        if (!Number.isFinite(qty) || qty <= 0) continue;
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty);
      }

      const saleItems: SaleItem[] = [];
      let subtotal = 0;
      let totalCost = 0;

      for (const [productId, quantity] of qtyByProduct.entries()) {
        const product = productMap.get(productId);
        if (!product) {
          throw new Error('One of the cart items is no longer available.');
        }
        if (quantity > product.stock) {
          throw new Error(
            `Only ${product.stock} unit(s) of ${product.name} available in stock.`
          );
        }
        const lineTotal = Math.round(product.price * quantity * 100) / 100;
        subtotal += lineTotal;
        totalCost += product.costPrice * quantity;
        saleItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          unit: product.unit,
          quantity,
          unitPrice: product.price,
          costPrice: product.costPrice,
          lineTotal,
        });
      }

      const discount = Math.min(Math.max(0, Number(input.discount) || 0), subtotal);
      const taxableBase = Math.max(0, subtotal - discount);
      const gstAmount = input.includeGst ? Math.round(taxableBase * 0.05) : 0;
      const totalAmount = Math.round(taxableBase + gstAmount);
      const grossProfit = Math.round(taxableBase - totalCost);

      // Deduct sold quantities from live store inventory
      const updatedProducts = store.products.map((p) => {
        const soldQty = qtyByProduct.get(p.id);
        if (!soldQty) return p;
        return {
          ...p,
          stock: Math.max(0, p.stock - soldQty),
        };
      });

      const sale: SaleRecord = {
        id: randomId('sale'),
        invoiceNumber: nextLocalInvoiceNumber(),
        date: getLocalIsoDate(0),
        createdAt: new Date().toISOString(),
        customerName: input.customerName.trim() || 'Walk-in Customer',
        customerPhone: input.customerPhone?.trim() || undefined,
        paymentMethod: input.paymentMethod || 'UPI',
        cashierName: getActiveLocalUser().name,
        items: saleItems,
        subtotal: Math.round(subtotal),
        gstAmount,
        discount: Math.round(discount),
        totalAmount,
        totalCost: Math.round(totalCost),
        grossProfit,
      };

      const nextStore = writeLocalStore({
        ...store,
        products: updatedProducts,
        sales: [sale, ...store.sales],
      });

      return { sale, store: nextStore };
    }
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

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
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ store: Partial<StoreSnapshot> }>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return { store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const expense: ExpenseRecord = {
        id: randomId('exp'),
        date: input.date || getLocalIsoDate(0),
        title: input.title.trim(),
        category: input.category,
        amount: Math.round(Number(input.amount) || 0),
        paymentMethod: input.paymentMethod,
        notes: input.notes?.trim() || undefined,
      };
      const nextStore = writeLocalStore({
        ...store,
        expenses: [expense, ...store.expenses],
      });
      return { store: nextStore };
    }
  );
}

export async function deleteExpense(id: string): Promise<{ store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
        `/api/expenses/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
      return { store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const nextStore = writeLocalStore({
        ...store,
        expenses: store.expenses.filter((e) => e.id !== id),
      });
      return { store: nextStore };
    }
  );
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export type EmployeeInput = Omit<EmployeeRecord, 'id' | 'joinedDate'>;

export async function createEmployee(
  input: EmployeeInput
): Promise<{ store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ store: Partial<StoreSnapshot> }>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return { store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const employee: EmployeeRecord = {
        ...input,
        id: randomId('emp'),
        joinedDate: getLocalIsoDate(0),
      };
      const nextStore = writeLocalStore({
        ...store,
        employees: [employee, ...store.employees],
      });
      return { store: nextStore };
    }
  );
}

export async function updateEmployee(
  id: string,
  input: Partial<EmployeeInput>
): Promise<{ store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
        `/api/employees/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      );
      return { store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const nextStore = writeLocalStore({
        ...store,
        employees: store.employees.map((e) => (e.id === id ? { ...e, ...input } : e)),
      });
      return { store: nextStore };
    }
  );
}

export async function deleteEmployee(id: string): Promise<{ store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{ store: Partial<StoreSnapshot> }>(
        `/api/employees/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
      return { store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const nextStore = writeLocalStore({
        ...store,
        employees: store.employees.filter((e) => e.id !== id),
      });
      return { store: nextStore };
    }
  );
}

// ---------------------------------------------------------------------------
// Stock Adjustment Approvals
// ---------------------------------------------------------------------------

export interface CreateAdjustmentInput {
  productId: string;
  requestedDelta: number;
  reasonType: AdjustmentReasonType;
  notes: string;
}

export async function submitStockAdjustment(
  input: CreateAdjustmentInput
): Promise<{ request: StockAdjustmentRequest; store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{
        request: StockAdjustmentRequest;
        store: Partial<StoreSnapshot>;
      }>('/api/approvals', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return { request: res.request, store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const product = store.products.find((p) => p.id === input.productId);
      if (!product) {
        throw new Error('Selected product not found.');
      }
      const delta = Math.round(Number(input.requestedDelta));
      if (!Number.isFinite(delta) || delta === 0) {
        throw new Error('Adjustment quantity must be non-zero.');
      }
      const request: StockAdjustmentRequest = {
        id: randomId('adj'),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: product.stock,
        requestedDelta: delta,
        reasonType: input.reasonType,
        notes: input.notes.trim(),
        requestedBy: getActiveLocalUser().name,
        requestedAt: new Date().toISOString(),
        status: 'Pending',
      };
      const nextStore = writeLocalStore({
        ...store,
        adjustments: [request, ...store.adjustments],
      });
      return { request, store: nextStore };
    }
  );
}

export async function reviewStockAdjustment(
  id: string,
  decision: 'Approved' | 'Rejected',
  reviewNote?: string
): Promise<{ request: StockAdjustmentRequest; store: StoreSnapshot }> {
  return withLocalFallback(
    async () => {
      const res = await apiFetch<{
        request: StockAdjustmentRequest;
        store: Partial<StoreSnapshot>;
      }>(`/api/approvals/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reviewNote }),
      });
      return { request: res.request, store: normalizeStoreSnapshot(res.store) };
    },
    () => {
      const store = readLocalStore();
      const target = store.adjustments.find((a) => a.id === id);
      if (!target) {
        throw new Error('Adjustment request not found.');
      }
      let nextProducts = store.products;
      if (decision === 'Approved') {
        nextProducts = store.products.map((p) =>
          p.id === target.productId
            ? { ...p, stock: Math.max(0, p.stock + target.requestedDelta) }
            : p
        );
      }
      const updatedRequest: StockAdjustmentRequest = {
        ...target,
        status: decision,
        reviewedBy: getActiveLocalUser().name,
        reviewedAt: new Date().toISOString(),
        reviewNote: reviewNote?.trim() || undefined,
      };
      const nextStore = writeLocalStore({
        ...store,
        products: nextProducts,
        adjustments: store.adjustments.map((a) => (a.id === id ? updatedRequest : a)),
      });
      return { request: updatedRequest, store: nextStore };
    }
  );
}

// ---------------------------------------------------------------------------
// Offline / Static Hosting Smart Assistant Summary Fallback
// ---------------------------------------------------------------------------

export function generateLocalAssistantReply(question: string): string {
  const store = readLocalStore();
  const metrics = computeDashboardMetrics(store.products, store.sales, store.expenses);
  const q = question.toLowerCase();

  if (q.includes('low') || q.includes('restock') || q.includes('reorder') || q.includes('budget')) {
    const suggestions = metrics.restockSuggestions.slice(0, 8);
    if (suggestions.length === 0) {
      return '### All Stock Levels Healthy\n\nNo products are currently below their reorder threshold.';
    }
    const totalBudget = suggestions.reduce((sum, s) => sum + s.estimatedCost, 0);
    const rows = suggestions
      .map(
        (s) =>
          `- **${s.product.name}** (${s.product.unit}) — Stock: **${s.product.stock}** / Min ${s.product.minStock} → Reorder **+${s.recommendedQty} units** (~${formatInr(s.estimatedCost)}) *(${s.urgency})*`
      )
      .join('\n');
    return `### Low-Stock & Smart Restock Priority\n\n${rows}\n\n**Estimated Priority Restock Budget:** ${formatInr(totalBudget)}`;
  }

  if (q.includes('expir')) {
    const expiring = metrics.expiringSoonProducts;
    if (expiring.length === 0) {
      return '### No Immediate Expiry Alerts\n\nAll active products have more than 14 days of shelf life remaining.';
    }
    const rows = expiring
      .map((p) => {
        const days = daysUntilExpiry(p.expiryDate);
        const tag = days <= 0 ? 'Expired / Today' : `${days} days left`;
        return `- **${p.name}** (${p.unit}) — **${p.stock} units** in stock · Expiry: \`${p.expiryDate}\` (**${tag}**)`;
      })
      .join('\n');
    return `### Upcoming Expiry Watch (Next 14 Days)\n\n${rows}\n\n**Action Tip:** Place items with ≤5 days left near the POS billing counter with a 10–15% bundle discount to clear inventory before expiry.`;
  }

  if (q.includes('profit') || q.includes('today') || q.includes('sales') || q.includes('expense')) {
    return [
      `### Today's & 7-Day Store Performance`,
      '',
      `- **Today's Sales:** ${formatInr(metrics.todaysSales)} across **${metrics.todaysBillsCount}** bills`,
      `- **Today's Gross Profit:** ${formatInr(metrics.todaysGrossProfit)}`,
      `- **7-Day Total Sales:** ${formatInr(metrics.totalSales7d)}`,
      `- **Recorded Business Expenses:** ${formatInr(metrics.totalExpenses)}`,
      `- **7-Day Net Profit:** ${formatInr(metrics.netProfit)} (${metrics.netProfitMarginPct}% margin)`,
      `- **Inventory Alert Count:** ${metrics.lowStockProducts.length} low-stock · ${metrics.expiringSoonProducts.length} expiring soon`,
    ].join('\n');
  }

  // Demand forecast / top movers default
  const topMovers = [...store.products]
    .sort((a, b) => b.avgDailySales - a.avgDailySales)
    .slice(0, 6);
  const moverLines = topMovers
    .map(
      (p) =>
        `- **${p.name}** (${p.category}) — ~**${Math.round(p.avgDailySales * 7)} units** projected next 7 days · Current stock: **${p.stock}**`
    )
    .join('\n');

  return [
    `### Next Week Demand Forecast & Store Snapshot`,
    '',
    moverLines,
    '',
    `**Quick Summary:** ${metrics.totalProducts} SKUs active · Today's sales ${formatInr(metrics.todaysSales)} · ${metrics.lowStockProducts.length} items need restocking.`,
  ].join('\n');
}
