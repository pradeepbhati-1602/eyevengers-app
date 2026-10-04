const { prisma } = require('../prisma');
const { getStoreFilter } = require('../middleware/tenantIsolation');

exports.getMetrics = async (req, res) => {
  const { tenant_id } = req.user;
  const storeFilter = getStoreFilter(req);
  
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayAgg, monthAgg, totalAgg, 
      todayCount, monthCount, totalCount,
      totalCustomers, stores, dueBillsCount, dueAmountAgg, undelivered, lowStock, birthdays
    ] = await Promise.all([
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, ...storeFilter, created_at: { gte: today } } }),
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, ...storeFilter, created_at: { gte: firstDayOfMonth } } }),
      prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, ...storeFilter } }),
      prisma.bill.count({ where: { tenant_id, ...storeFilter, created_at: { gte: today } } }),
      prisma.bill.count({ where: { tenant_id, ...storeFilter, created_at: { gte: firstDayOfMonth } } }),
      prisma.bill.count({ where: { tenant_id, ...storeFilter } }),
      prisma.customer.count({ where: { tenant_id } }), // Customers are global
      (req.user.role === 'OWNER' || req.user.cross_store_read)
        ? prisma.store.findMany({ where: { tenant_id }, select: { store_id: true, store_name: true } })
        : prisma.store.findMany({ where: { tenant_id, ...(storeFilter.store_id ? { store_id: storeFilter.store_id } : {}) }, select: { store_id: true, store_name: true } }),
      prisma.bill.count({ where: { tenant_id, due_amount: { gt: 0 } } }),
      prisma.bill.aggregate({ _sum: { due_amount: true }, where: { tenant_id, due_amount: { gt: 0 } } }),
      prisma.bill.count({ where: { tenant_id, delivery_status: 'PENDING' } }),
      storeFilter.store_id 
        ? prisma.$queryRaw`SELECT COUNT(*) FROM products WHERE tenant_id = ${tenant_id} AND store_id = ${storeFilter.store_id} AND current_stock <= low_stock_alert AND status = 'ACTIVE'`
        : prisma.$queryRaw`SELECT COUNT(*) FROM products WHERE tenant_id = ${tenant_id} AND current_stock <= low_stock_alert AND status = 'ACTIVE'`,
      prisma.$queryRaw`SELECT COUNT(*) FROM customers WHERE tenant_id = ${tenant_id} AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)`
    ]);

    const lsCount = Number(lowStock[0].count);
    const bdCount = Number(birthdays[0].count);

    const revToday = Number(todayAgg._sum.total_amount || 0);
    const revMonth = Number(monthAgg._sum.total_amount || 0);
    const revTotal = Number(totalAgg._sum.total_amount || 0);
    const totalDue = Number(dueAmountAgg._sum.due_amount || 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const recentBillsForCharts = await prisma.bill.findMany({
      where: { tenant_id, ...storeFilter, created_at: { gte: sevenDaysAgo } },
      select: { created_at: true, total_amount: true, items: true }
    });

    const revenueMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      revenueMap[dayStr] = 0;
    }

    const categoryMap = { 'FRAMES': 0, 'SUNGLASSES': 0, 'CONTACT LENSES': 0, 'ACCESSORIES': 0 };

    recentBillsForCharts.forEach(b => {
      const dayStr = new Date(b.created_at).toLocaleDateString('en-US', { weekday: 'short' });
      if (revenueMap[dayStr] !== undefined) {
        revenueMap[dayStr] += Number(b.total_amount);
      }
      const cat = b.bill_type === 'SUNGLASSES' ? 'SUNGLASSES' : 'FRAMES';
      categoryMap[cat] += Number(b.total_amount);
    });

    const revenueTrend = Object.keys(revenueMap).map(day => ({ day, sales: revenueMap[day] }));
    const categorySplit = Object.keys(categoryMap).filter(k => categoryMap[k] > 0).map(name => ({ name, value: categoryMap[name] }));

    res.json({
      metrics: {
        today: { revenue: revToday, bills: todayCount },
        monthly: { revenue: revMonth, bills: monthCount },
        overall: { 
          revenue: revTotal, 
          bills: totalCount, 
          customers: totalCustomers,
          avgBill: totalCount > 0 ? revTotal / totalCount : 0
        },
        alerts: {
          totalDueAmount: totalDue,
          pendingDues: dueBillsCount,
          undelivered_orders: undelivered,
          low_stock_items: lsCount,
          expiringWarranties: 0,
          birthday_customers: bdCount
        },
        stores
      },
      charts: {
        revenueTrend,
        categorySplit
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getBirthdaysToday = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    // In PostgreSQL, to find today's birthdays regardless of year:
    // We can fetch all and filter, or use raw SQL. For simplicity, fetch customers with birthdays and filter in JS if small,
    // or use a raw query.
    const customers = await prisma.$queryRaw`
      SELECT id, name, mobile, birthday 
      FROM customers 
      WHERE tenant_id = ${tenant_id} 
      AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
    `;
    res.json(customers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getDuePayments = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    const bills = await prisma.bill.findMany({
      where: { tenant_id, due_amount: { gt: 0 } },
      select: { 
        id: true, 
        invoice_number: true, 
        due_amount: true, 
        total_amount: true, 
        created_at: true, 
        store: { select: { store_name: true } },
        customer: { select: { name: true, mobile: true } } 
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    const formatted = bills.map(b => ({
      ...b,
      bill_id: b.invoice_number, // UI expects invoice_number here
      customer_name: b.customer?.name || 'Unknown',
      customer_mobile: b.customer?.mobile || '',
      store_name: b.store?.store_name || 'Main Branch'
    }));
    res.json(formatted);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUndelivered = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    const bills = await prisma.bill.findMany({
      where: { tenant_id, delivery_status: 'PENDING' },
      select: { 
        id: true, 
        invoice_number: true, 
        total_amount: true, 
        created_at: true, 
        due_amount: true,
        items: true,
        store: { select: { store_name: true } },
        customer: { select: { name: true, mobile: true } } 
      },
      orderBy: { created_at: 'asc' },
      take: 100
    });
    const formatted = bills.map(b => {
      let brand = 'Unknown';
      
      // Parse items safely
      let parsedItems = b.items || [];
      if (typeof parsedItems === 'string') {
        try { parsedItems = JSON.parse(parsedItems); } catch(e) {}
      }
      
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        brand = parsedItems[0]?.brand || 'Unknown';
      }

      return {
        ...b,
        bill_id: b.invoice_number,
        customer_name: b.customer?.name || 'Unknown',
        customer_mobile: b.customer?.mobile || '',
        brand,
        store_name: b.store?.store_name || 'Main Branch'
      };
    });
    res.json(formatted);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getLowStock = async (req, res) => {
  const { tenant_id } = req.user;
  const storeFilter = getStoreFilter(req);
  try {
    let products;
    if (storeFilter.store_id) {
      products = await prisma.$queryRaw`
        SELECT id, barcode, product_name, brand, current_stock, low_stock_alert 
        FROM products 
        WHERE tenant_id = ${tenant_id} 
        AND store_id = ${storeFilter.store_id}
        AND current_stock <= low_stock_alert
        AND status = 'ACTIVE'
      `;
    } else {
      products = await prisma.$queryRaw`
        SELECT id, barcode, product_name, brand, current_stock, low_stock_alert 
        FROM products 
        WHERE tenant_id = ${tenant_id} 
        AND current_stock <= low_stock_alert
        AND status = 'ACTIVE'
      `;
    }
    res.json(products);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getComparison = async (req, res) => {
  const { tenant_id } = req.user;
  
  try {
    const stores = await prisma.store.findMany({ 
      where: { tenant_id }, 
      select: { store_id: true, store_name: true } 
    });
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const results = [];
    for (const store of stores) {
      const [todayAgg, monthAgg, totalAgg, todayCount, monthCount, totalCount] = await Promise.all([
        prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, store_id: store.store_id, created_at: { gte: today } } }),
        prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, store_id: store.store_id, created_at: { gte: firstDayOfMonth } } }),
        prisma.bill.aggregate({ _sum: { total_amount: true }, where: { tenant_id, store_id: store.store_id } }),
        prisma.bill.count({ where: { tenant_id, store_id: store.store_id, created_at: { gte: today } } }),
        prisma.bill.count({ where: { tenant_id, store_id: store.store_id, created_at: { gte: firstDayOfMonth } } }),
        prisma.bill.count({ where: { tenant_id, store_id: store.store_id } }),
      ]);

      const revTotal = Number(totalAgg._sum.total_amount || 0);

      results.push({
        store_id: store.store_id,
        store_name: store.store_name,
        today: { revenue: Number(todayAgg._sum.total_amount || 0), bills: todayCount },
        monthly: { revenue: Number(monthAgg._sum.total_amount || 0), bills: monthCount },
        overall: { 
          revenue: revTotal, 
          bills: totalCount, 
          aov: totalCount > 0 ? revTotal / totalCount : 0 
        }
      });
    }

    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

