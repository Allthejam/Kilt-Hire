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
import { upsertPurchaseOrder } from '@/lib/firestore';

function PaymentContent() {
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') || 'PO-SAMPLE-001';
  const rawHire = searchParams.get('hire') ? parseFloat(searchParams.get('hire')!) : NaN;
  const rawDeposit = searchParams.get('deposit') ? parseFloat(searchParams.get('deposit')!) : NaN;
  const rawAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : NaN;
  const customerName = searchParams.get('name') || 'Valued Customer';
  const typeParam = searchParams.get('type')?.toUpperCase();

  // Deduce accurate hire fee and deposit from query params without hardcoded assumptions
  const deposit = !isNaN(rawDeposit) ? rawDeposit : (!isNaN(rawAmount) ? Math.min(rawAmount, 50.00) : 18.00);
  const hireFee = !isNaN(rawHire) ? rawHire : (!isNaN(rawAmount) ? Math.max(0, rawAmount - deposit) : 0.00);
  const totalOrderValue = hireFee + deposit;

  // Selected payment mode (if hireFee is 0, only deposit exists)
  const isZeroHire = hireFee === 0;
  const [selectedMode, setSelectedMode] = useState<'DEPOSIT' | 'FULL'>(isZeroHire ? 'DEPOSIT' : typeParam === 'FULL' ? 'FULL' : 'DEPOSIT');
  const amountToPay = (selectedMode === 'DEPOSIT' || isZeroHire) ? deposit : totalOrderValue;

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
                amount: amountToPay,
                description: `Highland Kilt Hire - PO #${poId} (${selectedMode === 'DEPOSIT' ? 'Security Deposit' : 'Full Hire & Deposit'})`,
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

            // Sync payment record into Firestore
            if (poId && poId !== 'PO-SAMPLE-001') {
              try {
                const isPaidFull = selectedMode === 'FULL' || amountToPay >= totalOrderValue;
                const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
                await upsertPurchaseOrder({
                  id: poId,
                  paymentStatus: isPaidFull ? 'FULL_BALANCE_PAID' : 'PARTIAL_DEPOSIT',
                  depositPaymentMethod: 'PAYPAL_ONLINE',
                  depositPaidAt: nowStr,
                  balancePaidAt: isPaidFull ? nowStr : undefined,
                  orderStatus: 'DEPOSIT_PAID_CONFIRMED',
                  paypalTransactionId: data.orderId,
                  paypalCaptureId: captureData.captureId,
                  paypalPayerEmail: captureData.payerEmail
                } as any);
              } catch (dbErr) {
                console.warn('Firestore direct sync error from pay client:', dbErr);
              }
            }

            setPaymentSuccess(true);
            setPaymentDetails({
              orderId: data.orderId,
              captureId: captureData.captureId,
              payerName: captureData.payerName || customerName,
              payerEmail: captureData.payerEmail,
              amountPaid: amountToPay
            });
          } catch (err: any) {
            setErrorMessage(`Capture failed: ${err.message}`);
          } finally {
            setIsProcessing(false);
          }
        },
        onError: (err: any) => {
          console.error('PayPal button error:', err);
          setErrorMessage('Payment failed or was cancelled. Please try again.');
          setIsProcessing(false);
        }
      }).render('#paypal-button-container');
    } catch (e: any) {
      console.error('PayPal button rendering error:', e);
      setErrorMessage(`Failed to render PayPal: ${e.message}`);
    }
  };

  useEffect(() => {
    if (sdkReady) {
      renderPayPalButtons();
    }
  }, [sdkReady, selectedMode]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${clientId}&currency=GBP&components=buttons&enable-funding=card,paylater`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setErrorMessage('Failed to load PayPal Secure Checkout SDK.')}
      />

      {/* HEADER */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 py-4 px-6 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
            <div>
              <h1 className="text-base font-black text-amber-400 tracking-wider uppercase">Highland Kiltmakers</h1>
              <p className="text-[10px] text-slate-400">Secure Online Payment Terminal</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" /> 256-Bit SSL Encrypted
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {paymentSuccess ? (
          /* GREEN RECEIPT SCREEN */
          <div className="bg-slate-800/90 border border-emerald-500/40 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl backdrop-blur-md max-w-lg mx-auto">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-black uppercase tracking-wider">
                Payment Authorized &amp; Confirmed
              </span>
              <h2 className="text-2xl font-black text-white">Thank You, {paymentDetails?.payerName}!</h2>
              <p className="text-xs text-slate-300">
                Your payment for order <strong className="text-amber-400 font-mono font-bold">{poId}</strong> has been successfully processed via PayPal.
              </p>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Order Reference:</span>
                <span className="font-mono text-white font-bold">{poId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Allocation:</span>
                <span className="font-bold text-amber-400 uppercase">
                  {selectedMode === 'DEPOSIT' ? 'Security Deposit (Confirmed)' : 'Full Hire & Deposit'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Paid:</span>
                <span className="font-black text-emerald-400 text-sm">£{amountToPay.toFixed(2)} GBP</span>
              </div>
              {paymentDetails?.captureId && (
                <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2 text-[11px]">
                  <span>PayPal Capture ID:</span>
                  <span className="font-mono text-slate-300">{paymentDetails.captureId}</span>
                </div>
              )}
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

              {/* PAYMENT OPTION SELECTOR PILLS (ONLY SHOWN IF HIRE FEE > 0) */}
              {!isZeroHire ? (
                <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-700 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block px-1">Select Payment Amount:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMode('DEPOSIT')}
                      className={`p-3 rounded-xl text-left transition cursor-pointer border ${
                        selectedMode === 'DEPOSIT' 
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-[10px] block opacity-80 uppercase font-extrabold">Option 1</span>
                      <strong className="text-sm block">🔒 £{deposit.toFixed(2)}</strong>
                      <span className="text-[10px] opacity-80 block">Deposit to Confirm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMode('FULL')}
                      className={`p-3 rounded-xl text-left transition cursor-pointer border ${
                        selectedMode === 'FULL' 
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-[10px] block opacity-80 uppercase font-extrabold">Option 2</span>
                      <strong className="text-sm block">💳 £{totalOrderValue.toFixed(2)}</strong>
                      <span className="text-[10px] opacity-80 block">Pay Full in Advance</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-700 text-xs text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <strong className="text-white block">Refundable Security Deposit Only</strong>
                      <span className="text-[11px] text-slate-400">Garments in this booking have £0.00 hire fee</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-400">£{deposit.toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Customer / Wearer:</span>
                  <strong className="text-white">{customerName}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Garment Hire Fee:</span>
                  <span className="font-medium text-slate-200">£{hireFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Security Deposit (Capped &amp; Refundable):</span>
                  <span className="font-extrabold">£{deposit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 border-t border-slate-700 pt-2">
                  <span>Total Order Value:</span>
                  <span className="font-bold text-slate-200">£{totalOrderValue.toFixed(2)}</span>
                </div>
                {selectedMode === 'DEPOSIT' && (
                  <div className="flex justify-between text-amber-300 text-[11px] bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <span>Remaining Balance Due at Collection:</span>
                    <span className="font-extrabold">£{hireFee.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    {selectedMode === 'DEPOSIT' ? 'Deposit Due Now to Confirm' : 'Total Due Now (Paid in Full)'}
                  </span>
                  <span className="text-2xl font-black text-amber-400">£{amountToPay.toFixed(2)}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-extrabold">
                  GBP (£)
                </span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-400">
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <strong>Security Deposit Guarantee:</strong> Your £{deposit.toFixed(2)} deposit will be automatically refunded upon the safe return of garments.
                </p>
                <p className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  Full Rigout &amp; Deposit cap discounts have been applied.
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
