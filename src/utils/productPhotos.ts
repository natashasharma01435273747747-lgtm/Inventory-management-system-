import type { Product } from '../types/store.ts';

export const SMARTSTOCK_DATA_VERSION = 'v3_real_photos';
export const SMARTSTOCK_DATA_VERSION_KEY = 'smartstock_data_version';
export const PHOTO_CACHE_STORAGE_KEY = 'smartstock_photo_cache_v3';

// Real studio retail pack photographs bundled with the app (copied to dist/src/assets/images/ on build)
export const BUILT_IN_PRODUCT_PHOTOS: Record<string, string> = {
  'prod-tata-salt': '/src/assets/images/tata_salt_pack_1795377752455.jpg',
  'prod-fortune-oil': '/src/assets/images/fortune_sunflower_oil_1795377753226.jpg',
  'prod-aashirvaad-atta': '/src/assets/images/aashirvaad_chakki_atta_1795378311594.jpg',
  'prod-indiagate-rice': '/src/assets/images/india_gate_basmati_rice_1795377749498.jpg',
  'prod-toor-dal': '/src/assets/images/tata_sampann_toor_dal_1795378306247.jpg',
  'prod-kissan-ketchup': '/src/assets/images/kissan_tomato_ketchup_1795377749142.jpg',
  'prod-maggi-4pk': '/src/assets/images/maggi_masala_noodles_1795377749086.jpg',
  'prod-parleg': '/src/assets/images/parle_g_biscuits_1795377754103.jpg',
  'prod-lays-masala': '/src/assets/images/lays_magic_masala_1795377750378.jpg',
  'prod-haldiram-bhujia': '/src/assets/images/haldiram_aloo_bhujia_1795377751319.jpg',
  'prod-goodday-butter': '/src/assets/images/good_day_butter_cookies_1795377749023.jpg',
  'prod-cocacola-750': '/src/assets/images/coca_cola_bottle_1795378303642.jpg',
  'prod-thumsup-125': '/src/assets/images/thums_up_bottle_1795378305240.jpg',
  'prod-real-juice': '/src/assets/images/real_mixed_fruit_juice_1795377749435.jpg',
  'prod-tata-tea': '/src/assets/images/tata_tea_gold_1795378305301.jpg',
  'prod-amul-milk': '/src/assets/images/amul_taaza_milk_1795377751259.jpg',
  'prod-amul-butter': '/src/assets/images/amul_table_butter_1795377749260.jpg',
  'prod-motherdairy-curd': '/src/assets/images/mother_dairy_dahi_1795377749523.jpg',
  'prod-amul-paneer': '/src/assets/images/amul_malai_paneer_1795377751863.jpg',
  'prod-dettol-soap': '/src/assets/images/dettol_original_soap_1795377748786.jpg',
  'prod-colgate-paste': '/src/assets/images/colgate_strong_teeth_1795377751141.jpg',
  'prod-clinicplus': '/src/assets/images/clinic_plus_shampoo_1795377753454.jpg',
};

const KEYWORD_PHOTO_RULES: Array<{ match: (name: string) => boolean; url: string }> = [
  { match: (n) => n.includes('tata salt'), url: BUILT_IN_PRODUCT_PHOTOS['prod-tata-salt'] },
  {
    match: (n) => n.includes('fortune') || (n.includes('sunflower') && n.includes('oil')),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-fortune-oil'],
  },
  {
    match: (n) => n.includes('aashirvaad') || n.includes('chakki atta'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-aashirvaad-atta'],
  },
  {
    match: (n) => n.includes('india gate') || n.includes('basmati rice'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-indiagate-rice'],
  },
  {
    match: (n) => n.includes('toor dal') || n.includes('sampann'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-toor-dal'],
  },
  {
    match: (n) => n.includes('kissan') || n.includes('ketchup'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-kissan-ketchup'],
  },
  {
    match: (n) => n.includes('maggi'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-maggi-4pk'],
  },
  {
    match: (n) => n.includes('parle-g') || n.includes('parle g'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-parleg'],
  },
  {
    match: (n) => n.includes("lay's") || n.includes('lays'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-lays-masala'],
  },
  {
    match: (n) => n.includes('haldiram') || n.includes('bhujia'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-haldiram-bhujia'],
  },
  {
    match: (n) => n.includes('good day') || n.includes('britannia'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-goodday-butter'],
  },
  {
    match: (n) => n.includes('coca-cola') || n.includes('coca cola') || n.includes('coke'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-cocacola-750'],
  },
  {
    match: (n) => n.includes('thums up'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-thumsup-125'],
  },
  {
    match: (n) => n.includes('real activ') || n.includes('mixed fruit juice'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-real-juice'],
  },
  {
    match: (n) => n.includes('tata tea'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-tata-tea'],
  },
  {
    match: (n) => n.includes('amul taaza') || (n.includes('amul') && n.includes('milk')),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-amul-milk'],
  },
  {
    match: (n) => n.includes('amul') && n.includes('butter'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-amul-butter'],
  },
  {
    match: (n) => n.includes('mother dairy') || n.includes('dahi') || n.includes('curd'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-motherdairy-curd'],
  },
  {
    match: (n) => n.includes('paneer'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-amul-paneer'],
  },
  {
    match: (n) => n.includes('dettol'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-dettol-soap'],
  },
  {
    match: (n) => n.includes('colgate'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-colgate-paste'],
  },
  {
    match: (n) => n.includes('clinic plus') || n.includes('clinic+'),
    url: BUILT_IN_PRODUCT_PHOTOS['prod-clinicplus'],
  },
];

export function getBuiltInProductPhoto(
  product: Partial<Pick<Product, 'id' | 'name'>> | null | undefined
): string | null {
  if (!product) return null;
  if (product.id && BUILT_IN_PRODUCT_PHOTOS[product.id]) {
    return BUILT_IN_PRODUCT_PHOTOS[product.id];
  }
  const normalized = (product.name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  for (const rule of KEYWORD_PHOTO_RULES) {
    if (rule.match(normalized)) {
      return rule.url;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Open Food Facts Real Photo Fetcher + localStorage Cache
// ---------------------------------------------------------------------------

interface PhotoCacheEntry {
  url: string | null;
  fetchedAt: number;
}

type PhotoCacheMap = Record<string, PhotoCacheEntry>;

const CACHE_MISS_TTL_MS = 1000 * 60 * 30; // Retry misses after 30 minutes
const inFlightFetches = new Map<string, Promise<string | null>>();

function normalizeCacheKey(productName: string): string {
  return productName.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readPhotoCache(): PhotoCacheMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(PHOTO_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PhotoCacheMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePhotoCache(cache: PhotoCacheMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    // Keep cache compact (max 150 entries)
    const keys = Object.keys(cache);
    if (keys.length > 150) {
      keys
        .sort((a, b) => (cache[a]?.fetchedAt ?? 0) - (cache[b]?.fetchedAt ?? 0))
        .slice(0, keys.length - 150)
        .forEach((k) => delete cache[k]);
    }
    localStorage.setItem(PHOTO_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedOpenFoodFactsPhoto(
  productName: string
): { hit: boolean; url: string | null } {
  const key = normalizeCacheKey(productName);
  if (!key) return { hit: false, url: null };
  const cache = readPhotoCache();
  const entry = cache[key];
  if (!entry) return { hit: false, url: null };
  if (entry.url) {
    return { hit: true, url: entry.url };
  }
  if (Date.now() - entry.fetchedAt < CACHE_MISS_TTL_MS) {
    return { hit: true, url: null };
  }
  return { hit: false, url: null };
}

function isValidHttpImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}

export async function fetchOpenFoodFactsPhoto(
  productName: string,
  options?: { forceRefresh?: boolean }
): Promise<string | null> {
  const key = normalizeCacheKey(productName);
  if (!key) return null;

  if (!options?.forceRefresh) {
    const cached = getCachedOpenFoodFactsPhoto(productName);
    if (cached.hit) return cached.url;
  }

  const existing = inFlightFetches.get(key);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 5000)
      : undefined;

    try {
      const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        productName.trim()
      )}&search_simple=1&action=process&json=1&page_size=3`;

      const res = await fetch(searchUrl, {
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json().catch(() => null)) as {
        products?: Array<{
          image_front_small_url?: string;
          image_front_url?: string;
        }>;
      } | null;

      let matchedUrl: string | null = null;
      if (data && Array.isArray(data.products)) {
        for (const item of data.products) {
          if (isValidHttpImageUrl(item?.image_front_small_url)) {
            matchedUrl = item.image_front_small_url.trim();
            break;
          }
          if (isValidHttpImageUrl(item?.image_front_url)) {
            matchedUrl = item.image_front_url.trim();
            break;
          }
        }
      }

      const cache = readPhotoCache();
      cache[key] = { url: matchedUrl, fetchedAt: Date.now() };
      writePhotoCache(cache);
      return matchedUrl;
    } catch {
      return null;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      inFlightFetches.delete(key);
    }
  })();

  inFlightFetches.set(key, task);
  return task;
}

// ---------------------------------------------------------------------------
// Client-side Photo Compression for Admin Phone / File Uploads
// ---------------------------------------------------------------------------

export function compressImageFile(
  file: File,
  maxDimension = 480,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (JPG, PNG, or WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Empty image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the selected image.'));
      img.onload = () => {
        try {
          const naturalW = img.naturalWidth || img.width || maxDimension;
          const naturalH = img.naturalHeight || img.height || maxDimension;
          const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
          const targetW = Math.max(1, Math.round(naturalW * scale));
          const targetH = Math.max(1, Math.round(naturalH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Clean white studio background for transparent PNG cutouts
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
