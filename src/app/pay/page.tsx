'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { 
  ShieldCheck, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Sparkles,
  ArrowRight,
  Clock
} from 'lucide-react';

function PaymentContent() {
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') || 'PO-SAMPLE-001';
  const amountParam = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : 160.00;
  const customerName = searchParams.get('name') || 'Valued Customer';
  const paymentType = searchParams.get('type') || 'FULL'; // 'DEPOSIT' | 'BALANCE' | 'FULL'

  const [amount, setAmount] = useState<number>(amountParam);
  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    orderId: string;
    captureId?: string;
    payerName?: string;
    payerEmail?: string;
    amountPaid?: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'AZFesY0CQIX0Bj88JPxObaigD2vsVumDk_isHuKOfXGA2-ICOTdUP7CzuwsqLZ-Bn3D4oG8rIMtriPge';

  useEffect(() => {
    if (amountParam && !isNaN(amountParam)) {
      setAmount(amountParam);
    }
  }, [amountParam]);

  const renderPayPalButtons = () => {
    if (typeof window === 'undefined' || !(window as any).paypal) return;

    const container = document.getElementById('paypal-button-container');
    if (!container) return;
    container.innerHTML = '';

    try {
      (window as any).paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay'
        },
        createOrder: async () => {
          setIsProcessing(true);
          setErrorMessage('');
          try {
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                poId: poId,
                amount: amount,
                description: `Highland Kilt Hire - PO #${poId} (${paymentType})`,
                customerName: customerName
              })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Failed to initialize PayPal order.');
            }

            return data.orderId;
          } catch (err: any) {
            setIsProcessing(false);
            setErrorMessage(err.message || 'Error creating PayPal order.');
            throw err;
          }
        },
        onApprove: async (data: any) => {
          try {
            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderId,
                poId: poId
              })
            });

            const captureData = await res.json();
            if (!res.ok || !captureData.success) {
              throw new Error(captureData.error || 'Failed to capture PayPal payment.');
            }

            setPaymentSuccess(true);
            setPaymentDetails({
              orderId: captureData.orderId,
              captureId: captureData.captureId,
              payerName: captureData.payerName,
              payerEmail: captureData.payerEmail,
              amountPaid: captureData.amountPaid || amount
            });
            setIsProcessing(false);
          } catch (err: any) {
            setIsProcessing(false);
            setErrorMessage(err.message || 'Error capturing payment.');
          }
        },
        onError: (err: any) => {
          setIsProcessing(false);
          setErrorMessage('Payment was declined or cancelled. Please try again.');
          console.error('PayPal Button Error:', err);
        }
      }).render('#paypal-button-container');
    } catch (err) {
      console.error('PayPal button render error:', err);
    }
  };

  useEffect(() => {
    if (sdkReady && !paymentSuccess) {
      renderPayPalButtons();
    }
  }, [sdkReady, amount, paymentSuccess]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${clientId}&currency=GBP&components=buttons`}
        onLoad={() => setSdkReady(true)}
      />

      {/* TOP HEADER */}
      <header className="bg-slate-950/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow-sm">
              🏴󠁧󠁢󠁳󠁣󠁴󠁿
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider">Highland Kiltmakers</h1>
              <p className="text-[10px] text-slate-400">Secure Online Checkout &amp; Counter Settlement</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-700/60 rounded-full text-emerald-300 text-xs font-bold shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit SSL Encrypted
          </div>
        </div>
      </header>

      {/* MAIN CHECKOUT CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1 flex items-center justify-center">
        {paymentSuccess && paymentDetails ? (
          /* SUCCESS SCREEN */
          <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200 max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-extrabold uppercase">
                Payment Settled via PayPal
              </span>
              <h2 className="text-2xl font-black text-slate-900">Thank You, {customerName}!</h2>
              <p className="text-xs text-slate-500">
                Your payment for Order <strong>#{poId}</strong> has been successfully processed and confirmed.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Amount Settled:</span>
                <span className="font-extrabold text-emerald-700 text-sm">£{paymentDetails.amountPaid?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Order Reference:</span>
                <span className="font-mono font-extrabold text-slate-900">{poId}</span>
              </div>
              {paymentDetails.captureId && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">PayPal Capture ID:</span>
                  <span className="font-mono text-[10px] text-purple-700">{paymentDetails.captureId}</span>
                </div>
              )}
              {paymentDetails.payerEmail && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Payer Account:</span>
                  <span className="text-slate-900 font-medium">{paymentDetails.payerEmail}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-950 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">Next Step: Outfit Preparation</p>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Our shop staff will now custom pick and steam your rigout. You will receive an automated notification as soon as your outfit is bagged and ready for collection!
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              A payment receipt has been dispatched to your email. You may close this window.
            </p>
          </div>
        ) : (
          /* CHECKOUT FORM */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full items-start">
            
            {/* LEFT: ORDER SUMMARY */}
            <div className="md:col-span-6 bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Highland Rigout Hire</span>
                  <h2 className="text-xl font-black text-white">Order Summary</h2>
                </div>
                <span className="font-mono font-extrabold text-xs px-2.5 py-1 bg-slate-900 border border-slate-600 rounded-lg text-slate-300">
                  {poId}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Customer / Wearer:</span>
                  <strong className="text-white">{customerName}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Payment Allocation:</span>
                  <strong className="text-amber-400 uppercase font-bold">{paymentType} SETTLEMENT</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Hire Package Rate:</span>
                  <span className="font-medium text-slate-200">£{(amount > 50 ? amount - 50 : amount).toFixed(2)}</span>
                </div>
                {amount > 50 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Security Deposit (Refundable):</span>
                    <span className="font-extrabold">£50.00</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Due Now</span>
                  <span className="text-2xl font-black text-amber-400">£{amount.toFixed(2)}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-extrabold">
                  GBP (£)
                </span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-400">
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <strong>Security Deposit Guarantee:</strong> Your £50 security deposit will be automatically refunded upon the safe return of garments.
                </p>
                <p className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  Full Rigout cap discounts have been applied to this booking.
                </p>
              </div>
            </div>

            {/* RIGHT: PAYPAL PAYMENT SMART BUTTONS */}
            <div className="md:col-span-6 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-600" /> Secure Payment
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pay securely with PayPal, Debit/Credit Card, or Pay in 3 installments.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Payment Notice</strong>
                    {errorMessage}
                  </div>
                </div>
              )}

              <div className="min-h-[160px] flex flex-col justify-center">
                {!sdkReady ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 font-semibold">Connecting to PayPal Secure Checkout...</p>
                  </div>
                ) : (
                  <div id="paypal-button-container" className="w-full"></div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400 space-y-1">
                <p>Protected by PayPal Buyer &amp; Merchant Protection</p>
                <p>Highland Kiltmakers • 123 High Street, Edinburgh • 0131 555 1234</p>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <p>© 2026 Highland Kiltmakers. All rights reserved.</p>
          <p className="text-[11px] text-slate-600">Official PayPal Partner Gateway</p>
        </div>
      </footer>
    </div>
  );
}

export default function PayPalPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading Secure Payment Gateway...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
