import { NextResponse } from 'next/server';
import { StoreEmailSettings } from '@/app/types';

interface EmailPayload {
  toEmail: string;
  toName: string;
  emailType: 'BOOKING_CONFIRMATION' | 'READY_FOR_COLLECTION' | 'RETURN_REMINDER' | 'OVERDUE_ALERT' | 'DAMAGE_RECONCILIATION' | 'TEST_EMAIL' | 'CUSTOM';
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

    const emailShell = (title: string, badgeLabel: string, innerHtml: string) => `
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
                          <span style="background-color:${brandColor};color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;display:inline-block;text-transform:uppercase;">
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

    if (emailType === 'BOOKING_CONFIRMATION') {
      const headline = emailSettings?.bookingConfirmation?.headline || 'Booking Confirmation & PayPal Invoice';
      const customIntro = emailSettings?.bookingConfirmation?.customIntro || `Thank you for choosing ${senderName}! Your hire order has been successfully booked and scheduled in our store reservation system.`;
      const policyNotice = emailSettings?.bookingConfirmation?.policyNotice || 'Please bring photo ID when collecting your hire outfit from our shop.';
      const paypalNotice = emailSettings?.bookingConfirmation?.paypalNotice || 'Instant secure settlement via PayPal or Debit/Credit Card';

      subject = body.subject || `${headline} - PO #${orderData?.poId || 'RESERVATION'}`;

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

      const totalFee = orderData?.totalHireFee ?? 110;
      const depositHeld = orderData?.totalDepositHeld ?? 50;
      const paypalLink = orderData?.paypalPaymentLink || `https://www.paypal.com/checkout?po=${orderData?.poId || 'PO-1001'}&amount=${totalFee + depositHeld}`;

      htmlContent = emailShell(headline, 'CONFIRMATION', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#0f172a;">
          Hello ${toName || orderData?.customerName || 'Customer'},
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <!-- SCHEDULE SUMMARY -->
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
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">💰 Total Hire Fee:</td>
            <td style="padding:4px 8px;font-size:13px;color:#0f172a;font-weight:800;text-align:right;">£${totalFee.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;font-size:12px;color:#64748b;font-weight:600;">🛡️ Security Deposit:</td>
            <td style="padding:4px 8px;font-size:13px;color:#059669;font-weight:800;text-align:right;">£${depositHeld.toFixed(2)} (Refundable upon safe return)</td>
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

        <div style="text-align:center;margin:28px 0 16px 0;">
          <a href="${paypalLink}" style="background-color:#0070ba;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:900;display:inline-block;box-shadow:0 2px 8px rgba(0,112,186,0.3);">
            💳 Pay £${(totalFee + depositHeld).toFixed(2)} Deposit &amp; Balance via PayPal
          </a>
          <p style="margin:8px 0 0 0;font-size:11px;color:#64748b;">${paypalNotice}</p>
        </div>
      `);

    } else if (emailType === 'READY_FOR_COLLECTION') {
      const headline = emailSettings?.collectionReady?.headline || 'Your Highland Kilt Outfit is Ready for Collection!';
      const customIntro = emailSettings?.collectionReady?.customIntro || `Great news! Your outfit has been picked, inspected, custom fitted, and bagged on our shop floor collection rail.`;
      const idRequirement = emailSettings?.collectionReady?.idRequirementNotice || 'Please present your Order Reference or Photo ID at the counter.';
      const parkingTips = emailSettings?.collectionReady?.parkingOrPickupTips || 'Free customer parking is available at the rear of the store.';

      subject = body.subject || `🛍️ ${headline} - PO #${orderData?.poId || 'HIRE'}`;

      htmlContent = emailShell(headline, 'READY FOR PICKUP', `
        <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#059669;">
          Good News, ${toName || orderData?.customerName || 'Customer'}!
        </h2>
        <p style="margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;">
          ${customIntro}
        </p>

        <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;font-weight:800;color:#065f46;">
            🛍️ Collection Date: <strong>${orderData?.hireStartDate || 'Today'}</strong>
          </p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#047857;">
            ${idRequirement}
          </p>
        </div>

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
