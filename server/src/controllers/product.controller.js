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

    res.json({ ...product, product_id: product.id });
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
  const where = { tenant_id: req.user.tenant_id, ...getStoreFilter(req), status: 'ACTIVE' };
  
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
      
      const formattedData = data.map(prod => ({ ...prod, product_id: prod.id }));
      
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
        selling_price: true,
        current_stock: true,
        barcode: true
      },
      orderBy: { created_at: 'desc' } 
    });
    const formattedProducts = products.map(prod => ({ ...prod, product_id: prod.id }));
    res.json(formattedProducts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProduct = async (req, res) => {
  try {
    const { 
      barcode, category, section, brand, frame_name, product_name, 
      color, frame_color, size, purchase_price, selling_price, 
      opening_stock, current_stock, low_stock_limit, low_stock_alert, supplier_name, supplier
    } = req.body;

    let targetStoreId = getTargetStoreId(req);
    if (!targetStoreId || targetStoreId === 'all') {
      const defaultStore = await prisma.store.findFirst({ where: { tenant_id: req.user.tenant_id } });
      if (!defaultStore) throw new Error("No store found. Please create a store first.");
      targetStoreId = defaultStore.store_id;
    }

    // Determine category based on section if not explicitly passed
    let resolvedCategory = category ? category.toUpperCase().replace(' ', '_') : 'FRAMES';
    if (section === 'Contact lens') {
      resolvedCategory = 'CONTACT_LENS';
    }

    const data = { 
      tenant_id: req.user.tenant_id,
      store_id: targetStoreId,
      barcode,
      category: resolvedCategory,
      section: section || 'Eyevengers Classic',
      brand: brand || (section && section.startsWith('Eyevengers') ? 'Eyevengers' : 'Eyevengers'),
      product_name: product_name || frame_name,
      color: color || frame_color,
      size,
      purchase_price: parseFloat(purchase_price || 0),
      selling_price: parseFloat(selling_price || 0),
      opening_stock: parseInt(opening_stock || current_stock || 0),
      current_stock: parseInt(current_stock || opening_stock || 0),
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
