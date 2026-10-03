const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdf.service');

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { 
        customer: true,
        source_eye_tests: true
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Fallback: If bill.power_details is null and no source_eye_tests, fetch latest eye test for customer
    if (!bill.power_details && (!bill.source_eye_tests || bill.source_eye_tests.length === 0)) {
      const eyeTest = await prisma.eyeTest.findFirst({
        where: { customer_id: bill.customer_id },
        orderBy: { created_at: 'desc' }
      });
      if (eyeTest) {
        bill.source_eye_tests = [eyeTest];
      }
    }

    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: bill.tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const pdfBuffer = await pdfService.generateInvoicePDF(bill, tenant);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${bill.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.downloadPrescriptionPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await prisma.eyeTest.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!test) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { tenant_id: test.tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const pdfBuffer = await pdfService.generatePrescriptionPDF(test, tenant);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PRES-${test.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming prescription PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
