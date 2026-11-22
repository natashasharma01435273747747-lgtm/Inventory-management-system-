export type UserRole = 'Admin' | 'Employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
}

export type ProductCategory =
  | 'Grocery'
  | 'Snacks'
  | 'Drinks'
  | 'Dairy'
  | 'Personal Care';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Grocery',
  'Snacks',
  'Drinks',
  'Dairy',
  'Personal Care',
];

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  mrp?: number;
  discount?: number;
  image?: string;
  costPrice: number;
  stock: number;
  minStock: number;
  expiryDate: string; // YYYY-MM-DD
  supplier: string;
  avgDailySales: number;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card';

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  category: ProductCategory;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  customerName: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  gstAmount: number;
  discount: number;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
}

export interface PurchaseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  productId: string;
  productName: string;
  category: ProductCategory;
  supplier: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  recordedBy: string;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity & Utilities'
  | 'Staff Salary'
  | 'Supplier Delivery'
  | 'Store Maintenance'
  | 'Miscellaneous';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity & Utilities',
  'Staff Salary',
  'Supplier Delivery',
  'Store Maintenance',
  'Miscellaneous',
];

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod | 'Bank Transfer';
  notes?: string;
}

export type EmployeeShift = 'Morning' | 'Evening' | 'Full Day';
export type EmployeeStatus = 'Active' | 'On Leave';

export interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleTitle: string;
  shift: EmployeeShift;
  monthlySalary: number;
  status: EmployeeStatus;
  joinedDate: string; // YYYY-MM-DD
}

export type AdjustmentReasonType =
  | 'Damaged / Spoiled'
  | 'Restock Received'
  | 'Shelf Count Correction'
  | 'Expired Write-off';

export const ADJUSTMENT_REASON_TYPES: AdjustmentReasonType[] = [
  'Damaged / Spoiled',
  'Restock Received',
  'Shelf Count Correction',
  'Expired Write-off',
];

export type AdjustmentStatus = 'Pending' | 'Approved' | 'Rejected';

export interface StockAdjustmentRequest {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  requestedDelta: number;
  reasonType: AdjustmentReasonType;
  notes: string;
  requestedBy: string;
  requestedAt: string; // ISO timestamp
  status: AdjustmentStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface StoreSnapshot {
  products: Product[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  expenses: ExpenseRecord[];
  employees: EmployeeRecord[];
  adjustments: StockAdjustmentRequest[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface PublicCatalogProduct {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  available: boolean;
}

export interface PublicCatalogResponse {
  storeName: string;
  updatedAt: string;
  products: PublicCatalogProduct[];
}
