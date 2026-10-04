const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getStoreFilter, getTargetStoreId } = require('../middleware/tenantIsolation');

exports.lookupBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const tenant_id = req.user.tenant_id;
    const store_id = getStoreFilter(req).store_id || req.query.store_id; // Need store_id context

    if (!store_id || store_id === 'all') {
      return res.status(400).json({ error: 'store_id is required for product lookup' });
    }

    const product = await prisma.product.findUnique({
      where: {
        tenant_id_store_id_barcode: {
          tenant_id,
          store_id,
          barcode: code
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ 
      ...product, 
      product_id: product.id,
      frame_name: product.product_name,
      frame_color: product.color,
      low_stock_limit: product.low_stock_alert
    });
  } catch (error) {
    console.error('Product barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup product' });
  }
};

exports.adjustStock = async (req, res) => {
  const { tenant_id, user_id, store_id } = req.user;
  const { id } = req.params;
  const { adjustment_quantity, reason = 'Stock Adjustment' } = req.body;

  try {
    const qty = parseInt(adjustment_quantity, 10);
    if (isNaN(qty)) throw new Error('Invalid adjustment quantity');

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.tenant_id !== tenant_id) throw new Error('Product not found');

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          current_stock: { increment: qty },
          last_updated_date: new Date(),
          ...(qty > 0 ? { last_purchase_date: new Date() } : {})
        }
      });

      await tx.inventoryHistory.create({
        data: {
          tenant_id,
          store_id,
          product_id: product.id,
          user_id,
          change_type: 'ADJUSTMENT',
          quantity_changed: qty,
          new_stock: product.current_stock + qty,
          reason
        }
      });

      return updatedProduct;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(result);
  } catch (error) {
    console.error('Stock adjustment error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  const { tenant_id } = req.user;
  const { category, section, search, store_id, is_paginated, page, limit } = req.query;
  const storeFilter = getStoreFilter(req);
  const where = { tenant_id: req.user.tenant_id, status: 'ACTIVE' };
  
  if (storeFilter.store_id) {
    if (category === 'LENS_TYPE' || category === 'LENS_COATING' || category === 'Lens Type' || category === 'Lens Coating') {
      // Tenant-wide lens definitions
    } else if (!category || category === 'All') {
      where.OR = [
        { store_id: storeFilter.store_id },
        { category: { in: ['LENS_TYPE', 'LENS_COATING'] } }
      ];
    } else {
      where.store_id = storeFilter.store_id;
    }
  }
  
  if (section && section !== 'All') {
    where.section = section;
  } else if (category && category !== 'All') {
    if (category === 'Eyevengers Classic' || category === 'Eyevengers Premium') {
      where.section = category;
    } else if (category === 'Contact Lens' || category === 'CONTACT_LENS' || category === 'Contact lens') {
      where.OR = [
        { section: 'Contact lens' },
        { category: 'CONTACT_LENS' }
      ];
    } else if (category === 'Lens Type' || category === 'LENS_TYPE') {
      where.category = 'LENS_TYPE';
    } else if (category === 'Lens Coating' || category === 'LENS_COATING') {
      where.category = 'LENS_COATING';
    } else if (category === 'Sunglasses' || category === 'SUNGLASSES') {
      where.category = 'SUNGLASSES';
    } else {
      where.category = category.toUpperCase().replace(' ', '_');
    }
  }
  if (search) {
    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } },
      { product_name: { contains: search, mode: 'insensitive' } },
      { barcode: search }
    ];
  }
  
  try {
    if (is_paginated === 'true') {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const skip = (p - 1) * l;
      
      const [data, total] = await Promise.all([
        prisma.product.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: l }),
        prisma.product.count({ where })
      ]);
      
      const formattedData = data.map(prod => ({ 
        ...prod, 
        product_id: prod.id,
        frame_name: prod.product_name,
        frame_color: prod.color,
        features: prod.features || '',
        low_stock_limit: prod.low_stock_alert
      }));
      
      return res.json({
        data: formattedData,
        total,
        page: p,
        pages: Math.ceil(total / l),
        limit: l
      });
    }

    const products = await prisma.product.findMany({ 
      where, 
      select: {
        id: true,
        product_name: true,
        brand: true,
        category: true,
        section: true,
        color: true,
        size: true,
        features: true,
        selling_price: true,
        current_stock: true,
        barcode: true,
        low_stock_alert: true
      },
      orderBy: { created_at: 'desc' } 
    });
    const formattedProducts = products.map(prod => ({ 
      ...prod, 
      product_id: prod.id,
      frame_name: prod.product_name,
      frame_color: prod.color,
      features: prod.features || '',
      low_stock_limit: prod.low_stock_alert
    }));
    res.json(formattedProducts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const { 
      barcode, category, section, brand, frame_name, product_name, 
      color, frame_color, size, features, purchase_price, selling_price, 
      opening_stock, current_stock, low_stock_limit, low_stock_alert, supplier_name, supplier
    } = req.body;

    let targetStoreId = getTargetStoreId(req);
    if (!targetStoreId || targetStoreId === 'all') {
      const defaultStore = await prisma.store.findFirst({ where: { tenant_id: req.user.tenant_id } });
      if (!defaultStore) throw new Error("No store found. Please create a store first.");
      targetStoreId = defaultStore.store_id;
    }

    // Determine category based on section or category
    let resolvedCategory = category ? category.toUpperCase().replace(' ', '_') : 'FRAMES';
    if (category === 'LENS_TYPE' || category === 'Lens Type') {
      resolvedCategory = 'LENS_TYPE';
    } else if (category === 'LENS_COATING' || category === 'Lens Coating') {
      resolvedCategory = 'LENS_COATING';
    } else if (category === 'Sunglasses' || category === 'SUNGLASSES') {
      resolvedCategory = 'SUNGLASSES';
    } else if (section === 'Contact lens' || category === 'Contact Lens' || category === 'CONTACT_LENS') {
      resolvedCategory = 'CONTACT_LENS';
    }

    let finalBarcode = barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      if (resolvedCategory === 'LENS_TYPE') finalBarcode = `LT-${Date.now().toString().slice(-6)}`;
      else if (resolvedCategory === 'LENS_COATING') finalBarcode = `LC-${Date.now().toString().slice(-6)}`;
      else finalBarcode = `PRD-${Date.now().toString().slice(-6)}`;
    }

    const data = { 
      tenant_id: req.user.tenant_id,
      store_id: targetStoreId,
      barcode: finalBarcode,
      category: resolvedCategory,
      section: section || (resolvedCategory === 'SUNGLASSES' ? 'Sunglasses' : (resolvedCategory.startsWith('LENS') ? 'Lenses' : 'Eyevengers Classic')),
      brand: brand || (resolvedCategory === 'FRAMES' ? 'Eyevengers' : (resolvedCategory.startsWith('LENS') ? 'Standard' : 'Eyevengers')),
      product_name: product_name || frame_name,
      color: color || frame_color,
      size,
      features: features || null,
      purchase_price: parseFloat(purchase_price || 0),
      selling_price: parseFloat(selling_price || 0),
      opening_stock: parseInt(opening_stock || current_stock || (resolvedCategory.startsWith('LENS') ? 999 : 0)),
      current_stock: parseInt(current_stock || opening_stock || (resolvedCategory.startsWith('LENS') ? 999 : 0)),
      low_stock_alert: parseInt(low_stock_alert || low_stock_limit || 5),
      supplier_name: supplier_name || supplier
    };
    
    const product = await prisma.product.create({ data });
    res.json(product);
  } catch (err) { 
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A product with this barcode already exists for this store.' });
    }
    res.status(500).json({ error: err.message }); 
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.category) data.category = data.category.toUpperCase().replace(' ', '_');
    if (data.price) data.price = parseFloat(data.price);
    if (data.current_stock) data.current_stock = parseInt(data.current_stock);
    if (data.low_stock_limit) data.low_stock_limit = parseInt(data.low_stock_limit);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: 'DISCONTINUED' } });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
