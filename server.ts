import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createSeedStore } from './src/data/seedStore.ts';
import type {
  AdjustmentReasonType,
  AuthUser,
  EmployeeRecord,
  EmployeeShift,
  EmployeeStatus,
  ExpenseCategory,
  ExpenseRecord,
  PaymentMethod,
  Product,
  ProductCategory,
  PurchaseRecord,
  SaleItem,
  SaleRecord,
  StockAdjustmentRequest,
  StoreSnapshot,
  UserRole,
} from './src/types/store.ts';
import {
  ADJUSTMENT_REASON_TYPES,
  EXPENSE_CATEGORIES,
  PRODUCT_CATEGORIES,
} from './src/types/store.ts';
import {
  computeDashboardMetrics,
  daysUntilExpiry,
  formatInr,
  getLocalIsoDate,
} from './src/utils/storeMetrics.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Auth & Session Management (salted scrypt + opaque server-side tokens)
// ---------------------------------------------------------------------------

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  salt: string;
  passwordHash: string;
}

interface SessionRecord {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  session?: SessionRecord;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const accountsByEmail = new Map<string, StoredAccount>();
const activeSessions = new Map<string, SessionRecord>();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHex: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHex, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function seedAccounts(): void {
  const defaults: Array<{
    id: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
    designation: string;
  }> = [
    {
      id: 'usr-admin-1',
      name: 'Rajesh Sharma',
      email: 'admin@smartstock.in',
      password: 'admin123',
      role: 'Admin',
      designation: 'Store Owner & Manager',
    },
    {
      id: 'usr-emp-1',
      name: 'Priya Verma',
      email: 'cashier@smartstock.in',
      password: 'staff123',
      role: 'Employee',
      designation: 'Senior Billing Cashier',
    },
    {
      id: 'usr-emp-2',
      name: 'Rohan Joshi',
      email: 'rohan.joshi@smartstock.in',
      password: 'staff123',
      role: 'Employee',
      designation: 'POS & Floor Associate',
    },
  ];

  for (const acc of defaults) {
    const salt = crypto.randomBytes(16).toString('hex');
    accountsByEmail.set(acc.email.toLowerCase(), {
      id: acc.id,
      name: acc.name,
      email: acc.email.toLowerCase(),
      role: acc.role,
      designation: acc.designation,
      salt,
      passwordHash: hashPassword(acc.password, salt),
    });
  }
}

seedAccounts();

function createSession(user: AuthUser): SessionRecord {
  const token = crypto.randomBytes(32).toString('hex');
  const record: SessionRecord = {
    token,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  activeSessions.set(token, record);
  return record;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }
  req.session = session;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.session?.user.role !== 'Admin') {
      res.status(403).json({
        error: 'Admin access required. Employees must submit a stock adjustment request.',
      });
      return;
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Live Server-Authoritative Store State
// ---------------------------------------------------------------------------

let store: StoreSnapshot = createSeedStore();
let invoiceCounter = 1055;

function isValidCategory(val: unknown): val is ProductCategory {
  return typeof val === 'string' && PRODUCT_CATEGORIES.includes(val as ProductCategory);
}

function isValidExpenseCategory(val: unknown): val is ExpenseCategory {
  return typeof val === 'string' && EXPENSE_CATEGORIES.includes(val as ExpenseCategory);
}

function isValidAdjustmentReason(val: unknown): val is AdjustmentReasonType {
  return typeof val === 'string' && ADJUSTMENT_REASON_TYPES.includes(val as AdjustmentReasonType);
}

function isValidPaymentMethod(val: unknown): val is PaymentMethod {
  return val === 'Cash' || val === 'UPI' || val === 'Card';
}

// ---------------------------------------------------------------------------
// Gemini AI Client & Live Store Context Builder (Strictly Read-Only)
// ---------------------------------------------------------------------------

interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function validateMessages(raw: unknown): ChatMessagePayload[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-20)
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
    .map((m): ChatMessagePayload => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').trim().slice(0, 6000),
    }))
    .filter((m) => m.content.length > 0);
}

function buildStoreSystemInstruction(snapshot: StoreSnapshot, user: AuthUser): string {
  const metrics = computeDashboardMetrics(
    snapshot.products,
    snapshot.sales,
    snapshot.expenses
  );
  const today = getLocalIsoDate(0);
  const pendingApprovals = snapshot.adjustments.filter((a) => a.status === 'Pending');

  const productLines = snapshot.products
    .map((p) => {
      const expDays = daysUntilExpiry(p.expiryDate);
      const flags: string[] = [];
      if (p.stock === 0) flags.push('OUT OF STOCK');
      else if (p.stock <= p.minStock) flags.push('LOW STOCK');
      if (expDays <= 0) flags.push('EXPIRED');
      else if (expDays <= 5) flags.push(`EXPIRES IN ${expDays}D`);
      else if (expDays <= 14) flags.push(`EXPIRING IN ${expDays}D`);

      return `- [${p.sku}] ${p.name} (${p.category}, ${p.unit}) | Price: ${formatInr(p.price)} | Cost: ${formatInr(p.costPrice)} | Stock: ${p.stock} (Min: ${p.minStock}) | Pace: ${p.avgDailySales}/day | Expiry: ${p.expiryDate} (${expDays}d) | Supplier: ${p.supplier}${flags.length ? ` | Flags: ${flags.join(', ')}` : ''}`;
    })
    .join('\n');

  const restockLines =
    metrics.restockSuggestions.length === 0
      ? '- All products are currently comfortably stocked.'
      : metrics.restockSuggestions
          .map(
            (r) =>
              `- ${r.product.name} (${r.urgency}): Current ${r.product.stock}, Reorder +${r.recommendedQty} units (Est. Cost ${formatInr(r.estimatedCost)}) — ${r.reason} | Supplier: ${r.product.supplier}`
          )
          .join('\n');

  const recentSalesLines = snapshot.sales
    .slice(0, 10)
    .map(
      (s) =>
        `- ${s.invoiceNumber} (${s.date}) | Customer: ${s.customerName} | ${s.paymentMethod} | Total: ${formatInr(s.totalAmount)} | Gross Profit: ${formatInr(s.grossProfit)} | Items: ${s.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}`
    )
    .join('\n');

  const expenseLines = snapshot.expenses
    .slice(0, 10)
    .map((e) => `- ${e.date} | ${e.title} (${e.category}): ${formatInr(e.amount)}`)
    .join('\n');

  const approvalLines =
    pendingApprovals.length === 0
      ? '- None'
      : pendingApprovals
          .map(
            (a) =>
              `- ${a.productName} (${a.sku}): Delta ${a.requestedDelta >= 0 ? `+${a.requestedDelta}` : a.requestedDelta} | Reason: ${a.reasonType} | By: ${a.requestedBy} | Note: ${a.notes}`
          )
          .join('\n');

  return [
    'You are SmartStock AI, a sharp, practical retail analytics assistant for an Indian general store (kirana / mini-supermarket).',
    `Current signed-in user: ${user.name} (${user.role} — ${user.designation}). Today's date is ${today}.`,
    '',
    'CRITICAL RULES:',
    '- You are STRICTLY READ-ONLY. Never claim that you modified stock, recorded a sale, deleted a product, or approved a request. Instead, give clear recommendations the user can act on inside the dashboard.',
    '- Ground EVERY number, SKU, stock level, expiry date, sales figure, expense, and profit calculation strictly in the live store snapshot below. Do not invent items or fake sales data.',
    '- Use Indian Rupee formatting (₹) and concise, scannable Markdown (bullet lists or compact tables).',
    '- When forecasting what will sell more next week, reason from each item’s daily sales pace (avgDailySales), recent bill frequency, everyday Indian household staples (milk, noodles, oil, atta, biscuits, cold drinks), and highlight items that risk stocking out before next week.',
    '',
    'LIVE FINANCIAL SNAPSHOT:',
    `- Total SKUs: ${metrics.totalProducts} (${metrics.totalUnitsInStock} total units, Stock Cost Value: ${formatInr(metrics.inventoryValue)})`,
    `- Today's Sales (${today}): ${formatInr(metrics.todaysSales)} across ${metrics.todaysBillsCount} bill(s)`,
    `- Today's Gross Profit (Revenue - COGS): ${formatInr(metrics.todaysGrossProfit)}`,
    `- Today's Logged Expenses: ${formatInr(metrics.todaysExpenses)}`,
    `- Today's Net Profit Estimate: ${formatInr(metrics.todaysGrossProfit - metrics.todaysExpenses)}`,
    `- 7-Day Total Sales: ${formatInr(metrics.totalSales7d)}`,
    `- 7-Day Total Gross Profit: ${formatInr(metrics.totalGrossProfit7d)}`,
    `- Total Logged Operating Expenses: ${formatInr(metrics.totalExpenses)}`,
    `- Overall Net Profit (Gross Profit - Operating Expenses): ${formatInr(metrics.netProfit)} (${metrics.netProfitMarginPct}% margin)`,
    `- Low-Stock Items Count: ${metrics.lowStockProducts.length}`,
    `- Expiring Soon (<= 14 days) Count: ${metrics.expiringSoonProducts.length}`,
    `- Pending Stock Adjustment Approvals: ${pendingApprovals.length}`,
    '',
    'SMART RESTOCKING RECOMMENDATIONS:',
    restockLines,
    '',
    'LIVE PRODUCT INVENTORY:',
    productLines,
    '',
    'RECENT SALES INVOICES (LATEST 10):',
    recentSalesLines || '- No sales recorded yet.',
    '',
    'LOGGED OPERATING EXPENSES:',
    expenseLines || '- No expenses logged.',
    '',
    'PENDING EMPLOYEE STOCK ADJUSTMENT REQUESTS:',
    approvalLines,
  ].join('\n');
}

function classifyGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: rawMessage };
  }
  if (
    rawMessage.includes('403') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID')
  ) {
    return {
      status: 403,
      message: 'API key authentication failed. Please verify your Gemini API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 502,
    message: rawMessage || 'Unable to reach SmartStock AI right now.',
  };
}

// ---------------------------------------------------------------------------
// Express Application
// ---------------------------------------------------------------------------

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ---- Public Customer Product Availability Catalog (No Auth Required) ----
  // Strictly exposes ONLY customer-safe fields: name, category, unit, price, and boolean availability.
  app.get('/api/public/catalog', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      storeName: 'Shree Ganesh General Store',
      updatedAt: new Date().toISOString(),
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: p.price,
        ...(p.image ? { image: p.image } : {}),
        available: p.stock > 0,
      })),
    });
  });

  // ---- Authentication Routes ----

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const identifier = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const expectedRole =
      req.body?.role === 'Admin' || req.body?.role === 'Employee'
        ? (req.body.role as UserRole)
        : undefined;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Enter both username/email and password.' });
      return;
    }

    let account = accountsByEmail.get(identifier);
    if (!account && !identifier.includes('@')) {
      for (const candidate of accountsByEmail.values()) {
        const localPart = candidate.email.split('@')[0];
        if (localPart === identifier) {
          account = candidate;
          break;
        }
      }
    }

    if (!account || !verifyPassword(password, account.salt, account.passwordHash)) {
      res.status(401).json({
        error: 'Invalid username/email or password. Please check your credentials and try again.',
      });
      return;
    }

    if (expectedRole && account.role !== expectedRole) {
      res.status(403).json({
        error: `This account is registered for ${account.role} Login. Please switch to the ${account.role} Login tab.`,
      });
      return;
    }

    const session = createSession({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      designation: account.designation,
    });
    res.json({ token: session.token, user: session.user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.session!.user });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) activeSessions.delete(token);
    res.json({ ok: true });
  });

  // ---- Store Snapshot ----

  app.get('/api/store', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    res.json(store);
  });

  app.post('/api/store/reset', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    store = createSeedStore();
    invoiceCounter = 1055;
    res.json(store);
  });

  // ---- Products CRUD (Admin Only) ----

  app.post('/api/products', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 120);
    const rawSku = String(req.body?.sku ?? '').trim().toUpperCase().slice(0, 24);
    const sku = rawSku || `ITEM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const category = req.body?.category;
    const unit = String(req.body?.unit ?? '').trim().slice(0, 40) || '1 unit';
    const price = Number(req.body?.price);
    const costPrice = Number(req.body?.costPrice);
    const stock = Math.max(0, Math.round(Number(req.body?.stock) || 0));
    const minStock = Math.max(1, Math.round(Number(req.body?.minStock) || 10));
    const expiryDate = String(req.body?.expiryDate ?? '').trim();
    const supplier = String(req.body?.supplier ?? '').trim().slice(0, 100);
    const avgDailySales = Math.max(0.5, Number(req.body?.avgDailySales) || 3);

    if (!name) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    if (!isValidCategory(category)) {
      res.status(400).json({ error: 'Select a valid product category.' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Selling price must be greater than ₹0.' });
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      res.status(400).json({ error: 'Cost price must be ₹0 or higher.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      res.status(400).json({ error: 'Provide a valid expiry date (YYYY-MM-DD).' });
      return;
    }
    if (!supplier) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }

    const roundedPrice = Math.round(price * 100) / 100;
    const rawMrp = Number(req.body?.mrp);
    const mrp =
      Number.isFinite(rawMrp) && rawMrp > roundedPrice
        ? Math.round(rawMrp * 100) / 100
        : Math.ceil((roundedPrice * 1.1) / 2) * 2;

    const rawImage = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
    const safeImage =
      rawImage &&
      rawImage.length <= 450_000 &&
      (rawImage.startsWith('data:image/') ||
        rawImage.startsWith('/src/assets/') ||
        rawImage.startsWith('/assets/') ||
        /^https?:\/\//i.test(rawImage))
        ? rawImage
        : undefined;

    const newProduct: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      sku,
      name,
      category,
      unit,
      price: roundedPrice,
      mrp,
      ...(safeImage ? { image: safeImage } : {}),
      costPrice: Math.round(costPrice * 100) / 100,
      stock,
      minStock,
      expiryDate,
      supplier,
      avgDailySales,
    };

    store.products = [newProduct, ...store.products];

    if (stock > 0) {
      const purchase: PurchaseRecord = {
        id: `pur-${crypto.randomUUID().slice(0, 8)}`,
        date: getLocalIsoDate(0),
        productId: newProduct.id,
        productName: newProduct.name,
        category: newProduct.category,
        supplier: newProduct.supplier,
        quantity: stock,
        unitCost: newProduct.costPrice,
        totalCost: Math.round(stock * newProduct.costPrice),
        recordedBy: req.session!.user.name,
      };
      store.purchases = [purchase, ...store.purchases];
    }

    res.status(201).json({ product: newProduct, store });
  });

  app.put('/api/products/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const idx = store.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const existing = store.products[idx];
    const name = String(req.body?.name ?? existing.name).trim().slice(0, 120);
    const sku = String(req.body?.sku ?? existing.sku).trim().toUpperCase().slice(0, 24);
    const category = isValidCategory(req.body?.category)
      ? req.body.category
      : existing.category;
    const unit = String(req.body?.unit ?? existing.unit).trim().slice(0, 40) || existing.unit;
    const price = Number(req.body?.price ?? existing.price);
    const costPrice = Number(req.body?.costPrice ?? existing.costPrice);
    const stock = Math.max(0, Math.round(Number(req.body?.stock ?? existing.stock)));
    const minStock = Math.max(1, Math.round(Number(req.body?.minStock ?? existing.minStock)));
    const expiryDate = String(req.body?.expiryDate ?? existing.expiryDate).trim();
    const supplier = String(req.body?.supplier ?? existing.supplier).trim().slice(0, 100);
    const avgDailySales = Math.max(
      0.5,
      Number(req.body?.avgDailySales ?? existing.avgDailySales)
    );

    if (!name || !sku || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Invalid product details provided.' });
      return;
    }

    const roundedPrice = Math.round(price * 100) / 100;
    const rawMrp = Number(req.body?.mrp ?? existing.mrp);
    const mrp =
      Number.isFinite(rawMrp) && rawMrp > roundedPrice
        ? Math.round(rawMrp * 100) / 100
        : Math.ceil((roundedPrice * 1.1) / 2) * 2;

    let nextImage = existing.image;
    if (req.body?.image !== undefined) {
      const rawImage = typeof req.body.image === 'string' ? req.body.image.trim() : '';
      if (!rawImage) {
        nextImage = undefined;
      } else if (
        rawImage.length <= 450_000 &&
        (rawImage.startsWith('data:image/') ||
          rawImage.startsWith('/src/assets/') ||
          rawImage.startsWith('/assets/') ||
          /^https?:\/\//i.test(rawImage))
      ) {
        nextImage = rawImage;
      }
    }

    const updated: Product = {
      ...existing,
      sku,
      name,
      category,
      unit,
      price: roundedPrice,
      mrp,
      image: nextImage,
      costPrice: Math.round(costPrice * 100) / 100,
      stock,
      minStock,
      expiryDate,
      supplier,
      avgDailySales,
    };

    store.products = store.products.map((p) => (p.id === id ? updated : p));
    res.json({ product: updated, store });
  });

  app.delete('/api/products/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const exists = store.products.some((p) => p.id === id);
    if (!exists) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    store.products = store.products.filter((p) => p.id !== id);
    res.json({ ok: true, store });
  });

  app.post(
    '/api/products/:id/restock',
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const quantity = Math.round(Number(req.body?.quantity));
      const newExpiryDate = req.body?.expiryDate
        ? String(req.body.expiryDate).trim()
        : undefined;

      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
        res.status(400).json({ error: 'Restock quantity must be between 1 and 5,000.' });
        return;
      }

      const product = store.products.find((p) => p.id === id);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }

      const updated: Product = {
        ...product,
        stock: product.stock + quantity,
        expiryDate:
          newExpiryDate && /^\d{4}-\d{2}-\d{2}$/.test(newExpiryDate)
            ? newExpiryDate
            : product.expiryDate,
      };

      store.products = store.products.map((p) => (p.id === id ? updated : p));

      const purchase: PurchaseRecord = {
        id: `pur-${crypto.randomUUID().slice(0, 8)}`,
        date: getLocalIsoDate(0),
        productId: updated.id,
        productName: updated.name,
        category: updated.category,
        supplier: updated.supplier,
        quantity,
        unitCost: updated.costPrice,
        totalCost: Math.round(quantity * updated.costPrice),
        recordedBy: req.session!.user.name,
      };
      store.purchases = [purchase, ...store.purchases];

      res.json({ product: updated, purchase, store });
    }
  );

  // ---- POS Customer Billing / Sales (Employee & Admin) ----

  app.post('/api/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const customerName =
      String(req.body?.customerName ?? '').trim().slice(0, 100) || 'Walk-in Customer';
    const customerPhone = String(req.body?.customerPhone ?? '').trim().slice(0, 20);
    const paymentMethod: PaymentMethod = isValidPaymentMethod(req.body?.paymentMethod)
      ? req.body.paymentMethod
      : 'Cash';
    const includeGst = req.body?.includeGst !== false;
    const rawDiscount = Math.max(0, Number(req.body?.discount) || 0);

    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Add at least one item to generate a bill.' });
      return;
    }

    // Aggregate quantities per productId first to validate stock accurately
    const qtyByProductId = new Map<string, number>();
    for (const entry of rawItems) {
      const productId = String(entry?.productId ?? '');
      const quantity = Math.round(Number(entry?.quantity));
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        res.status(400).json({ error: 'Invalid cart item quantity.' });
        return;
      }
      qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + quantity);
    }

    const saleItems: SaleItem[] = [];
    for (const [productId, quantity] of qtyByProductId.entries()) {
      const product = store.products.find((p) => p.id === productId);
      if (!product) {
        res.status(404).json({ error: 'One or more products in the cart no longer exist.' });
        return;
      }
      if (product.stock < quantity) {
        res.status(400).json({
          error: `Insufficient stock for ${product.name}. Only ${product.stock} left in store.`,
        });
        return;
      }
      saleItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        quantity,
        unitPrice: product.price,
        costPrice: product.costPrice,
        lineTotal: Math.round(product.price * quantity * 100) / 100,
      });
    }

    // Atomically deduct sold quantities from live inventory
    store.products = store.products.map((p) => {
      const soldQty = qtyByProductId.get(p.id);
      if (!soldQty) return p;
      return { ...p, stock: Math.max(0, p.stock - soldQty) };
    });

    const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = saleItems.reduce(
      (sum, item) => sum + item.costPrice * item.quantity,
      0
    );
    const discount = Math.min(Math.round(rawDiscount), Math.round(subtotal));
    const taxableBase = Math.max(0, subtotal - discount);
    const gstAmount = includeGst ? Math.round(taxableBase * 0.05) : 0;
    const totalAmount = Math.round(taxableBase + gstAmount);
    const grossProfit = Math.round(taxableBase - totalCost);

    invoiceCounter += 1;
    const saleRecord: SaleRecord = {
      id: `sale-${crypto.randomUUID().slice(0, 8)}`,
      invoiceNumber: `INV-2026-${String(invoiceCounter).padStart(4, '0')}`,
      date: getLocalIsoDate(0),
      createdAt: new Date().toISOString(),
      customerName,
      customerPhone: customerPhone || undefined,
      paymentMethod,
      cashierName: req.session!.user.name,
      items: saleItems,
      subtotal: Math.round(subtotal),
      gstAmount,
      discount,
      totalAmount,
      totalCost: Math.round(totalCost),
      grossProfit,
    };

    store.sales = [saleRecord, ...store.sales];
    res.status(201).json({ sale: saleRecord, store });
  });

  // ---- Business Expenses (Admin Only) ----

  app.post('/api/expenses', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const title = String(req.body?.title ?? '').trim().slice(0, 120);
    const category = req.body?.category;
    const amount = Math.round(Number(req.body?.amount));
    const date = String(req.body?.date ?? getLocalIsoDate(0)).trim();
    const rawMethod = String(req.body?.paymentMethod ?? 'UPI');
    const paymentMethod =
      rawMethod === 'Cash' ||
      rawMethod === 'UPI' ||
      rawMethod === 'Card' ||
      rawMethod === 'Bank Transfer'
        ? rawMethod
        : 'UPI';
    const notes = String(req.body?.notes ?? '').trim().slice(0, 240);

    if (!title) {
      res.status(400).json({ error: 'Expense title is required.' });
      return;
    }
    if (!isValidExpenseCategory(category)) {
      res.status(400).json({ error: 'Select a valid expense category.' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Expense amount must be greater than ₹0.' });
      return;
    }

    const expense: ExpenseRecord = {
      id: `exp-${crypto.randomUUID().slice(0, 8)}`,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalIsoDate(0),
      title,
      category,
      amount,
      paymentMethod,
      notes: notes || undefined,
    };

    store.expenses = [expense, ...store.expenses];
    res.status(201).json({ expense, store });
  });

  app.delete('/api/expenses/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    store.expenses = store.expenses.filter((e) => e.id !== id);
    res.json({ ok: true, store });
  });

  // ---- Employee Management (Admin Only) ----

  app.post('/api/employees', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 100);
    const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 120);
    const phone = String(req.body?.phone ?? '').trim().slice(0, 30);
    const roleTitle = String(req.body?.roleTitle ?? '').trim().slice(0, 80);
    const shiftRaw = String(req.body?.shift ?? 'Morning');
    const shift: EmployeeShift =
      shiftRaw === 'Morning' || shiftRaw === 'Evening' || shiftRaw === 'Full Day'
        ? shiftRaw
        : 'Morning';
    const monthlySalary = Math.max(0, Math.round(Number(req.body?.monthlySalary) || 0));
    const status: EmployeeStatus = req.body?.status === 'On Leave' ? 'On Leave' : 'Active';

    if (!name || !email || !roleTitle) {
      res.status(400).json({ error: 'Name, email, and role title are required.' });
      return;
    }

    const employee: EmployeeRecord = {
      id: `emp-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      phone: phone || '+91 98000 00000',
      roleTitle,
      shift,
      monthlySalary,
      status,
      joinedDate: getLocalIsoDate(0),
    };

    store.employees = [employee, ...store.employees];
    res.status(201).json({ employee, store });
  });

  app.put('/api/employees/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const existing = store.employees.find((e) => e.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const shiftRaw = String(req.body?.shift ?? existing.shift);
    const shift: EmployeeShift =
      shiftRaw === 'Morning' || shiftRaw === 'Evening' || shiftRaw === 'Full Day'
        ? shiftRaw
        : existing.shift;
    const status: EmployeeStatus =
      req.body?.status === 'On Leave'
        ? 'On Leave'
        : req.body?.status === 'Active'
          ? 'Active'
          : existing.status;

    const updated: EmployeeRecord = {
      ...existing,
      name: String(req.body?.name ?? existing.name).trim().slice(0, 100),
      email: String(req.body?.email ?? existing.email).trim().toLowerCase().slice(0, 120),
      phone: String(req.body?.phone ?? existing.phone).trim().slice(0, 30),
      roleTitle: String(req.body?.roleTitle ?? existing.roleTitle).trim().slice(0, 80),
      shift,
      monthlySalary: Math.max(
        0,
        Math.round(Number(req.body?.monthlySalary ?? existing.monthlySalary))
      ),
      status,
    };

    store.employees = store.employees.map((e) => (e.id === id ? updated : e));
    res.json({ employee: updated, store });
  });

  app.delete('/api/employees/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    store.employees = store.employees.filter((e) => e.id !== id);
    res.json({ ok: true, store });
  });

  // ---- Stock Adjustment Approvals (Employee Submit -> Admin Approve/Reject) ----

  app.post('/api/approvals', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const productId = String(req.body?.productId ?? '');
    const requestedDelta = Math.round(Number(req.body?.requestedDelta));
    const reasonType = req.body?.reasonType;
    const notes = String(req.body?.notes ?? '').trim().slice(0, 300);

    const product = store.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: 'Selected product was not found.' });
      return;
    }
    if (!Number.isFinite(requestedDelta) || requestedDelta === 0) {
      res.status(400).json({ error: 'Adjustment quantity cannot be zero.' });
      return;
    }
    if (product.stock + requestedDelta < 0) {
      res.status(400).json({
        error: `Cannot reduce stock below 0 (current stock is ${product.stock}).`,
      });
      return;
    }
    if (!isValidAdjustmentReason(reasonType)) {
      res.status(400).json({ error: 'Select a valid adjustment reason.' });
      return;
    }
    if (!notes) {
      res.status(400).json({ error: 'Please provide a brief explanation for the Admin.' });
      return;
    }

    const request: StockAdjustmentRequest = {
      id: `adj-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stock,
      requestedDelta,
      reasonType,
      notes,
      requestedBy: req.session!.user.name,
      requestedAt: new Date().toISOString(),
      status: 'Pending',
    };

    store.adjustments = [request, ...store.adjustments];
    res.status(201).json({ request, store });
  });

  app.post(
    '/api/approvals/:id/review',
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const decision = req.body?.decision === 'Approved' ? 'Approved' : 'Rejected';
      const reviewNote = String(req.body?.reviewNote ?? '').trim().slice(0, 240);

      const target = store.adjustments.find((a) => a.id === id);
      if (!target) {
        res.status(404).json({ error: 'Stock adjustment request not found.' });
        return;
      }
      if (target.status !== 'Pending') {
        res.status(400).json({ error: 'This request has already been reviewed.' });
        return;
      }

      if (decision === 'Approved') {
        const product = store.products.find((p) => p.id === target.productId);
        if (product) {
          const nextStock = Math.max(0, product.stock + target.requestedDelta);
          store.products = store.products.map((p) =>
            p.id === product.id ? { ...p, stock: nextStock } : p
          );

          if (target.reasonType === 'Restock Received' && target.requestedDelta > 0) {
            const purchase: PurchaseRecord = {
              id: `pur-${crypto.randomUUID().slice(0, 8)}`,
              date: getLocalIsoDate(0),
              productId: product.id,
              productName: product.name,
              category: product.category,
              supplier: product.supplier,
              quantity: target.requestedDelta,
              unitCost: product.costPrice,
              totalCost: Math.round(target.requestedDelta * product.costPrice),
              recordedBy: `${req.session!.user.name} (via Approval)`,
            };
            store.purchases = [purchase, ...store.purchases];
          }
        }
      }

      const updatedRequest: StockAdjustmentRequest = {
        ...target,
        status: decision,
        reviewedBy: req.session!.user.name,
        reviewedAt: new Date().toISOString(),
        reviewNote:
          reviewNote ||
          (decision === 'Approved'
            ? 'Approved and inventory updated.'
            : 'Rejected by Admin.'),
      };

      store.adjustments = store.adjustments.map((a) =>
        a.id === id ? updatedRequest : a
      );

      res.json({ request: updatedRequest, store });
    }
  );

  // ---- Gemini AI Assistant (Read-Only Live Store Intelligence) ----

  app.post(
    '/api/assistant/chat',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      const messages = validateMessages(req.body?.messages);
      if (messages.length === 0) {
        res.status(400).json({ error: 'Enter a question for SmartStock AI.' });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err) {
        const classified = classifyGeminiError(err);
        res.status(classified.status).json({ error: classified.message });
        return;
      }

      const systemInstruction = buildStoreSystemInstruction(store, req.session!.user);
      const contents = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendEvent = (payload: Record<string, unknown>) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      };

      try {
        const stream = await ai.models.generateContentStream({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            sendEvent({ type: 'chunk', text: chunk.text });
          }
        }

        sendEvent({ type: 'done' });
        res.end();
      } catch (err) {
        const classified = classifyGeminiError(err);
        sendEvent({ type: 'error', error: classified.message });
        res.end();
      }
    }
  );

  // ---- Vite Dev Middleware / Production Static ----

  if (IS_PROD) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartStock AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
