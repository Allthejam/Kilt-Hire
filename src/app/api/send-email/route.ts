import { NextResponse } from 'next/server';
import { StoreEmailSettings } from '@/app/types';

interface EmailPayload {
  toEmail: string;
  toName: string;
  emailType: 'BOOKING_CONFIRMATION' | 'PAYMENT_RECEIPT_INVOICE' | 'ORDER_CANCELLATION' | 'READY_FOR_COLLECTION' | 'RETURN_REMINDER' | 'OVERDUE_ALERT' | 'DAMAGE_RECONCILIATION' | 'TEST_EMAIL' | 'CUSTOM';
  subject?: string;
  emailSettings?: Partial<StoreEmailSettings>;
  orderData?: {
    poId: string;
    customerName: string;
    customerPhone?: string;
    hireStartDate: string;
    hireEndDate: string;
    items: Array<{ itemName: string; size?: string; category?: string }>;
    totalHireFee: number;
    totalDepositHeld: number;
    paymentStatus: string;
    paypalPaymentLink?: string;
    measurements?: {
      waistInches: number;
      chestInches: number;
      shoeSize: string;
    };
    amountPaid?: number;
    paymentMethod?: string;
    paymentDate?: string;
    cancellationReason?: string;
    depositRetainedAmount?: number;
    netRefundAmount?: number;
    cancelledBy?: string;
    deductedAmount?: number;
    refundedAmount?: number;
    reconciliationReason?: string;
  };
  customMessage?: string;
}

export async function POST(request: Request) {
  try {
    const body: EmailPayload = await request.json();
    const { toEmail, toName, emailType, orderData, customMessage, emailSettings } = body;

    if (!toEmail) {
      return NextResponse.json({ success: false, error: 'Recipient email is required.' }, { status: 400 });
    }

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = emailSettings?.senderEmail || process.env.BREVO_SENDER_EMAIL || 'sales@scottishhighlandkilthire.co.uk';
    const senderName = emailSettings?.storeName || process.env.BREVO_SENDER_NAME || 'Highland Kiltmakers';
    const storePhone = emailSettings?.storePhone || '0131 555 1234';
    const storeAddress = emailSettings?.storeAddress || '123 High Street, Edinburgh, EH1 1AA';
    const storeHours = emailSettings?.storeOpeningHours || 'Mon - Sat: 9:00am - 5:30pm | Sun: Closed';
    const brandColor = emailSettings?.brandColor || '#b45309'; // Warm Highland amber
    const headerBg = '#0f172a'; // Deep slate 900

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'BREVO_API_KEY is not configured in server environment (.env.local).' 
      }, { status: 500 });
    }

    let subject = body.subject || `${senderName} Notification`;
    let htmlContent = '';

    const emailShell = (title: string, badgeLabel: string, innerHtml: string, badgeBg?: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:30px 10px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
                
                <!-- HEADER -->
                <tr>
                  <td style="background-color:${headerBg};padding:24px 30px;text-align:left;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <h1 style="margin:0;font-size:20px;font-weight:900;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">
                            ${senderName}
                          </h1>
                          <p style="margin:4px 0 0 0;font-size:12px;color:#cbd5e1;font-weight:500;">
                            Traditional Tartan &amp; Formal Highland Outfits
                          </p>
                        </td>
                        <td align="right">
                          <span style="background-color:${badgeBg || brandColor};color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;display:inline-block;text-transform:uppercase;">
                            ${badgeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CONTENT -->
                <tr>
                  <td style="padding:32px 30px;">
                    ${innerHtml}
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background-color:#f8fafc;padding:20px 30px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;line-height:1.6;">
                    <p style="margin:0;font-weight:700;color:#334155;">${senderName} Store &amp; Counter Dispatch</p>
                    <p style="margin:4px 0 0 0;">📍 ${storeAddress} | 📞 ${storePhone}</p>
                    <p style="margin:2px 0 0 0;">⏰ Opening Hours: ${storeHours}</p>
                    <p style="margin:6px 0 0 0;color:#94a3b8;">Please keep this email for your records. Need assistance? Reply directly to this email or call our shop.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const totalFee = typeof orderData?.totalHireFee === 'number' ? orderData.totalHireFee : 110;
    const depositHeld = typeof orderData?.totalDepositHeld === 'number' ? orderData.totalDepositHeld : 50;
    const itemsListHtml = orderData?.items?.map(it => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:#1e293b;">${it.itemName}</td>
        <td style="padding:10px 0;font-size:12px;color:#64748b;text-align:right;">${it.category || 'Garment'}</td>
      </tr>
    `).join('') || `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:#1e293b;">Full Highland 8-Yard Rigout Package</td>
        <td style="padding:10px 0;font-size:12px;color:#64748b;text-align:right;">Complete Outfit</td>
      </tr>
    `;

    if (emailType === 'BOOKING_CONFIRMATION') {
      const headline = emailSettings?.bookingConfirmation?.headline || 'Booking Confirmation & Reservation Summary';
      const customIntro = emailSettings?.bookingConfirmation?.customIntro || `Thank you for choosing ${senderName}! Your hire order has been successfully booked and scheduled in our store reservation system.`;
      const policyNotice = emailSettings?.bookingConfirmation?.policyNotice || 'Please bring photo ID when collecting your hire outfit from our shop.';
      const paypalNotice = emailSettings?.bookingConfirmation?.paypalNotice || 'Instant secure settlement via PayPal or Debit/Credit Card';

      subject = body.subject || `${headline} - PO #${orderData?.poId || 'RESERVATION'}`;

      const paymentStatus = orderData?.paymentStatus || 'UNPAID';
      const isFullyPaid = paymentStatus === 'FULL_BALANCE_PAID' || paymentStatus === 'PAID_WITH_DEPOSIT';
      const isDepositPaid = paymentStatus === 'PARTIAL_DEPOSIT';
      const outstandingAmount = isFullyPaid ? 0 : isDepositPaid ? totalFee : (totalFee + depositHeld);
      const paypalLink = orderData?.paypalPaymentLink || `http://localhost:3006/pay?po=${orderData?.poId || 'PO-1001'}&hire=${totalFee}&deposit=${depositHeld}&amount=${outstandingAmount}&name=${encodeURIComponent(toName || 'Customer')}`;

      htmlContent = emailShell(headline, 'CONFIRMATION', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#0f172a;">
          Hello ${toName || orderData?.customerName || 'Customer'},
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <!-- SCHEDULE & PAYMENT SUMMARY -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:20px;">
          <tr>
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">📅 Collection Date:</td>
            <td style="padding:4px 8px;font-size:13px;color:#0f172a;font-weight:800;text-align:right;">${orderData?.hireStartDate || 'Upcoming Friday'}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">↩️ Return Due Date:</td>
            <td style="padding:4px 8px;font-size:13px;color:#0f172a;font-weight:800;text-align:right;">${orderData?.hireEndDate || 'Upcoming Monday'}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">👔 Garment Hire Fee:</td>
            <td style="padding:4px 8px;font-size:13px;color:#0f172a;font-weight:800;text-align:right;">£${totalFee.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">🛡️ Security Deposit (Refundable):</td>
            <td style="padding:4px 8px;font-size:13px;color:#059669;font-weight:800;text-align:right;">£${depositHeld.toFixed(2)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:8px 8px 4px 8px;font-size:12px;color:#0f172a;font-weight:800;">🔒 Deposit Due to Confirm:</td>
            <td style="padding:8px 8px 4px 8px;font-size:14px;color:${isDepositPaid || isFullyPaid ? '#059669' : '#b45309'};font-weight:900;text-align:right;">
              ${isDepositPaid || isFullyPaid ? `£${depositHeld.toFixed(2)} (Paid ✓)` : `£${depositHeld.toFixed(2)}`}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 8px 8px 8px;font-size:12px;color:#64748b;font-weight:600;">💳 Hire Balance Due at Collection:</td>
            <td style="padding:4px 8px 8px 8px;font-size:13px;color:${isFullyPaid ? '#059669' : '#334155'};font-weight:800;text-align:right;">
              ${isFullyPaid ? '£0.00 (Paid in Advance ✓)' : `£${totalFee.toFixed(2)}`}
            </td>
          </tr>
        </table>

        <!-- ITEMS INCLUDED -->
        <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
          Reserved Garments &amp; Outfit Items
        </h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
          ${itemsListHtml}
        </table>

        <div style="background-color:#fffbe6;border:1px solid #ffe58f;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#78350f;">
          <strong>📋 Store Policy:</strong> ${policyNotice}
        </div>
      `);

    } else if (emailType === 'PAYMENT_RECEIPT_INVOICE') {
      const headline = emailSettings?.paymentReceiptInvoice?.headline || 'Official Payment Receipt & Security Deposit Invoice';
      const customIntro = emailSettings?.paymentReceiptInvoice?.customIntro || 'Thank you for your payment! We confirm that your payment has been successfully received and credited towards your hire reservation.';
      const taxNotice = emailSettings?.paymentReceiptInvoice?.taxOrVatNotice || 'Official small business hire invoice & security bond receipt. Please retain this document for your financial records.';
      const depositStatement = emailSettings?.paymentReceiptInvoice?.depositPolicyStatement || 'Your refundable security deposit is held safely in escrow and will be returned to your original payment method upon safe garment check-in.';

      subject = body.subject || `🧾 ${headline} - PO #${orderData?.poId || 'INVOICE'}`;

      const paidAmount = typeof orderData?.amountPaid === 'number' ? orderData.amountPaid : (totalFee + depositHeld);
      const remainingBalance = Math.max(0, (totalFee + depositHeld) - paidAmount);

      htmlContent = emailShell(headline, 'PAID INVOICE', `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:52px;height:52px;line-height:52px;background-color:#dcfce7;border-radius:50%;color:#166534;font-size:24px;font-weight:bold;margin-bottom:8px;">
            ✓
          </div>
          <h2 style="margin:0;font-size:20px;font-weight:900;color:#0f172a;">
            Payment Received &amp; Verified
          </h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:#059669;font-weight:700;">
            Receipt Ref: ${orderData?.poId ? `REC-${orderData.poId}` : 'REC-ONLINE'} • ${orderData?.paymentDate || new Date().toLocaleDateString('en-GB')}
          </p>
        </div>

        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <!-- OFFICIAL INVOICE BREAKDOWN TABLE -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
          <tr style="background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th align="left" style="padding:10px 14px;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Description</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Amount (£)</th>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#1e293b;">
              Highland Garment Hire Fee (${orderData?.items?.length || 1} Outfits/Items)
              <span style="display:block;font-size:11px;color:#64748b;font-weight:500;">Hire Dates: ${orderData?.hireStartDate || ''} to ${orderData?.hireEndDate || ''}</span>
            </td>
            <td align="right" style="padding:12px 14px;font-size:13px;font-weight:800;color:#0f172a;">
              £${totalFee.toFixed(2)}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:#059669;">
              🛡️ Refundable Security Deposit
              <span style="display:block;font-size:11px;color:#64748b;font-weight:500;">Held in escrow against damage/loss • Fully refundable</span>
            </td>
            <td align="right" style="padding:12px 14px;font-size:13px;font-weight:800;color:#059669;">
              £${depositHeld.toFixed(2)}
            </td>
          </tr>
          <tr style="background-color:#f8fafc;border-top:2px solid #cbd5e1;">
            <td style="padding:12px 14px;font-size:13px;font-weight:900;color:#0f172a;">TOTAL TRANSACTION VALUE:</td>
            <td align="right" style="padding:12px 14px;font-size:14px;font-weight:900;color:#0f172a;">£${(totalFee + depositHeld).toFixed(2)}</td>
          </tr>
          <tr style="background-color:#ecfdf5;">
            <td style="padding:12px 14px;font-size:13px;font-weight:900;color:#166534;">💳 AMOUNT RECEIVED &amp; CREDITED:</td>
            <td align="right" style="padding:12px 14px;font-size:15px;font-weight:900;color:#166534;">-£${paidAmount.toFixed(2)}</td>
          </tr>
          <tr style="background-color:#ffffff;border-top:1px solid #e2e8f0;">
            <td style="padding:12px 14px;font-size:13px;font-weight:800;color:#334155;">OUTSTANDING BALANCE DUE:</td>
            <td align="right" style="padding:12px 14px;font-size:14px;font-weight:900;color:${remainingBalance > 0 ? '#b45309' : '#059669'};">
              ${remainingBalance > 0 ? `£${remainingBalance.toFixed(2)} (Due at pickup)` : '£0.00 (PAID IN FULL ✓)'}
            </td>
          </tr>
        </table>

        <!-- ESCROW & SECURITY DEPOSIT ADVICE -->
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:16px;font-size:12px;color:#166534;">
          <strong>🛡️ Security Deposit Escrow:</strong> ${depositStatement}
        </div>

        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:11px;color:#64748b;line-height:1.5;">
          <strong>📑 Tax / Invoice Notice:</strong> ${taxNotice}
        </div>
      `, '#059669');

    } else if (emailType === 'ORDER_CANCELLATION') {
      const headline = emailSettings?.orderCancellation?.headline || 'Order Cancellation Notice & Deposit Settlement';
      const customIntro = emailSettings?.orderCancellation?.customIntro || 'We confirm that your Highland kilt hire booking has been cancelled in our store management schedule.';
      const retentionPolicy = emailSettings?.orderCancellation?.depositRetentionPolicy || 'In accordance with our booking terms, any applicable administrative retention from the deposit held has been recorded.';
      const refundNotice = emailSettings?.orderCancellation?.refundProcessingNotice || 'Any net refundable amount has been initiated back to your original payment method and typically settles in 2-5 business days.';
      const supportPrompt = emailSettings?.orderCancellation?.supportContactPrompt || 'If you have questions regarding this cancellation or wish to reschedule for a future date, please contact our team.';

      subject = body.subject || `❌ ${headline} - PO #${orderData?.poId || 'CANCELLED'}`;

      const retainedAmt = typeof orderData?.depositRetainedAmount === 'number' ? orderData.depositRetainedAmount : 0;
      const netRefund = typeof orderData?.netRefundAmount === 'number' ? orderData.netRefundAmount : Math.max(0, depositHeld - retainedAmt);

      htmlContent = emailShell(headline, 'CANCELLED', `
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;width:52px;height:52px;line-height:52px;background-color:#fee2e2;border-radius:50%;color:#991b1b;font-size:24px;font-weight:bold;margin-bottom:8px;">
            ✕
          </div>
          <h2 style="margin:0;font-size:20px;font-weight:900;color:#7f1d1d;">
            Order Cancellation Confirmed
          </h2>
          <p style="margin:4px 0 0 0;font-size:12px;color:#64748b;">
            Order Reference: <strong>${orderData?.poId || 'PO-2026-CANCELLED'}</strong> • Customer: <strong>${toName || orderData?.customerName || 'Customer'}</strong>
          </p>
        </div>

        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <!-- CANCELLATION & DEPOSIT SETTLEMENT SUMMARY -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #fecaca;border-radius:12px;overflow:hidden;margin-bottom:20px;">
          <tr style="background-color:#fef2f2;border-bottom:1px solid #fecaca;">
            <th align="left" style="padding:10px 14px;font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;">Settlement Summary</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;">Amount (£)</th>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;font-size:13px;color:#475569;">Security Deposit Initially Held:</td>
            <td align="right" style="padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a;">£${depositHeld.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;font-size:13px;color:#991b1b;font-weight:700;">
              Administrative / Late Cancellation Retention:
            </td>
            <td align="right" style="padding:10px 14px;font-size:13px;font-weight:800;color:#b91c1c;">
              -£${retainedAmt.toFixed(2)}
            </td>
          </tr>
          <tr style="background-color:#f0fdf4;border-top:2px solid #bbf7d0;">
            <td style="padding:12px 14px;font-size:13px;font-weight:900;color:#166534;">
              💰 NET REFUND RETURNED TO YOU:
            </td>
            <td align="right" style="padding:12px 14px;font-size:15px;font-weight:900;color:#166534;">
              £${netRefund.toFixed(2)}
            </td>
          </tr>
        </table>

        ${orderData?.cancellationReason ? `
          <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#475569;">
            <strong>Recorded Reason:</strong> "${orderData.cancellationReason}"
          </div>
        ` : ''}

        <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:16px;font-size:12px;color:#1e40af;">
          <strong>💳 Refund Settlement:</strong> ${refundNotice}
        </div>

        <div style="background-color:#fffbe6;border:1px solid #ffe58f;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#78350f;">
          <strong>📋 Cancellation Terms:</strong> ${retentionPolicy}
        </div>

        <p style="font-size:12px;color:#64748b;margin:0;line-height:1.5;">
          ${supportPrompt}
        </p>
      `, '#dc2626');

    } else if (emailType === 'READY_FOR_COLLECTION') {
      const headline = emailSettings?.collectionReady?.headline || 'Your Highland Kilt Outfit is Ready for Collection!';
      const customIntro = emailSettings?.collectionReady?.customIntro || `Great news! Your outfit has been picked, inspected, custom fitted, and bagged on our shop floor collection rail.`;
      const idRequirement = emailSettings?.collectionReady?.idRequirementNotice || 'Please present your Order Reference or Photo ID at the counter.';
      const parkingTips = emailSettings?.collectionReady?.parkingOrPickupTips || 'Free customer parking is available at the rear of the store.';

      subject = body.subject || `🛍️ ${headline} - PO #${orderData?.poId || 'HIRE'}`;

      const paymentStatus = orderData?.paymentStatus || 'UNPAID';
      const isFullyPaid = paymentStatus === 'FULL_BALANCE_PAID' || paymentStatus === 'PAID_WITH_DEPOSIT';
      const isDepositPaid = paymentStatus === 'PARTIAL_DEPOSIT';
      const outstandingAmount = isFullyPaid ? 0 : isDepositPaid ? totalFee : (totalFee + depositHeld);
      const paypalLink = orderData?.paypalPaymentLink || `http://localhost:3006/pay?po=${orderData?.poId || 'PO-1001'}&amount=${outstandingAmount}&name=${encodeURIComponent(toName || 'Customer')}`;

      htmlContent = emailShell(headline, 'READY FOR PICKUP', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#059669;">
          Good News, ${toName || orderData?.customerName || 'Customer'}!
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin-bottom:16px;">
          <p style="margin:0;font-size:14px;font-weight:800;color:#065f46;">
            🛍️ Collection Date: <strong>${orderData?.hireStartDate || 'Today'}</strong>
          </p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#047857;">
            ${idRequirement}
          </p>
        </div>

        ${isFullyPaid ? `
          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#166534;">
            <strong>✅ Payment Status: Fully Paid (£0.00 Balance Outstanding)</strong><br>
            Your hire outfit and refundable security deposit are fully settled in advance. No counter payment needed!
          </div>
        ` : isDepositPaid ? `
          <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:16px;font-size:12px;color:#1e40af;">
            <strong>💳 Deposit Paid: £${depositHeld.toFixed(2)} | Remaining Hire Balance: £${totalFee.toFixed(2)}</strong><br>
            You can pay the remaining £${totalFee.toFixed(2)} balance online below, or tap your card at our counter upon collection.
          </div>
          <div style="text-align:center;margin:16px 0 20px 0;">
            <a href="${paypalLink}" style="background-color:#0070ba;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:800;display:inline-block;">
              💳 Settle Remaining £${totalFee.toFixed(2)} Balance via PayPal
            </a>
          </div>
        ` : `
          <div style="background-color:#fffbe6;border:1px solid #ffe58f;border-radius:12px;padding:14px;margin-bottom:16px;font-size:12px;color:#78350f;">
            <strong>⚠️ Outstanding Balance: £${(totalFee + depositHeld).toFixed(2)}</strong><br>
            Total Hire Fee & Security Deposit: <strong>£${(totalFee + depositHeld).toFixed(2)}</strong>. Settle online below or tap your card at pickup.
          </div>
          <div style="text-align:center;margin:16px 0 20px 0;">
            <a href="${paypalLink}" style="background-color:#0070ba;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:800;display:inline-block;">
              💳 Pay £${(totalFee + depositHeld).toFixed(2)} Deposit & Balance Online
            </a>
          </div>
        `}

        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#475569;">
          <strong>🚗 Store Visit &amp; Parking Tips:</strong> ${parkingTips}
        </div>
      `);

    } else if (emailType === 'RETURN_REMINDER') {
      const headline = emailSettings?.returnReminder?.headline || 'Reminder: Kilt Hire Return Due Tomorrow';
      const customIntro = emailSettings?.returnReminder?.customIntro || 'We hope you had a fantastic event! This is a friendly reminder that your hire outfit is due back to our store tomorrow.';
      const checklistNotice = emailSettings?.returnReminder?.checklistNotice || 'Please ensure all accessories (sporran, belt, socks, shoes, and cufflinks) are inside your garment bag.';
      const refundNotice = emailSettings?.returnReminder?.depositRefundNotice || 'Your security deposit will be promptly refunded back to your payment card upon safe return check-in.';

      subject = body.subject || `⏰ ${headline} - PO #${orderData?.poId || 'HIRE'}`;

      htmlContent = emailShell(headline, 'RETURN REMINDER', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#0f172a;">
          Hello ${toName || orderData?.customerName || 'Customer'},
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;">
          <p style="margin:0;font-size:11px;font-weight:800;text-transform:uppercase;color:#1e40af;">Return Due Date</p>
          <p style="margin:4px 0 0 0;font-size:18px;font-weight:900;color:#1e3a8a;">${orderData?.hireEndDate || 'Tomorrow'}</p>
        </div>

        <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px;color:#334155;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#0f172a;">📦 Packing Checklist:</p>
          <p style="margin:0;">${checklistNotice}</p>
        </div>

        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:#166534;">
          <strong>🛡️ Security Deposit:</strong> ${refundNotice}
        </div>
      `);

    } else if (emailType === 'OVERDUE_ALERT') {
      const headline = emailSettings?.overdueAlert?.headline || 'URGENT NOTICE: Overdue Garment Return';
      const customIntro = emailSettings?.overdueAlert?.customIntro || 'Our records indicate that your hired Highland outfit is now overdue for return to our store.';
      const urgencyStatement = emailSettings?.overdueAlert?.urgencyStatement || 'Our hire outfits are strictly reserved for upcoming events. Unreturned garments cause immediate booking conflicts for other customers.';
      const depositForfeiture = emailSettings?.overdueAlert?.depositForfeitureNotice || 'Security deposits will be forfeited for unnotified late returns to cover rescheduling disruption and replacement costs.';

      subject = body.subject || `🚨 ${headline} - PO #${orderData?.poId || 'URGENT'}`;

      htmlContent = emailShell(headline, 'OVERDUE NOTICE', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#7f1d1d;">
          Attention: ${toName || orderData?.customerName || 'Customer'},
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <div style="background-color:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:18px;margin-bottom:20px;color:#991b1b;">
          <p style="margin:0;font-size:13px;font-weight:700;">⚠️ Urgent Policy Notice:</p>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;">${urgencyStatement}</p>
        </div>

        <div style="background-color:#fffbe6;border:1px solid #ffe58f;border-radius:12px;padding:16px;margin-bottom:20px;font-size:12px;color:#78350f;">
          <strong>🛡️ Deposit Notice:</strong> ${depositForfeiture}
        </div>
      `);

    } else if (emailType === 'TEST_EMAIL') {
      subject = `⚡ ${senderName} - Brevo Email Configuration Test`;
      htmlContent = emailShell('Brevo API Test', 'SYSTEM TEST', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#0f172a;">
          Brevo API Connected Successfully!
        </h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.5;">
          This test email confirms that your <strong>Brevo Transactional Email integration</strong> and <strong>IONOS DMARC DNS records</strong> are functioning perfectly with ${senderName}!
        </p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:16px;font-size:12px;color:#166534;">
          <strong>Configuration Verified:</strong><br>
          • Sender: ${senderName} &lt;${senderEmail}&gt;<br>
          • Recipient: ${toName} &lt;${toEmail}&gt;<br>
          • Timestamp: ${new Date().toUTCString()}
        </div>
      `);
    } else {
      htmlContent = emailShell(subject, 'MESSAGE', `
        <p style="font-size:14px;color:#334155;line-height:1.5;">${customMessage || 'Thank you for choosing Highland Kilt Hire.'}</p>
      `);
    }

    // Call Brevo REST API v3
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail
          }
        ],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo API Error:', brevoData);
      return NextResponse.json({
        success: false,
        error: brevoData.message || 'Failed to dispatch email via Brevo.',
        details: brevoData
      }, { status: brevoResponse.status });
    }

    return NextResponse.json({
      success: true,
      messageId: brevoData.messageId,
      recipient: toEmail,
      emailType: emailType
    });

  } catch (error: any) {
    console.error('Send Email Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
