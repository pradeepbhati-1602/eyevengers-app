import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Receipt, Landmark, 
  AlertTriangle, Cake, CheckSquare, Sparkles, MessageCircle, PhoneCall, Shield 
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { useFeatures } from '../context/FeatureContext';

export default function Dashboard({ user, tenant, activeStore, triggerToast }) {
  const { hasFeature } = useFeatures();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [birthdays, setBirthdays] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [repairsList, setRepairsList] = useState([]);
  const [undeliveredList, setUndeliveredList] = useState([]);

  // Dues modal states
  const [showDuesModal, setShowDuesModal] = useState(false);
  const [duesBills, setDuesBills] = useState([]);
  const [duesSearch, setDuesSearch] = useState('');
  const [loadingDues, setLoadingDues] = useState(false);

  // Handover template selection state
  const [selectedHandover, setSelectedHandover] = useState(null);

  // Warranty modal states
  const [showWarrantiesModal, setShowWarrantiesModal] = useState(false);
  const [warrantiesList, setWarrantiesList] = useState([]);
  const [loadingWarranties, setLoadingWarranties] = useState(false);
  const [warrantiesSearch, setWarrantiesSearch] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [activeStore]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch all APIs concurrently using Promise.all
      const [res, resD, resB, resL, resR, resU] = await Promise.all([
        fetch(`/api/v1/dashboard?store_id=${activeStore}`, { headers }),
        fetch(`/api/v1/dashboard/due-payments`, { headers }),
        fetch('/api/v1/customers/birthdays', { headers }),
        fetch(`/api/v1/products/low-stock?store_id=${activeStore}`, { headers }),
        fetch(`/api/v1/repairs?store_id=${activeStore}`, { headers }),
        fetch(`/api/v1/dashboard/undelivered`, { headers })
      ]);

      const [
        dashboardData, duesData, birthdaysData, lowStockData, repairsData, undeliveredData
      ] = await Promise.all([
        res.json(), resD.json(), resB.json(), resL.json(), resR.json(), resU.json()
      ]);

      setData(dashboardData);
      setDuesBills(Array.isArray(duesData) ? duesData : []);
      setBirthdays(Array.isArray(birthdaysData) ? birthdaysData : []);
      setLowStockList(Array.isArray(lowStockData) ? lowStockData : []);
      
      const readyRepairs = Array.isArray(repairsData) ? repairsData.filter(r => r.repair_status === 'Ready' && r.delivery_status !== 'Delivered') : [];
      setRepairsList(readyRepairs);
      
      setUndeliveredList(Array.isArray(undeliveredData) ? undeliveredData : []);

    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (id, invoiceNumber) => {
    if (!window.confirm(`Mark bill ${invoiceNumber} as delivered and hand over spectacles?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/bills/${id}/deliver`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) {
        triggerToast(`✅ Spectacles for ${invoiceNumber} marked as delivered`);
        fetchDashboardData();
        setSelectedHandover({
          billId: invoiceNumber,
          customerName: resData.customer ? resData.customer.name : 'Client',
          waLinkEn: resData.waLinkEn,
          waLinkHi: resData.waLinkHi
        });
      } else {
        alert(resData.error || 'Failed to update delivery status');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating delivery');
    }
  };

  const fetchWarranties = async () => {
    setLoadingWarranties(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/bills/warranty-expirations?store_id=${activeStore}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setWarrantiesList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWarranties(false);
    }
  };

  const sendWarrantyReminder = (bill) => {
    const text = `Hi *${bill.customer_name}*, the warranty for your spectacles (Invoice *${bill.bill_id}*) is expiring soon on *${new Date(bill.warranty_expiry_date).toLocaleDateString()}*. Drop by our store for a free frame adjustment checkup!`;
    const waLink = `https://api.whatsapp.com/send?phone=91${bill.customer_mobile}&text=${encodeURIComponent(text)}`;
    window.open(waLink, '_blank');
  };

  const fetchDuesBills = async () => {
    setLoadingDues(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/dashboard/due-payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDuesBills(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDues(false);
    }
  };

  useEffect(() => {
    if (showDuesModal) {
      fetchDuesBills();
    }
  }, [showDuesModal, activeStore]);

  const handleCollectPayment = async (id, invoiceNumber, dueAmount) => {
    if (!window.confirm(`Are you sure you want to mark Bill ${invoiceNumber} (₹${dueAmount}) as fully paid?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/bills/${id}/collect-payment`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        triggerToast(`✅ Payment of ₹${dueAmount} collected for ${invoiceNumber}`);
        fetchDashboardData();
        fetchDuesBills();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to collect payment');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating payment status');
    }
  };

  const sendDueReminder = (bill) => {
    const msg = `Dear *${bill.customer_name}*, this is a friendly reminder that an outstanding amount of ${formatCurrency(bill.due_amount)} is pending for your invoice *${bill.bill_id}* at ${tenant?.business_name || 'our store'}. Please clear it at your convenience. Thank you!`;
    const link = `https://wa.me/91${bill.customer_mobile}?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-white/5 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-3xl animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 lg:col-span-2 bg-white/5 rounded-3xl animate-pulse"></div>
          <div className="h-80 bg-white/5 rounded-3xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500 animate-bounce" />
        <h3 className="text-xl font-bold text-white">Dashboard Load Error</h3>
        <p className="text-gray-400 text-sm max-w-md text-center">{data.error}</p>
        <button 
          onClick={fetchDashboardData}
          className="px-6 py-2 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-bold rounded-xl text-sm transition-all shadow-lg shadow-gold/10"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { metrics, charts } = data || {};
  if (!metrics || !charts) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h3 className="text-xl font-bold text-white">Missing Dashboard Metrics</h3>
        <p className="text-gray-400 text-sm">The server did not return complete performance metrics.</p>
        <button 
          onClick={fetchDashboardData}
          className="px-6 py-2 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-bold rounded-xl text-sm transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const PIE_COLORS = ['#3B82F6', '#D4AF37', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const sendBirthdayWish = (customer, lang) => {
    let msg = '';
    if (lang === 'en') {
      msg = `Dear *${customer.name}*, ${tenant?.business_name || 'Our store'} wishes you a very Happy Birthday! 🎂 We hope your day is filled with joy. As a special gift, get 10% off on your next purchase. Show this message at store.`;
    } else {
      msg = `प्रिय *${customer.name}*, ${tenant?.business_name || 'Our store'} की तरफ से आपको जन्मदिन की ढेर सारी शुभकामनाएं! 🎂 इस खास मौके पर हमारी तरफ से आपको विशेष उपहार - अपने अगले चश्मे पर 10% की छूट पाएं।`;
    }
    const link = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(msg)}`;
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back, {user?.name ? user.name.split(' ')[0] : 'User'}</h1>
        <p className="text-gray-400 mt-1">Here is how your store is performing today.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        {/* Card 1 */}
        {hasFeature('today_sales') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 hover:border-gold/20 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gold/5 blur-2xl group-hover:bg-gold/10 transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
              <Landmark className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-gold/10 text-gold px-2.5 py-1 rounded-full font-bold uppercase">Today</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Today's Revenue</h4>
            <h3 className="text-2xl font-black text-white mt-1">₹{metrics.today.revenue.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-gray-500 mt-1">{metrics.today.bills} bills generated</p>
          </div>
        </div>
        )}

        {/* Card 2 */}
        {hasFeature('monthly_sales') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 hover:border-electric/20 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-electric/5 blur-2xl group-hover:bg-electric/10 transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-electric/10 flex items-center justify-center text-electric">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-electric/10 text-electric px-2.5 py-1 rounded-full font-bold uppercase">This Month</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Monthly Revenue</h4>
            <h3 className="text-2xl font-black text-white mt-1">₹{metrics.monthly.revenue.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-gray-500 mt-1">{metrics.monthly.bills} transactions</p>
          </div>
        </div>
        )}

        {/* Card 3 */}
        {hasFeature('total_customers') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 blur-2xl transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-300">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2.5 py-1 rounded-full font-bold uppercase">Overall</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Customers</h4>
            <h3 className="text-2xl font-black text-white mt-1">{metrics.overall.customers}</h3>
            <p className="text-xs text-gray-500 mt-1">Overall database size</p>
          </div>
        </div>
        )}

        {/* Card 4 */}
        <div className="glass-card p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 blur-2xl transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-300">
              <Receipt className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2.5 py-1 rounded-full font-bold uppercase">Ticket Size</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Average Bill</h4>
            <h3 className="text-2xl font-black text-white mt-1">₹{Math.round(metrics.overall.avgBill).toLocaleString('en-IN')}</h3>
            <p className="text-xs text-gray-500 mt-1">From {metrics.overall.bills} overall bills</p>
          </div>
        </div>

        {/* Card 5 (Amount Due) */}
        {hasFeature('due_amount_card') && (
        <div 
          onClick={() => setShowDuesModal(true)}
          className="glass-card p-6 rounded-3xl border border-red-500/10 hover:border-red-500/30 transition-all duration-300 relative overflow-hidden group cursor-pointer animate-pulse"
        >
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-red-500/5 blur-2xl group-hover:bg-red-500/10 transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Landmark className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full font-bold uppercase">Pending Dues</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Amount Due (All Stores)</h4>
            <h3 className="text-2xl font-black text-red-400 mt-1">₹{metrics.alerts.totalDueAmount.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-gray-500 mt-1">{metrics.alerts.pendingDues} accounts outstanding</p>
          </div>
        </div>
        )}

        {/* Card 6 (Warranty Expirations) */}
        <div 
          onClick={() => {
            setShowWarrantiesModal(true);
            fetchWarranties();
          }}
          className="glass-card p-6 rounded-3xl border border-white/5 hover:border-gold/20 transition-all duration-300 relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gold/5 blur-2xl group-hover:bg-gold/10 transition-all"></div>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-gold/10 text-gold px-2.5 py-1 rounded-full font-bold uppercase">Warranties</span>
          </div>
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Expiring 30 Days</h4>
            <h3 className="text-2xl font-black text-white mt-1">{metrics.alerts.expiringWarranties}</h3>
            <p className="text-xs text-gray-500 mt-1">Click to view expirations</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      {(() => {
        const totalCategorySales = (charts.categorySplit || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        const totalTrendSales = (charts.revenueTrend || []).reduce((acc, curr) => acc + (Number(curr.sales) || 0), 0);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <div className="glass-card p-6 rounded-3xl border border-white/5 lg:col-span-2 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Revenue Trend (Last 7 Days)</h3>
                  <p className="text-xs text-gray-400">Daily optical sales tracking</p>
                </div>
                <div className="text-right bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] text-gray-400">7-Day Total: </span>
                  <span className="text-sm font-bold text-gold">₹{totalTrendSales.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="h-64 min-h-[240px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.revenueTrend || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      stroke="#9CA3AF" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => val >= 1000 ? `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `₹${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '14px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                      formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Sales']}
                      labelStyle={{ color: '#D4AF37', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#D4AF37" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#salesGradient)" 
                      dot={{ fill: '#0D0F14', stroke: '#D4AF37', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#D4AF37', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Share split */}
            <div className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Sales Split by Category</h3>
                  <p className="text-xs text-gray-400">Retail revenue breakdown</p>
                </div>
              </div>
              <div className="h-56 min-h-[210px] w-full relative">
                {(charts.categorySplit || []).length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.categorySplit}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={(charts.categorySplit || []).length > 1 ? 4 : 0}
                          dataKey="value"
                          stroke="#0D0F14"
                          strokeWidth={2}
                        >
                          {(charts.categorySplit || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                          contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total</span>
                      <span className="text-xs font-black text-white">₹{totalCategorySales.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-gray-500">No category sales recorded yet</p>
                  </div>
                )}
              </div>
              {/* Chart Legend */}
              <div className="mt-3 grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1">
                {(charts.categorySplit || []).map((item, index) => {
                  const pct = totalCategorySales > 0 ? Math.round((Number(item.value) / totalCategorySales) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                        <span className="text-[11px] text-gray-300 truncate">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 ml-1 shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Alerts Widgets panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Low Stock Alerts */}
        {hasFeature('low_stock_alert') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Low Stock Alerts</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">{lowStockList.length}</span>
          </div>

          <div className="flex-1 space-y-3 max-h-64 overflow-y-auto pr-1">
            {lowStockList.length > 0 ? (
              lowStockList.map(item => (
                <div key={item.product_id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white leading-snug">{item.brand} — {item.frame_name}</h5>
                    <span className="text-[10px] text-gray-500 capitalize">{item.category} • Current Stock: <strong className="text-red-400">{item.current_stock}</strong></span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 font-bold uppercase">Reorder</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-8 h-8 text-gold opacity-30 mb-2" />
                <p className="text-xs text-gray-500">All products have sufficient stock levels.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Today's Birthdays */}
        {hasFeature('birthday_customers_card') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Cake className="w-5 h-5 text-gold" />
              <span>Today's Birthdays</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gold/10 text-gold rounded-full border border-gold/20">{birthdays.length}</span>
          </div>

          <div className="flex-1 space-y-3 max-h-64 overflow-y-auto pr-1">
            {birthdays.length > 0 ? (
              birthdays.map(customer => (
                <div key={customer.customer_id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white leading-snug">{customer.name}</h5>
                    <span className="text-[10px] text-gray-500">{customer.mobile}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button 
                      onClick={() => sendBirthdayWish(customer, 'en')}
                      className="p-1.5 hover:bg-white/5 text-gold rounded-lg transition-all"
                      title="Wish in English"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => sendBirthdayWish(customer, 'hi')}
                      className="p-1.5 hover:bg-white/5 text-electric rounded-lg transition-all font-bold text-xs"
                      title="Wish in Hindi"
                    >
                      हिं
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Cake className="w-8 h-8 text-gray-500 opacity-20 mb-2" />
                <p className="text-xs text-gray-500">No customer birthdays today.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Repairs Ready for Pickup */}
        {hasFeature('repair_orders') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-electric" />
              <span>Repairs Ready for Pickup</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-electric/10 text-electric rounded-full border border-electric/20">{repairsList.length}</span>
          </div>

          <div className="flex-1 space-y-3 max-h-64 overflow-y-auto pr-1">
            {repairsList.length > 0 ? (
              repairsList.map(rep => (
                <div key={rep.repair_id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white leading-snug">{rep.customer_name}</h5>
                    <span className="text-[10px] text-gray-500">{rep.frame_details} ({rep.repair_type})</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-extrabold text-white">{formatCurrency(rep.charges)}</span>
                    <span className="text-[8px] text-electric uppercase font-bold mt-0.5">Pickup Ready</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <CheckSquare className="w-8 h-8 text-gray-500 opacity-20 mb-2" />
                <p className="text-xs text-gray-500">No repair jobs ready for collection.</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Pending Handovers */}
        {hasFeature('pending_delivery_card') && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-gold" />
              <span>Pending Handovers (All Stores)</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gold/10 text-gold rounded-full border border-gold/20">{undeliveredList.length}</span>
          </div>

          <div className="flex-1 space-y-3 max-h-64 overflow-y-auto pr-1">
            {undeliveredList.length > 0 ? (
              undeliveredList.map(b => (
                <div key={b.bill_id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h5 className="text-xs font-bold text-white leading-snug truncate">{b.customer_name}</h5>
                      {b.store_name && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium shrink-0">
                          {b.store_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono block truncate">{b.bill_id} • {b.brand} {b.frame_name || 'Item'}</span>
                  </div>
                  <button
                    onClick={() => handleMarkDelivered(b.id, b.bill_id)}
                    className="ml-2 px-2.5 py-1.5 bg-gold text-darkBg font-bold rounded-lg text-[10px] transition-all hover:opacity-90 shrink-0 font-bold"
                  >
                    Deliver
                  </button>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-8 h-8 text-gold opacity-30 mb-2" />
                <p className="text-xs text-gray-500">All customer spectacles have been delivered.</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Dues List Modal */}
      {showDuesModal && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-card max-w-2xl w-full max-h-[85vh] flex flex-col p-6 rounded-3xl border border-white/10 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-red-400 animate-pulse" />
                <span>Outstanding Dues Accounts (All Stores)</span>
              </h3>
              <button 
                onClick={() => setShowDuesModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search pending bills by name, phone or bill ID..."
                value={duesSearch}
                onChange={(e) => setDuesSearch(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingDues ? (
                <div className="py-12 text-center text-xs text-gray-500 animate-pulse">LOADING OUTSTANDING ACCOUNTS...</div>
              ) : duesBills.length > 0 ? (
                duesBills
                  .filter(b => 
                    b.customer_name.toLowerCase().includes(duesSearch.toLowerCase()) ||
                    b.customer_mobile.includes(duesSearch) ||
                    b.bill_id.toLowerCase().includes(duesSearch.toLowerCase())
                  )
                  .map(b => (
                    <div key={b.bill_id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white leading-tight">{b.customer_name}</h4>
                          <span className="text-[10px] text-gray-500 font-mono">({b.customer_mobile})</span>
                          {b.store_name && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                              {b.store_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono block mt-1">Invoice: {b.bill_id} • Date: {new Date(b.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-left md:text-right">
                          <span className="text-xs text-gray-400 block uppercase font-bold tracking-wide">Due Amount</span>
                          <span className="text-base font-black text-red-400">{formatCurrency(b.due_amount)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <a 
                            href={`tel:${b.customer_mobile}`}
                            className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all"
                            title="Call Customer"
                          >
                            <PhoneCall className="w-4 h-4" />
                          </a>
                          <button 
                            onClick={() => sendDueReminder(b)}
                            className="p-2 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded-xl transition-all"
                            title="WhatsApp Reminder"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleCollectPayment(b.id, b.bill_id, b.due_amount)}
                            className="px-3 py-2 bg-gold text-darkBg font-bold rounded-xl text-xs hover:opacity-90 transition-all font-bold"
                          >
                            Mark Paid
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-xs text-gray-500">No outstanding dues accounts found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Warranties List Modal */}
      {showWarrantiesModal && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-card max-w-2xl w-full max-h-[85vh] flex flex-col p-6 rounded-3xl border border-white/10 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="text-lg font-black text-white flex items-center space-x-2">
                <Shield className="w-5 h-5 text-gold" />
                <span>Upcoming Warranty Expirations</span>
              </h3>
              <button 
                onClick={() => setShowWarrantiesModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search expiring warranties by name, phone or bill ID..."
                value={warrantiesSearch}
                onChange={(e) => setWarrantiesSearch(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingWarranties ? (
                <div className="py-12 text-center text-xs text-gray-500 animate-pulse">LOADING EXPIRING WARRANTIES...</div>
              ) : warrantiesList.length > 0 ? (
                warrantiesList
                  .filter(b => 
                    b.customer_name.toLowerCase().includes(warrantiesSearch.toLowerCase()) ||
                    b.customer_mobile.includes(warrantiesSearch) ||
                    b.bill_id.toLowerCase().includes(warrantiesSearch.toLowerCase())
                  )
                  .map(b => (
                    <div key={b.bill_id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white leading-tight">{b.customer_name}</h4>
                          <span className="text-[10px] text-gray-500 font-mono">({b.customer_mobile})</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono block mt-1">
                          Product: {b.brand} {b.frame_name || 'Walk-in item'} • Invoice: {b.bill_id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-left md:text-right">
                          <span className="text-xs text-gray-400 block uppercase font-bold tracking-wide">Expiry Date</span>
                          <span className="text-sm font-bold text-gold">{new Date(b.warranty_expiry_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <a 
                            href={`tel:${b.customer_mobile}`}
                            className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all"
                            title="Call Customer"
                          >
                            <PhoneCall className="w-4 h-4" />
                          </a>
                          <button 
                            onClick={() => sendWarrantyReminder(b)}
                            className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all font-bold"
                            title="WhatsApp Reminder"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Notify</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-xs text-gray-500">No warranties expiring in the next 30 days.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Handover WhatsApp Greeting Modal */}
      {selectedHandover && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-card max-w-sm w-full p-6 rounded-3xl border border-white/10 text-center space-y-5 animate-fade-in-up">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 mx-auto">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Order {selectedHandover.billId} Delivered!</h3>
              <p className="text-xs text-gray-400 mt-1">Would you like to send a delivery confirmation message to {selectedHandover.customerName}?</p>
            </div>
            <div className="flex flex-col space-y-2">
              <a
                href={selectedHandover.waLinkEn}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSelectedHandover(null)}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <span>Send English WhatsApp</span>
              </a>
              <a
                href={selectedHandover.waLinkHi}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSelectedHandover(null)}
                className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <span>भेजें Hindi WhatsApp</span>
              </a>
              <button
                onClick={() => setSelectedHandover(null)}
                className="w-full py-2 bg-white/5 border border-white/5 text-gray-300 rounded-xl text-xs hover:bg-white/10"
              >
                Skip Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
