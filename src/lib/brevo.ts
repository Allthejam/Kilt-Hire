// Brevo (formerly Sendinblue) Transactional Email Service Helper

export interface BrevoEmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
}

export async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  senderName = 'Highland Kilt Hire',
  senderEmail = 'orders@kilt-hire.co.uk'
}: BrevoEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.NEXT_PUBLIC_BREVO_API_KEY || process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('Brevo API key not set in environment (NEXT_PUBLIC_BREVO_API_KEY). Email preview mode active.');
    return { 
      success: true, 
      messageId: `PREVIEW-SIMULATED-${Date.now()}`,
      error: 'Brevo API key missing. Email simulated in preview mode.' 
    };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || `Brevo HTTP error ${res.status}`);
    }

    const data = await res.json();
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error('Brevo Email dispatch failed:', err);
    return { success: false, error: err.message || 'Failed to dispatch Brevo email' };
  }
}

// EMAIL TEMPLATE GENERATORS

export function generateCollectionReadyEmailHtml({
  customerName,
  poId,
  eventDate,
  collectionDate,
  isFullyPaid,
  totalHireFee,
  totalDepositHeld,
  itemsCount
}: {
  customerName: string;
  poId: string;
  eventDate: string;
  collectionDate: string;
  isFullyPaid: boolean;
  totalHireFee: number;
  totalDepositHeld: number;
  itemsCount: number;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;">
      <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #f59e0b;">🏴󠁧󠁢󠁳󠁣󠁴󠁿 Highland Kilt & Hire</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Your Rigout Order is Ready for Collection</p>
      </div>

      <div style="padding: 24px; font-size: 14px; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Hello ${customerName},</h2>
        <p>Great news! Your Highland Outfit for order <strong>${poId}</strong> (${itemsCount} garment items) has been custom-picked, inspected, and packed by our store staff.</p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Collection Date:</strong> ${collectionDate}</p>
          <p style="margin: 0 0 8px 0;"><strong>Event Date:</strong> ${eventDate}</p>
          <p style="margin: 0;"><strong>Store Location:</strong> Highland Kilt Hire Shop</p>
        </div>

        ${isFullyPaid ? `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 12px; color: #065f46; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: bold;">✓ Fully Paid (£${totalHireFee} Hire Fee + £${totalDepositHeld} Deposit)</p>
            <p style="margin: 4px 0 0 0; font-size: 13px;">Your order is completely paid for. Simply present your order ID <strong>${poId}</strong> at store collection!</p>
          </div>
        ` : `
          <div style="background: #fffbe6; border: 1px solid #ffe58f; padding: 16px; border-radius: 12px; color: #722ed1; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: bold; color: #b7eb8f;">⚠️ Action Required: Outstanding Balance Due</p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #520339;">
              Please pay your outstanding balance online or in store upon collection. 
              <strong>Note:</strong> Failure to collect your reserved outfit on your scheduled collection date without notice may result in forfeiture of your deposit.
            </p>
          </div>
        `}

        <p style="font-size: 13px; color: #64748b;">If you have any questions or need to change your collection time, please reply to this email or call the shop.</p>
        <p style="margin-bottom: 0;">Warm regards,<br><strong>Allan & The Highland Kilt Hire Team</strong></p>
      </div>
    </div>
  `;
}

export function generatePaymentReminderEmailHtml({
  customerName,
  poId,
  collectionDate,
  outstandingAmount
}: {
  customerName: string;
  poId: string;
  collectionDate: string;
  outstandingAmount: number;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;">
      <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #f59e0b;">🏴󠁧󠁢󠁳󠁣󠁴󠁿 Highland Kilt & Hire</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">7-Day Payment Reminder</p>
      </div>

      <div style="padding: 24px; font-size: 14px; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Hello ${customerName},</h2>
        <p>This is a friendly reminder that your upcoming Highland Kilt Hire collection for order <strong>${poId}</strong> is scheduled in 1 week on <strong>${collectionDate}</strong>.</p>

        <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 16px; border-radius: 12px; margin: 20px 0; color: #9a3412;">
          <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 15px;">Outstanding Balance: £${outstandingAmount}</p>
          <p style="margin: 0; font-size: 13px;">Please complete your deposit/balance payment online via PayPal or upon collection in store.</p>
        </div>

        <p style="margin-bottom: 0;">Warm regards,<br><strong>Allan & The Highland Kilt Hire Team</strong></p>
      </div>
    </div>
  `;
}

export function generateOverdueReturnEmailHtml({
  customerName,
  poId,
  returnDeadline,
  daysOverdue,
  itemsList,
  totalDepositHeld
}: {
  customerName: string;
  poId: string;
  returnDeadline: string;
  daysOverdue: number;
  itemsList: string;
  totalDepositHeld: number;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #ef4444; border-radius: 16px; overflow: hidden; color: #1e293b;">
      <div style="background: #7f1d1d; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #fef08a;">🏴󠁧󠁢󠁳󠁣󠁴󠁿 Highland Kilt & Hire</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: bold; color: #fca5a5; letter-spacing: 0.5px;">🚨 URGENT NOTICE: OVERDUE GARMENT RETURN</p>
      </div>

      <div style="padding: 24px; font-size: 14px; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #7f1d1d; margin-top: 0;">Attention: ${customerName},</h2>
        
        <p>Our records show that your hired Highland outfit for order <strong>${poId}</strong> was due back to our store on <strong>${returnDeadline}</strong> and is currently <strong style="color: #dc2626;">${daysOverdue} day(s) overdue</strong>.</p>

        <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 18px; border-radius: 12px; margin: 20px 0; color: #991b1b;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: bold; color: #7f1d1d;">📋 Garments Outstanding for Return:</h3>
          <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 13px; color: #450a0a; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #fecaca;">
            ${itemsList}
          </p>
          <p style="margin: 0; font-size: 12px; font-weight: bold; color: #991b1b;">
            Security Deposit Currently Held: £${totalDepositHeld}
          </p>
        </div>

        <div style="background: #fffbe6; border: 1px solid #ffe58f; padding: 16px; border-radius: 12px; margin-bottom: 20px; color: #722ed1;">
          <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #b71c1c;">⚠️ Store Policy & Security Deposit Notice:</h4>
          <p style="margin: 0; font-size: 13px; color: #581845; leading-relaxed: 1.5;">
            Our hire outfits are strictly scheduled for upcoming weddings and events. Unreturned garments cause immediate booking conflicts for other customers. 
            If you are unable for any reason to return your outfit today, <strong>please contact the store immediately on 0131 555 1234 or reply to this email</strong>. 
            <br/><br/>
            <strong>Important:</strong> Security deposits (£${totalDepositHeld}) may be forfeited in the event of unnotified late returns or unreturned garments to compensate for scheduling disruption and replacement costs.
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; font-size: 13px; color: #334155;">
          <p style="margin: 0 0 4px 0;"><strong>Store Address:</strong> Highland Kilt Hire Shop</p>
          <p style="margin: 0 0 4px 0;"><strong>Store Phone:</strong> 0131 555 1234</p>
          <p style="margin: 0;"><strong>Opening Hours:</strong> Mon - Sat: 9:00am - 5:30pm</p>
        </div>

        <p style="margin-top: 20px; margin-bottom: 0; font-size: 13px; color: #475569;">
          Thank you for your prompt cooperation in returning these garments.<br/>
          Warm regards,<br/>
          <strong>Allan & The Highland Kilt Hire Store Team</strong>
        </p>
      </div>
    </div>
  `;
}
