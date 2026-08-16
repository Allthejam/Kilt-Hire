// PayPal REST API v2 Integration Helper for Highland Kilt Hire

interface PayPalTokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: PayPalTokenCache | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  if (!clientId || !secret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in environment (.env.local).');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to obtain PayPal OAuth token (${res.status}): ${errText}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in * 1000)
  };

  return data.access_token;
}

export async function createPayPalOrder({
  poId,
  amount,
  currency = 'GBP',
  description,
  customerEmail,
  customerName
}: {
  poId: string;
  amount: number;
  currency?: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
}): Promise<{ id: string; status: string; approveUrl?: string }> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  const res = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: poId,
          custom_id: poId,
          description: description || `Highland Kilt Hire - PO #${poId}`,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2)
          }
        }
      ],
      application_context: {
        brand_name: 'Highland Kiltmakers',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW'
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `PayPal Order creation failed (${res.status})`);
  }

  const approveLink = data.links?.find((l: any) => l.rel === 'approve')?.href;
  return {
    id: data.id,
    status: data.status,
    approveUrl: approveLink
  };
}

export async function capturePayPalOrder(orderId: string): Promise<{
  success: boolean;
  orderId: string;
  captureId?: string;
  status: string;
  amountPaid?: number;
  currency?: string;
  payerEmail?: string;
  payerName?: string;
  raw?: any;
}> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  const res = await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `PayPal Order capture failed (${res.status})`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    success: data.status === 'COMPLETED',
    orderId: data.id,
    captureId: capture?.id,
    status: data.status,
    amountPaid: capture?.amount?.value ? parseFloat(capture.amount.value) : undefined,
    currency: capture?.amount?.currency_code,
    payerEmail: data.payer?.email_address,
    payerName: `${data.payer?.name?.given_name || ''} ${data.payer?.name?.surname || ''}`.trim(),
    raw: data
  };
}

export async function refundPayPalCapture({
  captureId,
  amount,
  currency = 'GBP',
  noteToPayer,
  invoiceNumber
}: {
  captureId: string;
  amount?: number; // Optional: If omitted, refunds the full remaining amount
  currency?: string;
  noteToPayer?: string;
  invoiceNumber?: string;
}): Promise<{
  success: boolean;
  refundId: string;
  status: string;
  amountRefunded: number;
  currency: string;
  raw?: any;
}> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  const payload: any = {
    note_to_payer: noteToPayer || 'Highland Kilt Hire - Security Deposit / Order Refund'
  };

  if (invoiceNumber) {
    payload.invoice_id = invoiceNumber;
  }

  if (amount && amount > 0) {
    payload.amount = {
      value: amount.toFixed(2),
      currency_code: currency
    };
  }

  const res = await fetch(`${apiBase}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `PayPal Refund failed (${res.status})`);
  }

  return {
    success: data.status === 'COMPLETED' || data.status === 'PENDING',
    refundId: data.id,
    status: data.status,
    amountRefunded: data.amount?.value ? parseFloat(data.amount.value) : (amount || 0),
    currency: data.amount?.currency_code || currency,
    raw: data
  };
}
