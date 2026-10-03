const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdf.service');
const whatsappService = require('../services/whatsapp.service');

exports.generatePdf = async (req, res) => {
  try {
    const { billId } = req.params;
    const tenant_id = req.user.tenant_id;

    const bill = await prisma.bill.findUnique({
      where: { id: billId, tenant_id },
      include: {
        customer: true,
        tenant: true,
        source_eye_tests: true
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Fallback: If bill.power_details is null and no source_eye_tests, fetch latest eye test for customer
    if (!bill.power_details && (!bill.source_eye_tests || bill.source_eye_tests.length === 0)) {
      const eyeTest = await prisma.eyeTest.findFirst({
        where: { customer_id: bill.customer_id, tenant_id },
        orderBy: { created_at: 'desc' }
      });
      if (eyeTest) {
        bill.source_eye_tests = [eyeTest];
      }
    }

    const pdfUrl = await pdfService.generateInvoicePDF(bill, bill.tenant);
    
    // We update the bill just to mark that PDF was generated (optional)
    const fullUrl = `http://localhost:5000${pdfUrl}`;
    res.json({ pdfUrl: fullUrl });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const { billId } = req.params;
    const tenant_id = req.user.tenant_id;

    const bill = await prisma.bill.findUnique({
      where: { id: billId, tenant_id },
      include: { customer: true, tenant: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const pdfUrl = `http://localhost:5000/uploads/${bill.invoice_number}.pdf`;
    
    await whatsappService.sendInvoice(
      bill.customer.mobile,
      bill.customer.name,
      bill.tenant.business_name,
      bill.total_amount,
      pdfUrl
    );

    res.json({ message: 'WhatsApp message sent successfully' });
  } catch (error) {
    console.error('WhatsApp sending error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
};
