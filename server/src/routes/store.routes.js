const express = require('express');
const router = express.Router();
const { prisma } = require('../prisma');
const { requireTenantAuth, requireOwner } = require('../middleware/tenantIsolation');

// All store routes require tenant authentication
router.use(requireTenantAuth);

// 1. Get all stores for current tenant (Owner gets all, Employee gets assigned store)
router.get('/', async (req, res) => {
  try {
    const roleStr = String(req.user?.role || '').trim().toUpperCase();
    let where = { tenant_id: req.user.tenant_id };

    if (roleStr === 'EMPLOYEE' && !req.user.cross_store_read) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { store_id: true, cross_store_read: true }
      });
      if (dbUser && dbUser.store_id && !dbUser.cross_store_read) {
        where.store_id = dbUser.store_id;
      }
    }

    const stores = await prisma.store.findMany({
      where,
      orderBy: { created_at: 'asc' }
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add new store (Owner only)
router.post('/', requireOwner, async (req, res) => {
  const { store_name, address, phone, gst_number, custom_receipt_footer } = req.body;
  if (!store_name) return res.status(400).json({ error: 'Store name is required' });

  try {
    // Check max stores limit
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: req.user.tenant_id } });
    if (tenant.max_stores !== null) {
      const storeCount = await prisma.store.count({ where: { tenant_id: req.user.tenant_id } });
      if (storeCount >= tenant.max_stores) {
        return res.status(403).json({ error: `You have reached your limit of ${tenant.max_stores} stores. Please upgrade your plan.` });
      }
    }

    const store = await prisma.store.create({
      data: {
        tenant_id: req.user.tenant_id,
        store_name,
        address,
        phone,
        gst_number,
        custom_receipt_footer
      }
    });
    res.status(201).json(store);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Update store (Owner only)
router.put('/:id', requireOwner, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const updated = await prisma.store.update({
      where: { store_id: id, tenant_id: req.user.tenant_id },
      data
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Delete store (Owner only)
router.delete('/:id', requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent deleting the last store
    const storeCount = await prisma.store.count({ where: { tenant_id: req.user.tenant_id } });
    if (storeCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining store.' });
    }

    await prisma.store.delete({
      where: { store_id: id, tenant_id: req.user.tenant_id }
    });
    res.json({ message: 'Store deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
