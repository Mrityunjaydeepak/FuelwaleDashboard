import React from 'react';
import { generateInvoicePDF } from './InvoiceGenerator';

export default function CompletedTripInvoice({ trip, completedDeliveries }) {
  const invoiceData = {
    company: {
      name: 'SHREENATH PETROLEUM PRIVATE LIMITED',
      address: 'Thane, Maharashtra - 421501',
      phone: '+91-9321640558',
      email: 'order@fuelwale.com',
      website: 'www.fuelwale.com'
    },
    party: {
      name: trip.partyName,
      address: trip.partyAddress
    },
    invoiceNo: trip.invoiceNo,
    invoiceDate: trip.invoiceDate, // e.g. '16 Jun 2025'
    misc: [
      `PoS: ${trip.pos}`,
      `DC Number: ${trip.dcNo}`,
      `Payment: ${trip.payment}`,
      `Ref. No.: ${trip.refNo}`,
      `Credit Period: ${trip.creditPeriod} Days`
    ],
    items: completedDeliveries.map(d => ({
      description: d.product,
      qty: d.qty,
      unit: 'Liter',
      rate: d.rate,
      amount: d.qty * d.rate
    })),
    totalQty: completedDeliveries.reduce((sum, d) => sum + d.qty, 0),
    unit: 'Liter',
    totalAmount: completedDeliveries.reduce((sum, d) => sum + d.qty * d.rate, 0),
    bankDetails: [
      'Bank Details: Bank of Maharashtra',
      'A/c No.: 60528140328',
      'IFSC: MAHB0001006',
      'Branch: BoM & Nariman Point',
      'upi payment'
    ]
  };

  return (
    <button
      onClick={() => generateInvoicePDF(invoiceData)}
      className="bg-indigo-600 text-white px-4 py-2 rounded"
    >
      Generate Invoice PDF
    </button>
  );
}
