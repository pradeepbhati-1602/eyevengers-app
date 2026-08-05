import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldAlert, Plus, Users, ShieldCheck, Check, Trash2, X } from 'lucide-react';
import { useFeatures } from '../context/FeatureContext';

export default function SettingsPage({ user, tenant, stores = [], setStores = () => {} }) {
  const { hasFeature } = useFeatures();
  const [storeName, setStoreName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeMobile, setStoreMobile] = useState('');
  const [cashbackPercent, setCashbackPercent] = useState('5');
  const [inactiveDays, setInactiveDays] = useState('45');
  const [lowStockLimit, setLowStockLimit] = useState('5');
  const [deliveryTemplateEn, setDeliveryTemplateEn] = useState('');
  const [deliveryTemplateHi, setDeliveryTemplateHi] = useState('');
  const [waTemplateGeneral, setWaTemplateGeneral] = useState('');
  const [waTemplatePayment, setWaTemplatePayment] = useState('');
  const [waTemplateOffer, setWaTemplateOffer] = useState('');
  const [feedbackLink, setFeedbackLink] = useState('');
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Employee creation states
  const [employees, setEmployees] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Employee');
  const [employeeStoreId, setEmployeeStoreId] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [errorUser, setErrorUser] = useState('');
  const [successUser, setSuccessUser] = useState(false);

  // Feature 12 Audit trail states
  const [activeTab, setActiveTab] = useState('config');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditLimit, setAuditLimit] = useState('200');
  const [auditSearch, setAuditSearch] = useState('');

  // Store management states
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreGst, setNewStoreGst] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreStatus, setNewStoreStatus] = useState('Active');
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [submittingStore, setSubmittingStore] = useState(false);
  const [errorStore, setErrorStore] = useState('');
  const [showStoreForm, setShowStoreForm] = useState(false);

  // Transfer Ownership states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Membership Plans states
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('365');
  const [planDiscount, setPlanDiscount] = useState('10');
  const [planPerks, setPlanPerks] = useState('');
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => {
    if (user.role === 'OWNER' || user.role === 'Owner') {
      fetchSettings();
      fetchEmployees();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setStoreName(data.store_name || '');
      setGstNumber(data.gst_number || '');
      setStoreAddress(data.store_address || '');
      setStoreMobile(data.store_mobile || '');
      setCashbackPercent(data.referral_cashback_percent || '5');
      setInactiveDays(data.inactive_customer_days || '45');
      setLowStockLimit(data.low_stock_limit || '5');
      setDeliveryTemplateEn(data.whatsapp_delivery_template_en || '');
      setDeliveryTemplateHi(data.whatsapp_delivery_template_hi || '');
      setWaTemplateGeneral(data.wa_template_general || `Hi {customer_name}, hope you are doing well! This is ${tenant?.business_name || 'our store'}. We wanted to check if you are comfortable with your new eyewear. Let us know if you need any adjustments.`);
      setWaTemplatePayment(data.wa_template_payment || `Dear {customer_name}, this is a gentle reminder that your bill payment of {dueAmount} is pending at ${tenant?.business_name || 'our store'}. You can pay via UPI at our store. Please disregard if already paid.`);
      setWaTemplateOffer(data.wa_template_offer || `Hello {customer_name}, exclusive offer for you at ${tenant?.business_name || 'our store'}! Get flat 15% off on our new arrivals of designer frames this weekend. Show this message at checkout.`);
      setFeedbackLink(data.feedback_link || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/v1/settings/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setEmployees(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMembershipPlans = async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch('/api/v1/memberships/plans', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMembershipPlans(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setSubmittingPlan(true);
    try {
      const res = await fetch('/api/v1/memberships/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: planName,
          price: planPrice,
          duration_days: planDuration,
          discount_percent: planDiscount,
          perks: planPerks
        })
      });
      if (res.ok) {
        alert('Membership plan created successfully!');
        setPlanName('');
        setPlanPrice('');
        setPlanDuration('365');
        setPlanDiscount('10');
        setPlanPerks('');
        fetchMembershipPlans();
      } else {
        const error = await res.json();
        alert('Failed to create plan: ' + error.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error creating plan');
    } finally {
      setSubmittingPlan(false);
    }
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm('Are you sure you want to delete this membership plan? Customers already on this plan will keep their active memberships.')) return;
    try {
      const res = await fetch(`/api/v1/memberships/plans/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchMembershipPlans();
      } else {
        const error = await res.json();
        alert('Failed to delete plan: ' + error.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error deleting plan');
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/v1/settings/audit?limit=${auditLimit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAuditLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          store_name: storeName,
          gst_number: gstNumber,
          store_address: storeAddress,
          store_mobile: storeMobile,
          referral_cashback_percent: cashbackPercent,
          inactive_customer_days: inactiveDays,
          low_stock_limit: lowStockLimit,
          whatsapp_delivery_template_en: deliveryTemplateEn,
          whatsapp_delivery_template_hi: deliveryTemplateHi,
          wa_template_general: waTemplateGeneral,
          wa_template_payment: waTemplatePayment,
          wa_template_offer: waTemplateOffer,
          feedback_link: feedbackLink
        })
      });
      if (res.ok) {
        alert('Configurations saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!username || !password || !name) {
      setErrorUser('All fields are required');
      return;
    }
    setErrorUser('');
    setSuccessUser(false);
    setSubmittingUser(true);

    try {
      const res = await fetch('/api/v1/settings/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          username, 
          password, 
          name, 
          role, 
          store_id: role === 'Employee' ? (employeeStoreId || (stores[0] && stores[0].store_id) || 'store-main') : null 
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create employee');

      setSuccessUser(true);
      setUsername('');
      setPassword('');
      setName('');
      setRole('Employee');
      setEmployeeStoreId('');
      fetchEmployees();
    } catch (err) {
      setErrorUser(err.message);
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    if (!newStoreName) {
      setErrorStore('Store Name is required');
      return;
    }
    setErrorStore('');
    setSubmittingStore(true);

    const method = editingStoreId ? 'PUT' : 'POST';
    const url = editingStoreId ? `/api/v1/stores/${editingStoreId}` : '/api/v1/stores';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          store_name: newStoreName,
          address: newStoreAddress,
          gst_number: newStoreGst,
          phone: newStorePhone,
          status: newStoreStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save store');

      // Refresh stores list
      const token = localStorage.getItem('token');
      const storesRes = await fetch('/api/v1/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const storesData = await storesRes.json();
      if (Array.isArray(storesData)) {
        setStores(storesData);
      }

      setNewStoreName('');
      setNewStoreAddress('');
      setNewStoreGst('');
      setNewStorePhone('');
      setNewStoreStatus('Active');
      setEditingStoreId(null);
      setShowStoreForm(false);
    } catch (err) {
      setErrorStore(err.message);
    } finally {
      setSubmittingStore(false);
    }
  };

  const startEditStore = (store) => {
    setNewStoreName(store.store_name);
    setNewStoreAddress(store.address || '');
    setNewStoreGst(store.gst_number || '');
    setNewStorePhone(store.phone || '');
    setNewStoreStatus(store.status);
    setEditingStoreId(store.store_id);
    setShowStoreForm(true);
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm('Are you sure you want to delete this store? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`/api/v1/stores/${storeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete store');
      
      triggerToast('Store deleted successfully');
      
      // Refresh stores list
      const token = localStorage.getItem('token');
      const storesRes = await fetch('/api/v1/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const storesData = await storesRes.json();
      if (Array.isArray(storesData)) {
        setStores(storesData);
      }
    } catch (err) {
      setErrorStore(err.message);
    }
  };

  const handleToggleCrossStoreRead = async (empId, currentValue) => {
    try {
      const res = await fetch(`/api/v1/settings/users/${empId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cross_store_read: !currentValue })
      });
      if (res.ok) {
        fetchEmployees();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update permission');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating permissions');
    }
  };

  const handleDeleteEmployee = async (empId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/v1/settings/users/${empId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchEmployees();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting user');
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    setSubmittingTransfer(true);
    setTransferError('');

    try {
      const res = await fetch(`/api/v1/settings/users/${transferTargetId}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ password: transferPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to transfer ownership');

      alert('Ownership successfully transferred! You will now be logged out.');
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (err) {
      setTransferError(err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  };


  const roleStr = String(user?.role || '').trim().toUpperCase();
  if (roleStr !== 'OWNER') {
    return (
      <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto min-h-[300px] border border-red-500/10">
        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center text-red-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-white font-extrabold text-lg">Owner Clearance Required</h3>
        <p className="text-gray-400 text-xs">Employee terminals are restricted from modifying store configuration parameters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">System Settings</h1>
        <p className="text-gray-400 text-xs mt-1">Configure retail workflows, adjust loyalty cashbacks, and manage terminal logins.</p>
      </div>

      <div className="flex border-b border-white/5 space-x-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 transition-all ${activeTab === 'config' ? 'text-gold border-b-2 border-gold font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          General Configurations & Staff
        </button>
        <button
          onClick={() => {
            setActiveTab('audit');
            fetchAuditLogs();
          }}
          className={`pb-3 transition-all ${activeTab === 'audit' ? 'text-gold border-b-2 border-gold font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          Security Audit Trail
        </button>
        <button
          onClick={() => {
            setActiveTab('memberships');
            fetchMembershipPlans();
          }}
          className={`pb-3 transition-all ${activeTab === 'memberships' ? 'text-gold border-b-2 border-gold font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          Membership Plans
        </button>
        <button
          onClick={() => setActiveTab('subscription')}
          className={`pb-3 transition-all ${activeTab === 'subscription' ? 'text-gold border-b-2 border-gold font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          Subscription Details
        </button>
      </div>

      {activeTab === 'config' && (
        loadingConfig ? (
          <div className="h-64 flex items-center justify-center text-xs text-gray-500 animate-pulse">
            LOADING CONFIGURATIONS...
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Form: Configuration details (2/3 cols) */}
          <form onSubmit={handleSaveSettings} className="lg:col-span-2 glass-card p-6 rounded-3xl space-y-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
              <Settings className="w-5 h-5 text-gold" />
              <span>Retail & Business Parameters</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">GST Registration Number</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">UPI Billing Mobile Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={storeMobile}
                  onChange={(e) => setStoreMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-xs font-mono"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Referral Cashback Earn (%)</label>
                <input
                  type="text"
                  value={cashbackPercent}
                  onChange={(e) => setCashbackPercent(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-xs font-bold text-gold"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Low Stock Reorder Line</label>
                <input
                  type="text"
                  value={lowStockLimit}
                  onChange={(e) => setLowStockLimit(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Inactive Customer Threshold (Days)</label>
                <input
                  type="text"
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Store Address</label>
              <textarea
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full h-16 text-xs px-3 py-2 resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">WhatsApp Handover Template (English)</label>
                <textarea
                  value={deliveryTemplateEn}
                  onChange={(e) => setDeliveryTemplateEn(e.target.value)}
                  placeholder="Dear {customer_name}, your spectacles for {bill_id} are ready..."
                  className="w-full h-24 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                  required
                />
                <span className="text-[10px] text-gray-500">Supports variables: <code>{`{customer_name}`}</code>, <code>{`{bill_id}`}</code></span>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">WhatsApp Handover Template (Hindi)</label>
                <textarea
                  value={deliveryTemplateHi}
                  onChange={(e) => setDeliveryTemplateHi(e.target.value)}
                  placeholder="प्रिय {customer_name}, आपका बिल {bill_id} का चश्मा तैयार है..."
                  className="w-full h-24 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                  required
                />
                <span className="text-[10px] text-gray-500">Supports variables: <code>{`{customer_name}`}</code>, <code>{`{bill_id}`}</code></span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">WhatsApp General Greeting Template</label>
                <textarea
                  value={waTemplateGeneral}
                  onChange={(e) => setWaTemplateGeneral(e.target.value)}
                  className="w-full h-20 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                  required
                />
                <span className="text-[10px] text-gray-500">Supports variables: <code>{`{customer_name}`}</code></span>
              </div>
              
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">WhatsApp Payment Due Template</label>
                <textarea
                  value={waTemplatePayment}
                  onChange={(e) => setWaTemplatePayment(e.target.value)}
                  className="w-full h-20 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                  required
                />
                <span className="text-[10px] text-gray-500">Supports variables: <code>{`{customer_name}`}</code>, <code>{`{dueAmount}`}</code></span>
              </div>
              
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">WhatsApp Offer Template</label>
                <textarea
                  value={waTemplateOffer}
                  onChange={(e) => setWaTemplateOffer(e.target.value)}
                  className="w-full h-20 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                  required
                />
                <span className="text-[10px] text-gray-500">Supports variables: <code>{`{customer_name}`}</code></span>
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Google Review / Customer Feedback Link</label>
              <input
                type="text"
                value={feedbackLink}
                onChange={(e) => setFeedbackLink(e.target.value)}
                placeholder="https://g.page/r/your-store/review"
                className="w-full text-xs"
              />
              <span className="text-[10px] text-gray-500">Supports variable <code>{`{feedback_link}`}</code> in WhatsApp templates</span>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-4 bg-gradient-to-r from-gold to-gold-light text-darkBg font-black rounded-2xl shadow-xl shadow-gold/10 transition-all flex items-center justify-center space-x-2 text-base"
            >
              {savingConfig ? (
                <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Commit Store Settings</span>
                </>
              )}
            </button>
          </form>

          {/* Right Panel: Role & Staff registration (1/3 cols) */}
          {hasFeature('employee_accounts') && (
          <div className="space-y-6">
            
            {/* Create Staff Form */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-gold" />
                <span>Add Staff Account</span>
              </h3>

              {errorUser && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{errorUser}</div>
              )}
              {successUser && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl flex items-center space-x-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Account registered successfully!</span>
                </div>
              )}

              <form onSubmit={handleCreateEmployee} className="space-y-3.5">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Peter Parker"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. peter"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Security Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                    required
                  >
                    <option>Employee</option>
                    <option>Owner</option>
                  </select>
                </div>

                {role === 'Employee' && hasFeature('multi_store') && stores.length > 1 && (
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-400">Assigned Store Location</label>
                    <select
                      value={employeeStoreId}
                      onChange={(e) => setEmployeeStoreId(e.target.value)}
                      className="w-full py-2 px-3 text-xs"
                      required
                    >
                      <option value="">Select Location...</option>
                      {stores.map(s => (
                        <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingUser}
                  className="w-full py-2.5 bg-gradient-to-r from-gold to-gold-light text-darkBg font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all"
                >
                  {submittingUser ? (
                    <div className="w-4 h-4 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </form>
            </div>

             {/* Staff list */}
             <div className="glass-card p-6 rounded-3xl space-y-4">
               <h3 className="text-base font-bold text-white flex items-center space-x-2">
                 <Users className="w-5 h-5 text-gold" />
                 <span>Active Logins Registry</span>
               </h3>
 
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                 {employees.map(emp => (
                   <div key={emp.user_id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col space-y-2 text-xs">
                     <div className="flex items-center justify-between">
                       <div>
                         <h4 className="font-bold text-white leading-tight">{emp.name}</h4>
                         <span className="text-[10px] text-gray-500 font-mono">@{emp.username}</span>
                       </div>
                       <span className="px-2.5 py-0.5 bg-white/10 text-gray-300 font-bold uppercase rounded text-[8px]">
                         {emp.role}
                       </span>
                       {user.user_id !== emp.user_id && (
                         <div className="flex items-center space-x-2 ml-3">
                           <button
                             onClick={() => {
                               setTransferTargetId(emp.user_id);
                               setShowTransferModal(true);
                             }}
                             className="text-gold hover:text-gold-light transition-colors p-1"
                             title="Transfer Ownership to this user"
                           >
                             <ShieldCheck className="w-4 h-4" />
                           </button>
                           <button
                             onClick={() => handleDeleteEmployee(emp.user_id)}
                             className="text-red-400 hover:text-red-300 transition-colors p-1"
                             title="Delete User"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       )}
                     </div>
                     
                     {emp.role === 'Employee' && (
                       <div className="pt-2 border-t border-white/5 flex flex-col space-y-1.5">
                         <div className="text-[10px] text-gray-400">
                           Assigned: <strong className="text-white">{emp.store_name || 'Main Store'}</strong>
                         </div>
                         {hasFeature('multi_store') && stores.length > 1 && (
                           <label className="flex items-center space-x-2 text-[10px] text-gray-300 cursor-pointer">
                             <input
                               type="checkbox"
                               checked={!!emp.cross_store_read}
                               onChange={() => handleToggleCrossStoreRead(emp.user_id, emp.cross_store_read)}
                               className="rounded border-white/10 bg-darkBg text-gold focus:ring-0 focus:ring-offset-0"
                             />
                             <span>Allow Cross-Store View</span>
                           </label>
                         )}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             </div>

          </div>
          )}

        </div>
        )
      )}

      {/* Feature 1: Store Locations Registry (View Only) */}
      {activeTab === 'config' && (user.role === 'Owner' || user.role === 'OWNER') && (
        <div className="glass-card p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Settings className="w-5 h-5 text-gold" />
              <span>Store Locations Registry</span>
            </h3>
            {!showStoreForm && (
              <button
                onClick={() => {
                  setEditingStoreId(null);
                  setNewStoreName('');
                  setNewStoreAddress('');
                  setNewStorePhone('');
                  setNewStoreGst('');
                  setNewStoreStatus('Active');
                  setShowStoreForm(true);
                }}
                className="px-3 py-1.5 bg-gold/10 text-gold hover:bg-gold/20 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Store</span>
              </button>
            )}
          </div>

          {errorStore && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{errorStore}</div>
          )}

          {showStoreForm && (
            <form onSubmit={handleSaveStore} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4 animate-fade-in-up">
              <h4 className="text-xs font-bold text-gold uppercase tracking-wider">
                {editingStoreId ? 'Edit Store Location' : 'Setup Additional Store Location'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">Store Name</label>
                  <input
                    type="text"
                    placeholder="e.g. South Delhi Branch"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="w-full text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543211"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-xs font-mono"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">GSTIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 27EYEVEN1002B2Z1"
                    value={newStoreGst}
                    onChange={(e) => setNewStoreGst(e.target.value)}
                    className="w-full text-xs font-mono"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">Status</label>
                  <select
                    value={newStoreStatus}
                    onChange={(e) => setNewStoreStatus(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-darkBg text-white border border-white/10 rounded-xl"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-semibold text-gray-400">Address</label>
                <textarea
                  placeholder="Store address..."
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="w-full h-12 text-xs px-3 py-2 bg-darkBg text-white border border-white/10 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowStoreForm(false)}
                  className="px-4 py-2 bg-white/5 border border-white/5 text-gray-300 rounded-xl text-xs hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStore}
                  className="px-4 py-2 bg-gold text-darkBg font-bold rounded-xl text-xs flex items-center space-x-1.5 hover:opacity-90"
                >
                  {submittingStore ? (
                    <div className="w-4 h-4 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingStoreId ? 'Save Changes' : 'Initialize Location'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Dynamic List / CTA depending on stores count */}
          {stores.length === 0 ? (
            <div className="p-8 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 bg-white/[0.01]">
              <p className="text-gray-400 text-xs max-w-sm">
                No store locations are currently configured. Click "Add Store" to set one up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map(s => (
                <div key={s.store_id} className={`p-4 rounded-2xl border ${s.status === 'Active' ? 'bg-white/5 border-white/5' : 'bg-red-500/[0.02] border-red-500/10'} space-y-3`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">{s.store_name}</h4>
                      <span className="text-[10px] text-gray-500 font-mono">{s.store_id}</span>
                    </div>
                    <span className={`px-2 py-0.5 font-bold uppercase rounded text-[8px] ${s.status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 space-y-1">
                    <div>📞 {s.phone || 'No phone'}</div>
                    <div>🆔 GSTIN: {s.gst_number || 'N/A'}</div>
                    <div className="truncate">📍 {s.address || 'No address'}</div>
                  </div>
                  <div className="flex items-center space-x-2 mt-3">
                    <button
                      onClick={() => startEditStore(s)}
                      className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-lg text-[10px] transition-all"
                    >
                      Edit Location Info
                    </button>
                    {stores.length > 1 && (
                      <button
                        onClick={() => handleDeleteStore(s.store_id)}
                        className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-[10px] transition-all"
                        title="Delete Store"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="glass-card p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-gold" />
              <span>Audit Trail (Last {auditLimit} Actions)</span>
            </h3>
            <div className="flex items-center space-x-2">
              <select
                value={auditLimit}
                onChange={(e) => {
                  setAuditLimit(e.target.value);
                  setTimeout(() => fetchAuditLogs(), 0);
                }}
                className="bg-darkBg text-white border border-white/10 rounded-xl px-2 py-1 text-xs"
              >
                <option value="50">Show 50</option>
                <option value="100">Show 100</option>
                <option value="200">Show 200</option>
                <option value="500">Show 500</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Filter audit logs by action or username..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            {loadingAudit ? (
              <div className="py-12 text-center text-xs text-gray-500 animate-pulse">LOADING AUDIT LOGS...</div>
            ) : auditLogs.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400">
                    <th className="pb-3 pr-2">TIMESTAMP</th>
                    <th className="pb-3 pr-2">OPERATOR</th>
                    <th className="pb-3 pr-2">ACTION EVENT</th>
                    <th className="pb-3">METADATA DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {auditLogs
                    .filter(log => 
                      log.username.toLowerCase().includes(auditSearch.toLowerCase()) ||
                      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                      (log.details && log.details.toLowerCase().includes(auditSearch.toLowerCase()))
                    )
                    .map(log => (
                      <tr key={log.log_id} className="hover:bg-white/5">
                        <td className="py-3 pr-2 text-gray-400 font-mono text-[10px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-2 font-bold text-white">
                          {log.username}
                        </td>
                        <td className="py-3 pr-2">
                          <span className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[10px] font-bold border border-gold/10">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-gray-400 text-[10px] max-w-md truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-gray-500">No actions recorded in the log trail.</div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-md w-full p-8 rounded-3xl glow-red/5 animate-fade-in-up space-y-6 border border-red-500/20">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-red-400 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5" />
                <span>Transfer Ownership</span>
              </h3>
              <button 
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferTargetId(null);
                  setTransferPassword('');
                  setTransferError('');
                }}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-300">
              You are about to transfer <strong className="text-white">OWNER</strong> access to another user. You will be demoted to an Employee and will immediately lose access to Owner-only settings.
            </p>
            <p className="text-xs text-gold font-bold">
              Please enter your current password to confirm this action.
            </p>

            {transferError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{transferError}</div>
            )}

            <form onSubmit={handleTransferOwnership} className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-red-500/30 focus:border-red-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingTransfer}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-sm mt-3"
              >
                {submittingTransfer ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm Transfer & Logout</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'memberships' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-4">Create New Membership Plan</h3>
            <form onSubmit={handleCreatePlan} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Plan Name</label>
                <input required type="text" value={planName} onChange={e => setPlanName(e.target.value)} className="w-full text-xs" placeholder="e.g. VIP Gold" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Price (₹)</label>
                <input required type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} className="w-full text-xs" placeholder="500" min="0" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Duration (Days)</label>
                <input required type="number" value={planDuration} onChange={e => setPlanDuration(e.target.value)} className="w-full text-xs" min="1" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Discount (%)</label>
                <input required type="number" value={planDiscount} onChange={e => setPlanDiscount(e.target.value)} className="w-full text-xs" min="0" max="100" />
              </div>
              <button disabled={submittingPlan} type="submit" className="w-full px-4 py-2 bg-gold text-darkBg font-bold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 h-10">
                {submittingPlan ? 'Saving...' : 'Add Plan'}
              </button>
            </form>
          </div>

          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-4">Active Membership Plans</h3>
            {loadingPlans ? (
              <div className="text-xs text-gray-500 text-center py-4">Loading plans...</div>
            ) : membershipPlans.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">No membership plans created yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {membershipPlans.map(plan => (
                  <div key={plan.plan_id} className="p-4 bg-white/5 border border-white/5 rounded-2xl relative">
                    <button onClick={() => handleDeletePlan(plan.plan_id)} className="absolute top-3 right-3 text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 p-1.5 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <h4 className="text-sm font-black text-gold mb-1">{plan.plan_name}</h4>
                    <div className="text-xs text-gray-400 space-y-1 mt-3">
                      <div className="flex justify-between"><span>Price:</span><span className="text-white font-bold">₹{plan.price}</span></div>
                      <div className="flex justify-between"><span>Discount:</span><span className="text-white font-bold">{plan.discount_percent}%</span></div>
                      <div className="flex justify-between"><span>Validity:</span><span className="text-white font-bold">{plan.duration_days} Days</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscription' && tenant && (
        <div className="glass-card p-8 rounded-3xl animate-fade-in-up border border-white/5 space-y-8">
          <div className="flex items-center space-x-4 border-b border-white/5 pb-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-gold to-gold-light rounded-xl flex items-center justify-center shadow-lg shadow-gold/20">
              <ShieldCheck className="w-6 h-6 text-darkBg" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Your SaaS Subscription</h2>
              <p className="text-sm text-gray-400">Manage your active plan and module access.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Business Name</p>
                <p className="text-lg font-bold text-white">{tenant.business_name}</p>
              </div>
              
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                  <p className={`text-sm font-bold ${tenant.status === 'ACTIVE' ? 'text-green-400' : tenant.status === 'TRIAL' ? 'text-gold' : 'text-red-400'}`}>
                    {tenant.status}
                  </p>
                </div>
                {tenant.status === 'TRIAL' && (
                  <div className="px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-bold border border-gold/20">
                    Trial Active
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white mb-4">Enabled Modules</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-darkBg border border-white/5">
                  <span className="text-sm text-gray-300">Multi-Store Platform</span>
                  {hasFeature('multi_store') ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-darkBg border border-white/5">
                  <span className="text-sm text-gray-300">WhatsApp Automation</span>
                  {tenant.whatsapp_auto_send_enabled ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-darkBg border border-white/5">
                  <span className="text-sm text-gray-300">Eye Test / Clinical Module</span>
                  {tenant.eye_test_module_enabled ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-darkBg border border-white/5">
                  <span className="text-sm text-gray-300">Repair Orders Module</span>
                  {tenant.repair_module_enabled ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-gray-600" />}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">
                Contact your platform administrator to upgrade your plan or enable additional modules.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
