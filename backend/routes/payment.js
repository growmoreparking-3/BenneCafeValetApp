const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID_HERE',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET_HERE'
});

// POST /api/payment/create-order
// Creates a Razorpay order for the given amount (in rupees)
// Accessible without auth (customer fills QR form without logging in)
router.post('/create-order', async (req, res) => {
  try {
    const { amount = 100, currency = 'INR', notes = {} } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes
    };

    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_YOUR_KEY_ID_HERE' || process.env.RAZORPAY_KEY_SECRET === 'YOUR_KEY_SECRET_HERE') {
      console.log('⚠️ Using Mock Razorpay Order Creation (No valid keys found)');
      return res.json({
        orderId: `mock_order_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency,
        keyId: 'mock_key'
      });
    }

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID_HERE'
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
});

// POST /api/payment/verify
// Verifies a Razorpay payment signature
// Used by frontend after payment modal closes
router.post('/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    if (razorpay_order_id && razorpay_order_id.startsWith('mock_order_')) {
      console.log('⚠️ Verifying Mock Razorpay Order:', razorpay_order_id);
      return res.json({ success: true, paymentId: `mock_pay_${Date.now()}` });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET_HERE';
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Razorpay signature mismatch');
      return res.status(400).json({ success: false, message: 'Payment verification failed — invalid signature' });
    }

    res.json({ success: true, paymentId: razorpay_payment_id });
  } catch (error) {
    console.error('Razorpay verify error:', error);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
});

module.exports = router;
