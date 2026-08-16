import { NextResponse } from 'next/server';
import { upsertPurchaseOrder, addAuditLogFS } from '@/lib/firestore';

export async function POST(request: Request) {
  try {
    const event = await request.json();
    const eventType = event.event_type;
    const resource = event.resource;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    console.log(`🔔 [PayPal Webhook] Event received: ${eventType}`, resource?.id);

    // 1. PAYMENT CAPTURE COMPLETED (Successful Customer Payment)
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const poId = resource?.custom_id || resource?.supplementary_data?.related_ids?.order_id;
      const captureId = resource?.id;
      const amountPaid = parseFloat(resource?.amount?.value || '0');
      const payerEmail = resource?.payer?.email_address;

      if (poId && poId.startsWith('PO-')) {
        await upsertPurchaseOrder({
          id: poId,
          paypalCaptureId: captureId,
          paypalPayerEmail: payerEmail,
          paymentStatus: 'PAID_WITH_DEPOSIT',
          depositPaymentMethod: 'PAYPAL_ONLINE',
          depositPaidAt: nowStr,
          orderStatus: 'DEPOSIT_PAID_CONFIRMED'
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}`,
          timestamp: nowStr,
          staffName: 'PayPal Webhook',
          action: 'PAYPAL_PAYMENT_CAPTURED',
          details: `Webhook confirmed payment capture of £${amountPaid.toFixed(2)} for ${poId} (Capture: ${captureId})`,
          relatedQrCode: poId
        });
      }
    }

    // 2. PAYMENT REFUNDED IN PAYPAL (Direct from PayPal Dashboard or Customer Return)
    else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const refundId = resource?.id;
      const amountRefunded = parseFloat(resource?.amount?.value || '0');
      const poId = resource?.custom_id;

      if (poId && poId.startsWith('PO-')) {
        await upsertPurchaseOrder({
          id: poId,
          paypalRefundId: refundId,
          paypalRefundAmount: amountRefunded,
          paypalRefundDate: nowStr,
          paymentStatus: 'REFUNDED'
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}`,
          timestamp: nowStr,
          staffName: 'PayPal Webhook',
          action: 'PAYPAL_REFUND_RECORDED',
          details: `PayPal webhook recorded deposit/payment refund of £${amountRefunded.toFixed(2)} (Refund ID: ${refundId})`,
          relatedQrCode: poId
        });
      }
    }

    // 3. CUSTOMER OPENS A DISPUTE / CLAIM IN PAYPAL
    else if (eventType === 'CUSTOMER.DISPUTE.CREATED') {
      const disputeId = resource?.dispute_id || resource?.id;
      const reason = resource?.reason || 'Customer opened dispute in PayPal';
      const disputedAmount = parseFloat(resource?.dispute_amount?.value || '0');
      const transactionId = resource?.disputed_transactions?.[0]?.buyer_transaction_id || resource?.disputed_transactions?.[0]?.seller_transaction_id;
      const customId = resource?.disputed_transactions?.[0]?.custom;

      console.warn(`⚠️ [PayPal Webhook] Customer opened dispute ${disputeId} for £${disputedAmount}: ${reason}`);

      if (customId && customId.startsWith('PO-')) {
        await upsertPurchaseOrder({
          id: customId,
          paymentStatus: 'DISPUTED',
          disputeStatus: 'DISPUTE_OPENED',
          disputeDetails: {
            disputeId,
            reason,
            amountDisputed: disputedAmount,
            openedAt: nowStr,
            status: 'OPEN'
          }
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}`,
          timestamp: nowStr,
          staffName: 'PayPal Dispute Engine',
          action: 'PAYPAL_DISPUTE_OPENED',
          details: `⚠️ Customer opened dispute in PayPal for £${disputedAmount.toFixed(2)} (Reason: ${reason}). PO locked as DISPUTED.`,
          relatedQrCode: customId
        });
      }
    }

    // 4. DISPUTE RESOLVED (e.g. In Seller's Favor or Case Closed)
    else if (eventType === 'CUSTOMER.DISPUTE.RESOLVED') {
      const disputeId = resource?.dispute_id || resource?.id;
      const outcome = resource?.dispute_outcome?.outcome_code || 'RESOLVED';
      const customId = resource?.disputed_transactions?.[0]?.custom;

      if (customId && customId.startsWith('PO-')) {
        await upsertPurchaseOrder({
          id: customId,
          disputeStatus: 'DISPUTE_RESOLVED',
          paymentStatus: outcome === 'RESOLVED_BUYER_FAVOUR' ? 'REFUNDED' : 'PAID_WITH_DEPOSIT'
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}`,
          timestamp: nowStr,
          staffName: 'PayPal Dispute Engine',
          action: 'PAYPAL_DISPUTE_RESOLVED',
          details: `PayPal dispute ${disputeId} closed with outcome: ${outcome}`,
          relatedQrCode: customId
        });
      }
    }

    // 5. PAYMENT REVERSED / CHARGEBACK
    else if (eventType === 'PAYMENT.CAPTURE.REVERSED') {
      const captureId = resource?.id;
      const poId = resource?.custom_id;

      if (poId && poId.startsWith('PO-')) {
        await upsertPurchaseOrder({
          id: poId,
          paymentStatus: 'DISPUTED',
          disputeStatus: 'CHARGEBACK_REVERSED'
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}`,
          timestamp: nowStr,
          staffName: 'PayPal Webhook',
          action: 'PAYPAL_CHARGEBACK_REVERSED',
          details: `⚠️ Payment capture ${captureId} was reversed by PayPal. PO flagged as CHARGEBACK_REVERSED.`,
          relatedQrCode: poId
        });
      }
    }

    return NextResponse.json({ received: true, eventType });
  } catch (error: any) {
    console.error('PayPal webhook processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
