import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../types/store.ts';
import {
  fetchOpenFoodFactsPhoto,
  getBuiltInProductPhoto,
  getCachedOpenFoodFactsPhoto,
} from '../utils/productPhotos.ts';

interface ProductPackThumbnailProps {
  product: Partial<Product> | null | undefined;
  className?: string;
  compact?: boolean;
}

export const ProductPackThumbnail: React.FC<ProductPackThumbnailProps> = ({
  product,
  className = 'w-16 h-16',
  compact = false,
}) => {
  const productId = typeof product?.id === 'string' ? product.id : '';
  const productName =
    typeof product?.name === 'string' && product.name.trim()
      ? product.name.trim()
      : 'Store Product';

  const explicitImage =
    typeof product?.image === 'string' && product.image.trim().length > 0
      ? product.image.trim()
      : null;

  const builtInPhoto = getBuiltInProductPhoto({ id: productId, name: productName });

  // Resolve initial synchronous photo: Admin/product image -> Built-in studio photo -> Cached Open Food Facts photo
  const resolveSyncPhoto = (): string | null => {
    if (explicitImage) return explicitImage;
    if (builtInPhoto) return builtInPhoto;
    const cached = getCachedOpenFoodFactsPhoto(productName);
    return cached.url;
  };

  const [photoSrc, setPhotoSrc] = useState<string | null>(resolveSyncPhoto);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImageFailed(false);

    if (explicitImage) {
      setPhotoSrc(explicitImage);
      return;
    }

    if (builtInPhoto) {
      setPhotoSrc(builtInPhoto);
      return;
    }

    const cached = getCachedOpenFoodFactsPhoto(productName);
    if (cached.hit) {
      setPhotoSrc(cached.url);
      return;
    }

    setPhotoSrc(null);

    if (productName && productName !== 'Store Product') {
      fetchOpenFoodFactsPhoto(productName).then((fetchedUrl) => {
        if (!cancelled && fetchedUrl) {
          setPhotoSrc(fetchedUrl);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [explicitImage, builtInPhoto, productName]);

  const handleImageError = () => {
    // If an explicit external URL failed, try built-in studio photo or Open Food Facts before falling back to icon
    if (photoSrc === explicitImage && builtInPhoto && builtInPhoto !== explicitImage) {
      setPhotoSrc(builtInPhoto);
      return;
    }
    setImageFailed(true);
  };

  const frameClass = compact
    ? `${className} rounded-xl bg-white border border-slate-200 p-1 shadow-xs flex items-center justify-center shrink-0 overflow-hidden select-none`
    : `${className} rounded-xl bg-white border border-slate-200 p-1 shadow-sm flex items-center justify-center shrink-0 overflow-hidden select-none`;

  if (photoSrc && !imageFailed) {
    return (
      <div className={frameClass}>
        <img
          src={photoSrc}
          alt={productName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImageError}
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    );
  }

  // Clean minimal package icon fallback while loading or when unavailable — never a cartoon drawing
  return (
    <div
      className={`${frameClass} bg-slate-50`}
      aria-label={`${productName} photo unavailable`}
    >
      <Package
        className={compact ? 'w-5 h-5 text-slate-400' : 'w-6 h-6 text-slate-400'}
        strokeWidth={1.75}
      />
    </div>
  );
};
