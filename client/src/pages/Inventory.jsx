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
  const [categories] = useState(['All', 'Eyevengers Classic', 'Eyevengers Premium', 'Sunglasses', 'Lens Type', 'Lens Coating', 'Contact Lens', 'Frames', 'Accessories']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  
  // Add product form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [productType, setProductType] = useState('FRAME'); // 'FRAME', 'SUNGLASSES', 'LENS', 'CONTACT_LENS'
  const [lensCategory, setLensCategory] = useState('LENS_TYPE'); // 'LENS_TYPE', 'LENS_COATING'
  const [barcode, setBarcode] = useState('');
  const [section, setSection] = useState('Eyevengers Classic');
  const [category, setCategory] = useState('Frames');
  const [brand, setBrand] = useState('Eyevengers');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [features, setFeatures] = useState('');
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

  // Stock update modal states
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [stockAddQty, setStockAddQty] = useState('');
  const [stockReason, setStockReason] = useState('New Stock Refill');
  const [submittingStock, setSubmittingStock] = useState(false);
  const [errorStock, setErrorStock] = useState('');

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

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!selectedProductForStock || !stockAddQty) return;
    const qty = parseInt(stockAddQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorStock('Please enter a valid quantity greater than 0');
      return;
    }
    setErrorStock('');
    setSubmittingStock(true);
    try {
      const pId = selectedProductForStock.product_id || selectedProductForStock.id;
      const res = await fetch(`/api/v1/products/${pId}/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          adjustment_quantity: qty,
          reason: stockReason.trim() || 'New Stock Refill'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');

      // Update in local list immediately
      setProducts(prev => prev.map(p => {
        if ((p.product_id || p.id) === pId) {
          return {
            ...p,
            current_stock: data.current_stock,
            last_updated_date: data.last_updated_date || new Date().toISOString()
          };
        }
        return p;
      }));

      setShowStockModal(false);
      setSelectedProductForStock(null);
      setStockAddQty('');
    } catch (err) {
      setErrorStock(err.message);
    } finally {
      setSubmittingStock(false);
    }
  };

  const handleProductTypeChange = (type) => {
    setProductType(type);
    setError('');
    if (type === 'FRAME') {
      setSection('Eyevengers Classic');
      setCategory('Frames');
      setBrand('Eyevengers');
      setStock('');
    } else if (type === 'SUNGLASSES') {
      setSection('Sunglasses');
      setCategory('Sunglasses');
      setBrand('');
      setStock('');
    } else if (type === 'LENS') {
      setSection('Lenses');
      setCategory(lensCategory);
      setBrand('Vision');
      setStock('999');
    } else if (type === 'CONTACT_LENS') {
      setSection('Contact lens');
      setCategory('Contact Lens');
      setBrand('Bausch & Lomb');
      setStock('');
    }
  };

  const handleSectionSelect = (sec) => {
    setSection(sec);
    setCategory('Frames');
    if (!brand || brand === 'Ray-Ban') {
      setBrand('Eyevengers');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Please fill in Model/Lens name');
      return;
    }
    if ((productType !== 'LENS' || lensCategory === 'LENS_COATING') && !sellingPrice) {
      setError('Please fill in Selling Price / Rate');
      return;
    }
    if (productType !== 'LENS' && !stock) {
      setError('Please enter stock quantity');
      return;
    }

    setError('');
    setSubmitting(true);

    let resolvedCategory = category;
    let resolvedSection = section;

    if (productType === 'FRAME') {
      resolvedCategory = 'FRAMES';
      resolvedSection = section;
    } else if (productType === 'SUNGLASSES') {
      resolvedCategory = 'SUNGLASSES';
      resolvedSection = 'Sunglasses';
    } else if (productType === 'LENS') {
      resolvedCategory = lensCategory;
      resolvedSection = 'Lenses';
    } else if (productType === 'CONTACT_LENS') {
      resolvedCategory = 'CONTACT_LENS';
      resolvedSection = 'Contact lens';
    }

    const autoBarcode = barcode.trim() || (productType === 'LENS' ? (lensCategory === 'LENS_TYPE' ? `LT-${Date.now().toString().slice(-6)}` : `LC-${Date.now().toString().slice(-6)}`) : `PRD-${Date.now().toString().slice(-6)}`);
    const priceToSave = (productType === 'LENS' && lensCategory === 'LENS_TYPE') ? 0 : parseFloat(sellingPrice || 0);

    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          barcode: autoBarcode,
          section: resolvedSection,
          category: resolvedCategory,
          brand: brand.trim() || (productType === 'FRAME' ? 'Eyevengers' : (productType === 'LENS' ? 'Standard' : 'Eyevengers')),
          frame_name: name.trim(),
          product_name: name.trim(),
          frame_color: color.trim(),
          color: color.trim(),
          size: size.trim(),
          features: features.trim() || null,
          purchase_price: parseFloat(purchasePrice || 0),
          selling_price: priceToSave,
          opening_stock: parseInt(stock || (productType === 'LENS' ? 999 : 0)),
          current_stock: parseInt(stock || (productType === 'LENS' ? 999 : 0)),
          low_stock_limit: parseInt(lowStockLimit || 5),
          supplier: supplier.trim()
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
    setProductType('FRAME');
    setLensCategory('LENS_TYPE');
    setBarcode('');
    setSection('Eyevengers Classic');
    setCategory('Frames');
    setBrand('Eyevengers');
    setName('');
    setColor('');
    setSize('');
    setFeatures('');
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
                const isLow = p.current_stock <= (p.low_stock_limit ?? p.low_stock_alert ?? 5);
                return (
                  <tr key={p.product_id} className="hover:bg-white/5">
                    <td className="py-4 pr-2 font-mono text-[10px] text-gray-400">{p.barcode}</td>
                    <td className="py-4 pr-2">
                      <span className="font-extrabold text-white block leading-tight">{p.brand}</span>
                      <span className="text-xs font-semibold text-gold/90 mt-0.5 block">
                        {p.product_name || p.frame_name || '-'}
                      </span>
                      {p.features && (
                        <span className="text-[10px] text-gray-400 mt-0.5 block truncate max-w-xs">
                          ✨ {p.features}
                        </span>
                      )}
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
                      <span className="block text-white leading-none">{p.color || p.frame_color || '-'}</span>
                      <span className="text-[9px] text-gray-400 mt-1 block">{p.size || '-'}</span>
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
                        {p.last_updated_date ? (
                          <span className="text-[9px] text-gray-400 font-mono mt-1" title="Last Stock Update Date">
                            📅 {new Date(p.last_updated_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        ) : p.created_at ? (
                          <span className="text-[9px] text-gray-500 font-mono mt-1" title="Created Date">
                            📅 {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {(user.role === 'Owner' || user.role === 'OWNER' || (hasFeature('multi_store') && stores.length > 1)) && (
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setSelectedProductForStock(p);
                              setStockAddQty('');
                              setStockReason('New Stock Refill');
                              setErrorStock('');
                              setShowStockModal(true);
                            }}
                            className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all"
                            title="Add / Update Stock (+)"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
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
              
              {/* Product Type Selector */}
              <div className="flex flex-col space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gold tracking-wide uppercase flex items-center justify-between">
                  <span>Product Type *</span>
                  <span className="text-[10px] text-gray-400 font-normal">Select what you are adding</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {[
                    { id: 'FRAME', label: 'Optical Frame', icon: '👓', desc: 'Classic / Premium' },
                    { id: 'SUNGLASSES', label: 'Sunglasses', icon: '🕶️', desc: 'Direct Brand & Rate' },
                    { id: 'LENS', label: 'Spectacle Lens', icon: '🔍', desc: 'Type & Coating' },
                    { id: 'CONTACT_LENS', label: 'Contact Lens', icon: '👁️', desc: 'Contact Pack' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleProductTypeChange(t.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        productType === t.id
                          ? 'bg-gradient-to-br from-gold/20 via-gold/10 to-transparent border-gold shadow-lg shadow-gold/10 text-white ring-1 ring-gold/50'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="text-xl mb-1">{t.icon}</div>
                      <div className="font-extrabold text-xs leading-snug">{t.label}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Sub-selector for Frame */}
              {productType === 'FRAME' && (
                <div className="flex flex-col space-y-2 md:col-span-2 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <label className="text-xs font-bold text-gold tracking-wide uppercase">
                    Select Frame Section *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'Eyevengers Classic', label: 'Eyevengers Classic', icon: '👓', price: '₹450' },
                      { id: 'Eyevengers Premium', label: 'Eyevengers Premium', icon: '💎', price: '₹650' }
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => handleSectionSelect(sec.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          section === sec.id
                            ? 'bg-gold/20 border-gold text-white font-bold ring-1 ring-gold/50'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <span>{sec.icon}</span>
                          <span className="text-xs font-bold">{sec.label}</span>
                        </span>
                        <span className="text-xs text-gold font-mono">{sec.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditional Sub-selector for Lens */}
              {productType === 'LENS' && (
                <div className="flex flex-col space-y-2 md:col-span-2 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent p-4 rounded-2xl border border-gold/30">
                  <label className="text-xs font-bold text-gold tracking-wide uppercase">
                    Select Lens Component *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setLensCategory('LENS_TYPE');
                        setSellingPrice('0');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col ${
                        lensCategory === 'LENS_TYPE'
                          ? 'bg-amber-500/20 border-amber-400 text-white font-bold ring-1 ring-amber-400/50'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-bold text-amber-300">1. Lens Type (₹0 / Type Only)</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Single Vision, Bifocal, Progressive (No price required)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLensCategory('LENS_COATING');
                        if (sellingPrice === '0') setSellingPrice('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col ${
                        lensCategory === 'LENS_COATING'
                          ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold ring-1 ring-emerald-400/50'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-bold text-emerald-300">2. Lens Coating / Package (With Price & Features)</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Blue Cut, Anti-Glare, Photochromic, Crizal (Lens + Coating Rate)</span>
                    </button>
                  </div>
                  {lensCategory === 'LENS_TYPE' ? (
                    <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                      💡 <strong>Lens Type sirf chashme ke design ke liye hai (jaise Single Vision, Bifocal, Progressive). Iska rate ₹0 rahega, actual rate Coating package me set hoga.</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                      💡 <strong>Isme pura lens + coating ka final rate daaliye (jaise Blue Cut ₹800, Photochromic ₹1500) aur features likhiye. Billing me yehi rate automatic select hoga.</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Barcode input */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">
                  Barcode {productType === 'LENS' ? '(Optional - Auto-generated)' : '*'}
                </label>
                <input
                  type="text"
                  placeholder={productType === 'LENS' ? 'Auto-generated if empty' : 'Barcode / SKU scan'}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required={productType !== 'LENS'}
                />
              </div>

              {/* Brand input */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">
                  {productType === 'LENS' ? 'Brand / Lab *' : 'Brand *'}
                </label>
                <input
                  type="text"
                  placeholder={productType === 'LENS' ? 'e.g. Essilor, Zeiss, Vision' : (productType === 'SUNGLASSES' ? 'e.g. Ray-Ban, Fastrack, Eyevengers' : 'e.g. Eyevengers')}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              {/* Model / Lens Name input */}
              <div className={`flex flex-col space-y-1 ${productType === 'LENS' ? 'md:col-span-2' : ''}`}>
                <label className="text-xs font-semibold text-gray-400">
                  {productType === 'LENS' ? (lensCategory === 'LENS_TYPE' ? 'Lens Type Name *' : 'Lens Coating Name *') : 'Model Name *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    productType === 'LENS'
                      ? (lensCategory === 'LENS_TYPE' ? 'e.g. Single Vision Standard, Progressive HD' : 'e.g. Anti-Glare ARC, Blue Block UV420, Crizal Rock')
                      : 'e.g. Aviator Classic, Metal Square'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2 px-3 text-xs"
                  required
                />
              </div>

              {/* Lens Features Field (for Lenses) */}
              {productType === 'LENS' && (
                <div className="flex flex-col space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-gold">
                    Lens Features & Benefits (Printed on Customer Invoice) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anti-Glare, Blue Cut UV420, Scratch Resistant, Water Repellent"
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    className="w-full py-2 px-3 text-xs"
                  />
                  <span className="text-[10px] text-gray-400">
                    Yeh features bill aur invoice PDF me item ke sath print honge.
                  </span>
                </div>
              )}

              {/* Color & Size (for Frame & Sunglasses) */}
              {productType !== 'LENS' && (
                <>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-400">Color (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Gold/Green, Matte Black"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full py-2 px-3 text-xs"
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-400">Size (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Medium (55mm), Wide"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full py-2 px-3 text-xs"
                    />
                  </div>
                </>
              )}

              {/* Pricing */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-400">Purchase Price (₹) (Optional)</label>
                <input
                  type="text"
                  placeholder="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-2 px-3 text-xs"
                />
              </div>

              {productType === 'LENS' && lensCategory === 'LENS_TYPE' ? (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Rate / Price (₹)</label>
                  <input
                    type="text"
                    value="₹0 (Free / Design Only)"
                    disabled
                    className="w-full py-2 px-3 text-xs bg-white/5 text-gray-400 cursor-not-allowed border border-white/5 rounded-xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-gray-400">
                    {productType === 'LENS' ? 'Lens + Coating Package Rate (₹) *' : 'Selling Price / Rate (₹) *'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 800"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-2 px-3 text-xs"
                    required
                  />
                </div>
              )}

              {/* Stock */}
              {productType !== 'LENS' && (
                <>
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
                </>
              )}

              <div className="flex flex-col space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-gray-400">Supplier / Lab Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Supplier name or laboratory notes"
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
                <div>Product: <strong className="text-white">{selectedProductForTransfer.brand} {selectedProductForTransfer.product_name || selectedProductForTransfer.frame_name}</strong></div>
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
                          <span className="font-bold text-white block leading-tight">{t.product?.brand || t.brand} {t.product?.product_name || t.product_name || t.frame_name}</span>
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

      {/* Update Stock Modal */}
      {showStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-modal max-w-md w-full p-6 rounded-3xl glow-gold/5 animate-fade-in-up space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <span>Update Stock / Naya Maal Add Karein</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  <strong className="text-white">{selectedProductForStock.brand}</strong> — {selectedProductForStock.product_name || selectedProductForStock.frame_name} ({selectedProductForStock.barcode})
                </p>
              </div>
              <button 
                onClick={() => { setShowStockModal(false); setSelectedProductForStock(null); }}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorStock && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {errorStock}
              </div>
            )}

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase">Current Stock</span>
                  <span className="text-lg font-black text-white">{selectedProductForStock.current_stock} pcs</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold uppercase">After Adding</span>
                  <span className="text-lg font-black text-emerald-400">
                    {selectedProductForStock.current_stock + (parseInt(stockAddQty, 10) || 0)} pcs
                  </span>
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-300">
                  New Quantity to Add (Pcs) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50"
                  value={stockAddQty}
                  onChange={(e) => setStockAddQty(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-sm font-bold font-mono py-2.5 px-3"
                  autoFocus
                  required
                />
                <span className="text-[10px] text-gray-400">
                  Jitna naya maal aaya hai wo quantity daalein (ye current stock me jud jayegi).
                </span>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-gray-300">
                  Reason / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. New Vendor Purchase / Refill"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="w-full text-xs py-2 px-3"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center space-x-2">
                <span>📅</span>
                <span>
                  Update karte hi aaj ki tareekh (<strong>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>) automatic save ho jayegi aur table me dikhegi.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowStockModal(false); setSelectedProductForStock(null); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStock || !stockAddQty}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submittingStock ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Update Stock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
