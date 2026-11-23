import type {
  ChatMessage,
  ExpenseRecord,
  Product,
  ProductCategory,
  SaleRecord,
  UserRole,
} from '../types/store.ts';
import {
  computeDashboardMetrics,
  daysUntilExpiry,
  formatInr,
  getLocalIsoDate,
} from './storeMetrics.ts';

export interface AssistantStoreContext {
  products: Product[];
  sales: SaleRecord[];
  expenses?: ExpenseRecord[];
}

const HINGLISH_CUES = [
  'namaste',
  'namaskar',
  'kaise',
  'kya',
  'kaun',
  'kaunse',
  'kitna',
  'kitne',
  'saman',
  'hai',
  'hain',
  'khatam',
  'kam',
  'aaj',
  'bikri',
  'kamai',
  'munafa',
  'kharcha',
  'agle',
  'hafte',
  'batao',
  'dikhao',
  'doodh',
  'dudh',
  'namak',
  'chawal',
  'tel',
  'sabun',
  'chai',
  'dahi',
  'makkhan',
  'aata',
  'daal',
];

const PRODUCT_ALIASES: Record<string, string[]> = {
  namak: ['salt'],
  salt: ['salt'],
  tel: ['oil'],
  oil: ['oil'],
  aata: ['atta'],
  atta: ['atta'],
  chawal: ['rice'],
  rice: ['rice'],
  daal: ['dal'],
  dal: ['dal'],
  doodh: ['milk'],
  dudh: ['milk'],
  milk: ['milk'],
  makkhan: ['butter'],
  butter: ['butter'],
  dahi: ['dahi', 'curd'],
  curd: ['curd', 'dahi'],
  paneer: ['paneer'],
  chai: ['tea'],
  tea: ['tea'],
  sabun: ['soap', 'dettol'],
  soap: ['soap'],
  paste: ['toothpaste', 'colgate'],
  toothpaste: ['toothpaste', 'colgate'],
  shampoo: ['shampoo', 'clinic'],
  coke: ['coca-cola', 'coca'],
  cola: ['coca-cola', 'thums up', 'cola'],
  thums: ['thums'],
  thumbs: ['thums'],
  lays: ["lay's", 'lays'],
  chips: ['chips', "lay's"],
  biskut: ['biscuits', 'parle', 'cookies'],
  biscuit: ['biscuits', 'parle'],
  biscuits: ['biscuits', 'parle'],
  cookies: ['cookies', 'good day'],
  namkeen: ['namkeen', 'bhujia', 'haldiram'],
  bhujia: ['bhujia', 'haldiram'],
  noodles: ['noodles', 'maggi'],
  maggi: ['maggi'],
  maggie: ['maggi'],
  ketchup: ['ketchup', 'kissan'],
  sauce: ['ketchup', 'kissan'],
  juice: ['juice', 'real'],
  parle: ['parle'],
  haldiram: ['haldiram'],
  haldirams: ['haldiram'],
  britannia: ['britannia', 'good day'],
  goodday: ['good day'],
  fortune: ['fortune'],
  aashirvaad: ['aashirvaad'],
  ashirvaad: ['aashirvaad'],
  indiagate: ['india gate'],
  basmati: ['basmati'],
  amul: ['amul'],
  dettol: ['dettol'],
  colgate: ['colgate'],
  clinic: ['clinic'],
  tata: ['tata'],
  kissan: ['kissan'],
  mother: ['mother dairy'],
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'am',
  'do',
  'does',
  'did',
  'we',
  'you',
  'i',
  'me',
  'my',
  'our',
  'your',
  'it',
  'this',
  'that',
  'these',
  'those',
  'in',
  'on',
  'at',
  'of',
  'for',
  'to',
  'from',
  'with',
  'about',
  'and',
  'or',
  'not',
  'no',
  'yes',
  'what',
  'which',
  'who',
  'how',
  'many',
  'much',
  'any',
  'all',
  'some',
  'more',
  'most',
  'show',
  'list',
  'tell',
  'check',
  'give',
  'get',
  'find',
  'please',
  'pls',
  'plz',
  'can',
  'could',
  'will',
  'would',
  'should',
  'item',
  'items',
  'product',
  'products',
  'stock',
  'stocks',
  'instock',
  'available',
  'availability',
  'out',
  'low',
  'left',
  'remaining',
  'quantity',
  'qty',
  'count',
  'units',
  'unit',
  'pack',
  'packs',
  'price',
  'prices',
  'rate',
  'mrp',
  'cost',
  'store',
  'shop',
  'inventory',
  'status',
  'alert',
  'alerts',
  'today',
  'todays',
  'sales',
  'sale',
  'revenue',
  'profit',
  'earning',
  'earnings',
  'bill',
  'bills',
  'forecast',
  'demand',
  'next',
  'week',
  'prediction',
  'restock',
  'reorder',
  'expiring',
  'expiry',
  'expire',
  'soon',
  'hai',
  'hain',
  'kya',
  'kaun',
  'kaunse',
  'sa',
  'se',
  'saman',
  'kitna',
  'kitne',
  'khatam',
  'kam',
  'aaj',
  'ki',
  'ka',
  'ke',
  'me',
  'mein',
  'batao',
  'dikhao',
  'hi',
  'hello',
  'hey',
  'namaste',
  'help',
  'currently',
  'now',
  'right',
  'still',
  'there',
  'have',
  'has',
  'sell',
  'sold',
  'selling',
  'top',
  'best',
  'summary',
  'summarize',
]);

function isHinglish(normalized: string): boolean {
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((w) => HINGLISH_CUES.includes(w));
}

function detectCategoryFilter(normalized: string): ProductCategory | null {
  if (/\bgrocery|groceries|kirana\b/.test(normalized)) return 'Grocery';
  if (/\bsnack|snacks\b/.test(normalized)) return 'Snacks';
  if (/\bdrink|drinks|beverage|beverages|cold drink\b/.test(normalized)) return 'Drinks';
  if (/\bdairy\b/.test(normalized)) return 'Dairy';
  if (/\bpersonal care|hygiene|toiletries\b/.test(normalized)) return 'Personal Care';
  return null;
}

function findMatchedProducts(question: string, products: Product[]): Product[] {
  const normalized = question
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const tokens = normalized
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  if (tokens.length === 0) return [];

  // Expand aliases (English/Hindi/Hinglish)
  const searchTerms = new Set<string>();
  for (const token of tokens) {
    searchTerms.add(token);
    const aliases = PRODUCT_ALIASES[token];
    if (aliases) {
      for (const a of aliases) {
        searchTerms.add(a.replace(/['’]/g, ''));
      }
    }
  }

  // Also check two-word phrases (e.g., "tata salt", "good day", "india gate", "toor dal", "thums up")
  const phrases: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  const scored: Array<{ product: Product; score: number }> = [];

  for (const product of products) {
    const cleanName = product.name.toLowerCase().replace(/['’]/g, '');
    const cleanSku = product.sku.toLowerCase();
    const nameWords = cleanName.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    let score = 0;

    // Exact phrase match gets highest priority
    for (const phrase of phrases) {
      if (cleanName.includes(phrase)) {
        score += 10;
      }
    }

    // SKU match
    for (const token of tokens) {
      if (token.length >= 3 && cleanSku.includes(token)) {
        score += 8;
      }
    }

    // Word / alias match against product name words
    for (const term of searchTerms) {
      if (term.includes(' ')) {
        if (cleanName.includes(term)) score += 9;
        continue;
      }
      if (term.length < 3) continue;
      if (nameWords.some((w) => w === term)) {
        score += 5;
      } else if (nameWords.some((w) => w.startsWith(term) || (term.length >= 4 && w.includes(term)))) {
        score += 3;
      }
    }

    if (score > 0) {
      scored.push({ product, score });
    }
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  const maxScore = scored[0].score;
  // If we have a strong specific match (e.g., "Tata Salt" matching score 15), filter out weak partial matches like "Tata Tea" (score 5)
  const threshold = maxScore >= 10 ? Math.max(8, maxScore - 4) : Math.max(3, maxScore - 2);
  return scored.filter((s) => s.score >= threshold).map((s) => s.product);
}

function getStockStatusBadge(product: Product): string {
  if (product.stock <= 0) return 'Out of Stock';
  if (product.stock <= product.minStock) return 'Low Stock';
  return 'In Stock';
}

function formatTopSoldItems(sales: SaleRecord[]): Array<{ name: string; qty: number; revenue: number }> {
  const tally = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const prev = tally.get(item.productId) ?? {
        name: item.productName,
        qty: 0,
        revenue: 0,
      };
      prev.qty += item.quantity;
      prev.revenue += item.lineTotal;
      tally.set(item.productId, prev);
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 5);
}

export function answerStoreQuestionLocally(
  question: string,
  store: AssistantStoreContext,
  userRole: UserRole = 'Admin'
): string {
  const products = Array.isArray(store.products) ? store.products : [];
  const sales = Array.isArray(store.sales) ? store.sales : [];
  const expenses = Array.isArray(store.expenses) ? store.expenses : [];

  const raw = question.trim();
  const normalized = raw
    .toLowerCase()
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const hinglish = isHinglish(normalized);

  // 1. Pure Greetings ("hi", "hello", "hey", "namaste", "good morning", etc.)
  const isPureGreeting =
    /^(hi+|hello+|hey+|helo+|hii+|namaste|namaskar|salaam|ram ram|good\s*(morning|afternoon|evening)|kaise ho|how are you)(\s+(smartstock|ai|assistant|bot|bro|sir|mam|ji))?$/i.test(
      normalized
    );

  if (isPureGreeting) {
    return hinglish
      ? 'Namaste! Aap mujhse **in-stock items**, **low stock alerts**, kisi bhi product ka **price ya quantity**, ya **aaj ki sales** pooch sakte hain.'
      : "Hello! Ask me about **in-stock items**, **low stock alerts**, specific product **quantities/prices**, or **today's sales**.";
  }

  // 2. Unclear / Very Short / Help Inputs ("what", "what?", "?", "help", "kya", "ok", "thanks")
  const isThanks = /^(thanks|thank you|thx|dhanyawad|shukriya|ok|okay|cool|great|nice)$/i.test(
    normalized
  );
  if (isThanks) {
    return hinglish
      ? 'Aapka swagat hai! Agar aur kisi product ka stock, price, ya sales check karni ho toh pooch sakte hain.'
      : "You're welcome! Let me know if you want to check any product stock, price, or sales summary.";
  }

  const isUnclearOrHelp =
    !normalized ||
    normalized.length <= 2 ||
    /^(what|what\??|why|who|huh|hmm+|help|kya|kya hai|menu|options|commands|start)$/i.test(
      normalized
    );

  if (isUnclearOrHelp) {
    return hinglish
      ? [
          'Main aapke live store inventory aur sales records check kar sakta hoon. Ye questions try karein:',
          '',
          '- **"In-stock items"** — abhi store mein kaun-kaun se items available hain',
          '- **"Low stock alerts"** — kaun se items khatam ya kam ho rahe hain',
          '- **"Maggi aur Amul milk kitna hai?"** — kisi specific product ka exact stock aur price',
        ].join('\n')
      : [
          'I can answer questions directly from your live store inventory and sales records. Try asking:',
          '',
          '- **"Which items are currently in stock?"**',
          '- **"Show low stock and out-of-stock alerts"**',
          '- **"How many Tata Salt or Maggi packs are left?"**',
        ].join('\n');
  }

  const metrics = computeDashboardMetrics(products, sales, expenses);

  // Check explicit high-level intents first
  const asksForecast =
    /\b(forecast|demand|next\s*week|agle\s*hafte|predict|prediction|sell\s*more|zyada\s*bikega|fast\s*moving|projected)\b/.test(
      normalized
    );
  const asksExpiry = /\b(expir|shelf\s*life|kharab)\b/.test(normalized);
  const asksOutOfStockOnly =
    /\b(out\s*of\s*stock|out-of-stock|oos|zero\s*stock|khatam|finish|unavailable)\b/.test(
      normalized
    ) && !/\b(low\s*stock|low-stock|restock|reorder|kam)\b/.test(normalized);
  const asksLowOrRestock =
    /\b(low\s*stock|low-stock|restock|reorder|shortage|kam\s*hai|stock\s*kam|out\s*of\s*stock|out-of-stock|oos|khatam|budget)\b/.test(
      normalized
    );
  const asksSalesOrRevenue =
    /\b(sales|sale|today|todays|aaj|revenue|earning|earnings|income|kamai|bill|bills|bikri|profit|munafa|expense|expenses|kharcha)\b/.test(
      normalized
    );
  const asksInStockList =
    /\b(in\s*stock|in-stock|instock|available|availability|kaun\s*sa\s*saman|kaunse\s*item|kya\s*kya\s*hai|all\s*items|all\s*products|show\s*stock|stock\s*list|saman\s*hai)\b/.test(
      normalized
    );

  // 3. Specific Product Lookup (runs BEFORE generic in-stock so "is maggi in stock?" answers about Maggi directly!)
  const matchedProducts = findMatchedProducts(raw, products);
  if (matchedProducts.length > 0 && !asksForecast && !asksSalesOrRevenue) {
    const lines = matchedProducts.map((p) => {
      const status = getStockStatusBadge(p);
      const stockDetail =
        p.stock <= 0
          ? '**0 units** (Out of Stock)'
          : `**${p.stock} units** in stock *(Min: ${p.minStock})*`;
      return `- **${p.name}** (${p.unit}) — ${stockDetail} · Price: **${formatInr(p.price)}** · Category: ${p.category} · Status: **${status}**`;
    });

    const heading =
      matchedProducts.length === 1
        ? `### ${matchedProducts[0].name}`
        : `### Matching Products (${matchedProducts.length})`;

    return [heading, '', ...lines].join('\n');
  }

  // 4. Out-of-Stock / Low-Stock / Restock Query
  if (asksOutOfStockOnly) {
    const outOfStock = products.filter((p) => p.stock <= 0);
    const lowStockOnly = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);

    if (outOfStock.length === 0) {
      return hinglish
        ? `Abhi koi bhi item completely **Out of Stock (0 units)** nahi hai. Haan, **${lowStockOnly.length} items** low stock mein hain — "Low stock alerts" pooch kar list dekh sakte hain.`
        : `No products are currently **Out of Stock (0 units)**. However, **${lowStockOnly.length} items** are running low — ask **"Low stock alerts"** to view them.`;
    }

    const rows = outOfStock.map(
      (p) =>
        `- **${p.name}** (${p.unit}) — **0 units** / Min ${p.minStock} · Price: ${formatInr(p.price)} *(Out of Stock)*`
    );
    return [
      `### Out of Stock Items (${outOfStock.length})`,
      '',
      ...rows,
      ...(lowStockOnly.length > 0
        ? [
            '',
            `Additionally, **${lowStockOnly.length} items** are below their minimum stock threshold.`,
          ]
        : []),
    ].join('\n');
  }

  if (asksLowOrRestock) {
    const alertItems = products
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock);

    if (alertItems.length === 0) {
      return '### All Stock Levels Healthy\n\nNo products are currently out of stock or below their minimum threshold.';
    }

    const rows = alertItems.map((p) => {
      const tag = p.stock <= 0 ? 'Out of Stock' : 'Low Stock';
      const reorderQty = Math.max(p.minStock * 2 - p.stock, Math.ceil(p.avgDailySales * 7));
      const estCost = Math.round(reorderQty * p.costPrice);
      return `- **${p.name}** (${p.unit}) — **${p.stock} units** / Min ${p.minStock} *(${tag})* · Suggested reorder: +${reorderQty} (~${formatInr(estCost)})`;
    });

    const totalBudget = metrics.restockSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

    return [
      `### Low-Stock & Out-of-Stock Alerts (${alertItems.length} items)`,
      '',
      ...rows,
      '',
      `**Estimated Restock Budget:** ${formatInr(totalBudget)}`,
    ].join('\n');
  }

  // 5. In-Stock Query ("in stock", "available", "kaun sa saman hai", "which item is in stock")
  if (asksInStockList) {
    const categoryFilter = detectCategoryFilter(normalized);
    const pool = categoryFilter
      ? products.filter((p) => p.category === categoryFilter)
      : products;
    const inStock = pool.filter((p) => p.stock > 0);
    const outCount = pool.length - inStock.length;

    if (inStock.length === 0) {
      return categoryFilter
        ? `No **${categoryFilter}** items are currently in stock.`
        : 'No products are currently in stock.';
    }

    const rows = inStock.map(
      (p) =>
        `- **${p.name}** — **${p.stock} units** in stock (${formatInr(p.price)})`
    );

    const title = categoryFilter
      ? `### ${categoryFilter} Items In Stock (${inStock.length} of ${pool.length})`
      : `### Currently In-Stock Items (${inStock.length} of ${pool.length})`;

    return [
      title,
      '',
      ...rows,
      ...(outCount > 0 ? ['', `*${outCount} item(s) currently out of stock.*`] : []),
    ].join('\n');
  }

  // 6. Expiry Query
  if (asksExpiry) {
    const expiring = metrics.expiringSoonProducts;
    if (expiring.length === 0) {
      return '### No Upcoming Expiry Alerts\n\nAll active products have more than 14 days of shelf life remaining.';
    }
    const rows = expiring.map((p) => {
      const days = daysUntilExpiry(p.expiryDate);
      const tag = days <= 0 ? 'Expired / Today' : `${days} days left`;
      return `- **${p.name}** (${p.unit}) — **${p.stock} units** · Expiry: \`${p.expiryDate}\` (**${tag}**)`;
    });
    return [
      `### Expiring Soon (Next 14 Days — ${expiring.length} items)`,
      '',
      ...rows,
    ].join('\n');
  }

  // 7. Sales, Revenue, Bills & Profit Query
  if (asksSalesOrRevenue) {
    const todayIso = getLocalIsoDate(0);
    const todaysSalesList = sales.filter((s) => s.date === todayIso);
    const topToday = formatTopSoldItems(todaysSalesList);
    const topRecent = topToday.length > 0 ? topToday : formatTopSoldItems(sales);

    const lines: string[] = [
      hinglish ? "### Aaj ki Sales aur Store Revenue" : "### Today's Sales & Revenue Summary",
      '',
      `- **Today's Sales:** ${formatInr(metrics.todaysSales)} across **${metrics.todaysBillsCount} bill${metrics.todaysBillsCount === 1 ? '' : 's'}**`,
    ];

    if (userRole === 'Admin') {
      lines.push(`- **Today's Gross Profit:** ${formatInr(metrics.todaysGrossProfit)}`);
      lines.push(`- **7-Day Total Sales:** ${formatInr(metrics.totalSales7d)}`);
      if (/\b(profit|munafa|expense|expenses|kharcha)\b/.test(normalized)) {
        lines.push(`- **Recorded Expenses:** ${formatInr(metrics.totalExpenses)}`);
        lines.push(
          `- **7-Day Net Profit:** ${formatInr(metrics.netProfit)} (${metrics.netProfitMarginPct}% margin)`
        );
      }
    } else {
      lines.push(`- **7-Day Total Sales:** ${formatInr(metrics.totalSales7d)}`);
    }

    if (topRecent.length > 0) {
      lines.push('');
      lines.push(
        topToday.length > 0 ? "**Top-Sold Items Today:**" : '**Top-Sold Items (Recent Bills):**'
      );
      for (const item of topRecent) {
        lines.push(
          `- **${item.name}** — **${item.qty} units** sold (${formatInr(item.revenue)})`
        );
      }
    }

    return lines.join('\n');
  }

  // 8. Forecast / Demand Query (ONLY when user specifically asks about demand or forecast)
  if (asksForecast) {
    const topMovers = [...products]
      .sort((a, b) => b.avgDailySales - a.avgDailySales)
      .slice(0, 6);

    const moverLines = topMovers.map((p) => {
      const projected7d = Math.round(p.avgDailySales * 7);
      const gapNote =
        p.stock < projected7d ? ` — *short by ~${projected7d - p.stock} units*` : '';
      return `- **${p.name}** (${p.category}) — ~**${projected7d} units** projected next 7 days · Current stock: **${p.stock}**${gapNote}`;
    });

    return [
      '### Next Week Demand Forecast (7 Days)',
      '',
      ...moverLines,
    ].join('\n');
  }

  // 9. Category Browse Query ("grocery", "snacks", "drinks", "dairy", "personal care")
  const categoryOnly = detectCategoryFilter(normalized);
  if (categoryOnly) {
    const items = products.filter((p) => p.category === categoryOnly);
    if (items.length === 0) {
      return `No products found in **${categoryOnly}**.`;
    }
    const rows = items.map(
      (p) =>
        `- **${p.name}** (${p.unit}) — **${p.stock} units** (${formatInr(p.price)}) · *${getStockStatusBadge(p)}*`
    );
    return [`### ${categoryOnly} Inventory (${items.length} items)`, '', ...rows].join('\n');
  }

  // 10. Clean Unmatched Fallback (NEVER dumps demand forecast)
  return hinglish
    ? [
        `Mujhe "${raw}" ke liye koi exact matching store record nahi mila. Aap is tarah pooch sakte hain:`,
        '',
        '- **"In-stock items"** ya **"kaun sa saman hai?"**',
        '- **"Low stock alerts"** ya **"kya khatam ho gaya?"**',
        '- **"Tata Salt ya Maggi kitna stock mein hai?"**',
      ].join('\n')
    : [
        `I couldn't match **"${raw}"** to a specific product or store query. Try asking:`,
        '',
        '- **"Which items are currently in stock?"**',
        '- **"Show low stock and out-of-stock alerts"**',
        '- **"Check Amul Milk stock and price"** or **"Today\'s sales"**',
      ].join('\n');
}

// ---------------------------------------------------------------------------
// Optional Direct Gemini API Support (gemini-2.5-flash when VITE_GEMINI_API_KEY is set)
// ---------------------------------------------------------------------------

function buildCompactClientContext(
  store: AssistantStoreContext,
  userRole: UserRole
): string {
  const products = Array.isArray(store.products) ? store.products : [];
  const sales = Array.isArray(store.sales) ? store.sales : [];
  const expenses = Array.isArray(store.expenses) ? store.expenses : [];
  const metrics = computeDashboardMetrics(products, sales, expenses);
  const todayIso = getLocalIsoDate(0);
  const todaysSales = sales.filter((s) => s.date === todayIso);
  const topSold = formatTopSoldItems(todaysSales.length > 0 ? todaysSales : sales);

  const inventoryLines = products
    .map(
      (p) =>
        `- ${p.name} (${p.category}, ${p.unit}): stock=${p.stock}, minStock=${p.minStock}, price=${formatInr(p.price)}, avgDailySales=${p.avgDailySales}, expiry=${p.expiryDate}, status=${getStockStatusBadge(p)}`
    )
    .join('\n');

  const topSoldLines =
    topSold.length > 0
      ? topSold.map((t) => `- ${t.name}: ${t.qty} units (${formatInr(t.revenue)})`).join('\n')
      : '- No sales recorded yet.';

  return [
    `Store: Shree Ganesh General Store | Date: ${todayIso} | Role: ${userRole}`,
    `Today's Sales: ${formatInr(metrics.todaysSales)} (${metrics.todaysBillsCount} bills)${
      userRole === 'Admin'
        ? ` | Today's Gross Profit: ${formatInr(metrics.todaysGrossProfit)} | 7-Day Sales: ${formatInr(metrics.totalSales7d)} | Net Profit: ${formatInr(metrics.netProfit)}`
        : ` | 7-Day Sales: ${formatInr(metrics.totalSales7d)}`
    }`,
    '',
    'LIVE INVENTORY:',
    inventoryLines,
    '',
    todaysSales.length > 0 ? "TODAY'S TOP SOLD ITEMS:" : 'RECENT TOP SOLD ITEMS:',
    topSoldLines,
  ].join('\n');
}

export async function queryClientGeminiIfConfigured(
  history: ChatMessage[],
  store: AssistantStoreContext,
  userRole: UserRole
): Promise<string | null> {
  const apiKey = (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GEMINI_API_KEY ?? ''
  ).trim();

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const systemInstruction = [
    'Answer ONLY what the user asked concisely using the provided store records. Reply in the same language (English or Hinglish) the user used.',
    'Do not dump unrelated sections (like demand forecasts) unless the user specifically asks for them.',
    'If the user only greets you (e.g. hi, hello, namaste), reply with a brief friendly greeting and offer to check stock, prices, low-stock alerts, or sales.',
    'Use ₹ for currency and exact numbers from the live records below.',
    '',
    buildCompactClientContext(store, userRole),
  ].join('\n');

  const recentMessages = history.slice(-8).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 12000)
    : undefined;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: recentMessages,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    } | null;

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';

    return text || null;
  } catch {
    return null;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
