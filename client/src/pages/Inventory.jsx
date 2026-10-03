import { formatCurrency } from '../utils/formatCurrency';
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Tag, Eye, Layers, 
  Trash2, AlertTriangle, X, Check, Filter 
} from 'lucide-react';

import { useFeatures } from '../context/FeatureContext';

export default function Inventory({ user, activeStore, stores = [] }) {
  const { hasFeature } = useFeatures();
  const [products, setProducts] = useState([]);
  const [categories] = useState(['All', 'Eyevengers Classic', 'Eyevengers Premium', 'Contact Lens', 'Frames', 'Reading Glasses', 'Sunglasses', 'Accessories', 'Lens', 'Repair Parts']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  
  // Add product form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [section, setSection] = useState('Eyevengers Classic');
  const [category, setCategory] = useState('Frames');
  const [brand, setBrand] = useState('Eyevengers');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState('5');
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stock transfer states
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [transfersList, setTransfersList] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  // Transfer stock modal states
  const [showTransferStockModal, setShowTransferStockModal] = useState(false);
  const [selectedProductForTransfer, setSelectedProductForTransfer] = useState(null);
  const [transferToStoreId, setTransferToStoreId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [errorTransfer, setErrorTransfer] = useState('');

  useEffect(() => {
    fetchInventory();
  }, [activeCategory, search, lowStockFilter, activeStore, page]);

  const fetchInventory = async () => {
    try {
      let url = `/api/v1/products?category=${activeCategory}&search=${encodeURIComponent(search)}&store_id=${activeStore}&is_paginated=true&page=${page}&limit=${limit}`;
      if (lowStockFilter) {
        url += '&lowStock=true';
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setProducts(data.data || []);
      setTotalPages(Math.ceil((data.total || 0) / (data.limit || limit)) || 1);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransfers = async () => {
    setLoadingTransfers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/transfers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransfersList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTransfers(false);
    }
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!selectedProductForTransfer || !transferToStoreId || !transferQuantity) {
      setErrorTransfer('Please fill in all fields');
      return;
    }
    setErrorTransfer('');
    setSubmittingTransfer(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedProductForTransfer.product_id,
          from_store_id: selectedProductForTransfer.store_id || 'store-main',
          to_store_id: transferToStoreId,
          quantity: parseInt(transferQuantity)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit transfer request');

      setShowTransferStockModal(false);
      setSelectedProductForTransfer(null);
      setTransferToStoreId('');
      setTransferQuantity('');
      fetchInventory();
    } catch (err) {
      setErrorTransfer(err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleProcessTransfer = async (transferId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this transfer request?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/transfers/${transferId}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTransfers();
        fetchInventory();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to process transfer');
      }
    } catch (e) {
      console.error(e);
      alert('Error processing transfer');
    }
  };

  const handleSectionSelect = (sec) => {
    setSection(sec);
    if (sec === 'Contact lens') {
      setCategory('Contact Lens');
    } else {
      setCategory('Frames');
    }
    if (!brand || brand === 'Ray-Ban') {
      setBrand('Eyevengers');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!barcode || !name || !purchasePrice || !sellingPrice || !stock) {
      setError('Please fill in all mandatory fields');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          barcode,
          section,
          category,
          brand: brand || (section && section.startsWith('Eyevengers') ? 'Eyevengers' : 'Eyevengers'),
          frame_name: name,
          frame_color: color,
          size,
          purchase_price: parseFloat(purchasePrice),
          selling_price: parseFloat(sellingPrice),
          opening_stock: parseInt(stock),
          low_stock_limit: parseInt(lowStockLimit),
          supplier
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to add product');

      // Success
      setShowAddModal(false);
      resetForm();
      fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscontinue = async (id) => {
    if (!window.confirm('Are you sure you want to discontinue this product? It will be deactivated from checkout selection.')) return;
    try {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchInventory();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to discontinue product');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setBarcode('');
    setSection('Eyevengers Classic');
    setCategory('Frames');
    setBrand('Eyevengers');
    setName('');
    setColor('');
    setSize('');
    setPurchasePrice('');
    setSellingPrice('');
    setStock('');
    setLowStockLimit('5');
    setSupplier('');
    setError('');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Products & Inventory</h1>
          <p className="text-gray-400 text-xs mt-1">Manage store catalog, query barcode scans, and track stock reorder lines.</p>
        </div>
        <div className="flex space-x-2 self-start md:self-auto shrink-0">
          {hasFeature('multi_store') && stores.length > 1 && (
            <button
              onClick={() => {
                setShowTransfersModal(true);
                fetchTransfers();
              }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
            >
              <Layers className="w-4 h-4 text-gold" />
              <span>Stock Transfers</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-gold to-gold-light text-darkBg hover:opacity-90 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-gold/10"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Categories Tabs Selector */}
      <div className="overflow-x-auto pb-2 -mx-6 px-6">
        <div className="flex space-x-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                activeCategory === cat 
                  ? 'bg-gradient-to-r from-gold/15 to-gold/5 border-gold text-gold font-bold shadow-md shadow-gold/5' 
                  : 'bg-darkSurface/50 border-white/5 text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search brand, name, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 py-2.5 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              lowStockFilter 
                ? 'bg-red-500/10 border-red-500/20 text-red-400 font-bold' 
                : 'bg-darkSurface/50 border-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Low Stock Alerts</span>
          </button>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="glass-card rounded-3xl p-6 overflow-x-auto min-h-[400px]">
        {products.length > 0 ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="pb-3 pr-2">BARCODE</th>
                <th className="pb-3 pr-2">BRAND / MODEL</th>
                <th className="pb-3 pr-2">CATEGORY</th>
                <th className="pb-3 pr-2">COLOR / SIZE</th>
                <th className="pb-3 text-right pr-2">SELL PRICE</th>
                <th className="pb-3 text-center pr-2">STOCK STATUS</th>
                {(user.role === 'Owner' || user.role === 'OWNER' || (hasFeature('multi_store') && stores.length > 1)) && <th className="pb-3 text-center">ACTION</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {products.map(p => {
                const isLow = p.current_stock <= p.low_stock_limit;
                return (
                  <tr key={p.product_id} className="hover:bg-white/5">
                    <td className="py-4 pr-2 font-mono text-[10px] text-gray-400">{p.barcode}</td>
                    <td className="py-4 pr-2">
                      <span className="font-extrabold text-white block leading-tight">{p.brand}</span>
                      <span className="text-[10px] text-gray-500 mt-0.5 block">{p.frame_name}</span>
                    </td>
                    <td className="py-4 pr-2">
                      <div className="flex flex-col space-y-1">
                        {p.section && (
                          <span className={`px-2 py-0.5 border rounded-md text-[9px] font-bold inline-block w-fit ${
                            p.section === 'Eyevengers Premium'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : p.section === 'Contact lens'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          }`}>
                            {p.section}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-gray-400 rounded-md text-[9px] uppercase font-bold w-fit">
                          {p.category}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-2">
                      <span className="block text-white leading-none">{p.frame_color || '-'}</span>
                      <span className="text-[9px] text-gray-500 mt-1 block">{p.size || '-'}</span>
                    </td>
                    <td className="py-4 text-right pr-2 font-bold text-white">{formatCurrency(p.selling_price)}</td>
                    <td className="py-4 text-center pr-2">
                      <div className="flex flex-col items-center justify-center">
                        <span className={`font-black text-sm ${isLow ? 'text-red-400' : 'text-green-400'}`}>
                          {p.current_stock}
                        </span>
                        {isLow && (
                          <span className="text-[7px] font-black uppercase text-red-400 tracking-wider mt-0.5 animate-pulse">Low Limit</span>
                        )}
                      </div>
                    </td>
                    {(user.role === 'Owner' || user.role === 'OWNER' || (hasFeature('multi_store') && stores.length > 1)) && (
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {hasFeature('multi_store') && stores.length > 1 && p.current_stock > 0 && (
                            <button
                              onClick={() => {
                                setSelectedProductForTransfer(p);
                                setTransferToStoreId('');
                                setTransferQuantity('');
                                setShowTransferStockModal(true);
                              }}
                              className="p-2 text-gray-500 hover:text-gold hover:bg-gold/10 rounded-lg transition-all"
                              title="Transfer Stock"
                            >
                              <Layers className="w-4 h-4" />
                            </button>
                          )}
                          {(user.role === 'Owner' || user.role === 'OWNER') && (
                            <button
                              onClick={() => handleDiscontinue(p.product_id)}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Discontinue Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Layers className="w-12 h-12 text-gray-600 mb-3" />
            <h4 className="text-white font-bold text-sm">No products found</h4>
            <p className="text-gray-500 text-xs mt-1">Add items to populate the optical catalog.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-2xl">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-darkSurface/50 text-gray-300 rounded-lg text-xs hover:bg-white/10 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 font-bold">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 bg-darkSurface/50 text-gray-300 rounded-lg text-xs hover:bg-white/10 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Product Modal Drawer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-xl w-full p-8 rounded-3xl glow-gold/5 animate-fade-in-up space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Add New Catalog Product</h3>
              <button 
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center">
                <span>{error}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 3 Main Product Sections */}
              <div className="flex flex-col space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gold tracking-wide uppercase flex items-center justify-between">
                  <span>Product Section / Category *</span>
                  <span className="text-[10px] text-gray-400 font-normal lowercase">choose store section</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'Eyevengers Classic', label: 'Eyevengers Classic', icon: '👓', desc: 'Classic Eyewear' },
                    { id: 'Eyevengers Premium', label: 'Eyevengers Premium', icon: '💎', desc: 'Premium Luxury' },
                    { id: 'Contact lens', label: 'Contact lens', icon: '👁️', desc: 'Contact Lenses' }
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSectionSelect(sec.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        section === sec.id
                          ? 'bg-gradient-to-br from-gold/20 via-gold/10 to-transparent border-gold shadow-lg shadow-gold/10 text-white ring-1 ring-gold/50'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="text-xl mb-1">{sec.icon}</div>
                      <div className="font-extrabold text-xs leading-snug">{sec.label}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{sec.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Barcode *</label>
                <input
                  type="text"
                  placeholder="Barcode / SKU scan"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                >
                  {categories.slice(1).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. Ray-Ban"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Model Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Aviator Classic"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Color (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Gold/Green"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Size (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Medium (55mm)"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Purchase Price (₹) *</label>
                <input
                  type="text"
                  placeholder="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Selling Price (₹) *</label>
                <input
                  type="text"
                  placeholder="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Opening Stock *</label>
                <input
                  type="text"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Low Stock Limit *</label>
                <input
                  type="text"
                  value={lowStockLimit}
                  onChange={(e) => setLowStockLimit(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-gray-400">Supplier (Optional)</label>
                <input
                  type="text"
                  placeholder="Supplier name or notes"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="md:col-span-2 w-full py-3 bg-gradient-to-r from-gold to-gold-light hover:opacity-90 active:scale-[0.98] text-darkBg font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-sm mt-3"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save to Catalog</span>
                  </>
                )}
              </button>

            </form>
          </div>
        </div>
      )}
      {/* Transfer Stock Modal */}
      {showTransferStockModal && selectedProductForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-sm w-full p-6 rounded-3xl glow-gold/5 animate-fade-in-up space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white">Request Stock Transfer</h3>
              <button 
                onClick={() => { setShowTransferStockModal(false); setSelectedProductForTransfer(null); }}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorTransfer && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                {errorTransfer}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="space-y-3.5">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs space-y-1">
                <div>Product: <strong className="text-white">{selectedProductForTransfer.brand} {selectedProductForTransfer.frame_name}</strong></div>
                <div>SKU / Barcode: <span className="font-mono text-gray-400">{selectedProductForTransfer.barcode}</span></div>
                <div>Available Stock: <span className="font-bold text-gold">{selectedProductForTransfer.current_stock} units</span></div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-semibold text-gray-400">Destination Location *</label>
                <select
                  value={transferToStoreId}
                  onChange={(e) => setTransferToStoreId(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-darkBg text-white border border-white/10 rounded-xl"
                  required
                >
                  <option value="">Select Destination...</option>
                  {stores.filter(s => s.store_id !== selectedProductForTransfer.store_id).map(s => (
                    <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-semibold text-gray-400">Transfer Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProductForTransfer.current_stock}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  placeholder={`Max ${selectedProductForTransfer.current_stock}`}
                  className="w-full py-2 px-3 text-xs bg-darkBg text-white border border-white/10 rounded-xl"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingTransfer}
                className="w-full py-2.5 bg-gradient-to-r from-gold to-gold-light text-darkBg font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                {submittingTransfer ? (
                  <div className="w-4 h-4 border-2 border-darkBg border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Submit Transfer Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfers Ledger Modal */}
      {showTransfersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-4xl w-full p-6 rounded-3xl glow-gold/5 animate-fade-in-up space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-gold" />
                <span>Stock Transfer Logs & Approvals</span>
              </h3>
              <button 
                onClick={() => setShowTransfersModal(false)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[300px] pr-1">
              {loadingTransfers ? (
                <div className="py-12 text-center text-xs text-gray-500 animate-pulse">LOADING TRANSACTION RECORDS...</div>
              ) : transfersList.length > 0 ? (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400">
                      <th className="pb-2.5 pr-2">PRODUCT</th>
                      <th className="pb-2.5 pr-2">FROM</th>
                      <th className="pb-2.5 pr-2">TO</th>
                      <th className="pb-2.5 text-center pr-2">QTY</th>
                      <th className="pb-2.5 pr-2">REQUESTED BY</th>
                      <th className="pb-2.5 text-center pr-2">STATUS</th>
                      {(user.role === 'Owner' || user.role === 'OWNER') && <th className="pb-2.5 text-center">DECISION</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {transfersList.map(t => (
                      <tr key={t.transfer_id} className="hover:bg-white/5">
                        <td className="py-3 pr-2">
                          <span className="font-bold text-white block leading-tight">{t.brand} {t.frame_name}</span>
                          <span className="text-[9px] text-gray-500 font-mono mt-0.5 block">{t.barcode}</span>
                        </td>
                        <td className="py-3 pr-2 text-gray-400">{t.from_store_name}</td>
                        <td className="py-3 pr-2 text-gray-400">{t.to_store_name}</td>
                        <td className="py-3 text-center pr-2 font-bold text-white">{t.quantity}</td>
                        <td className="py-3 pr-2">
                          <span className="text-white block">{t.requested_by}</span>
                          <span className="text-[9px] text-gray-500 mt-0.5 block">{new Date(t.created_at).toLocaleDateString()}</span>
                        </td>
                        <td className="py-3 text-center pr-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                            t.status === 'Approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            t.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        {(user.role === 'Owner' || user.role === 'OWNER') && (
                          <td className="py-3 text-center">
                            {t.status === 'Pending' ? (
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleProcessTransfer(t.transfer_id, 'approve')}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-[9px] transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleProcessTransfer(t.transfer_id, 'reject')}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[9px] transition-all"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-500 font-mono leading-none">Processed by {t.action_by || 'Owner'}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-xs text-gray-500">No stock transfers found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
