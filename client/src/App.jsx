import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Receipt, Users, Gift, Eye, 
  Wrench, Sun, FileSpreadsheet, Settings, LogOut, Menu, X, Bell
} from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewBill = lazy(() => import('./pages/NewBill'));
const Customers = lazy(() => import('./pages/Customers'));
const Referrals = lazy(() => import('./pages/Referrals'));
const Inventory = lazy(() => import('./pages/Inventory'));
const EyeTest = lazy(() => import('./pages/EyeTest'));
const Repairs = lazy(() => import('./pages/Repairs'));
const SunglassesBilling = lazy(() => import('./pages/SunglassesBilling'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));

import { getOfflineBills, deleteOfflineBill } from './utils/offlineStore';
import { FeatureProvider, useFeatures } from './context/FeatureContext';

const LoadingFallback = () => (
  <div className="flex h-full items-center justify-center p-12">
    <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function Layout({ user, tenant, onLogout, toast, showToast, stores = [], activeStore = 'all', setActiveStore = () => {}, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'New Bill', path: '/new-bill', icon: Receipt, featureKey: 'billing' },
    { name: 'Customers', path: '/customers', icon: Users, featureKey: 'customer_management' },
    { name: 'Referrals', path: '/referrals', icon: Gift, featureKey: 'referral_system' },
    { name: 'Products & Inventory', path: '/inventory', icon: Eye, featureKey: 'inventory' },
    { name: 'Eye Test', path: '/eye-test', icon: Eye, featureKey: 'eye_test' },
    { name: 'Repair Orders', path: '/repairs', icon: Wrench, featureKey: 'repair_orders' },
    { name: 'Sunglasses Billing', path: '/sunglasses', icon: Sun, featureKey: 'sunglasses_billing' },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet, featureKey: 'reports' },
    { name: 'Settings', path: '/settings', icon: Settings, ownerOnly: true },
  ];

  const { hasFeature } = useFeatures();

  // Filter based on tenant feature toggles
  if (tenant) {
    menuItems = menuItems.filter(item => {
      if (item.featureKey && !hasFeature(item.featureKey)) return false;
      return true;
    });
  }

  const handleNav = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-darkBg text-gray-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-darkSurface border-r border-white/5 shrink-0 z-30">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gold to-gold-light flex items-center justify-center font-bold text-darkBg text-lg shadow-lg shadow-gold/15">
              EV
            </div>
            <div>
              <h1 className="font-extrabold text-white leading-tight tracking-wider text-base">{tenant?.business_name ? tenant.business_name.toUpperCase() : 'POS SYSTEM'}</h1>
              <span className="text-[10px] text-gold font-semibold uppercase tracking-wider">Store POS v1.0</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const roleStr = String(user?.role || '').trim().toUpperCase();
            if (item.ownerOnly && roleStr !== 'OWNER') return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.name}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-gold/10 to-gold/5 border-l-2 border-gold text-gold font-bold shadow-md shadow-gold/5' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile details in sidebar footer */}
        <div className="p-4 border-t border-white/5 bg-darkCard/50 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase text-sm shrink-0">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-white truncate">{user.name || 'User'}</h4>
              <span className="text-xs text-gray-500 capitalize">{user.role}</span>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-white/5 bg-darkSurface/50 backdrop-blur-md flex items-center justify-between px-6 z-20">
          <div className="flex items-center space-x-4 lg:space-x-0">
            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-tr from-gold to-gold-light flex items-center justify-center font-bold text-darkBg text-sm">
              EV
            </div>
            <h2 className="text-lg font-bold text-white capitalize hidden md:block">
              {menuItems.find(item => item.path === location.pathname)?.name || 'POS System'}
            </h2>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {tenant?.status === 'TRIAL' && (
              <div className="hidden md:flex px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs text-gold font-bold items-center space-x-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-gold"></span>
                <span>TRIAL MODE</span>
              </div>
            )}
            
            {stores.length > 0 && (
              <select
                value={activeStore}
                onChange={(e) => setActiveStore(e.target.value)}
                disabled={!(String(user.role).trim().toUpperCase() === 'OWNER' || user.cross_store_read)}
                className="bg-gold/10 border border-gold/30 rounded-xl px-2 md:px-3 py-1.5 text-xs text-gold focus:outline-none focus:border-gold transition-all cursor-pointer font-bold shadow-lg shadow-gold/5 max-w-[120px] md:max-w-xs truncate appearance-none"
                style={{ WebkitAppearance: 'none', paddingRight: '1rem' }}
              >
                {(String(user.role).trim().toUpperCase() === 'OWNER' || user.cross_store_read) && <option value="all" className="bg-darkBg text-white">All Locations</option>}
                {stores.map(s => (
                  <option key={s.store_id} value={s.store_id} className="bg-darkBg text-white">{s.store_name}</option>
                ))}
              </select>
            )}
            <div className="hidden md:flex px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-gray-400 items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Online Terminal</span>
            </div>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-darkBg pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Collapsible Mobile Navigation Bar (Bottom) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-darkSurface border-t border-white/5 flex items-center justify-around px-2 z-30 pb-safe">
          {menuItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => handleNav(item.path)}
                className={`flex flex-col items-center justify-center w-14 h-full space-y-0.5 text-[10px] font-medium transition-all ${
                  isActive ? 'text-gold font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate w-full text-center">{item.name.split(' ')[0]}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-14 h-full space-y-0.5 text-[10px] font-medium text-gray-400"
          >
            <Menu className="w-5 h-5" />
            <span>More</span>
          </button>
        </nav>

        {/* Mobile Full Screen Menu Modal */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-darkBg/95 backdrop-blur-lg flex flex-col p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-gold to-gold-light flex items-center justify-center font-bold text-darkBg text-sm">
                  EV
                </div>
                <span className="font-bold text-white">MAIN MENU</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {menuItems.map((item) => {
                if (item.ownerOnly && String(user.role).toUpperCase() !== 'OWNER') return null;
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl text-base font-semibold ${
                      isActive ? 'bg-gold/10 text-gold border-l-4 border-gold' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-6 mt-6 flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold text-sm">{user.name || 'User'}</h4>
                <p className="text-gray-500 text-xs capitalize">{user.role}</p>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Toast Notification Box */}
      {showToast && toast && (
        <div className="fixed bottom-20 lg:bottom-8 right-6 z-50 animate-slide-up max-w-sm w-full">
          <div className="p-4 bg-darkCard border border-gold/30 rounded-2xl shadow-2xl glow-gold/10 flex items-start space-x-3 glass-card">
            <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1">
              <h5 className="font-bold text-white text-sm">System Update</h5>
              <p className="text-xs text-gray-300 mt-1">{toast.message}</p>
              {toast.waLink && (
                <a
                  href={toast.waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-[10px] transition-all"
                >
                  Send Invoice WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/v1/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then(data => {
          setUser(data.user);
          if (data.tenant) setTenant(data.tenant);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (user && token && user.role !== 'SUPERADMIN') {
      fetch('/api/v1/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setStores(data);
            if (String(user.role).trim().toUpperCase() === 'EMPLOYEE') {
              setActiveStore(user.store_id || 'store-main');
            } else {
              setActiveStore('all');
            }
          }
        })
        .catch(err => console.error('Failed to load stores:', err));
    } else {
      setStores([]);
      setActiveStore('all');
    }
  }, [user]);

  const syncOfflineBills = async () => {
    try {
      const offlineBills = await getOfflineBills();
      if (offlineBills.length === 0) return;

      triggerToast(`🔄 Connection restored! Syncing ${offlineBills.length} offline bills...`);
      const token = localStorage.getItem('token');
      if (!token) return;

      for (const bill of offlineBills) {
        try {
          const res = await fetch('/api/v1/bills', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bill)
          });
          if (res.ok) {
            await deleteOfflineBill(bill.offline_id);
          }
        } catch (err) {
          console.error('Failed to sync offline bill:', err);
        }
      }
      triggerToast('✅ All offline bills successfully synchronized!');
    } catch (e) {
      console.error('Offline sync failed:', e);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      syncOfflineBills();
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine && user && user.role !== 'SUPERADMIN') {
      handleOnline();
    }
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

  const triggerToast = (message, waLink = null) => {
    setToast({ message, waLink });
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 8000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTenant(null);
  };

  const handleLoginSuccess = (u, t) => {
    setUser(u);
    if (t) setTenant(t);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-darkBg flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-500 font-bold text-sm tracking-widest animate-pulse">LOADING SYSTEM...</span>
        </div>
      </div>
    );
  }

  // Not logged in routing
  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/super-admin" element={<SuperAdminLogin onLoginSuccess={handleLoginSuccess} />} />
            <Route path="*" element={<Login onLoginSuccess={handleLoginSuccess} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // Super Admin routing
  if (user.role === 'SUPERADMIN') {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/super-admin/*" element={<SuperAdminDashboard user={user} onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // Regular POS layout routing
  return (
    <BrowserRouter>
      <FeatureProvider tenant={tenant}>
        <Layout 
          user={user} 
          tenant={tenant} 
          onLogout={handleLogout}
          toast={toast}
          showToast={showToast}
          stores={stores}
          activeStore={activeStore}
          setActiveStore={setActiveStore}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} tenant={tenant} activeStore={activeStore} triggerToast={triggerToast} />} />
              <Route path="/new-bill" element={<NewBill tenant={tenant} activeStore={activeStore} user={user} triggerToast={triggerToast} />} />
              <Route path="/customers" element={<Customers activeStore={activeStore} triggerToast={triggerToast} />} />
              <Route path="/referrals" element={<Referrals activeStore={activeStore} triggerToast={triggerToast} />} />
              <Route path="/inventory" element={<Inventory activeStore={activeStore} triggerToast={triggerToast} user={user} stores={stores} />} />
              <Route path="/eye-test" element={<EyeTest activeStore={activeStore} triggerToast={triggerToast} />} />
              <Route path="/repairs" element={<Repairs activeStore={activeStore} triggerToast={triggerToast} user={user} />} />
              <Route path="/sunglasses" element={<SunglassesBilling tenant={tenant} activeStore={activeStore} user={user} triggerToast={triggerToast} />} />
              <Route path="/reports" element={<Reports user={user} activeStore={activeStore} stores={stores} triggerToast={triggerToast} />} />
              <Route path="/settings" element={(String(user?.role || '').trim().toUpperCase() === 'OWNER') ? <SettingsPage user={user} stores={stores} setStores={setStores} triggerToast={triggerToast} /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Layout>
      </FeatureProvider>
    </BrowserRouter>
  );
}
