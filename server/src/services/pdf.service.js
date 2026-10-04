const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to draw a row with given columns
function drawTableRow(doc, y, columns) {
  columns.forEach(col => {
    doc.text(col.text, col.x, y, { width: col.width, align: col.align || 'left' });
  });
}

function generateHeader(doc, tenant, type, dateStr, refId, statusStr) {
  // Dark Background Header
  doc.rect(0, 0, doc.page.width, 110).fill('#1A1C24');

  // Left Side (Store Info)
  doc.font('Helvetica-Bold').fillColor('#E5B343').fontSize(24).text(tenant.business_name || 'Eyevengers Optical', 40, 25);
  doc.font('Helvetica').fillColor('#FFFFFF').fontSize(9).text('PREMIUM EYEWEAR & EYE CLINIC', 40, 52);
  doc.text(`GST: ${tenant.gst_number || 'N/A'}`, 40, 67);
  doc.text(`Mob: ${tenant.contact_phone || 'N/A'}`, 40, 82);

  // Right Side (Document Info)
  const rightAlign = { align: 'right', width: 532 }; // 612 (A4 width) - 40 (margin) - 40 = 532
  doc.font('Helvetica-Bold').fontSize(16).text(type, 40, 25, rightAlign);
  doc.font('Helvetica').fontSize(10).text(`${type === 'INVOICE' ? 'Invoice #' : 'Test #'}: ${refId}`, 40, 48, rightAlign);
  doc.text(`Date: ${dateStr}`, 40, 63, rightAlign);
  
  if (statusStr) {
    const isPaid = statusStr === 'PAID';
    doc.font('Helvetica-Bold').fillColor(isPaid ? '#22C55E' : '#E5B343').text(`Status: ${statusStr}`, 40, 78, rightAlign);
  }

  // Reset to black for body
  doc.fillColor('#000000');
}

function generateFooter(doc) {
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 110;
  
  doc.rect(0, footerY, doc.page.width, 110).fill('#F9FAFB');
  doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke('#E5E7EB');
  
  doc.fillColor('#6B7280').font('Helvetica').fontSize(8);
  doc.text('Terms & Conditions:', 40, footerY + 15);
  doc.text('1. Goods once sold will not be taken back or exchanged.', 40, footerY + 27);
  doc.text('2. Please check your prescription and lenses carefully before leaving the store.', 40, footerY + 39);
  doc.text('3. All disputes are subject to local jurisdiction only.', 40, footerY + 51);

  doc.font('Helvetica-Bold').fillColor('#111827').text('THANK YOU FOR YOUR PATRONAGE!', 40, footerY + 25, { align: 'right', width: 532 });
}

exports.generateInvoicePDF = async (bill, tenant) => {
  // Ensure we have tenant UPI settings
  let upiId = (tenant?.upi_id || '').trim();
  let upiQrCode = (tenant?.upi_qr_code || '').trim();

  if ((!upiId || !upiQrCode) && (bill?.tenant_id || tenant?.tenant_id)) {
    try {
      const tId = bill?.tenant_id || tenant?.tenant_id;
      const sList = await prisma.setting.findMany({ where: { tenant_id: tId } });
      sList.forEach(s => {
        if (s.key === 'upi_id' && !upiId) upiId = (s.value || '').trim();
        if ((s.key === 'upi_qr_code' || s.key === 'store_qr_url') && !upiQrCode) upiQrCode = (s.value || '').trim();
      });
    } catch (e) {
      console.error('Error fetching tenant UPI settings in PDF service:', e);
    }
  }

  // Prepare QR code buffer (custom uploaded image or auto-generated from UPI ID)
  let qrImageBuffer = null;
  if (upiQrCode) {
    try {
      if (upiQrCode.startsWith('data:image')) {
        const base64Data = upiQrCode.replace(/^data:image\/\w+;base64,/, '');
        qrImageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        qrImageBuffer = Buffer.from(upiQrCode, 'base64');
      }
    } catch (err) {
      console.error('Failed to parse uploaded QR code buffer:', err);
    }
  }

  if (!qrImageBuffer && upiId) {
    try {
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(tenant?.business_name || 'Eyevengers Optical')}&cu=INR`;
      qrImageBuffer = await QRCode.toBuffer(upiUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#1A1C24',
          light: '#FFFFFF'
        }
      });
    } catch (err) {
      console.error('Failed to generate dynamic UPI QR code:', err);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      // Prevent automatic page wrapping/breaking since we use absolute positioning
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const dateStr = new Date(bill.created_at).toLocaleDateString();
      const statusStr = bill.payment_status; // PAID, PARTIAL, PENDING

      generateHeader(doc, tenant, 'INVOICE', dateStr, bill.invoice_number, statusStr);

      // ── BILL TO SECTION ──
      let y = 140; // Absolute start below header
      doc.font('Helvetica-Bold').fontSize(11).text('BILL TO:', 40, y);
      y += 15;
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Customer Name : ${bill.customer.name}`, 40, y); y += 14;
      doc.text(`Mobile Number  : ${bill.customer.mobile}`, 40, y); y += 14;
      if (bill.customer.address) { doc.text(`Address             : ${bill.customer.address}`, 40, y); y += 14; }
      if (bill.referral_code) { doc.text(`Referral Code    : ${bill.referral_code}`, 40, y); y += 14; }

      // ── PRESCRIPTION DETAILS (If present) ──
      let power = bill.power_details;
      if (!power && bill.source_eye_tests && bill.source_eye_tests.length > 0) {
        const test = bill.source_eye_tests[0];
        power = {
          re_sph: test.re_sph !== null && test.re_sph !== undefined ? String(test.re_sph) : '0.00',
          re_cyl: test.re_cyl !== null && test.re_cyl !== undefined ? String(test.re_cyl) : '0.00',
          re_axis: test.re_axis !== null && test.re_axis !== undefined ? String(test.re_axis) : '-',
          le_sph: test.le_sph !== null && test.le_sph !== undefined ? String(test.le_sph) : '0.00',
          le_cyl: test.le_cyl !== null && test.le_cyl !== undefined ? String(test.le_cyl) : '0.00',
          le_axis: test.le_axis !== null && test.le_axis !== undefined ? String(test.le_axis) : '-',
          pd: test.pd !== null && test.pd !== undefined ? String(test.pd) : '-',
          add: test.add_power !== null && test.add_power !== undefined ? String(test.add_power) : '-'
        };
      }

      const hasValue = (v) => v !== undefined && v !== null && v !== '' && v !== '-' && v !== '0' && v !== '0.00' && v !== 0;
      const hasAnyPower = power && typeof power === 'object' && Object.keys(power).length > 0 && (
        hasValue(power.re_sph) ||
        hasValue(power.re_cyl) ||
        hasValue(power.re_axis) ||
        hasValue(power.le_sph) ||
        hasValue(power.le_cyl) ||
        hasValue(power.le_axis) ||
        hasValue(power.add) ||
        hasValue(power.add_power) ||
        hasValue(power.pd)
      );

      if (hasAnyPower) {
        y += 20;
        doc.font('Helvetica-Bold').fontSize(11).text('PRESCRIPTION DETAILS', 40, y);
        y += 15;

        // Table Header
        doc.rect(40, y, 532, 20).fill('#1A1C24');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
        const pCols = [
          { text: 'EYE', x: 50, width: 80 },
          { text: 'SPH', x: 140, width: 60, align: 'center' },
          { text: 'CYL', x: 210, width: 60, align: 'center' },
          { text: 'AXIS', x: 280, width: 60, align: 'center' },
          { text: 'ADD', x: 350, width: 60, align: 'center' },
          { text: 'PD', x: 420, width: 60, align: 'center' }
        ];
        drawTableRow(doc, y + 6, pCols);
        y += 20;

        // Rows
        doc.fillColor('#000000').font('Helvetica').fontSize(9);
        // RE
        drawTableRow(doc, y + 6, [
          { text: 'R.E. (Right)', x: 50, width: 80 },
          { text: power.re_sph || '0.00', x: 140, width: 60, align: 'center' },
          { text: power.re_cyl || '0.00', x: 210, width: 60, align: 'center' },
          { text: power.re_axis || '-', x: 280, width: 60, align: 'center' },
          { text: power.add || power.add_power || '-', x: 350, width: 60, align: 'center' },
          { text: power.pd || '-', x: 420, width: 60, align: 'center' }
        ]);
        doc.moveTo(40, y + 20).lineTo(572, y + 20).stroke('#E5E7EB');
        y += 20;

        // LE
        drawTableRow(doc, y + 6, [
          { text: 'L.E. (Left)', x: 50, width: 80 },
          { text: power.le_sph || '0.00', x: 140, width: 60, align: 'center' },
          { text: power.le_cyl || '0.00', x: 210, width: 60, align: 'center' },
          { text: power.le_axis || '-', x: 280, width: 60, align: 'center' },
          { text: power.add || power.add_power || '-', x: 350, width: 60, align: 'center' },
          { text: power.pd || '-', x: 420, width: 60, align: 'center' }
        ]);
        doc.moveTo(40, y + 20).lineTo(572, y + 20).stroke('#E5E7EB');
        y += 20;
      }

      // ── PURCHASE DETAILS ──
      y += 20;
      doc.font('Helvetica-Bold').fontSize(11).text('PURCHASE DETAILS', 40, y);
      y += 15;

      // Table Header
      doc.rect(40, y, 532, 20).fill('#1A1C24');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      const iCols = [
        { text: 'Items Description', x: 50, width: 190 },
        { text: 'Brand / Features', x: 245, width: 165 },
        { text: 'Rate', x: 420, width: 60, align: 'right' },
        { text: 'Total', x: 490, width: 70, align: 'right' }
      ];
      drawTableRow(doc, y + 6, iCols);
      y += 20;

      // Dynamic line items
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      
      let itemsToRender = [];
      const subtotal = Number(bill.subtotal || bill.total_amount);
      
      if (bill.items && Array.isArray(bill.items)) {
        itemsToRender = [...bill.items];
      }

      // Append lens details if present
      let lensObj = bill.lens_details;
      if (typeof lensObj === 'string') {
        try { lensObj = JSON.parse(lensObj); } catch(e) {}
      }

      if (lensObj && (lensObj.type || lensObj.coating || Number(lensObj.price) > 0)) {
        const parts = [];
        if (lensObj.type) parts.push(`Lens: ${lensObj.type}`);
        if (lensObj.coating) parts.push(`Coating: ${lensObj.coating}`);
        const lensDesc = parts.length > 0 ? parts.join(' + ') : 'Spectacle Lenses';
        
        const featParts = [];
        if (lensObj.type_features) featParts.push(lensObj.type_features);
        if (lensObj.coating_features) featParts.push(lensObj.coating_features);
        const featText = featParts.length > 0 ? featParts.join(' • ') : (lensObj.type_brand || lensObj.coating_brand || 'Prescription Lens');

        itemsToRender.push({
          product_name: lensDesc,
          brand: featText,
          price: Number(lensObj.price || 0),
          qty: 1
        });
      }

      if (itemsToRender.length === 0) {
        itemsToRender = [{
          product_name: bill.bill_type === 'REGULAR' ? 'Optical Frames & Lenses' : bill.bill_type === 'Sunglasses' ? 'Sunglasses' : 'Products & Services',
          brand: 'Standard',
          price: subtotal,
          qty: 1
        }];
      }

      itemsToRender.forEach(item => {
        const rate = Number(item.price || 0);
        const qty = Number(item.qty || 1);
        const total = rate * qty;

        const descText = item.product_name || 'Item';
        const brandText = item.brand || item.category || 'Standard';
        const rateText = `${rate.toFixed(2)} x ${qty}`;
        const totalText = total.toFixed(2);

        // Dynamically compute required row height based on actual wrapped text height
        doc.font('Helvetica').fontSize(9);
        const descHeight = doc.heightOfString(descText, { width: 190 });
        const brandHeight = doc.heightOfString(brandText, { width: 165 });
        const contentHeight = Math.max(descHeight, brandHeight, 14);
        const rowHeight = contentHeight + 12; // 6pt padding top & bottom

        drawTableRow(doc, y + 6, [
          { text: descText, x: 50, width: 190 },
          { text: brandText, x: 245, width: 165 },
          { text: rateText, x: 420, width: 60, align: 'right' },
          { text: totalText, x: 490, width: 70, align: 'right' }
        ]);

        doc.moveTo(40, y + rowHeight).lineTo(572, y + rowHeight).stroke('#E5E7EB');
        y += rowHeight;
      });
      y += 15;

      // ── FOOTER SECTIONS ──
      // Payment / Scan to Pay Box (Left: x 40, width 260)
      const payBoxY = y;
      const payBoxW = 260;
      const payBoxH = 88;

      doc.roundedRect(40, payBoxY, payBoxW, payBoxH, 6).lineWidth(1).stroke('#E5E7EB');

      if (qrImageBuffer) {
        try {
          doc.image(qrImageBuffer, 48, payBoxY + 9, { width: 70, height: 70 });
        } catch (e) {
          console.error('Error drawing QR code image:', e);
        }

        const textX = 126;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1C24').text('Scan to Pay via UPI', textX, payBoxY + 12);
        doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280').text('GPay • PhonePe • Paytm • Any UPI', textX, payBoxY + 26);
        
        if (upiId) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#4B5563').text('UPI ID:', textX, payBoxY + 42);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#D97706').text(upiId, textX, payBoxY + 54, { width: 165 });
        }
      } else {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1C24').text('Scan to Pay / Store UPI', 52, payBoxY + 16);
        doc.font('Helvetica').fontSize(8.5).fillColor('#6B7280').text('Pay via GooglePay / PhonePe / Paytm', 52, payBoxY + 32);
        if (upiId) {
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#D97706').text(`UPI ID: ${upiId}`, 52, payBoxY + 50);
        } else {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#D97706').text('Cash / Card / UPI accepted at counter', 52, payBoxY + 50);
        }
      }

      // Totals (Right)
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      const totalX = 350;
      const amountX = 490;
      
      doc.text('Subtotal:', totalX, y + 6);
      doc.text(subtotal.toFixed(2), amountX, y + 6, { width: 70, align: 'right' });
      
      let totY = y + 21;
      if (bill.discount > 0) {
        doc.text('Discount:', totalX, totY);
        doc.text(`- ${Number(bill.discount).toFixed(2)}`, amountX, totY, { width: 70, align: 'right' });
        totY += 15;
      }
      if (bill.cashback_used > 0) {
        doc.text('Cashback Used:', totalX, totY);
        doc.text(`- ${Number(bill.cashback_used).toFixed(2)}`, amountX, totY, { width: 70, align: 'right' });
        totY += 15;
      }

      doc.font('Helvetica-Bold').text('Grand Total:', totalX, totY);
      doc.text(Number(bill.total_amount || 0).toFixed(2), amountX, totY, { width: 70, align: 'right' });
      totY += 15;

      doc.font('Helvetica').text('Advance Paid:', totalX, totY);
      doc.text(Number(bill.advance_paid || 0).toFixed(2), amountX, totY, { width: 70, align: 'right' });
      totY += 15;

      const bal = Number(bill.due_amount || 0);
      doc.font('Helvetica-Bold').fillColor(bal > 0 ? '#EF4444' : '#22C55E').text('Balance Due:', totalX, totY);
      doc.text(bal.toFixed(2), amountX, totY, { width: 70, align: 'right' });

      generateFooter(doc);
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

exports.generatePrescriptionPDF = async (test, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      // Prevent automatic page wrapping/breaking since we use absolute positioning
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const dateStr = new Date(test.created_at).toLocaleDateString();

      generateHeader(doc, tenant, 'PRESCRIPTION', dateStr, test.id.substring(0, 8).toUpperCase(), null);

      // ── PATIENT SECTION ──
      let y = 140; // Absolute start below header
      doc.font('Helvetica-Bold').fontSize(11).text('PATIENT DETAILS:', 40, y);
      y += 15;
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Patient Name  : ${test.patient_name}`, 40, y); y += 14;
      doc.text(`Mobile Number : ${test.mobile}`, 40, y); y += 14;

      // ── PRESCRIPTION DETAILS ──
      y += 20;
      doc.font('Helvetica-Bold').fontSize(11).text('REFRACTION DETAILS', 40, y);
      y += 15;

      // Table Header
      doc.rect(40, y, 532, 20).fill('#1A1C24');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      const pCols = [
        { text: 'EYE', x: 50, width: 80 },
        { text: 'SPH', x: 140, width: 60, align: 'center' },
        { text: 'CYL', x: 210, width: 60, align: 'center' },
        { text: 'AXIS', x: 280, width: 60, align: 'center' },
        { text: 'ADD', x: 350, width: 60, align: 'center' },
        { text: 'PD', x: 420, width: 60, align: 'center' }
      ];
      drawTableRow(doc, y + 6, pCols);
      y += 20;

      // Rows
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      // RE
      drawTableRow(doc, y + 6, [
        { text: 'R.E. (Right)', x: 50, width: 80 },
        { text: test.re_sph || '0.00', x: 140, width: 60, align: 'center' },
        { text: test.re_cyl || '0.00', x: 210, width: 60, align: 'center' },
        { text: test.re_axis || '-', x: 280, width: 60, align: 'center' },
        { text: test.add_power || '-', x: 350, width: 60, align: 'center' },
        { text: test.pd || '-', x: 420, width: 60, align: 'center' }
      ]);
      doc.moveTo(40, y + 20).lineTo(572, y + 20).stroke('#E5E7EB');
      y += 20;

      // LE
      drawTableRow(doc, y + 6, [
        { text: 'L.E. (Left)', x: 50, width: 80 },
        { text: test.le_sph || '0.00', x: 140, width: 60, align: 'center' },
        { text: test.le_cyl || '0.00', x: 210, width: 60, align: 'center' },
        { text: test.le_axis || '-', x: 280, width: 60, align: 'center' },
        { text: test.add_power || '-', x: 350, width: 60, align: 'center' },
        { text: test.pd || '-', x: 420, width: 60, align: 'center' }
      ]);
      doc.moveTo(40, y + 20).lineTo(572, y + 20).stroke('#E5E7EB');
      y += 30;

      if (test.doctor_notes) {
        doc.font('Helvetica-Bold').fontSize(11).text('DOCTOR NOTES:', 40, y);
        y += 15;
        doc.font('Helvetica').fontSize(10).text(test.doctor_notes, 40, y, { width: 532, lineGap: 4 });
      }

      generateFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
