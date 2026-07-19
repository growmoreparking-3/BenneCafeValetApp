import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { Car, CheckCircle, CreditCard, ShieldCheck, AlertCircle, RefreshCw, IndianRupee, Phone } from 'lucide-react';
import axios from 'axios';
import './CustomerBookingForm.css';

const API_URL = process.env.REACT_APP_API_URL || '';
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID_HERE';

/* ─── Load Razorpay SDK once ─────────────────────────────── */
const loadRazorpaySDK = () =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const CustomerBookingForm = () => {
  const { driverPhone } = useParams();

  const [formData, setFormData] = useState({
    customerPhone: '',
    vehicleNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverNotFound, setDriverNotFound] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState(150);
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // razorpay | cash
  const [paymentState, setPaymentState] = useState('idle'); // idle | paying | success | failed
  const [paymentData, setPaymentData] = useState(null); // { orderId, paymentId, signature }
  const [venueName, setVenueName] = useState('');
  const [venueLoading, setVenueLoading] = useState(true);

  // Fetch driver name + venue parking fee to verify the QR is valid
  useEffect(() => {
    if (!driverPhone) { setDriverNotFound(true); return; }
    const verify = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/driver-info/${driverPhone}`);
        setDriverName(res.data.name || 'Your Valet Driver');
        if (res.data.parkingFee !== undefined) {
          setPaymentAmount(res.data.parkingFee);
        }
        if (res.data.venueName) {
          setVenueName(res.data.venueName);
        }
      } catch {
        setDriverName('Your Valet Driver');
      } finally {
        setVenueLoading(false);
      }
    };
    verify();
  }, [driverPhone]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /* ─── Razorpay Payment ──────────────────────────────────── */
  const handlePayment = useCallback(async () => {
    if (!/^[0-9]{10}$/.test(formData.customerPhone.trim())) {
      toast.error('Please enter a valid 10-digit mobile number first'); return;
    }
    if (paymentAmount <= 0) { toast.error('Invalid payment amount'); return; }

    setPaymentState('paying');

    const sdkLoaded = await loadRazorpaySDK();
    if (!sdkLoaded) {
      toast.error('Failed to load payment gateway. Check your internet connection.');
      setPaymentState('failed');
      return;
    }

    try {
      // Create Razorpay order on backend
      const { data } = await axios.post(`${API_URL}/api/payment/create-order`, {
        amount: paymentAmount,
        notes: { customerPhone: formData.customerPhone }
      });

      if (data.orderId && data.orderId.startsWith('mock_order_')) {
        toast.loading('Processing Test Payment (Mock Mode)...', { duration: 1500 });
        setTimeout(async () => {
          try {
            const verify = await axios.post(`${API_URL}/api/payment/verify`, {
              razorpay_order_id: data.orderId,
              razorpay_payment_id: `pay_mock_${Date.now()}`,
              razorpay_signature: 'mock_signature'
            });

            if (verify.data.success) {
              setPaymentData({
                orderId: data.orderId,
                paymentId: verify.data.paymentId,
                signature: 'mock_signature'
              });
              setPaymentState('success');
              toast.success('Test Payment Successful! (Mock Mode) ✓');
            } else {
              setPaymentState('failed');
              toast.error('Test Payment Verification Failed.');
            }
          } catch {
            setPaymentState('failed');
            toast.error('Test Payment Verification Error.');
          }
        }, 1500);
        return;
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: data.amount,
        currency: data.currency,
        name: 'Benne Cafe Valet',
        description: 'Valet Parking Payment',
        order_id: data.orderId,
        prefill: {
          contact: formData.customerPhone,
        },
        theme: { color: '#FF6B35' },
        handler: async (response) => {
          try {
            const verify = await axios.post(`${API_URL}/api/payment/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verify.data.success) {
              setPaymentData({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature
              });
              setPaymentState('success');
              toast.success('Payment successful! ✓');
            } else {
              setPaymentState('failed');
              toast.error('Payment verification failed. Please retry.');
            }
          } catch {
            setPaymentState('failed');
            toast.error('Payment verification error. Please retry.');
          }
        },
        modal: {
          ondismiss: () => {
            if (paymentState !== 'success') {
              setPaymentState('failed');
              toast.error('Payment cancelled. Please retry to create your booking.');
            }
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        setPaymentState('failed');
        toast.error('Payment failed. Please retry.');
      });
      rzp.open();
    } catch (err) {
      setPaymentState('failed');
      toast.error(err.response?.data?.message || 'Failed to initiate payment. Please try again.');
    }
  }, [formData, paymentAmount, paymentState]);

  const handleRetryPayment = () => {
    setPaymentState('idle');
    setPaymentData(null);
  };

  /* ─── Form Submit ───────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^[0-9]{10}$/.test(formData.customerPhone.trim())) {
      toast.error('Enter a valid 10-digit mobile number'); return;
    }
    if (formData.vehicleNumber.trim().length < 4) {
      toast.error('Vehicle number must be at least 4 characters'); return;
    }
    if (paymentMethod === 'razorpay' && (paymentState !== 'success' || !paymentData)) {
      toast.error('Please complete payment before creating a booking'); return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('driverPhone', driverPhone);
      // Use phone number as customer name since name field is removed
      data.append('customerName', formData.customerPhone.trim());
      data.append('customerPhone', formData.customerPhone.trim());
      data.append('vehicleNumber', formData.vehicleNumber.trim().toUpperCase());
      data.append('notes', '');
      data.append('hasValuables', false);
      data.append('valuables', JSON.stringify([]));
      data.append('paymentMethod', paymentMethod);
      if (paymentMethod === 'razorpay') {
        data.append('razorpayOrderId', paymentData.orderId);
        data.append('razorpayPaymentId', paymentData.paymentId);
        data.append('razorpaySignature', paymentData.signature);
      }
      data.append('paymentAmount', paymentAmount);

      const res = await axios.post(`${API_URL}/api/bookings/public`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCreatedBookingId(res.data.booking.bookingId);
      setSubmitted(true);
      toast.success('Booking created successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Screens ───────────────────────────────────────────── */
  if (driverNotFound) {
    return (
      <div className="cbf-page">
        <div className="cbf-error-state">
          <Car size={60} color="#EF4444" />
          <h2>Invalid QR Code</h2>
          <p>This QR code is not associated with a valid driver. Please contact your valet service.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="cbf-page">
        <Toaster position="top-center" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cbf-success-card"
        >
          <div className="cbf-success-icon">
            <CheckCircle size={64} color="#10B981" />
          </div>
          <h2>Booking Confirmed! 🎉</h2>
          <p>Your vehicle has been registered for valet parking at Benne Cafe.</p>
          <div className="cbf-booking-id-box">
            <span>Booking ID</span>
            <strong>{createdBookingId}</strong>
          </div>
          {paymentMethod === 'razorpay' ? (
            <div className="cbf-payment-success-badge">
              <ShieldCheck size={16} color="#10B981" />
              <span>Payment of ₹{paymentAmount} confirmed • {paymentData?.paymentId}</span>
            </div>
          ) : (
            <div className="cbf-payment-success-badge" style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}>
              <AlertCircle size={16} color="#92400E" />
              <span>Pay ₹{paymentAmount} in cash to the driver upon collection.</span>
            </div>
          )}
          <p className="cbf-track-hint">
            You will receive an SMS with a tracking link to monitor your car status in real time.
          </p>
        </motion.div>
      </div>
    );
  }

  /* ─── Main Form ─────────────────────────────────────────── */
  return (
    <div className="cbf-page">
      <Toaster position="top-center" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="cbf-wrapper"
      >
        {/* Header */}
        <div className="cbf-header">
          <div className="cbf-logo-ring">
            <Car size={36} color="#FF6B35" />
          </div>
          <h1>Benne Cafe Valet</h1>
          <p>Book your valet parking in seconds</p>
          {driverName && (
            <div className="cbf-driver-badge">
              <span>👋 Served by <strong>{driverName}</strong></span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="cbf-form">

          {/* Mobile Number */}
          <div className="cbf-section">
            <div className="cbf-section-title">
              <Phone size={18} /> Mobile Number
            </div>
            <div className="cbf-field">
              <label>Mobile Number <span className="req">*</span></label>
              <input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                maxLength="10"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          {/* Vehicle Number */}
          <div className="cbf-section">
            <div className="cbf-section-title">
              <Car size={18} /> Vehicle Number
            </div>
            <div className="cbf-field">
              <label>
                Vehicle Number <span className="req">*</span>
                <span className="cbf-hint"> (full plate or last 4 digits)</span>
              </label>
              <input
                type="text"
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="MH12AB1234 or 1234"
                minLength="4"
                required
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          {/* ═══════════════ PAYMENT SECTION ══════════════════ */}
          <div className="cbf-section cbf-payment-section">
            <div className="cbf-section-title">
              <CreditCard size={18} /> Payment
            </div>

            {/* Venue Fee Display (read-only) */}
            <div className="cbf-venue-fee-row">
              <div className="cbf-venue-fee-info">
                <span className="cbf-venue-fee-label">
                  {venueName ? `Parking charge at ${venueName}` : 'Valet Parking Charge'}
                </span>
                {venueLoading ? (
                  <span className="cbf-fee-loading">Loading fee…</span>
                ) : (
                  <span className="cbf-venue-fee-amount">₹{paymentAmount}</span>
                )}
              </div>
              <div className="cbf-fee-badge">Admin set</div>
            </div>

            {/* Payment Method Selector */}
            <div className="cbf-field" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <label>Select Payment Option</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'razorpay' ? '2.5px solid #FF6B35' : '2px solid #E5E7EB',
                    background: paymentMethod === 'razorpay' ? '#FFF5F2' : '#FAFAFA',
                    color: paymentMethod === 'razorpay' ? '#FF6B35' : '#374151',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setPaymentMethod('razorpay')}
                >
                  <CreditCard size={18} />
                  Online
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: paymentMethod === 'cash' ? '2.5px solid #FF6B35' : '2px solid #E5E7EB',
                    background: paymentMethod === 'cash' ? '#FFF5F2' : '#FAFAFA',
                    color: paymentMethod === 'cash' ? '#FF6B35' : '#374151',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <IndianRupee size={18} />
                  Cash
                </button>
              </div>
            </div>

            {paymentMethod === 'razorpay' ? (
              <>
                <AnimatePresence mode="wait">
                  {/* ── IDLE: Show Pay Button ── */}
                  {paymentState === 'idle' && (
                    <motion.button
                      key="pay-btn"
                      type="button"
                      className="cbf-pay-btn"
                      onClick={handlePayment}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CreditCard size={20} />
                      Pay ₹{paymentAmount} with Razorpay
                    </motion.button>
                  )}

                  {/* ── PAYING: Spinner ── */}
                  {paymentState === 'paying' && (
                    <motion.div
                      key="paying"
                      className="cbf-payment-status paying"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="cbf-spinner-ring" />
                      <span>Opening payment gateway…</span>
                    </motion.div>
                  )}

                  {/* ── SUCCESS ── */}
                  {paymentState === 'success' && (
                    <motion.div
                      key="success"
                      className="cbf-payment-status success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <ShieldCheck size={22} color="#10B981" />
                      <div>
                        <span className="cbf-ps-title">Payment Successful ✓</span>
                        <span className="cbf-ps-sub">₹{paymentAmount} paid • ID: {paymentData?.paymentId?.slice(-8)}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* ── FAILED ── */}
                  {paymentState === 'failed' && (
                    <motion.div
                      key="failed"
                      className="cbf-payment-failed-wrap"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="cbf-payment-status failed">
                        <AlertCircle size={22} color="#EF4444" />
                        <span className="cbf-ps-title">Payment Failed or Cancelled</span>
                      </div>
                      <button
                        type="button"
                        className="cbf-retry-btn"
                        onClick={handleRetryPayment}
                      >
                        <RefreshCw size={16} />
                        Retry Payment
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {paymentState !== 'success' && (
                  <p className="cbf-payment-note">
                    🔒 Secure payment powered by Razorpay. Pay first to confirm your booking slot.
                  </p>
                )}
              </>
            ) : (
              <div style={{
                background: '#FEF3C7',
                border: '1.5px solid #FDE68A',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#92400E',
                fontSize: '13.5px',
                lineHeight: '1.5',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} />
                <span>
                  You selected <strong>Cash Payment</strong>. You can bypass the online gateway and complete booking directly. Please pay <strong>₹{paymentAmount}</strong> in cash to the valet driver upon vehicle handover/collection.
                </span>
              </div>
            )}
          </div>

          {/* Submit — only active after payment success */}
          <button
            type="submit"
            className={`cbf-submit ${(paymentMethod === 'razorpay' && paymentState !== 'success') ? 'cbf-submit-locked' : ''}`}
            disabled={loading || (paymentMethod === 'razorpay' && paymentState !== 'success')}
          >
            {loading ? (
              <span className="cbf-spinner">Creating Booking...</span>
            ) : (paymentMethod === 'razorpay' && paymentState !== 'success') ? (
              <>🔒 Complete Payment to Book</>
            ) : (
              <>🚗 Create Booking</>
            )}
          </button>
        </form>

        <p className="cbf-footer">Powered by Benne Cafe Valet</p>
      </motion.div>
    </div>
  );
};

export default CustomerBookingForm;
