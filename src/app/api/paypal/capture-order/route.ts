import { NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { upsertPurchaseOrder, addAuditLogFS } from '@/lib/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.orderId || body.orderID || body.id;
    const { poId } = body;

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'PayPal orderId is required.' 
      }, { status: 400 });
    }

    const captureResult = await capturePayPalOrder(orderId);

    if (captureResult.success && poId && poId !== 'PO-SAMPLE-001') {
      try {
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
        const amountNum = typeof captureResult.amountPaid === 'number' 
          ? captureResult.amountPaid 
          : parseFloat(String(captureResult.amountPaid || '0')) || 0;

        await upsertPurchaseOrder({
          id: poId,
          paymentStatus: 'PARTIAL_DEPOSIT',
          depositPaymentMethod: 'PAYPAL_ONLINE',
          depositPaidAt: nowStr,
          paypalTransactionId: orderId,
          paypalCaptureId: captureResult.captureId,
          paypalPayerEmail: captureResult.payerEmail
        } as any);

        await addAuditLogFS({
          id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStr,
          staffName: 'PayPal Online Portal',
          action: 'PAYPAL_PAYMENT_CAPTURED',
          details: `Captured PayPal deposit of £${amountNum.toFixed(2)} for ${poId} (Capture: ${captureResult.captureId}, Payer: ${captureResult.payerEmail})`
        });
      } catch (dbErr) {
        console.warn('Firestore server sync in capture-order warning:', dbErr);
      }
    }

    return NextResponse.json({
      success: captureResult.success,
      orderId: captureResult.orderId,
      captureId: captureResult.captureId,
      status: captureResult.status,
      amountPaid: captureResult.amountPaid,
      currency: captureResult.currency,
      payerEmail: captureResult.payerEmail,
      payerName: captureResult.payerName,
      poId
    });
  } catch (error: any) {
    console.error('PayPal capture-order error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to capture PayPal order.'
    }, { status: 500 });
  }
}
