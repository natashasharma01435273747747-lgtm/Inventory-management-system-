import React, { useState } from 'react';
import type { Product } from '../types/store.ts';

interface ProductPackThumbnailProps {
  product: Partial<Product> | null | undefined;
  className?: string;
  compact?: boolean;
}

interface PackVisualSpec {
  shape: 'pouch' | 'bag' | 'bottle' | 'tetra' | 'box' | 'cup' | 'tube';
  primary: string;
  secondary: string;
  accent: string;
  brand: string;
  label: string;
  textColor?: string;
  motif?: 'sunflower' | 'wheat' | 'noodles' | 'milk' | 'cola' | 'fruit' | 'soap' | 'salt' | 'tea' | 'biscuit';
}

function getPackVisualSpec(product: Partial<Product> | null | undefined): PackVisualSpec {
  const safeName =
    typeof product?.name === 'string' && product.name.trim()
      ? product.name.trim()
      : 'Store Item';
  const safeBrandWord = (safeName.split(/\s+/)[0] || 'ITEM').slice(0, 8);
  const n = safeName.toLowerCase();

  if (n.includes('tata salt')) {
    return {
      shape: 'pouch',
      primary: '#EA6B00',
      secondary: '#FFFFFF',
      accent: '#3B1E08',
      brand: 'TATA',
      label: 'Salt',
      textColor: '#FFFFFF',
      motif: 'salt',
    };
  }
  if (n.includes('fortune') || n.includes('oil')) {
    return {
      shape: 'pouch',
      primary: '#FACC15',
      secondary: '#FEF9C3',
      accent: '#DC2626',
      brand: 'fortune',
      label: 'Sunlite Oil',
      textColor: '#DC2626',
      motif: 'sunflower',
    };
  }
  if (n.includes('aashirvaad') || n.includes('atta')) {
    return {
      shape: 'bag',
      primary: '#D4A564',
      secondary: '#991B1B',
      accent: '#FDE68A',
      brand: 'AASHIRVAAD',
      label: 'Chakki Atta',
      textColor: '#FFFFFF',
      motif: 'wheat',
    };
  }
  if (n.includes('india gate') || n.includes('rice')) {
    return {
      shape: 'bag',
      primary: '#3B0764',
      secondary: '#F59E0B',
      accent: '#FEF3C7',
      brand: 'INDIA GATE',
      label: 'Basmati',
      textColor: '#FEF3C7',
      motif: 'wheat',
    };
  }
  if (n.includes('toor dal') || n.includes('sampann')) {
    return {
      shape: 'pouch',
      primary: '#D97706',
      secondary: '#FEF3C7',
      accent: '#1E3A8A',
      brand: 'SAMPANN',
      label: 'Toor Dal',
      textColor: '#FFFFFF',
      motif: 'wheat',
    };
  }
  if (n.includes('ketchup') || n.includes('kissan')) {
    return {
      shape: 'pouch',
      primary: '#DC2626',
      secondary: '#FEE2E2',
      accent: '#16A34A',
      brand: 'KISSAN',
      label: 'Ketchup',
      textColor: '#FFFFFF',
      motif: 'fruit',
    };
  }
  if (n.includes('maggi') || n.includes('noodles')) {
    return {
      shape: 'pouch',
      primary: '#FACC15',
      secondary: '#DC2626',
      accent: '#991B1B',
      brand: 'Maggi',
      label: '2-Min',
      textColor: '#FEF08A',
      motif: 'noodles',
    };
  }
  if (n.includes('parle')) {
    return {
      shape: 'box',
      primary: '#FDE68A',
      secondary: '#D97706',
      accent: '#B91C1C',
      brand: 'Parle-G',
      label: 'Gold',
      textColor: '#991B1B',
      motif: 'biscuit',
    };
  }
  if (n.includes("lay's") || n.includes('chips')) {
    return {
      shape: 'pouch',
      primary: '#0284C7',
      secondary: '#0369A1',
      accent: '#FACC15',
      brand: "Lay's",
      label: 'Masala',
      textColor: '#FFFFFF',
      motif: 'biscuit',
    };
  }
  if (n.includes('haldiram') || n.includes('bhujia')) {
    return {
      shape: 'pouch',
      primary: '#B91C1C',
      secondary: '#F59E0B',
      accent: '#FEF08A',
      brand: 'Haldiram',
      label: 'Bhujia',
      textColor: '#FEF08A',
      motif: 'noodles',
    };
  }
  if (n.includes('good day') || n.includes('britannia')) {
    return {
      shape: 'box',
      primary: '#2563EB',
      secondary: '#F59E0B',
      accent: '#FEF3C7',
      brand: 'Good Day',
      label: 'Butter',
      textColor: '#FFFFFF',
      motif: 'biscuit',
    };
  }
  if (n.includes('coca-cola') || n.includes('coke')) {
    return {
      shape: 'bottle',
      primary: '#B91C1C',
      secondary: '#1F1313',
      accent: '#FFFFFF',
      brand: 'Coca-Cola',
      label: '750ml',
      textColor: '#FFFFFF',
      motif: 'cola',
    };
  }
  if (n.includes('thums up')) {
    return {
      shape: 'bottle',
      primary: '#1D4ED8',
      secondary: '#171717',
      accent: '#EF4444',
      brand: 'Thums Up',
      label: 'Cola',
      textColor: '#FFFFFF',
      motif: 'cola',
    };
  }
  if (n.includes('real') || n.includes('juice')) {
    return {
      shape: 'tetra',
      primary: '#16A34A',
      secondary: '#F97316',
      accent: '#FEF08A',
      brand: 'Réal',
      label: 'Fruit',
      textColor: '#FFFFFF',
      motif: 'fruit',
    };
  }
  if (n.includes('tea')) {
    return {
      shape: 'box',
      primary: '#0F172A',
      secondary: '#D97706',
      accent: '#FDE68A',
      brand: 'TATA TEA',
      label: 'Gold',
      textColor: '#FDE68A',
      motif: 'tea',
    };
  }
  if (n.includes('milk') || n.includes('taaza')) {
    return {
      shape: 'pouch',
      primary: '#0284C7',
      secondary: '#E0F2FE',
      accent: '#DC2626',
      brand: 'Amul',
      label: 'Taaza',
      textColor: '#FFFFFF',
      motif: 'milk',
    };
  }
  if (n.includes('butter')) {
    return {
      shape: 'box',
      primary: '#FDE047',
      secondary: '#FEF9C3',
      accent: '#DC2626',
      brand: 'Amul',
      label: 'Butter',
      textColor: '#DC2626',
      motif: 'milk',
    };
  }
  if (n.includes('curd') || n.includes('dahi')) {
    return {
      shape: 'cup',
      primary: '#2563EB',
      secondary: '#EFF6FF',
      accent: '#1D4ED8',
      brand: 'Mother',
      label: 'Dahi',
      textColor: '#FFFFFF',
      motif: 'milk',
    };
  }
  if (n.includes('paneer')) {
    return {
      shape: 'box',
      primary: '#FFFFFF',
      secondary: '#DC2626',
      accent: '#FEF2F2',
      brand: 'Amul',
      label: 'Paneer',
      textColor: '#DC2626',
      motif: 'milk',
    };
  }
  if (n.includes('dettol') || n.includes('soap')) {
    return {
      shape: 'box',
      primary: '#15803D',
      secondary: '#DCFCE7',
      accent: '#FFFFFF',
      brand: 'Dettol',
      label: 'Original',
      textColor: '#FFFFFF',
      motif: 'soap',
    };
  }
  if (n.includes('colgate') || n.includes('toothpaste')) {
    return {
      shape: 'tube',
      primary: '#DC2626',
      secondary: '#FFFFFF',
      accent: '#991B1B',
      brand: 'Colgate',
      label: 'Strong',
      textColor: '#FFFFFF',
      motif: 'soap',
    };
  }
  if (n.includes('clinic') || n.includes('shampoo')) {
    return {
      shape: 'bottle',
      primary: '#0284C7',
      secondary: '#38BDF8',
      accent: '#FFFFFF',
      brand: 'Clinic+',
      label: 'Shampoo',
      textColor: '#FFFFFF',
      motif: 'soap',
    };
  }

  // Category-aware fallback for newly added custom products
  switch (product?.category) {
    case 'Grocery':
      return {
        shape: 'bag',
        primary: '#D97706',
        secondary: '#FEF3C7',
        accent: '#92400E',
        brand: safeBrandWord,
        label: 'Grocery',
        textColor: '#FFFFFF',
        motif: 'wheat',
      };
    case 'Snacks':
      return {
        shape: 'pouch',
        primary: '#EA580C',
        secondary: '#FED7AA',
        accent: '#FACC15',
        brand: safeBrandWord,
        label: 'Snacks',
        textColor: '#FFFFFF',
        motif: 'biscuit',
      };
    case 'Drinks':
      return {
        shape: 'bottle',
        primary: '#2563EB',
        secondary: '#1E3A8A',
        accent: '#38BDF8',
        brand: safeBrandWord,
        label: 'Drink',
        textColor: '#FFFFFF',
        motif: 'cola',
      };
    case 'Dairy':
      return {
        shape: 'tetra',
        primary: '#0284C7',
        secondary: '#E0F2FE',
        accent: '#0369A1',
        brand: safeBrandWord,
        label: 'Dairy',
        textColor: '#FFFFFF',
        motif: 'milk',
      };
    default:
      return {
        shape: 'box',
        primary: '#0F766E',
        secondary: '#CCFBF1',
        accent: '#115E59',
        brand: safeBrandWord,
        label: 'Care',
        textColor: '#FFFFFF',
        motif: 'soap',
      };
  }
}

export const ProductPackThumbnail: React.FC<ProductPackThumbnailProps> = ({
  product,
  className = 'w-20 h-24 sm:w-24 sm:h-28',
  compact = false,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const spec = getPackVisualSpec(product);
  const imageUrl =
    typeof product?.image === 'string' && product.image.trim().length > 0
      ? product.image.trim()
      : null;

  const frameClass = compact
    ? `${className} rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden select-none`
    : `${className} rounded-2xl bg-gradient-to-b from-[#F8FAFF] to-[#EEF3FF] border border-[#E4ECFA] flex items-center justify-center p-2 shrink-0 overflow-hidden select-none`;

  if (imageUrl && !imageFailed) {
    return (
      <div className={frameClass}>
        <img
          src={imageUrl}
          alt={typeof product?.name === 'string' && product.name ? product.name : 'Product'}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className={frameClass} aria-hidden="true">
      {spec.shape === 'bottle' ? (
        <svg viewBox="0 0 80 100" className="w-full h-full drop-shadow-xs">
          {/* Bottle Cap */}
          <rect x="32" y="4" width="16" height="8" rx="2.5" fill={spec.primary} />
          {/* Neck */}
          <path
            d="M33 12 L47 12 L52 28 L28 28 Z"
            fill={spec.secondary}
            opacity="0.92"
          />
          {/* Body */}
          <rect
            x="22"
            y="27"
            width="36"
            height="66"
            rx="10"
            fill={spec.secondary}
          />
          {/* Gloss highlight */}
          <rect x="26" y="31" width="5" height="56" rx="2.5" fill="#FFFFFF" opacity="0.22" />
          {/* Brand Label Wrap */}
          <rect x="22" y="42" width="36" height="28" fill={spec.primary} />
          <text
            x="40"
            y="55"
            textAnchor="middle"
            fill={spec.textColor || '#FFFFFF'}
            fontSize="7.5"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="40"
            y="65"
            textAnchor="middle"
            fill={spec.accent}
            fontSize="6"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
        </svg>
      ) : spec.shape === 'cup' ? (
        <svg viewBox="0 0 84 96" className="w-full h-full drop-shadow-xs">
          {/* Foil Lid */}
          <ellipse cx="42" cy="24" rx="31" ry="7" fill={spec.primary} />
          <ellipse cx="42" cy="23" rx="26" ry="4.5" fill="#FFFFFF" opacity="0.28" />
          {/* Tapered Cup Body */}
          <path
            d="M14 26 L70 26 L63 82 C62 86 58 88 53 88 L31 88 C26 88 22 86 21 82 Z"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />
          {/* Blue Band */}
          <path d="M16 42 L68 42 L65.5 67 L18.5 67 Z" fill={spec.primary} />
          <text
            x="42"
            y="53"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="8.5"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="42"
            y="63"
            textAnchor="middle"
            fill="#DBEAFE"
            fontSize="7.5"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
        </svg>
      ) : spec.shape === 'tetra' ? (
        <svg viewBox="0 0 80 100" className="w-full h-full drop-shadow-xs">
          {/* Top Fold */}
          <path d="M18 18 L40 8 L62 18 Z" fill={spec.primary} />
          <rect x="48" y="8" width="9" height="6" rx="2" fill="#FFFFFF" stroke="#CBD5E1" />
          {/* Carton Box */}
          <rect x="18" y="18" width="44" height="74" rx="5" fill={spec.primary} />
          <rect x="22" y="28" width="36" height="42" rx="4" fill="#FFFFFF" opacity="0.16" />
          {/* Fruit Circle */}
          <circle cx="40" cy="68" r="12" fill={spec.secondary} />
          <circle cx="46" cy="72" r="7" fill={spec.accent} />
          <text
            x="40"
            y="38"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="40"
            y="49"
            textAnchor="middle"
            fill="#FEF08A"
            fontSize="7.5"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
        </svg>
      ) : spec.shape === 'tube' ? (
        <svg viewBox="0 0 92 84" className="w-full h-full drop-shadow-xs">
          {/* Toothpaste Carton Box */}
          <rect x="6" y="22" width="80" height="38" rx="6" fill={spec.primary} />
          <rect x="6" y="22" width="80" height="8" rx="3" fill="#FFFFFF" opacity="0.16" />
          <path d="M12 52 Q46 45 80 54" stroke="#FFFFFF" strokeWidth="2.5" fill="none" opacity="0.85" />
          <text
            x="46"
            y="42"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="46"
            y="53"
            textAnchor="middle"
            fill="#FEE2E2"
            fontSize="7"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
        </svg>
      ) : spec.shape === 'box' ? (
        <svg viewBox="0 0 88 96" className="w-full h-full drop-shadow-xs">
          {/* Outer Pack */}
          <rect
            x="10"
            y="14"
            width="68"
            height="68"
            rx="9"
            fill={spec.primary}
            stroke={spec.primary === '#FFFFFF' ? '#CBD5E1' : 'none'}
            strokeWidth="1.5"
          />
          {/* Accent Band */}
          <rect x="10" y="54" width="68" height="20" fill={spec.secondary} opacity="0.92" />
          {/* Top Highlight */}
          <rect x="14" y="18" width="60" height="7" rx="3" fill="#FFFFFF" opacity="0.22" />
          <text
            x="44"
            y="42"
            textAnchor="middle"
            fill={spec.textColor || '#FFFFFF'}
            fontSize="11"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="44"
            y="67"
            textAnchor="middle"
            fill={spec.primary === '#FFFFFF' ? '#FFFFFF' : '#0F172A'}
            fontSize="8.5"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
        </svg>
      ) : spec.shape === 'bag' ? (
        <svg viewBox="0 0 84 100" className="w-full h-full drop-shadow-xs">
          {/* Crimped Top & Bottom Bag */}
          <rect x="14" y="8" width="56" height="8" rx="2" fill={spec.primary} opacity="0.85" />
          <rect x="14" y="84" width="56" height="8" rx="2" fill={spec.primary} opacity="0.85" />
          <rect x="12" y="14" width="60" height="72" rx="6" fill={spec.primary} />
          {/* Center Emblem Panel */}
          <rect x="19" y="22" width="46" height="44" rx="5" fill={spec.secondary} />
          {/* Wheat / Grain Sunburst */}
          <circle cx="42" cy="34" r="7" fill={spec.accent} opacity="0.9" />
          <text
            x="42"
            y="48"
            textAnchor="middle"
            fill={spec.textColor || '#FFFFFF'}
            fontSize="7"
            fontWeight="800"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            {spec.brand}
          </text>
          <text
            x="42"
            y="59"
            textAnchor="middle"
            fill={spec.accent}
            fontSize="6.5"
            fontWeight="700"
            fontFamily="DM Sans, sans-serif"
          >
            {spec.label}
          </text>
          {/* Bottom Grain Texture */}
          <rect x="19" y="69" width="46" height="10" rx="3" fill={spec.accent} opacity="0.55" />
        </svg>
      ) : (
        /* Realistic Stand-up Pouch (Tata Salt, Fortune Oil, Maggi, Amul Milk, Lay's) */
        <svg viewBox="0 0 84 100" className="w-full h-full drop-shadow-xs">
          {/* Crimped Seal Edges */}
          <path d="M14 10 L70 10 L68 18 L16 18 Z" fill={spec.primary} />
          <path d="M16 82 L68 82 L70 90 L14 90 Z" fill={spec.primary} />
          {/* Main Pouch Body */}
          <rect x="14" y="16" width="56" height="68" rx="7" fill={spec.primary} />

          {/* Motif-specific authentic retail look */}
          {spec.motif === 'salt' ? (
            <>
              <rect x="14" y="25" width="56" height="28" fill="#FFFFFF" />
              <circle cx="42" cy="48" r="19" fill={spec.accent} stroke="#FFFFFF" strokeWidth="2" />
              <text
                x="42"
                y="46"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                TATA
              </text>
              <text
                x="42"
                y="57"
                textAnchor="middle"
                fill="#FDBA74"
                fontSize="9"
                fontWeight="700"
                fontStyle="italic"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                Salt
              </text>
            </>
          ) : spec.motif === 'sunflower' ? (
            <>
              <rect x="18" y="20" width="20" height="60" rx="4" fill="#FFFFFF" opacity="0.92" />
              <text
                x="28"
                y="52"
                textAnchor="middle"
                fill="#DC2626"
                fontSize="9"
                fontWeight="800"
                transform="rotate(-90 28 52)"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                fortune
              </text>
              {/* Bright Sunflower Graphic */}
              <circle cx="52" cy="62" r="14" fill="#F59E0B" />
              <circle cx="52" cy="62" r="10" fill="#FDE047" />
              <circle cx="52" cy="62" r="6" fill="#78350F" />
            </>
          ) : spec.motif === 'noodles' ? (
            <>
              <ellipse cx="42" cy="44" rx="22" ry="15" fill={spec.secondary} stroke="#FFFFFF" strokeWidth="2" />
              <text
                x="42"
                y="47"
                textAnchor="middle"
                fill={spec.textColor || '#FEF08A'}
                fontSize="10.5"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {spec.brand}
              </text>
              <path
                d="M22 68 Q32 62 42 68 T62 68"
                stroke="#B45309"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M24 74 Q34 68 44 74 T60 74"
                stroke="#D97706"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </>
          ) : spec.motif === 'milk' ? (
            <>
              <rect x="14" y="40" width="56" height="32" fill="#FFFFFF" />
              <text
                x="42"
                y="33"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {spec.brand}
              </text>
              <text
                x="42"
                y="56"
                textAnchor="middle"
                fill="#0284C7"
                fontSize="11"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {spec.label}
              </text>
              <text
                x="42"
                y="67"
                textAnchor="middle"
                fill="#64748B"
                fontSize="6.5"
                fontWeight="600"
              >
                TONED MILK
              </text>
            </>
          ) : (
            <>
              <circle cx="42" cy="46" r="18" fill={spec.accent} opacity="0.92" />
              <text
                x="42"
                y="45"
                textAnchor="middle"
                fill="#0F172A"
                fontSize="8.5"
                fontWeight="800"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {spec.brand}
              </text>
              <text
                x="42"
                y="56"
                textAnchor="middle"
                fill="#334155"
                fontSize="7"
                fontWeight="700"
                fontFamily="DM Sans, sans-serif"
              >
                {spec.label}
              </text>
            </>
          )}

          {/* Subtle Specular Sheen */}
          <rect x="18" y="20" width="5" height="60" rx="2.5" fill="#FFFFFF" opacity="0.18" />
        </svg>
      )}
    </div>
  );
};
