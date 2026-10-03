const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

exports.getSettings = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settingsList = await prisma.setting.findMany({ where: { tenant_id } });
    const settingsMap = {};
    settingsList.forEach(s => { settingsMap[s.key] = s.value; });

    const templatesList = await prisma.messageTemplate.findMany({ where: { tenant_id } });
    const templatesMap = {};
    templatesList.forEach(t => { templatesMap[t.type] = t.content; });

    res.json({
      store_name: tenant.business_name || '',
      gst_number: tenant.gst_number || '',
      store_address: tenant.shop_address || '',
      store_mobile: tenant.owner_mobile || '',
      referral_cashback_percent: settingsMap['referral_cashback_percent'] || '5',
      inactive_customer_days: settingsMap['inactive_customer_days'] || '45',
      low_stock_limit: settingsMap['low_stock_limit'] || '5',
      whatsapp_delivery_template_en: templatesMap['HANDOVER_EN'] || '',
      whatsapp_delivery_template_hi: templatesMap['HANDOVER_HI'] || '',
      wa_template_general: templatesMap['GENERAL'] || '',
      wa_template_payment: templatesMap['PAYMENT'] || '',
      wa_template_offer: templatesMap['OFFER'] || '',
      feedback_link: settingsMap['feedback_link'] || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const data = req.body;

    await prisma.tenant.update({
      where: { tenant_id },
      data: {
        business_name: data.store_name,
        gst_number: data.gst_number,
        shop_address: data.store_address,
        owner_mobile: data.store_mobile
      }
    });

    const settingsToUpsert = [
      { key: 'referral_cashback_percent', value: data.referral_cashback_percent },
      { key: 'inactive_customer_days', value: data.inactive_customer_days },
      { key: 'low_stock_limit', value: data.low_stock_limit },
      { key: 'feedback_link', value: data.feedback_link }
    ];

    for (const s of settingsToUpsert) {
      if (s.value !== undefined) {
        await prisma.setting.upsert({
          where: { tenant_id_key: { tenant_id, key: s.key } },
          update: { value: s.value },
          create: { tenant_id, key: s.key, value: s.value }
        });
      }
    }

    const templatesToUpsert = [
      { type: 'HANDOVER_EN', content: data.whatsapp_delivery_template_en },
      { type: 'HANDOVER_HI', content: data.whatsapp_delivery_template_hi },
      { type: 'GENERAL', content: data.wa_template_general },
      { type: 'PAYMENT', content: data.wa_template_payment },
      { type: 'OFFER', content: data.wa_template_offer }
    ];

    for (const t of templatesToUpsert) {
      if (t.content !== undefined) {
        await prisma.messageTemplate.upsert({
          where: { tenant_id_type: { tenant_id, type: t.type } },
          update: { content: t.content },
          create: { tenant_id, type: t.type, content: t.content }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenant_id: req.user.tenant_id },
      include: { store: true }
    });
    const mapped = users.map(u => ({
      user_id: u.id,
      name: u.name,
      username: u.email || u.mobile, // In this system, username is email or mobile
      role: u.role === 'OWNER' ? 'Owner' : 'Employee',
      store_id: u.store_id,
      store_name: u.store?.store_name,
      cross_store_read: false
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, password, name, role, store_id } = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Check if limits reached
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id } });
    if (tenant.max_staff_accounts) {
      const currentCount = await prisma.user.count({ where: { tenant_id } });
      if (currentCount >= tenant.max_staff_accounts) {
        return res.status(400).json({ error: 'Staff account limit reached for your plan' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    const isEmail = username.includes('@');

    const newUser = await prisma.user.create({
      data: {
        tenant_id,
        name,
        email: isEmail ? username : null,
        mobile: !isEmail ? username : null,
        password_hash,
        role: role === 'Owner' ? 'OWNER' : 'EMPLOYEE',
        store_id: role === 'Employee' ? store_id : null
      }
    });

    res.json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { store_id, name, role, cross_store_read } = req.body;
    const tenant_id = req.user.tenant_id;

    const existingUser = await prisma.user.findFirst({
      where: { id, tenant_id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role === 'Owner' || role === 'OWNER' ? 'OWNER' : 'EMPLOYEE';
    if (store_id !== undefined) data.store_id = store_id || null;
    if (cross_store_read !== undefined) data.cross_store_read = Boolean(cross_store_read);

    // If role is changed to OWNER, store_id becomes null
    if (data.role === 'OWNER') {
      data.store_id = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { store: true }
    });

    res.json({
      user_id: updated.id,
      name: updated.name,
      username: updated.email || updated.mobile,
      role: updated.role === 'OWNER' ? 'Owner' : 'Employee',
      store_id: updated.store_id,
      store_name: updated.store?.store_name || null,
      cross_store_read: updated.cross_store_read || false
    });
  } catch (err) {
    console.error('Failed to update user:', err);
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    await prisma.user.delete({
      where: { id, tenant_id: req.user.tenant_id }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const { password } = req.body;
    const tenant_id = req.user.tenant_id;
    const currentUserId = req.user.id;

    // Verify current owner password
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (!currentUser || currentUser.role !== 'OWNER') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const isMatch = await bcrypt.compare(password, currentUser.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId, tenant_id } });
    if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

    // Swap roles
    await prisma.$transaction([
      prisma.user.update({ where: { id: currentUserId }, data: { role: 'EMPLOYEE' } }),
      prisma.user.update({ where: { id: targetUserId }, data: { role: 'OWNER', store_id: null } })
    ]);

    res.json({ message: 'Ownership transferred successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const limit = parseInt(req.query.limit) || 100;
    
    const logs = await prisma.auditLog.findMany({
      where: { tenant_id },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true, role: true } },
        store: { select: { store_name: true } }
      }
    });
    
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};
