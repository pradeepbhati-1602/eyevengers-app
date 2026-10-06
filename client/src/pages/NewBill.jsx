import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  User, Phone, Calendar, MapPin, Gift, Eye, 
  Receipt, DollarSign, Barcode, HelpCircle, Save, RotateCcw, AlertCircle, Crown
} from 'lucide-react';

import { saveOfflineBill } from '../utils/offlineStore';
import { useFeatures } from '../context/FeatureContext';

export default function NewBill({ activeStore, triggerToast }) {
  const { hasFeature } = useFeatures();
  const location = useLocation();
  // Customer details state
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [language, setLanguage] = useState('English');
  const [referralCode, setReferralCode] = useState('');
  const [referralName, setReferralName] = useState('');
  const [referralError, setReferralError] = useState('');

  // Customer lookup states
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [availableCashback, setAvailableCashback] = useState(0);
  const [activeMembership, setActiveMembership] = useState(null);

  // Products stock states
  const [products, setProducts] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');

  // Section-based product selection
  const [selectedSection, setSelectedSection] = useState('Eyevengers Classic');
  const [sectionSearch, setSectionSearch] = useState('');

  const SECTIONS = [
    { id: 'Eyevengers Classic', label: 'Eyevengers Classic', icon: '👓', desc: 'Classic Collection' },
    { id: 'Eyevengers Premium', label: 'Eyevengers Premium', icon: '💎', desc: 'Premium Luxury' },
    { id: 'Contact lens', label: 'Contact lens', icon: '👁️', desc: 'Contact Lenses' },
    { id: 'All', label: 'All Products', icon: '📦', desc: 'Full Catalog' }
  ];

  const getSectionProducts = (secId) => {
    return products.filter(p => {
      if (p.category === 'LENS_TYPE' || p.category === 'LENS_COATING') return false;

      if (secId === 'Eyevengers Classic') {
        return p.section === 'Eyevengers Classic' || (!p.section && p.category !== 'CONTACT_LENS');
      }
      if (secId === 'Eyevengers Premium') {
        return p.section === 'Eyevengers Premium';
      }
      if (secId === 'Contact lens') {
        return p.section === 'Contact lens' || p.category === 'CONTACT_LENS';
      }
      return true;
    });
  };

  // Lens details states
  const [lensType, setLensType] = useState('');
  const [lensCoating, setLensCoating] = useState('');
  const [lensPrice, setLensPrice] = useState('0');

  // Power details states
  const [reSph, setReSph] = useState('0.00');
  const [reCyl, setReCyl] = useState('0.00');
  const [reAxis, setReAxis] = useState('');
  const [leSph, setLeSph] = useState('0.00');
  const [leCyl, setLeCyl] = useState('0.00');
  const [leAxis, setLeAxis] = useState('');
  const [pd, setPd] = useState('');
  const [addPower, setAddPower] = useState('');

  // Finance states
  const [discount, setDiscount] = useState('0');
  const [cashbackUsed, setCashbackUsed] = useState('0');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [cashbackError, setCashbackError] = useState('');

  // Process state
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Fetch products on mount and when activeStore changes
  useEffect(() => {
    fetchProducts();
  }, [activeStore]);

  // Handle conversion from prescription / EyeTest screen
  useEffect(() => {
    if (location.state?.prescription) {
      const p = location.state.prescription;
      setName(p.name || '');
      setMobile(p.mobile || '');
      setReSph(p.reSph || '0.00');
      setReCyl(p.reCyl || '0.00');
      setReAxis(p.reAxis || '');
      setLeSph(p.leSph || '0.00');
      setLeCyl(p.leCyl || '0.00');
      setLeAxis(p.leAxis || '');
      setPd(p.pd || '');
      setAddPower(p.addPower || '');
      setLensType(p.visionCategory || 'Single Vision');
      triggerToast(`📋 Imported Prescription for ${p.name}`);
    }
  }, [location.state]);

  const fetchProducts = async () => {
    try {
      let url = '/api/v1/products';
      if (activeStore && activeStore !== 'all') {
        url += `?store_id=${activeStore}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data.data || []));
    } catch (e) {
      console.error(e);
    }
  };

  // Live lookup for customer when mobile reaches 10 digits
  useEffect(() => {
    if (mobile.length === 10) {
      lookupCustomer(mobile);
    } else {
      setIsExistingCustomer(false);
      setAvailableCashback(0);
      setActiveMembership(null);
    }
  }, [mobile]);

  const lookupCustomer = async (num) => {
    try {
      const res = await fetch(`/api/v1/customers/lookup/${num}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.customer.name);
        setBirthday(data.customer.birthday ? data.customer.birthday.split('T')[0] : '');
        setGender(data.customer.gender || 'Male');
        setAddress(data.customer.address || '');
        setLanguage(data.customer.language || 'English');
        setAvailableCashback(parseFloat(data.customer.current_cashback) || 0);
        setIsExistingCustomer(true);

        // Fetch active membership status
        if (data.customer.memberships && data.customer.memberships.length > 0) {
          const m = data.customer.memberships[0];
          setActiveMembership({
            plan_name: m.plan?.name,
            discount_percent: m.plan?.discount_percent
          });
        } else {
          const token = localStorage.getItem('token');
          const mRes = await fetch(`/api/v1/memberships/active/${data.customer.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            setActiveMembership(mData);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Live lookup for referral code
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (referralCode.trim().length >= 4) {
        lookupReferral(referralCode.trim());
      } else {
        setReferralName('');
        setReferralError('');
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timeoutId);
  }, [referralCode]);

  const lookupReferral = async (code) => {
    try {
      const res = await fetch(`/api/v1/customers/referrals/${code}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReferralName(data.customer_name);
        setReferralError('');
      } else {
        const err = await res.json();
        setReferralName('');
        // Only show error if they typed something substantial
        if (code.length > 3) setReferralError(err.error || 'Invalid code');
      }
    } catch (e) {
      setReferralName('');
      if (code.length > 3) setReferralError('Validation failed');
    }
  };

  // Barcode quick lookup
  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setBarcodeError('');
    try {
      const res = await fetch(`/api/v1/products/barcode/${barcodeInput.trim()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Add to billItems or increment quantity if exists
        setBillItems(prev => {
          const existing = prev.find(item => item.product_id === data.product_id);
          if (existing) {
            if (existing.quantity >= data.current_stock) {
              triggerToast(`❌ Cannot add more. Only ${data.current_stock} in stock.`);
              return prev;
            }
            return prev.map(item => item.product_id === data.product_id ? { ...item, quantity: item.quantity + 1 } : item);
          } else {
            if (data.current_stock <= 0) {
              triggerToast(`❌ Product is out of stock.`);
              return prev;
            }
            return [...prev, { ...data, quantity: 1 }];
          }
        });
        
        setBarcodeInput('');
        triggerToast(`✅ Added ${data.brand} ${data.product_name || data.frame_name || ''}`);
      } else {
        setBarcodeError('Product barcode not found');
      }
    } catch (err) {
      setBarcodeError('Barcode lookup failed');
    }
  };

  // Handle manual product selection dropdown
  const handleProductChange = (id) => {
    if (!id) return;
    const product = products.find(p => p.product_id === id || p.id === id);
    if (!product) return;

    setBillItems(prev => {
      const existing = prev.find(item => item.product_id === product.product_id || item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          triggerToast(`❌ Cannot add more. Only ${product.current_stock} in stock.`);
          return prev;
        }
        return prev.map(item => (item.product_id === product.product_id || item.product_id === product.id) ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        if (product.current_stock <= 0) {
          triggerToast(`❌ Product is out of stock.`);
          return prev;
        }
        return [...prev, { ...product, quantity: 1 }];
      }
    });
  };

  const removeBillItem = (id) => {
    setBillItems(prev => prev.filter(item => item.product_id !== id && item.id !== id));
  };

  const updateBillItemQuantity = (id, newQty) => {
    if (newQty < 1) return;
    setBillItems(prev => prev.map(item => {
      if (item.product_id === id || item.id === id) {
        if (newQty > item.current_stock) {
          triggerToast(`❌ Only ${item.current_stock} in stock.`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleLensSelection = (typeVal, coatingVal) => {
    setLensType(typeVal);
    setLensCoating(coatingVal);
    let newPrice = 0;
    const lType = products.find(p => (p.product_id === typeVal || p.id === typeVal) && p.category === 'LENS_TYPE');
    const lCoating = products.find(p => (p.product_id === coatingVal || p.id === coatingVal) && p.category === 'LENS_COATING');
    if (lType) newPrice += parseFloat(lType.selling_price) || 0;
    if (lCoating) newPrice += parseFloat(lCoating.selling_price) || 0;
    setLensPrice(newPrice.toString());
  };

  // Real-time validations
  const validateCashback = (val) => {
    const parsed = parseFloat(val) || 0;
    if (parsed > availableCashback) {
      setCashbackError(`Cannot exceed available balance: ₹${availableCashback}`);
    } else {
      setCashbackError('');
    }
    setCashbackUsed(val);
  };

  // Compute subtotal and due in real-time
  const productsCost = billItems.reduce((acc, item) => acc + (parseFloat(item.selling_price) * item.quantity), 0);
  const parsedLensCost = parseFloat(lensPrice) || 0;
  const subtotal = productsCost + parsedLensCost;

  const membershipDiscount = activeMembership ? (subtotal * parseFloat(activeMembership.discount_percent) / 100) : 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const totalDiscount = parsedDiscount + membershipDiscount;

  const parsedCashback = parseFloat(cashbackUsed) || 0;
  const parsedAdvance = parseFloat(advancePaid) || 0;

  const totalAmount = Math.max(0, subtotal - totalDiscount - parsedCashback);
  const dueAmount = Math.max(0, totalAmount - parsedAdvance);

  const resetForm = () => {
    setMobile('');
    setName('');
    setBirthday('');
    setGender('Male');
    setAddress('');
    setLanguage('English');
    setReferralCode('');
    setReferralName('');
    setReferralError('');
    setBillItems([]);
    setBarcodeInput('');
    setLensPrice('0');
    setDiscount('0');
    setCashbackUsed('0');
    setAdvancePaid('0');
    setSuccessData(null);
    setCashbackError('');
    setActiveMembership(null);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cashbackError || referralError) return;

    setLoading(true);
    try {
      const payload = {
        name,
        mobile,
        birthday,
        gender,
        address,
        language,
        referral_code: referralCode.trim() || null,
        items: billItems.map(item => ({
          product_id: item.product_id || item.id,
          product_name: item.product_name || item.frame_name || 'Product',
          category: item.category,
          brand: item.brand,
          qty: item.quantity,
          price: parseFloat(item.selling_price)
        })),
        lens_details: {
          type_id: lensType,
          coating_id: lensCoating,
          type: products.find(p => (p.product_id === lensType || p.id === lensType) && p.category === 'LENS_TYPE')?.product_name || lensType,
          type_brand: products.find(p => (p.product_id === lensType || p.id === lensType) && p.category === 'LENS_TYPE')?.brand || '',
          type_features: products.find(p => (p.product_id === lensType || p.id === lensType) && p.category === 'LENS_TYPE')?.features || '',
          type_price: parseFloat(products.find(p => (p.product_id === lensType || p.id === lensType) && p.category === 'LENS_TYPE')?.selling_price || 0),
          coating: products.find(p => (p.product_id === lensCoating || p.id === lensCoating) && p.category === 'LENS_COATING')?.product_name || lensCoating,
          coating_brand: products.find(p => (p.product_id === lensCoating || p.id === lensCoating) && p.category === 'LENS_COATING')?.brand || '',
          coating_features: products.find(p => (p.product_id === lensCoating || p.id === lensCoating) && p.category === 'LENS_COATING')?.features || '',
          coating_price: parseFloat(products.find(p => (p.product_id === lensCoating || p.id === lensCoating) && p.category === 'LENS_COATING')?.selling_price || 0),
          price: parsedLensCost
        },
        power_details: {
          re_sph: reSph,
          re_cyl: reCyl,
          re_axis: reAxis,
          le_sph: leSph,
          le_cyl: leCyl,
          le_axis: leAxis,
          pd,
          add: addPower
        },
        subtotal,
        discount: totalDiscount,
        cashback_used: parsedCashback,
        advance_paid: parsedAdvance,
        store_id: activeStore || null
      };

      if (!navigator.onLine) {
        await saveOfflineBill(payload);
        triggerToast('⚠️ Offline Mode: Bill saved locally. It will sync automatically when connection returns.');
        resetForm();
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      setSuccessData(data);
      triggerToast('Invoice created successfully!', data.whatsapp_link);
      
      // Auto open generated PDF in new tab
      window.open(data.invoice_pdf_url, '_blank');
      
      // Refresh inventory stock
      fetchProducts();
      setLoading(false);
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        // Network / CORS / Server Down error!
        try {
          const payload = {
            name,
            mobile,
            birthday,
            gender,
            address,
            language,
            referral_code: referralCode.trim() || null,
            frame_product_id: selectedFrameId || null,
            lens_details: {
              type: lensType,
              coating: lensCoating,
              price: parsedLensCost
            },
            power_details: {
              re_sph: reSph,
              re_cyl: reCyl,
              re_axis: reAxis,
              le_sph: leSph,
              le_cyl: leCyl,
              le_axis: leAxis,
              pd,
              add: addPower
            },
            subtotal,
            discount: totalDiscount,
            cashback_used: parsedCashback,
            advance_paid: parsedAdvance,
            store_id: activeStore || null
          };
          await saveOfflineBill(payload);
          triggerToast('⚠️ Connection Error: Bill saved locally. It will sync when online.');
          resetForm();
        } catch (dbErr) {
          console.error(dbErr);
          alert('Network offline. Failed to save draft locally.');
        }
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Billing Counter</h1>
          <p className="text-gray-400 text-xs mt-1">Fill fields to automate invoice, stock, referrals & WhatsApp updates.</p>
        </div>
        <button 
          onClick={resetForm}
          className="px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset POS</span>
        </button>
      </div>

      {successData && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <h4 className="text-green-400 font-extrabold text-sm">Invoice Created Successfully!</h4>
            <p className="text-xs text-gray-300 mt-1">Invoice number: <strong className="text-white">{successData.billId}</strong>. Stock levels decremented. Cashbacks adjusted.</p>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            {hasFeature('invoice_generator') && (
            <a 
              href={successData.invoice_pdf_url} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl border border-white/5 transition-all text-center flex-1 md:flex-none"
            >
              Print Invoice PDF
            </a>
            )}
            {hasFeature('whatsapp') && (
            <a 
              href={successData.whatsapp_link} 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all text-center flex-1 md:flex-none"
            >
              Share via WhatsApp
            </a>
            )}
          </div>
        </div>
      )}

      {/* Main Billing Form */}
      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Box 1: Customer Profile */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <User className="w-5 h-5 text-gold" />
                <span>1. Customer Details</span>
              </h3>
              {activeMembership && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 text-yellow-300 border border-yellow-500/40 shadow-sm shadow-yellow-500/10 animate-fade-in">
                  <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>VIP: {activeMembership.plan_name} ({activeMembership.discount_percent}% Off)</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Mobile Number *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter 10 digit number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Birthday (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full pl-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full">
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-400">Address (Optional)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3 w-4 h-4 text-gray-500" />
                <textarea
                  placeholder="Enter contact address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-11 h-16 resize-none"
                />
              </div>
            </div>

            {/* Referral Info */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400 flex items-center space-x-1">
                  <Gift className="w-3.5 h-3.5 text-gold" />
                  <span>Referral Code (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. EYE1001"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={`w-full ${referralError ? 'border-red-500/40 focus:border-red-500' : ''}`}
                />
                {referralName && <span className="text-[10px] text-green-400 font-bold">Referrer Confirmed: {referralName}</span>}
                {referralError && <span className="text-[10px] text-red-400 font-bold">{referralError}</span>}
              </div>

              {isExistingCustomer && (
                <div className="bg-gold/5 border border-gold/10 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[10px] text-gold font-bold uppercase tracking-wider">Loyalty Cashback</span>
                  <span className="text-lg font-black text-white mt-0.5">{formatCurrency(availableCashback)}</span>
                  <span className="text-[9px] text-gray-500 mt-0.5">Use below to claim instant discount.</span>
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Inventory & Barcode Scans */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Barcode className="w-5 h-5 text-electric" />
                <span>2. Selection & Barcode</span>
              </h3>
              
              {/* Barcode Form */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Scan product barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch(e)}
                  className="w-full md:w-56 py-1.5 px-3 text-xs"
                />
                {barcodeError && <span className="absolute right-2 top-11 bg-red-950 text-red-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-500/20 z-10">{barcodeError}</span>}
              </div>
            </div>

            {/* Step 1: 3 Product Sections Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gold tracking-wide uppercase flex items-center space-x-1.5">
                  <span>Choose Section / Category</span>
                </label>
                <span className="text-[10px] text-gray-400">
                  Select a section to view products
                </span>
              </div>

              {/* 3 Main Sections + All */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {SECTIONS.map((sec) => {
                  const secCount = getSectionProducts(sec.id).length;
                  const isSelected = selectedSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setSelectedSection(sec.id);
                        setSectionSearch('');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-br from-gold/25 via-gold/10 to-transparent border-gold shadow-lg shadow-gold/10 text-white ring-1 ring-gold/40'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xl">{sec.icon}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-gold text-darkBg' : 'bg-white/10 text-gray-400'
                        }`}>
                          {secCount}
                        </span>
                      </div>
                      <div className="font-extrabold text-xs leading-snug">{sec.label}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{sec.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Step 2: Filtered Products Display for Selected Section */}
              {(() => {
                const sectionItems = getSectionProducts(selectedSection);
                const filtered = sectionItems.filter(p => {
                  if (!sectionSearch.trim()) return true;
                  const q = sectionSearch.toLowerCase();
                  return (
                    (p.frame_name || p.product_name || '').toLowerCase().includes(q) ||
                    (p.brand || '').toLowerCase().includes(q) ||
                    (p.barcode || '').toLowerCase().includes(q) ||
                    (p.color || p.frame_color || '').toLowerCase().includes(q)
                  );
                });

                return (
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                        <span>Showing</span>
                        <strong className="text-gold font-bold">{selectedSection}</strong>
                        <span>Products ({filtered.length}):</span>
                      </span>

                      {sectionItems.length > 4 && (
                        <input
                          type="text"
                          placeholder={`Search in ${selectedSection}...`}
                          value={sectionSearch}
                          onChange={(e) => setSectionSearch(e.target.value)}
                          className="py-1 px-2.5 text-[11px] bg-darkBg border border-white/10 rounded-lg w-full sm:w-48 text-white placeholder-gray-500"
                        />
                      )}
                    </div>

                    {/* Section Dropdown */}
                    <select
                      value=""
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full text-xs py-2.5 px-3 bg-darkSurface text-white border border-white/10 rounded-xl focus:border-gold"
                    >
                      <option value="">
                        {filtered.length > 0 
                          ? `-- Select ${selectedSection} Product (${filtered.length} available) --`
                          : `-- No products in ${selectedSection} --`}
                      </option>
                      {filtered.map(p => (
                        <option key={p.product_id || p.id} value={p.product_id || p.id} disabled={p.current_stock <= 0}>
                          {p.frame_name || p.product_name} {p.frame_color || p.color ? `(${p.frame_color || p.color})` : ''} — {formatCurrency(p.selling_price)} [{p.current_stock} left] {p.current_stock <= 0 ? '(Out of Stock)' : ''}
                        </option>
                      ))}
                    </select>

                    {/* Quick-tap Product Chips for 1-click addition */}
                    {filtered.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          ⚡ Quick Tap to Add:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                          {filtered.map(p => {
                            const outOfStock = p.current_stock <= 0;
                            return (
                              <button
                                key={p.product_id || p.id}
                                type="button"
                                disabled={outOfStock}
                                onClick={() => handleProductChange(p.product_id || p.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                                  outOfStock 
                                    ? 'opacity-40 bg-white/5 border-white/5 cursor-not-allowed' 
                                    : 'bg-white/5 hover:bg-gold/15 hover:border-gold/50 active:scale-[0.98] border-white/10 group cursor-pointer'
                                }`}
                              >
                                <div>
                                  <div className="font-extrabold text-white group-hover:text-gold truncate text-[11px]">
                                    {p.frame_name || p.product_name}
                                  </div>
                                  <div className="text-[9px] text-gray-400 truncate mt-0.5">
                                    {p.brand} {p.frame_color || p.color ? `• ${p.frame_color || p.color}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                                  <span className="text-gold font-extrabold text-[11px]">
                                    {formatCurrency(p.selling_price)}
                                  </span>
                                  <span className={`text-[9px] font-bold ${p.current_stock <= 3 ? 'text-red-400' : 'text-green-400'}`}>
                                    {p.current_stock} in stock
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

              {billItems.length > 0 && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col space-y-2 overflow-x-auto">
                  <span className="text-[10px] text-gray-500 uppercase font-bold mb-2">Selected Items</span>
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-gray-500">
                        <th className="pb-2 font-semibold">Product</th>
                        <th className="pb-2 font-semibold">Price</th>
                        <th className="pb-2 font-semibold">Qty</th>
                        <th className="pb-2 font-semibold">Total</th>
                        <th className="pb-2 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map(item => (
                        <tr key={item.product_id || item.id} className="border-b border-white/5 last:border-0">
                          <td className="py-3">
                            <div className="font-bold text-white">{item.brand} {item.frame_name || item.product_name}</div>
                            <div className="text-[10px] text-gray-500">{item.category}</div>
                          </td>
                          <td className="py-3">{formatCurrency(item.selling_price)}</td>
                          <td className="py-3">
                            <div className="flex items-center space-x-2">
                              <button type="button" onClick={() => updateBillItemQuantity(item.product_id || item.id, item.quantity - 1)} className="bg-white/10 hover:bg-white/20 text-white w-6 h-6 rounded flex items-center justify-center font-bold" disabled={item.quantity <= 1}>-</button>
                              <span className="text-white text-xs w-4 text-center">{item.quantity}</span>
                              <button type="button" onClick={() => updateBillItemQuantity(item.product_id || item.id, item.quantity + 1)} className="bg-white/10 hover:bg-white/20 text-white w-6 h-6 rounded flex items-center justify-center font-bold" disabled={item.quantity >= item.current_stock}>+</button>
                            </div>
                          </td>
                          <td className="py-3 text-gold font-bold">{formatCurrency(item.selling_price * item.quantity)}</td>
                          <td className="py-3 text-right">
                            <button type="button" onClick={() => removeBillItem(item.product_id || item.id)} className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 bg-red-500/10 rounded">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            {/* Lens selection */}
            {(() => {
              const selType = products.find(p => (p.product_id === lensType || p.id === lensType) && p.category === 'LENS_TYPE');
              const selCoating = products.find(p => (p.product_id === lensCoating || p.id === lensCoating) && p.category === 'LENS_COATING');
              return (
                <div className="pt-2 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-400">1. Lens Type (Design)</label>
                    <select value={lensType} onChange={(e) => handleLensSelection(e.target.value, lensCoating)} className="w-full">
                      <option value="">-- Select Lens Type --</option>
                      {products.filter(p => p.category === 'LENS_TYPE').map(p => (
                        <option key={p.product_id || p.id} value={p.product_id || p.id}>
                          {p.product_name}
                        </option>
                      ))}
                      {products.filter(p => p.category === 'LENS_TYPE').length === 0 && (
                        <option disabled>No Lens Types found in inventory</option>
                      )}
                    </select>
                    {selType && (
                      <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg mt-1 flex items-center justify-between">
                        <span>✨ <strong>Design:</strong> {selType.product_name}</span>
                        <span className="font-bold text-[9px] text-gray-400">Base Type</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-400">2. Lens Coating / Package</label>
                      {selCoating && (
                        <span className="text-[10px] text-gold font-bold">{formatCurrency(selCoating.selling_price)}</span>
                      )}
                    </div>
                    <select value={lensCoating} onChange={(e) => handleLensSelection(lensType, e.target.value)} className="w-full">
                      <option value="">-- Select Coating / Package --</option>
                      {products.filter(p => p.category === 'LENS_COATING').map(p => (
                        <option key={p.product_id || p.id} value={p.product_id || p.id}>
                          {p.product_name} — {formatCurrency(p.selling_price)}
                        </option>
                      ))}
                      {products.filter(p => p.category === 'LENS_COATING').length === 0 && (
                        <option disabled>No Coatings found in inventory</option>
                      )}
                    </select>
                    {selCoating?.features && (
                      <div className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg mt-1">
                        🛡️ <strong>Features:</strong> {selCoating.features}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-400">Total Lens Rate (₹)</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={lensPrice}
                      onChange={(e) => setLensPrice(e.target.value.replace(/\D/g, ''))}
                      className="w-full"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      Auto-loaded from Coating package (editable)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Box 3: Clinic Power prescription details */}
          <div className="glass-card p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Eye className="w-5 h-5 text-gold" />
              <span>3. Lens Prescription (Power Details)</span>
            </h3>

            {/* Table layout for visual clarity */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-gray-400">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-2">EYE</th>
                    <th className="py-2">SPH</th>
                    <th className="py-2">CYL</th>
                    <th className="py-2">AXIS</th>
                    <th className="py-2">ADD</th>
                    <th className="py-2">PD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 font-bold text-white">RE (Right)</td>
                    <td className="py-2"><input type="text" value={reSph} onChange={(e) => setReSph(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={reCyl} onChange={(e) => setReCyl(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={reAxis} onChange={(e) => setReAxis(e.target.value)} className="w-16 py-1 px-2 text-xs font-mono" placeholder="-" /></td>
                    <td className="py-2" rowSpan={2}>
                      <input type="text" value={addPower} onChange={(e) => setAddPower(e.target.value)} className="w-16 py-1 px-2 text-xs mt-3" placeholder="+" />
                    </td>
                    <td className="py-2" rowSpan={2}>
                      <input type="text" value={pd} onChange={(e) => setPd(e.target.value)} className="w-16 py-1 px-2 text-xs mt-3" placeholder="mm" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-white">LE (Left)</td>
                    <td className="py-2"><input type="text" value={leSph} onChange={(e) => setLeSph(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leCyl} onChange={(e) => setLeCyl(e.target.value)} className="w-16 py-1 px-2 text-xs" /></td>
                    <td className="py-2"><input type="text" value={leAxis} onChange={(e) => setLeAxis(e.target.value)} className="w-16 py-1 px-2 text-xs font-mono" placeholder="-" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Checkout Breakdown */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl space-y-6 border border-gold/10 glow-gold/5 sticky top-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-gold" />
              <span>Checkout Breakdown</span>
            </h3>

            {/* Calculations items list */}
            <div className="space-y-3.5 text-sm border-b border-white/5 pb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Products Cost:</span>
                <span className="text-white font-semibold">{formatCurrency(productsCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lens Cost:</span>
                <span className="text-white font-semibold">{formatCurrency(parsedLensCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-white/5">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            {/* Adjustment Fields */}
            <div className="space-y-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Discount Amount (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Redeem Cashback (₹)</label>
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={cashbackUsed}
                    onChange={(e) => validateCashback(e.target.value.replace(/\D/g, ''))}
                    className={`w-full pl-11 ${cashbackError ? 'border-red-500/40 focus:border-red-500' : ''}`}
                    disabled={!isExistingCustomer || availableCashback <= 0}
                  />
                </div>
                {cashbackError && <span className="text-[10px] text-red-400 font-bold">{cashbackError}</span>}
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Advance Paid (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11"
                  />
                </div>
              </div>
            </div>

            {/* Total summary */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
              {activeMembership && (
                <div className="p-2.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl flex items-center justify-between font-bold">
                  <span>Membership: {activeMembership.plan_name}</span>
                  <span>-{formatCurrency(membershipDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400">
                <span>Grand Total:</span>
                <span className="font-bold text-white">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white border-t border-white/5 pt-2">
                <span className="text-gray-400">Balance Due:</span>
                <span className={dueAmount > 0 ? 'text-red-400' : 'text-green-400'}>{formatCurrency(dueAmount)}</span>
              </div>
            </div>

            {/* Save Submit Button */}
            <button
              type="submit"
              disabled={loading || !!cashbackError || !!referralError}
              className="w-full py-4 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-black rounded-2xl shadow-xl shadow-gold/15 flex items-center justify-center space-x-2 transition-all"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Generate Bill & Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
