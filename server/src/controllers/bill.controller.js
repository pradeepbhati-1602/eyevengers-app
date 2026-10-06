const { prisma } = require('../prisma');
const pdfService = require('../services/pdf.service');
const { getStoreFilter, getTargetStoreId } = require('../middleware/tenantIsolation');// Generate an invoice number using the TenantCounter
async function getNextInvoiceNumber(tenant_id, tx) {
  let isUnique = false;
  let invoiceNumber = '';
  let safetyLimit = 10;
  
  while (!isUnique && safetyLimit > 0) {
    const counter = await tx.tenantCounter.upsert({
      where: { tenant_id_name: { tenant_id, name: 'INVOICE_NUMBER' } },
      update: { value: { increment: 1 } },
      create: { tenant_id, name: 'INVOICE_NUMBER', value: 1 }
    });
    
    invoiceNumber = `INV-${String(counter.value).padStart(6, '0')}`;
    
    // Check if this invoice number already exists
    const existingBill = await tx.bill.findUnique({
      where: { tenant_id_invoice_number: { tenant_id, invoice_number: invoiceNumber } }
    });
    
    if (!existingBill) {
      isUnique = true;
    }
    safetyLimit--;
  }
  
  if (!isUnique) throw new Error("Could not generate a unique invoice number");
  return invoiceNumber;
}

/**
 * Create a new bill (Atomic Transaction)
 */
exports.createBill = async (req, res) => {
  const { tenant_id, id: user_id, store_id: reqStoreId } = req.user;
  const { 
    mobile, name, customer_name, items = [], frame, frame_product_id, lens, lens_details, power, power_details,
    discount = 0, advance = 0, advance_paid = 0, cashback_used = 0, referral_code,
    subtotal: frontendSubtotal, birthday, gender, address, language
  } = req.body;

  const actualCustomerName = customer_name || name;
  const actualDiscount = parseFloat(discount) || 0;
  const actualAdvance = parseFloat(advance || advance_paid) || 0;
  const actualCashback = parseFloat(cashback_used) || 0;
  const actualSubtotal = parseFloat(frontendSubtotal) || items.reduce((acc, item) => acc + (item.qty * item.price), 0);

  let targetStoreId = getTargetStoreId(req);
  if (!targetStoreId || targetStoreId === 'all') {
    const defaultStore = await prisma.store.findFirst({ where: { tenant_id } });
    if (!defaultStore) throw new Error("No store found. Please create a store first.");
    targetStoreId = defaultStore.store_id;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const totalAmount = Math.max(0, actualSubtotal - actualDiscount - actualCashback);
      const dueAmount = Math.max(0, totalAmount - actualAdvance);
      const paymentStatus = dueAmount <= 0 ? 'PAID' : (actualAdvance > 0 ? 'PARTIAL' : 'DUE');

      // 1. Find or create customer
      let customer = await tx.customer.upsert({
        where: { tenant_id_mobile: { tenant_id, mobile } },
        update: {
          name: actualCustomerName || undefined,
          birthday: birthday ? new Date(birthday) : undefined,
          gender: gender ? gender.toUpperCase() : undefined,
          address: address || undefined,
          language: language ? language.toUpperCase() : undefined,
          last_visit: new Date(),
          total_bills: { increment: 1 },
          total_purchase: { increment: totalAmount },
          pending_due: { increment: dueAmount }
        },
        create: {
          tenant_id,
          name: actualCustomerName || 'Walk-in Customer',
          mobile,
          birthday: birthday ? new Date(birthday) : null,
          gender: gender ? gender.toUpperCase() : null,
          address: address || null,
          language: language ? language.toUpperCase() : 'ENGLISH',
          last_visit: new Date(),
          total_bills: 1,
          total_purchase: totalAmount,
          pending_due: dueAmount
        }
      });

      // 2. Process Referral Code if provided
      let referralReward = 0;
      if (referral_code) {
        const referral = await tx.referralMember.findUnique({
          where: { tenant_id_referral_code: { tenant_id, referral_code } }
        });
        
        if (!referral) {
          throw new Error('Invalid referral code');
        }

        // e.g. 5% cashback reward rule (could be fetched from Settings)
        referralReward = totalAmount * 0.05;

        await tx.referralMember.update({
          where: { id: referral.id },
          data: {
            referral_count: { increment: 1 },
            cashback_earned: { increment: referralReward }
          }
        });
        
        // Also update the customer record of the referral owner
        await tx.customer.updateMany({
          where: { tenant_id, mobile: referral.mobile },
          data: { current_cashback: { increment: referralReward } }
        });
      }

      // 3. Process Cashback Used
      if (actualCashback > 0) {
        if (customer.current_cashback < actualCashback) {
          throw new Error(`Insufficient cashback. Available: ${customer.current_cashback}`);
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: { current_cashback: { decrement: actualCashback } }
        });

        // Mirror subtraction if this customer is a referral member
        await tx.referralMember.updateMany({
          where: { tenant_id, mobile: customer.mobile },
          data: { cashback_used: { increment: actualCashback } }
        });
      }

      // 4. Generate Invoice Number & Create Bill FIRST
      const invoiceNumber = await getNextInvoiceNumber(tenant_id, tx);
      const bill = await tx.bill.create({
        data: {
          tenant_id,
          store_id: targetStoreId,
          invoice_number: invoiceNumber,
          customer_id: customer.id,
          referral_code: referral_code || null,
          frame_product_id: frame_product_id || frame?.product_id || null,
          items: items.length > 0 ? items : null,
          lens_details: lens_details || lens || null,
          power_details: power_details || power || null,
          subtotal: actualSubtotal,
          discount: actualDiscount,
          cashback_used: actualCashback,
          advance_paid: actualAdvance,
          due_amount: dueAmount,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          delivery_status: 'PENDING',
          bill_type: items.some(i => i.category === 'SUNGLASSES') ? 'SUNGLASSES' : 'REGULAR'
        }
      });

      // 5. Process Inventory Items
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id }
        });
        if (!product) throw new Error(`Product not found: ${item.product_id}`);

        if (product.current_stock < item.qty) {
          throw new Error(`Insufficient stock for ${product.product_name}. Available: ${product.current_stock}`);
        }

        const updatedProd = await tx.product.update({
          where: { id: item.product_id },
          data: { 
            current_stock: { decrement: item.qty },
            last_updated_date: new Date()
          }
        });

        await tx.inventoryHistory.create({
          data: {
            tenant_id,
            store_id: targetStoreId,
            product_id: item.product_id,
            added_quantity: -item.qty,
            previous_stock: product.current_stock,
            new_stock: updatedProd.current_stock,
            updated_by_id: user_id,
            reason: 'Sale',
            bill_id: bill.id
          }
        });
      }
      
      // Audit Log
      await tx.auditLog.create({
        data: {
          tenant_id, store_id: targetStoreId, user_id,
          action: 'BILL_CREATED',
          entity: 'Bill',
          entity_id: bill.id,
          details: { invoiceNumber, totalAmount }
        }
      });

      return bill;
    }, { maxWait: 10000, timeout: 30000 });

    // 7. Set PDF URL (Generated dynamically via public endpoint)
    let pdfUrl = `/api/v1/public/bills/${result.id}/pdf`;
    
    await prisma.bill.update({
      where: { id: result.id },
      data: { invoice_pdf_url: pdfUrl }
    });
    result.invoice_pdf_url = pdfUrl;

    // 8. Build WhatsApp Deep Link (Can be returned to the client to launch)
    result.whatsapp_link = `https://wa.me/91${mobile}?text=Hi%20${encodeURIComponent(actualCustomerName)},%20your%20invoice%20${result.invoice_number}%20is%20ready.%20Total:%20Rs.${result.total_amount}.`;

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Cancel a bill and reverse stock, totals, cashback
 */
exports.cancelBill = async (req, res) => {
  const { tenant_id, id: user_id, store_id: reqStoreId } = req.user;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id, tenant_id }
      });

      if (!bill) throw new Error('Bill not found');
      if (bill.bill_status === 'CANCELLED') throw new Error('Bill is already cancelled');

      // 1. Reverse Customer Totals
      const customer = await tx.customer.findUnique({ where: { id: bill.customer_id } });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            total_bills: { decrement: 1 },
            total_purchase: { decrement: bill.total_amount },
            pending_due: { decrement: bill.due_amount }
          }
        });
      }

      // 2. Reverse Cashback Used
      if (bill.cashback_used > 0) {
        await tx.customer.update({
          where: { id: bill.customer_id },
          data: { current_cashback: { increment: bill.cashback_used } }
        });
        await tx.referralMember.updateMany({
          where: { tenant_id, mobile: customer.mobile },
          data: { cashback_used: { decrement: bill.cashback_used } }
        });
      }

      // 3. Reverse Referral Earned
      if (bill.referral_code) {
        const referralReward = Number(bill.total_amount) * 0.05; // Matching the reward logic
        
        const referral = await tx.referralMember.findUnique({
          where: { tenant_id_referral_code: { tenant_id, referral_code: bill.referral_code } }
        });
        
        if (referral) {
          await tx.referralMember.update({
            where: { id: referral.id },
            data: {
              referral_count: { decrement: 1 },
              cashback_earned: { decrement: referralReward }
            }
          });
          await tx.customer.updateMany({
            where: { tenant_id, mobile: referral.mobile },
            data: { current_cashback: { decrement: referralReward } }
          });
        }
      }

      // 4. Reverse Stock
      const histories = await tx.inventoryHistory.findMany({
        where: { bill_id: bill.id }
      });

      for (const history of histories) {
        const qtyToRestore = Math.abs(history.added_quantity);
        const product = await tx.product.update({
          where: { id: history.product_id },
          data: { current_stock: { increment: qtyToRestore } }
        });

        await tx.inventoryHistory.create({
          data: {
            tenant_id, store_id: bill.store_id, product_id: product.id,
            added_quantity: qtyToRestore,
            previous_stock: product.current_stock - qtyToRestore,
            new_stock: product.current_stock,
            updated_by_id: user_id,
            reason: 'Cancellation Restore',
            bill_id: bill.id
          }
        });
      }

      // 5. Mark Bill Cancelled
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: { bill_status: 'CANCELLED' }
      });
      
      // Audit Log
      await tx.auditLog.create({
        data: {
          tenant_id, store_id: bill.store_id, user_id,
          action: 'BILL_CANCELLED',
          entity: 'Bill',
          entity_id: bill.id
        }
      });

      return updatedBill;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const formatEyePowerForMsg = (power) => {
  if (!power || typeof power !== 'object') return 'Not Specified';
  const reSph = power.re_sph ?? power.right_sph ?? '';
  const reCyl = power.re_cyl ?? power.right_cyl ?? '';
  const reAxis = power.re_axis ?? power.right_axis ?? '';
  const leSph = power.le_sph ?? power.left_sph ?? '';
  const leCyl = power.le_cyl ?? power.left_cyl ?? '';
  const leAxis = power.le_axis ?? power.left_axis ?? '';
  const add = power.add ?? power.add_power ?? '';

  let lines = [];
  if (reSph || reCyl || reAxis) {
    lines.push(`R: SPH ${reSph || '0.00'} | CYL ${reCyl || '0.00'} | AXIS ${reAxis || '-'}`);
  }
  if (leSph || leCyl || leAxis) {
    lines.push(`L: SPH ${leSph || '0.00'} | CYL ${leCyl || '0.00'} | AXIS ${leAxis || '-'}`);
  }
  if (add) {
    lines.push(`ADD: +${String(add).replace(/^\+/, '')}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'Standard / Plano';
};

const formatProductDetailsForMsg = (items, lens, frameProduct) => {
  let parts = [];
  if (Array.isArray(items) && items.length > 0) {
    const itemNames = items.map(i => `${i.product_name || i.name || 'Item'} (Qty: ${i.qty || 1})`).join(', ');
    parts.push(`Items: ${itemNames}`);
  } else if (frameProduct) {
    parts.push(`Frame: ${frameProduct.name || frameProduct.model_number || 'Optical Frame'}`);
  }

  if (lens && typeof lens === 'object') {
    const lType = lens.type || lens.lens_type || '';
    const lCoating = lens.coating || lens.lens_coating || '';
    const desc = [lType, lCoating].filter(Boolean).join(' - ');
    if (desc) parts.push(`Lens: ${desc}`);
  }
  return parts.length > 0 ? parts.join('\n') : 'Prescription Eyewear';
};

const formatBillingDetailsForMsg = (bill) => {
  const total = `₹${Number(bill.total_amount || 0).toLocaleString('en-IN')}`;
  const advance = `₹${Number(bill.advance_paid || 0).toLocaleString('en-IN')}`;
  const due = `₹${Number(bill.due_amount || 0).toLocaleString('en-IN')}`;
  return `Total: ${total} | Advance: ${advance} | Balance Due: ${due}`;
};

const replaceTemplatePlaceholders = (template, data) => {
  if (!template) return '';
  return template
    .replace(/{customer_name}/gi, data.customer_name || 'Valued Customer')
    .replace(/{customer_mobile}/gi, data.customer_mobile || '')
    .replace(/{invoice_number}/gi, data.invoice_number || '')
    .replace(/{bill_id}/gi, data.invoice_number || '')
    .replace(/{eye_power}/gi, data.eye_power || 'Not Specified')
    .replace(/{product_details}/gi, data.product_details || 'Eyewear')
    .replace(/{billing_details}/gi, data.billing_details || '')
    .replace(/{total_amount}/gi, data.total_amount || '₹0')
    .replace(/{advance_paid}/gi, data.advance_paid || '₹0')
    .replace(/{due_amount}/gi, data.due_amount || '₹0')
    .replace(/{store_name}/gi, data.store_name || 'Eyevengers Optical')
    .replace(/{store_mobile}/gi, data.store_mobile || '')
    .replace(/{feedback_link}/gi, data.feedback_link || '');
};

/**
 * Mark a bill as delivered
 */
exports.markDelivered = async (req, res) => {
  const { tenant_id, id: user_id } = req.user;
  const { id } = req.params;

  try {
    const existingBill = await prisma.bill.findFirst({
      where: { id, tenant_id },
      include: { 
        customer: true,
        frame_product: true,
        store: true
      }
    });
    
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });

    const bill = await prisma.bill.update({
      where: { id: existingBill.id },
      data: {
        delivery_status: 'DELIVERED',
        delivery_date: new Date()
      },
      include: { 
        customer: true,
        frame_product: true,
        store: true
      }
    });
    
    // Fetch tenant, custom message templates and settings
    const tenant = await prisma.tenant.findUnique({ where: { tenant_id } });
    const templates = await prisma.messageTemplate.findMany({
      where: { tenant_id, type: { in: ['HANDOVER_EN', 'HANDOVER_HI'] } }
    });
    const templatesMap = {};
    templates.forEach(t => { templatesMap[t.type] = t.content; });

    const feedbackSetting = await prisma.setting.findUnique({
      where: { tenant_id_key: { tenant_id, key: 'feedback_link' } }
    });

    const storeName = bill.store?.name || tenant?.business_name || 'Eyevengers Optical';
    const storeMobile = bill.store?.mobile || tenant?.owner_mobile || '';
    const feedbackLink = feedbackSetting?.value || '';

    const templateData = {
      customer_name: bill.customer?.name || 'Valued Customer',
      customer_mobile: bill.customer?.mobile || '',
      invoice_number: bill.invoice_number,
      store_name: storeName,
      store_mobile: storeMobile,
      feedback_link: feedbackLink,
      eye_power: formatEyePowerForMsg(bill.power_details),
      product_details: formatProductDetailsForMsg(bill.items, bill.lens_details, bill.frame_product),
      billing_details: formatBillingDetailsForMsg(bill),
      total_amount: `₹${Number(bill.total_amount || 0).toLocaleString('en-IN')}`,
      advance_paid: `₹${Number(bill.advance_paid || 0).toLocaleString('en-IN')}`,
      due_amount: `₹${Number(bill.due_amount || 0).toLocaleString('en-IN')}`
    };

    const defaultMsgEn = `Dear *{customer_name}*,\n\nThank you for choosing *{store_name}*! Your eyewear order (*{invoice_number}*) has been delivered. 👓✨\n\n📋 *Order & Prescription Details:*\n• Mobile: {customer_mobile}\n• Product: {product_details}\n• Eye Power:\n{eye_power}\n\n💰 *Billing Summary:*\n{billing_details}\n\nWe hope you love your clear vision! For any adjustment or queries, feel free to visit our store or call {store_mobile}.`;
    const defaultMsgHi = `प्रिय *{customer_name}*,\n\n*{store_name}* को चुनने के लिए धन्यवाद! आपका चश्मा (*{invoice_number}*) तैयार होकर डिलीवर कर दिया गया है। 👓✨\n\n📋 *ऑर्डर एवं नंबर विवरण:*\n• मोबाइल: {customer_mobile}\n• उत्पाद: {product_details}\n• आई पावर:\n{eye_power}\n\n💰 *बिलिंग विवरण:*\n{billing_details}\n\nआशा है कि आपको अपने नए चश्मे से स्पष्ट दृष्टि और आराम मिलेगा! किसी भी सहायता के लिए संपर्क करें: {store_mobile}।`;

    const rawTplEn = templatesMap['HANDOVER_EN'] || tenant?.wa_handover_msg_en || defaultMsgEn;
    const rawTplHi = templatesMap['HANDOVER_HI'] || tenant?.wa_handover_msg_hi || defaultMsgHi;

    const msgEn = replaceTemplatePlaceholders(rawTplEn, templateData);
    const msgHi = replaceTemplatePlaceholders(rawTplHi, templateData);

    const waLinkEn = bill.customer?.mobile ? `https://wa.me/91${bill.customer.mobile}?text=${encodeURIComponent(msgEn)}` : null;
    const waLinkHi = bill.customer?.mobile ? `https://wa.me/91${bill.customer.mobile}?text=${encodeURIComponent(msgHi)}` : null;
    
    res.json({ ...bill, waLinkEn, waLinkHi });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Collect remaining due payment
 */
exports.collectPayment = async (req, res) => {
  const { tenant_id, id: user_id } = req.user;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id, tenant_id } });
      if (!bill) throw new Error('Bill not found');
      if (bill.due_amount <= 0) throw new Error('No due amount left');

      // Update bill
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          advance_paid: { increment: bill.due_amount },
          due_amount: 0,
          payment_status: 'PAID'
        }
      });

      // Update customer pending_due
      await tx.customer.update({
        where: { id: bill.customer_id },
        data: { pending_due: { decrement: bill.due_amount } }
      });

      return updatedBill;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getBills = async (req, res) => {
  const { tenant_id } = req.user;
  const { search, store_id, is_paginated, page, limit } = req.query;
  const where = { tenant_id, ...getStoreFilter(req) };
  
  if (search) {
    where.OR = [
      { invoice_number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { mobile: { contains: search } } }
    ];
  }
  
  try {
    const mapBill = (b) => ({
      ...b,
      bill_id: b.invoice_number,
      customer_name: b.customer?.name || 'Unknown',
      customer_mobile: b.customer?.mobile || 'Unknown'
    });

    if (is_paginated === 'true') {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const skip = (p - 1) * l;
      
      const [data, total] = await Promise.all([
        prisma.bill.findMany({ 
          where, 
          orderBy: { created_at: 'desc' },
          skip, 
          take: l, 
          include: { customer: true }
        }),
        prisma.bill.count({ where })
      ]);
      
      return res.json({
        data: data.map(mapBill),
        total,
        page: p,
        pages: Math.ceil(total / l)
      });
    }

    const bills = await prisma.bill.findMany({ 
      where, 
      orderBy: { created_at: 'desc' },
      include: { customer: true }
    });
    res.json(bills.map(mapBill));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
