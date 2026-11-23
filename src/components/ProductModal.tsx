import React, { useEffect, useRef, useState } from 'react';
import { Camera, Globe, Trash2, X } from 'lucide-react';
import type { ProductInput } from '../api/client.ts';
import type { Product, ProductCategory } from '../types/store.ts';
import { PRODUCT_CATEGORIES } from '../types/store.ts';
import {
  compressImageFile,
  fetchOpenFoodFactsPhoto,
} from '../utils/productPhotos.ts';
import { getLocalIsoDate } from '../utils/storeMetrics.ts';
import { ProductPackThumbnail } from './ProductPackThumbnail.tsx';

interface ProductModalProps {
  isOpen: boolean;
  editingProduct: Product | null;
  onClose: () => void;
  onSave: (input: ProductInput, editingId?: string) => Promise<void>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  editingProduct,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Grocery');
  const [unit, setUnit] = useState('1 pack');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('15');
  const [expiryDate, setExpiryDate] = useState(getLocalIsoDate(90));
  const [supplier, setSupplier] = useState('');
  const [avgDailySales, setAvgDailySales] = useState('5');
  const [image, setImage] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fetchingPhoto, setFetchingPhoto] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPhotoStatus(null);
    if (editingProduct) {
      setName(editingProduct.name);
      setCategory(editingProduct.category);
      setUnit(editingProduct.unit);
      setPrice(String(editingProduct.price));
      setCostPrice(String(editingProduct.costPrice));
      setStock(String(editingProduct.stock));
      setMinStock(String(editingProduct.minStock));
      setExpiryDate(editingProduct.expiryDate);
      setSupplier(editingProduct.supplier);
      setAvgDailySales(String(editingProduct.avgDailySales));
      setImage(editingProduct.image ?? '');
    } else {
      setName('');
      setCategory('Grocery');
      setUnit('1 pack');
      setPrice('');
      setCostPrice('');
      setStock('20');
      setMinStock('12');
      setExpiryDate(getLocalIsoDate(90));
      setSupplier('');
      setAvgDailySales('5');
      setImage('');
    }
  }, [isOpen, editingProduct]);

  if (!isOpen) return null;

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPhoto(true);
    setPhotoStatus(null);
    setError(null);
    try {
      const compressedDataUrl = await compressImageFile(file, 480, 0.82);
      setImage(compressedDataUrl);
      setPhotoStatus('Photo compressed and ready to save.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to process the selected photo.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAutoFetchPhoto = async () => {
    const query = name.trim();
    if (!query) {
      setPhotoStatus('Enter a product name first to fetch a real photo.');
      return;
    }
    setFetchingPhoto(true);
    setPhotoStatus(null);
    try {
      const fetchedUrl = await fetchOpenFoodFactsPhoto(query, { forceRefresh: true });
      if (fetchedUrl) {
        setImage(fetchedUrl);
        setPhotoStatus('Real product photo fetched from Open Food Facts.');
      } else {
        setPhotoStatus('No matching photo found online — you can upload one from your device.');
      }
    } finally {
      setFetchingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numPrice = Number(price);
    const numCost = Number(costPrice);
    const numStock = Number(stock);
    const numMin = Number(minStock);
    const numVelocity = Number(avgDailySales);

    if (!name.trim() || !supplier.trim()) {
      setError('Product name and supplier are required.');
      return;
    }
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      setError('Enter a valid selling price greater than ₹0.');
      return;
    }
    if (!Number.isFinite(numCost) || numCost < 0) {
      setError('Enter a valid cost price.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(
        {
          name: name.trim(),
          category,
          unit: unit.trim() || '1 unit',
          price: numPrice,
          costPrice: numCost,
          stock: Math.max(0, Math.round(numStock)),
          minStock: Math.max(1, Math.round(numMin)),
          expiryDate,
          supplier: supplier.trim(),
          avgDailySales: Math.max(0.5, numVelocity || 3),
          image: image.trim(),
        },
        editingProduct?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingProduct ? 'Edit Product' : 'Add Product'}
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <p className="text-xs text-slate-500">
              Update product photo, pricing, stock thresholds, expiry date, and supplier.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Real Product Photo Upload / Capture Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3.5">
            <ProductPackThumbnail
              product={{
                id: editingProduct?.id,
                name: name.trim() || editingProduct?.name || 'Product Photo',
                category,
                image: image || undefined,
              }}
              className="w-16 h-16"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Product Photograph
                </p>
                <p className="text-[11px] text-slate-500">
                  Upload or snap a real pack photo from your phone, or auto-fetch by product name.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="px-3 py-1.5 rounded-lg bg-[#0052FF] hover:bg-[#0044D6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? 'Compressing...' : 'Upload / Capture Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoFetchPhoto}
                  disabled={fetchingPhoto || !name.trim()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{fetchingPhoto ? 'Searching...' : 'Fetch Online'}</span>
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => {
                      setImage('');
                      setPhotoStatus('Custom photo removed.');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              {photoStatus && (
                <p className="text-[11px] font-medium text-teal-700">{photoStatus}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Maggi 2-Minute Masala Noodles"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pack Size / Unit
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., 1 kg pack, 500 ml bottle"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                MRP / Price (₹)
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cost Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stock Qty
              </label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Low-Stock Alert
              </label>
              <input
                type="number"
                min="1"
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Avg Daily Sales
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={avgDailySales}
                onChange={(e) => setAvgDailySales(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supplier / Agency
              </label>
              <input
                type="text"
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g., Mahadev Distributors"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-sm font-medium text-white disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : editingProduct
                  ? 'Save Changes'
                  : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
