import { NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poId, amount, description, customerEmail, customerName } = body;

    if (!poId || !amount || amount <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid order parameters. Valid poId and positive amount are required.' 
      }, { status: 400 });
    }

    const order = await createPayPalOrder({
      poId,
      amount: Number(amount),
      description: description || `Highland Kilt Hire - PO #${poId}`,
      customerEmail,
      customerName
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: order.status,
      approveUrl: order.approveUrl
    });
  } catch (error: any) {
    console.error('PayPal create-order error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create PayPal order.'
    }, { status: 500 });
  }
}
