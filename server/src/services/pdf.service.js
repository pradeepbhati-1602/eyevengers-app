const PDFDocument = require('pdfkit');

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
        { text: 'Items Description', x: 50, width: 200 },
        { text: 'Brand / Details', x: 260, width: 150 },
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
        itemsToRender = bill.items;
      } else {
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
        drawTableRow(doc, y + 6, [
          { text: item.product_name || 'Item', x: 50, width: 200 },
          { text: item.brand || item.category || 'Standard', x: 260, width: 150 },
          { text: `${rate.toFixed(2)} x ${qty}`, x: 420, width: 60, align: 'right' },
          { text: total.toFixed(2), x: 490, width: 70, align: 'right' }
        ]);
        doc.moveTo(40, y + 20).lineTo(572, y + 20).stroke('#E5E7EB');
        y += 20;
      });
      y += 5;

      // ── FOOTER SECTIONS ──
      // Payment Box (Left)
      doc.rect(40, y, 220, 60).stroke('#E5E7EB');
      doc.font('Helvetica-Bold').fontSize(9).text('Scan to Pay / Store UPI', 50, y + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text('Pay via GooglePay/PhonePe/UPI', 50, y + 25);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#E5B343').text(tenant.upi_id || 'store@upi', 50, y + 40);

      // Totals (Right)
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      const totalX = 350;
      const amountX = 490;
      
      doc.text('Subtotal:', totalX, y + 10);
      doc.text(subtotal.toFixed(2), amountX, y + 10, { width: 70, align: 'right' });
      
      let totY = y + 25;
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
