import { NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, poId } = body;

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'PayPal orderId is required.' 
      }, { status: 400 });
    }

    const captureResult = await capturePayPalOrder(orderId);

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
