// src/InvoiceGenerator.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateInvoicePDF(data) {
  const doc = new jsPDF({ unit: 'pt' });
  const margin = 40;
  let y = margin;

  // — Header —
  doc.setFontSize(16).text('Delivery cum Sales Invoice', margin, y);
  y += 30;

  // — Company Info —
  doc.setFontSize(12).text(data.company.name, margin, y);
  y += 16;
  doc.text(data.company.address, margin, y);
  y += 16;
  doc.text(`${data.company.phone} | ${data.company.email}`, margin, y);
  y += 16;
  doc.text(data.company.website, margin, y);
  y += 30;

  // — Party & Invoice Details —
  const leftX  = margin;
  const rightX = 320;
  doc.text(`Party Name: ${data.party.name}`, leftX, y);
  doc.text(`Invoice No.: ${data.invoiceNo}`, rightX, y);
  y += 16;
  doc.text(`Address: ${data.party.address}`, leftX, y);
  doc.text(`Invoice Date: ${data.invoiceDate}`, rightX, y);
  y += 30;

  // — Miscellaneous lines —
  data.misc.forEach(line => {
    doc.text(line, leftX, y);
    y += 14;
  });
  y += 10;

  // — Items Table —
  doc.autoTable({
    startY: y,
    head: [['Description', 'Qty (L)', 'Rate (₹)', 'Amount (₹)']],
    body: data.items.map(i => [
      i.description,
      i.qty.toString(),
      i.rate.toFixed(2),
      i.amount.toFixed(2)
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 230, 230] },
    margin: { left: margin, right: margin }
  });

  // — Totals —
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(12).text(
    `Total (${data.totalQty} L):`,
    leftX,
    finalY
  );
  doc.text(`₹ ${data.totalAmount.toFixed(2)}`, rightX, finalY);
  let footerY = finalY + 40;

  // — Bank Details & Footer —
  data.bankDetails.forEach(line => {
    doc.text(line, margin, footerY);
    footerY += 14;
  });
  footerY += 20;
  doc.setFontSize(8).text(
    `This is a system-generated invoice on ${new Date().toLocaleString()}.`,
    margin,
    footerY
  );

  doc.save(`invoice_${data.invoiceNo}.pdf`);
}
