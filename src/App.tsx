import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  QrCode,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  createEmployee,
  createExpense,
  createProduct,
  createSale,
  deleteEmployee,
  deleteExpense,
  deleteProduct,
  fetchCurrentUser,
  fetchStoreSnapshot,
  getStoredToken,
  logoutSession,
  migrateAndSanitizeStorage,
  restockProduct,
  reviewStockAdjustment,
  setStoredToken,
  submitStockAdjustment,
  updateEmployee,
  updateProduct,
} from './api/client.ts';
import type {
  CreateAdjustmentInput,
  CreateExpenseInput,
  CreateSaleInput,
  EmployeeInput,
  ProductInput,
} from './api/client.ts';
import type { AuthUser, SaleRecord, StoreSnapshot } from './types/store.ts';
import { computeDashboardMetrics } from './utils/storeMetrics.ts';
import { AdminOverview } from './components/AdminOverview.tsx';
import { ApprovalsManager } from './components/ApprovalsManager.tsx';
import { AssistantPanel } from './components/AssistantPanel.tsx';
import { AuthPage } from './components/AuthPage.tsx';
import { CustomerCatalogPage } from './components/CustomerCatalogPage.tsx';
import { EmployeesManager } from './components/EmployeesManager.tsx';
import { EmployeeStockView } from './components/EmployeeStockView.tsx';
import { ExpensesManager } from './components/ExpensesManager.tsx';
import { InventoryManager } from './components/InventoryManager.tsx';
import { PosBilling } from './components/PosBilling.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { StoreBarcodeModal } from './components/StoreBarcodeModal.tsx';

function isCustomerViewFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if ((params.get('view') || '').toLowerCase() === 'customer') {
    return true;
  }
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/customer') {
    return true;
  }
  const hash = window.location.hash.toLowerCase();
  return hash === '#customer' || hash.includes('view=customer');
}

interface NavItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

const BrandCartMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 40 36" fill="none" className={className} aria-hidden="true">
    {/* Green Upward Chart Arrow */}
    <path
      d="M11 16.5 L17.5 11.5 L21.5 14 L30 6.5"
      stroke="#22E574"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M25.5 6 H30.5 V11"
      stroke="#22E574"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Crisp White Shopping Cart */}
    <path
      d="M3.5 8 H8.5 L12 24.5 C12.4 26 13.7 27 15.2 27 H31.5 L34.5 14 H12"
      stroke="#FFFFFF"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="15.5" cy="32" r="2.6" fill="#FFFFFF" />
    <circle cx="29" cy="32" r="2.6" fill="#FFFFFF" />
  </svg>
);

export function App() {
  const [isCustomerView, setIsCustomerView] = useState<boolean>(isCustomerViewFromUrl);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(() => !isCustomerViewFromUrl());
  const [store, setStore] = useState<StoreSnapshot | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<SaleRecord | null>(null);

  const openCustomerView = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'customer');
    url.hash = '';
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setIsCustomerView(true);
  }, []);

  const exitCustomerView = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.hash = '';
    const cleanPath =
      url.pathname.replace(/\/+$/, '').toLowerCase() === '/customer' ? '/' : url.pathname;
    const next = `${cleanPath}${url.search}`;
    window.history.pushState({}, '', next || '/');
    setIsCustomerView(false);
  }, []);

  useEffect(() => {
    const syncFromUrl = () => setIsCustomerView(isCustomerViewFromUrl());
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  const loadStore = useCallback(async () => {
    setStoreLoading(true);
    setLoadError(null);
    try {
      const snapshot = await fetchStoreSnapshot();
      setStore(snapshot);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load store data.');
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCustomerView) {
      setAuthChecking(false);
      return;
    }
    let active = true;
    const bootstrap = async () => {
      migrateAndSanitizeStorage();
      const token = getStoredToken();
      if (!token) {
        if (active) setAuthChecking(false);
        return;
      }
      try {
        const { user: currentUser } = await fetchCurrentUser();
        if (!active) return;
        setUser(currentUser);
        setActiveTab(currentUser.role === 'Admin' ? 'overview' : 'pos');
        await loadStore();
      } catch {
        setStoredToken(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, [isCustomerView, loadStore]);

  const handleAuthenticated = async (signedInUser: AuthUser) => {
    setUser(signedInUser);
    setActiveTab(signedInUser.role === 'Admin' ? 'overview' : 'pos');
    setAssistantOpen(false);
    await loadStore();
  };

  const handleLogout = async () => {
    await logoutSession();
    setUser(null);
    setStore(null);
    setAssistantOpen(false);
    setBarcodeModalOpen(false);
    setActiveReceipt(null);
    setMobileMenuOpen(false);
  };

  const pendingApprovalsCount = useMemo(
    () =>
      store && Array.isArray(store.adjustments)
        ? store.adjustments.filter((a) => a?.status === 'Pending').length
        : 0,
    [store]
  );

  const metrics = useMemo(() => {
    if (!store) return null;
    return computeDashboardMetrics(store.products, store.sales, store.expenses);
  }, [store]);

  const navItems: NavItem[] = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Admin') {
      return [
        {
          id: 'overview',
          label: 'Overview',
          subtitle: 'Live Store Metrics & Smart Alerts',
          icon: LayoutDashboard,
        },
        {
          id: 'pos',
          label: 'POS Billing',
          subtitle: 'Fast & Easy Billing',
          icon: ShoppingCart,
        },
        {
          id: 'inventory',
          label: 'Inventory & Products',
          subtitle: 'Manage Pricing, Stock & Expiry',
          icon: Package,
        },
        {
          id: 'reports',
          label: 'Sales & Purchases',
          subtitle: 'Invoices & Supplier Restocks',
          icon: BarChart3,
        },
        {
          id: 'expenses',
          label: 'Expenses',
          subtitle: 'Track Store Operating Costs',
          icon: Wallet,
        },
        {
          id: 'employees',
          label: 'Employees',
          subtitle: 'Staff Roster & Shifts',
          icon: Users,
        },
        {
          id: 'approvals',
          label: 'Approvals',
          subtitle: 'Review Employee Stock Requests',
          icon: CheckSquare,
          count: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
        },
      ];
    }
    return [
      {
        id: 'pos',
        label: 'POS Billing',
        subtitle: 'Fast & Easy Billing',
        icon: ShoppingCart,
      },
      {
        id: 'stock',
        label: 'Stock & Requests',
        subtitle: 'Check Availability & Request Updates',
        icon: ClipboardList,
        count:
          metrics && metrics.lowStockProducts.length > 0
            ? metrics.lowStockProducts.length
            : undefined,
      },
      {
        id: 'bills',
        label: 'Recent Bills',
        subtitle: 'Today’s Customer Receipts',
        icon: Receipt,
      },
    ];
  }, [user, pendingApprovalsCount, metrics]);

  const activeNav = navItems.find((n) => n.id === activeTab) ?? navItems[0];
  const ActiveNavIcon = activeNav?.id === 'pos' ? Receipt : (activeNav?.icon ?? Receipt);

  const alertBadgeCount =
    user?.role === 'Admin'
      ? pendingApprovalsCount + (metrics?.lowStockProducts.length ?? 0)
      : (metrics?.lowStockProducts.length ?? 0);

  // ---- Store Mutations ----

  const handleAddProduct = async (input: ProductInput) => {
    const res = await createProduct(input);
    setStore(res.store);
  };

  const handleUpdateProduct = async (id: string, input: ProductInput) => {
    const res = await updateProduct(id, input);
    setStore(res.store);
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await deleteProduct(id);
    setStore(res.store);
  };

  const handleRestockProduct = async (id: string, quantity: number) => {
    const res = await restockProduct(id, quantity);
    setStore(res.store);
  };

  const handleGenerateBill = async (input: CreateSaleInput): Promise<SaleRecord> => {
    const res = await createSale(input);
    setStore(res.store);
    return res.sale;
  };

  const handleAddExpense = async (input: CreateExpenseInput) => {
    const res = await createExpense(input);
    setStore(res.store);
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await deleteExpense(id);
    setStore(res.store);
  };

  const handleAddEmployee = async (input: EmployeeInput) => {
    const res = await createEmployee(input);
    setStore(res.store);
  };

  const handleUpdateEmployee = async (id: string, input: Partial<EmployeeInput>) => {
    const res = await updateEmployee(id, input);
    setStore(res.store);
  };

  const handleDeleteEmployee = async (id: string) => {
    const res = await deleteEmployee(id);
    setStore(res.store);
  };

  const handleSubmitAdjustment = async (input: CreateAdjustmentInput) => {
    const res = await submitStockAdjustment(input);
    setStore(res.store);
  };

  const handleReviewAdjustment = async (
    id: string,
    decision: 'Approved' | 'Rejected',
    reviewNote?: string
  ) => {
    const res = await reviewStockAdjustment(id, decision, reviewNote);
    setStore(res.store);
  };

  if (isCustomerView) {
    return <CustomerCatalogPage onBackToLogin={exitCustomerView} />;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EDF3FF] to-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-medium text-[#475569]">Loading SmartStock AI...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={handleAuthenticated}
        onOpenCustomerCatalog={openCustomerView}
      />
    );
  }

  const safeUserName =
    typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Store User';
  const userInitials =
    safeUserName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SS';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white/95 backdrop-blur-md border-r border-[#DCE6FA]">
      {/* Sidebar Brand */}
      <div className="h-[72px] px-5 border-b border-[#E6EEFC] flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0B1437] flex items-center justify-center shrink-0 shadow-xs">
            <BrandCartMark className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold tracking-tight leading-none whitespace-nowrap">
              <span className="text-[#0B1736]">SmartStock </span>
              <span className="text-[#0EA66C]">AI</span>
            </div>
            <p className="text-[10.5px] text-[#5B6E94] mt-0.5 truncate">
              Smart Inventory. Smarter Business.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#0052FF] text-white shadow-[0_6px_16px_rgba(0,82,255,0.28)]'
                  : 'text-[#334155] hover:bg-[#EEF4FF] hover:text-[#0B1736]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-white' : 'text-[#5B6E94]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`font-mono tabular-nums text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-md ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="p-4 border-t border-[#E6EEFC] bg-[#F6F9FF] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#0052FF] text-white font-display text-xs font-bold flex items-center justify-center shrink-0">
          {userInitials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#0B1736] truncate">{user.name}</p>
          <p className="text-xs text-[#5B6E94] truncate">
            {user.role} · {user.designation}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF2FF] via-[#F3F7FF] to-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-[#0B1736]/45">
          <div className="w-72 max-w-[82vw] h-full">{sidebarContent}</div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top App Brand Header (Matches Reference Image) */}
        <header className="sticky top-0 z-30 bg-[#EDF3FF]/90 backdrop-blur-md border-b border-[#DCE6FA]/80">
          <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            {/* Left: Menu + Dark-Blue Square Cart/Chart Logo + SmartStock AI */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-xl text-[#0B1736] hover:bg-white/70 cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0B1437] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(11,20,55,0.22)]">
                  <BrandCartMark className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg sm:text-xl font-bold tracking-tight leading-none whitespace-nowrap">
                    <span className="text-[#0B1736]">SmartStock </span>
                    <span className="text-[#0EA66C]">AI</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#3F537A] mt-0.5 truncate">
                    Smart Inventory. Smarter Business.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Admin Store Customer Barcode + Alerts Bell + User Avatar */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {user.role === 'Admin' && (
                <button
                  type="button"
                  onClick={() => setBarcodeModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-[#D4E2FC] bg-white hover:bg-[#F5F8FF] text-[#0B1736] text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <QrCode className="w-4 h-4 text-[#0052FF] shrink-0" />
                  <span className="hidden sm:inline">Store Customer Barcode</span>
                  <span className="sm:hidden">Store QR</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setActiveTab(user.role === 'Admin' ? 'approvals' : 'stock')
                }
                aria-label="View stock and approval alerts"
                className="relative w-10 h-10 rounded-full bg-white border border-[#DCE6FA] hover:border-[#BFD4FF] flex items-center justify-center text-[#0B1736] shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <Bell className="w-[18px] h-[18px]" />
                {alertBadgeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white font-mono tabular-nums text-[10px] font-bold flex items-center justify-center">
                    {alertBadgeCount}
                  </span>
                )}
              </button>

              <div
                title={`${user.name} (${user.role})`}
                className="hidden sm:flex w-10 h-10 rounded-full bg-gradient-to-br from-[#0B1437] to-[#0052FF] text-white font-display text-xs font-bold items-center justify-center border-2 border-white shadow-xs shrink-0"
              >
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Action Bar Directly Below Header (Matches Reference Image) */}
        <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-3.5">
          <div className="bg-white/90 backdrop-blur-md border border-[#DCE6FA] rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-[0_6px_22px_rgba(15,42,107,0.06)] flex flex-wrap items-center justify-between gap-3">
            {/* Left: Soft Blue Icon + Active Page Title & Subtitle */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#E8F0FF] text-[#0052FF] flex items-center justify-center shrink-0">
                <ActiveNavIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold text-[#0B1736] leading-tight truncate">
                  {activeNav?.label ?? 'POS Billing'}
                </h1>
                <p className="text-xs text-[#5B6E94] truncate">
                  {activeNav?.subtitle ?? 'Fast & Easy Billing'}
                </p>
              </div>
            </div>

            {/* Right: Glowing Emerald-Green Pill "Gemini Assistant" + Clean White "Logout" */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="px-4 sm:px-5 py-2.5 rounded-full bg-gradient-to-r from-[#05B870] via-[#0A9F82] to-[#0B7CA8] hover:brightness-105 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-[0_8px_22px_rgba(5,184,112,0.34)] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>Gemini Assistant</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-white hover:bg-[#F5F8FF] border border-[#DCE6FA] text-[#0B1736] text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Viewport */}
        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-[1440px] w-full mx-auto">
          {storeLoading && !store ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-24 bg-white border border-slate-100 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white border border-slate-100 rounded-2xl animate-pulse" />
            </div>
          ) : loadError ? (
            <div className="bg-white border border-red-200 rounded-2xl p-6 text-sm text-red-700 flex items-center justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={loadStore}
                className="px-4 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : store ? (
            <>
              {user.role === 'Admin' && activeTab === 'overview' && (
                <AdminOverview
                  store={store}
                  onNavigateTab={setActiveTab}
                  onQuickRestock={handleRestockProduct}
                  onOpenAssistant={() => setAssistantOpen(true)}
                />
              )}

              {user.role === 'Admin' && activeTab === 'inventory' && (
                <InventoryManager
                  products={store.products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onRestockProduct={handleRestockProduct}
                />
              )}

              {activeTab === 'pos' && (
                <PosBilling
                  products={store.products}
                  onGenerateBill={handleGenerateBill}
                  onViewReceipt={setActiveReceipt}
                />
              )}

              {user.role === 'Admin' && activeTab === 'reports' && (
                <ReportsView
                  sales={store.sales}
                  purchases={store.purchases}
                  onViewReceipt={setActiveReceipt}
                />
              )}

              {user.role === 'Admin' && activeTab === 'expenses' && (
                <ExpensesManager
                  expenses={store.expenses}
                  onAddExpense={handleAddExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {user.role === 'Admin' && activeTab === 'employees' && (
                <EmployeesManager
                  employees={store.employees}
                  onAddEmployee={handleAddEmployee}
                  onUpdateEmployee={handleUpdateEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                />
              )}

              {user.role === 'Admin' && activeTab === 'approvals' && (
                <ApprovalsManager
                  adjustments={store.adjustments}
                  products={store.products}
                  onReview={handleReviewAdjustment}
                />
              )}

              {user.role === 'Employee' && activeTab === 'stock' && (
                <EmployeeStockView
                  products={store.products}
                  adjustments={store.adjustments}
                  onSubmitAdjustment={handleSubmitAdjustment}
                />
              )}

              {user.role === 'Employee' && activeTab === 'bills' && (
                <ReportsView
                  sales={store.sales}
                  purchases={[]}
                  onViewReceipt={setActiveReceipt}
                  employeeMode
                />
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Gemini AI Assistant Slide-Over */}
      <AssistantPanel
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        userRole={user.role}
        lowStockCount={metrics?.lowStockProducts.length ?? 0}
        expiringCount={metrics?.expiringSoonProducts.length ?? 0}
        products={store?.products ?? []}
        sales={store?.sales ?? []}
        expenses={store?.expenses ?? []}
      />

      {/* Printable Invoice Receipt Modal */}
      <ReceiptModal
        sale={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      {/* Single Store Customer Barcode & QR Counter Card Modal */}
      {user.role === 'Admin' && (
        <StoreBarcodeModal
          isOpen={barcodeModalOpen}
          onClose={() => setBarcodeModalOpen(false)}
          onPreviewCustomerPage={openCustomerView}
        />
      )}
    </div>
  );
}

export default App;
