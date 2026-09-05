const PDFDocument = require('pdfkit');

function money(n) {
  return `Rs. ${Number(n || 0).toFixed(2)}`;
}

function streamInvoicePdf(res, { order, product, address, profile }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.order_id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).fillColor('#012652').text('AI Buyer', { continued: false });
  doc.fontSize(10).fillColor('#555555').text('Purchase Invoice');
  doc.moveDown(1.5);

  doc.fontSize(11).fillColor('#000000');
  doc.text(`Invoice for order: ${order.order_id}`);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  doc.text(`Status: ${order.status}`);
  if (order.razorpay_payment_id) doc.text(`Payment reference: ${order.razorpay_payment_id}`);
  doc.moveDown();

  if (profile) {
    doc.fontSize(12).fillColor('#012652').text('Billed to');
    doc.fontSize(10).fillColor('#000000');
    doc.text(profile.name || '');
    doc.text(profile.email || '');
    doc.text(profile.phone || '');
    doc.moveDown();
  }

  if (address) {
    doc.fontSize(12).fillColor('#012652').text('Shipped to');
    doc.fontSize(10).fillColor('#000000');
    doc.text(address.label ? `${address.label}` : '');
    doc.text([address.line1, address.line2].filter(Boolean).join(', '));
    doc.text(`${address.city}, ${address.state} ${address.postal_code}`);
    doc.moveDown();
  }

  doc.moveDown(0.5);
  const tableTop = doc.y;
  doc.fontSize(11).fillColor('#012652');
  doc.text('Item', 50, tableTop);
  doc.text('Qty', 320, tableTop);
  doc.text('Amount', 420, tableTop);
  doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#cccccc').stroke();

  const rowY = tableTop + 24;
  doc.fontSize(10).fillColor('#000000');
  doc.text(order.product_name || product?.name || order.product_id, 50, rowY, { width: 260 });
  doc.text(String(order.quantity ?? 1), 320, rowY);
  doc.text(money(order.amount), 420, rowY);

  let y = rowY + 30;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#eeeeee').stroke();
  y += 10;

  if (order.shipping_option) {
    doc.fontSize(10).fillColor('#555555').text(`Shipping (${order.shipping_option})`, 320, y);
    doc.text(money(order.shipping_cost), 420, y);
    y += 18;
  }
  if (order.coupon_code) {
    doc.fillColor('#0d94fb').text(`Coupon ${order.coupon_code}`, 320, y);
    doc.text(`-${money(order.discount_amount)}`, 420, y);
    y += 18;
  }

  y += 8;
  doc.moveTo(320, y).lineTo(545, y).strokeColor('#012652').stroke();
  y += 10;
  doc.fontSize(12).fillColor('#012652').text('Total', 320, y);
  doc.text(money(order.amount), 420, y);

  doc.moveDown(4);
  doc.fontSize(8).fillColor('#999999').text(
    order.simulated_payment
      ? 'This purchase was charged as a simulated debit against a pre-approved AI Buyer spending cap, not a live Razorpay transaction.'
      : 'This purchase was a real Razorpay payment.',
    50,
    doc.y,
    { width: 495 }
  );

  doc.end();
}

function streamCombinedInvoicePdf(res, { orders, address, profile }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const approvalId = orders[0]?.approval_id || 'ORDER';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${approvalId}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).fillColor('#012652').text('AI Buyer', { continued: false });
  doc.fontSize(10).fillColor('#555555').text('Purchase Invoice');
  doc.moveDown(1.5);

  const earliest = orders.reduce((min, o) => (o.created_at < min ? o.created_at : min), orders[0].created_at);
  doc.fontSize(11).fillColor('#000000');
  doc.text(`Invoice for orders: ${orders.map((o) => o.order_id).join(', ')}`, { width: 495 });
  doc.text(`Date: ${new Date(earliest).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  const paymentRef = orders.find((o) => o.razorpay_payment_id)?.razorpay_payment_id;
  if (paymentRef) doc.text(`Payment reference: ${paymentRef}`);
  doc.moveDown();

  if (profile) {
    doc.fontSize(12).fillColor('#012652').text('Billed to');
    doc.fontSize(10).fillColor('#000000');
    doc.text(profile.name || '');
    doc.text(profile.email || '');
    doc.text(profile.phone || '');
    doc.moveDown();
  }

  if (address) {
    doc.fontSize(12).fillColor('#012652').text('Shipped to');
    doc.fontSize(10).fillColor('#000000');
    doc.text(address.label ? `${address.label}` : '');
    doc.text([address.line1, address.line2].filter(Boolean).join(', '));
    doc.text(`${address.city}, ${address.state} ${address.postal_code}`);
    doc.moveDown();
  }

  doc.moveDown(0.5);
  const tableTop = doc.y;
  doc.fontSize(11).fillColor('#012652');
  doc.text('Item', 50, tableTop);
  doc.text('Qty', 320, tableTop);
  doc.text('Amount', 420, tableTop);
  doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#cccccc').stroke();

  let y = tableTop + 24;
  doc.fontSize(10).fillColor('#000000');
  let subtotal = 0;
  let shippingTotal = 0;
  let discountTotal = 0;
  for (const order of orders) {
    doc.text(order.product_name || order.product_id, 50, y, { width: 260 });
    doc.text(String(order.quantity ?? 1), 320, y);
    doc.text(money(order.amount), 420, y);
    y += 20;
    subtotal += order.amount || 0;
    shippingTotal += order.shipping_cost || 0;
    discountTotal += order.discount_amount || 0;
  }

  y += 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#eeeeee').stroke();
  y += 10;

  if (shippingTotal > 0) {
    doc.fontSize(10).fillColor('#555555').text('Shipping (total)', 320, y);
    doc.text(money(shippingTotal), 420, y);
    y += 18;
  }
  if (discountTotal > 0) {
    doc.fillColor('#0d94fb').text('Discount (total)', 320, y);
    doc.text(`-${money(discountTotal)}`, 420, y);
    y += 18;
  }

  y += 8;
  doc.moveTo(320, y).lineTo(545, y).strokeColor('#012652').stroke();
  y += 10;
  doc.fontSize(12).fillColor('#012652').text('Total', 320, y);
  doc.text(money(subtotal), 420, y);

  doc.moveDown(4);
  doc.fontSize(8).fillColor('#999999').text(
    orders.every((o) => o.simulated_payment)
      ? 'This purchase was charged as a simulated debit against a pre-approved AI Buyer spending cap, not a live Razorpay transaction.'
      : 'This purchase was a real Razorpay payment.',
    50,
    doc.y,
    { width: 495 }
  );

  doc.end();
}

module.exports = { streamInvoicePdf, streamCombinedInvoicePdf };
