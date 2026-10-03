const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { requireTenantAuth, requireOwner } = require('../middleware/tenantIsolation');

// GET /api/v1/settings
router.get('/', requireTenantAuth, requireOwner, settingsController.getSettings);

// POST /api/v1/settings
router.post('/', requireTenantAuth, requireOwner, settingsController.saveSettings);

// GET /api/v1/settings/users
router.get('/users', requireTenantAuth, requireOwner, settingsController.getUsers);

// POST /api/v1/settings/users
router.post('/users', requireTenantAuth, requireOwner, settingsController.createUser);

// DELETE /api/v1/settings/users/:id
router.delete('/users/:id', requireTenantAuth, requireOwner, settingsController.deleteUser);

// PUT /api/v1/settings/users/:id
router.put('/users/:id', requireTenantAuth, requireOwner, settingsController.updateUser);
router.patch('/users/:id', requireTenantAuth, requireOwner, settingsController.updateUser);

// POST /api/v1/settings/users/:id/transfer-ownership
router.post('/users/:id/transfer-ownership', requireTenantAuth, requireOwner, settingsController.transferOwnership);

// GET /api/v1/settings/audit
router.get('/audit', requireTenantAuth, requireOwner, settingsController.getAuditLogs);

module.exports = router;
