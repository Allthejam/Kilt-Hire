import { NextResponse } from 'next/server';
import { refundPayPalCapture } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { captureId, amount, noteToPayer, poId, refundReason, staffName } = body;

    if (!captureId) {
      return NextResponse.json({ 
        success: false, 
        error: 'PayPal captureId is required to execute a refund.' 
      }, { status: 400 });
    }

    const refundResult = await refundPayPalCapture({
      captureId,
      amount: amount !== undefined ? Number(amount) : undefined,
      noteToPayer: noteToPayer || `Highland Kilt Hire Refund for Order #${poId || ''}`
    });

    return NextResponse.json({
      success: refundResult.success,
      refundId: refundResult.refundId,
      status: refundResult.status,
      amountRefunded: refundResult.amountRefunded,
      currency: refundResult.currency,
      poId,
      refundReason,
      staffName
    });
  } catch (error: any) {
    console.error('PayPal refund error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process PayPal refund.'
    }, { status: 500 });
  }
}
