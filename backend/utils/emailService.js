import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendOrderReceiptEmail = async (userEmail, userName, order) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not set in .env. Skipping email delivery.');
    return;
  }

  try {
    const transporter = createTransporter();

    const itemsListHtml = order.items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">
          <strong style="color: #333;">${item.name}</strong>
          ${item.size ? `<br><small style="color: #666;">Size: ${item.size}</small>` : ''}
          ${item.crust ? `<br><small style="color: #666;">Crust: ${item.crust}</small>` : ''}
          ${item.toppings && item.toppings.length > 0 ? `<br><small style="color: #888;">Toppings: ${item.toppings.join(', ')}</small>` : ''}
        </td>
        <td style="padding: 12px; text-align: center;">${item.qty}</td>
        <td style="padding: 12px; text-align: right; font-weight: bold; color: #e53e3e;">₹${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Pizza Order Receipt</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #2d3748;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #e53e3e; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🍕 Pizza Crust & Co.</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px;">Thanks for your order, ${userName}!</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="font-size: 20px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; color: #2d3748;">Order Confirmation</h2>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Status:</strong> Placed (Method: ${order.paymentMethod.toUpperCase()})</p>
            <p><strong>Delivery Address:</strong> ${order.address}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr style="background-color: #f7fafc; border-bottom: 2px solid #edf2f7;">
                  <th style="padding: 12px; text-align: left; color: #4a5568;">Item</th>
                  <th style="padding: 12px; text-align: center; color: #4a5568;">Qty</th>
                  <th style="padding: 12px; text-align: right; color: #4a5568;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsListHtml}
              </tbody>
            </table>

            <div style="margin-top: 20px; border-top: 2px solid #edf2f7; padding-top: 12px; text-align: right;">
              <p style="margin: 4px 0; font-size: 14px; color: #4a5568;">Subtotal: ₹${order.subtotal.toFixed(2)}</p>
              ${order.discount ? `<p style="margin: 4px 0; font-size: 14px; color: #38a169;">Discount: -₹${order.discount.toFixed(2)}</p>` : ''}
              <p style="margin: 4px 0; font-size: 14px; color: #4a5568;">Delivery Fee: ₹${order.deliveryFee.toFixed(2)}</p>
              <h3 style="margin: 8px 0 0 0; font-size: 20px; color: #e53e3e;">Grand Total: ₹${order.totalAmount.toFixed(2)}</h3>
            </div>
          </div>
          <div style="background-color: #edf2f7; padding: 16px; text-align: center; font-size: 12px; color: #718096;">
            If you have any questions, please contact our customer support team. Enjoy your meal!
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Pizza Crust & Co." <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `🍕 Order Placed Successfully! (ID: ${order._id})`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent to: ${userEmail}`);
  } catch (error) {
    console.error('❌ Failed to send order receipt email:', error);
  }
};
