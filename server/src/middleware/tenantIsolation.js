const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const requireTenantAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123');
    
    // Check if they are a superadmin (superadmins don't need tenant_id for their own routes)
    if (decoded.role === 'SUPERADMIN') {
      req.user = decoded;
      return next();
    }

    if (!decoded.tenant_id) {
      return res.status(401).json({ error: 'Tenant context missing from token' });
    }

    req.user = decoded;
    req.tenant_id = decoded.tenant_id;

    // Refresh dynamic store assignment and role directly from DB
    if (decoded.id) {
      try {
        const freshUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { store_id: true, role: true, cross_store_read: true }
        });
        if (freshUser) {
          req.user.store_id = freshUser.store_id;
          req.user.role = freshUser.role;
          req.user.cross_store_read = freshUser.cross_store_read;
          req.store_id = freshUser.store_id;
        } else if (decoded.store_id) {
          req.store_id = decoded.store_id;
        }
      } catch (err) {
        if (decoded.store_id) req.store_id = decoded.store_id;
      }
    } else if (decoded.store_id) {
      req.store_id = decoded.store_id;
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireSuperAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123');
    if (decoded.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Super Admin privileges required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const requireOwner = (req, res, next) => {
  const roleStr = String(req.user?.role || '').trim().toUpperCase();
  if (roleStr !== 'OWNER') {
    return res.status(403).json({ error: 'Owner privileges required for this action' });
  }
  next();
};

const getStoreFilter = (req) => {
  const roleStr = String(req.user?.role || '').trim().toUpperCase();
  // If user is an Owner, or an Employee with cross_store_read, they can see all stores
  if (roleStr === 'OWNER' || req.user.cross_store_read) {
    // Return empty object (no filter), OR if they passed a specific store query, use it
    if (req.query.store_id && req.query.store_id !== 'all') {
      return { store_id: req.query.store_id };
    }
    return {};
  }
  
  // Otherwise, lock them to their assigned store
  return { store_id: req.user.store_id };
};

const getTargetStoreId = (req) => {
  const roleStr = String(req.user?.role || '').trim().toUpperCase();
  if (roleStr === 'OWNER') {
    return req.body.store_id || req.user.store_id;
  }
  return req.user.store_id; // Employees can ONLY write to their assigned store
};

const requireFeature = (featureFlag) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant_id) return res.status(401).json({ error: 'Tenant context required' });
      
      const tenant = await prisma.tenant.findUnique({
        where: { tenant_id: req.tenant_id },
        select: { [featureFlag]: true }
      });
      
      if (!tenant || !tenant[featureFlag]) {
        return res.status(403).json({ error: `Feature '${featureFlag}' is not enabled for your plan. Please contact support to upgrade.` });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify feature access' });
    }
  };
};

module.exports = {
  requireTenantAuth,
  requireSuperAdmin,
  requireOwner,
  getStoreFilter,
  getTargetStoreId,
  requireFeature
};
