const axios = require('axios');

/**
 * ChatMitra WhatsApp Service — Benne Cafe Valet
 * Sends WhatsApp template messages via ChatMitra API.
 * Falls back to MOCK mode if CHATMITRA_API_KEY or CHATMITRA_API_URL are not set.
 *
 * ✅ Templates registered in ChatMitra dashboard:
 *   - benne_cafe_otp_20260719205024                    (AUTHENTICATION — APPROVED)
 *   - benne_cafe_booking_confirmation_20260719210009   (UTILITY — PENDING)
 *   - benne_cafe_recall_notification_20260719210758    (UTILITY — PENDING)
 *   - benne_cafe_car_arrived_20260719210445            (UTILITY — PENDING)
 *   - benne_cafe_handover_otp_20260719205148           (AUTHENTICATION — APPROVED)
 *   - benne_cafe_thank_you_20260719210558              (UTILITY — PENDING)
 */
class WhatsAppService {
  constructor() {
    this.enabled = !!(
      process.env.CHATMITRA_API_KEY &&
      process.env.CHATMITRA_API_URL
    );

    if (this.enabled) {
      this.apiKey = process.env.CHATMITRA_API_KEY;
      this.apiUrl = process.env.CHATMITRA_API_URL;
      console.log('✓ ChatMitra WhatsApp Service initialized (Benne Cafe Valet)');
      console.log('   API URL:', this.apiUrl);
    } else {
      console.log('⚠ WhatsApp Service running in MOCK mode (CHATMITRA_API_KEY not configured)');
    }
  }

  /**
   * Format phone number to international format required by ChatMitra
   * e.g. "9876543210" → "919876543210"
   */
  _formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
  }

  /**
   * Build and send a raw axios POST to ChatMitra.
   * Logs the full request payload and full error response for debugging.
   */
  async _post(payload, templateName) {
    console.log(`\n📤 Sending [${templateName}] →`, JSON.stringify(payload, null, 2));
    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✓ WhatsApp [${templateName}] OK:`, JSON.stringify(response.data));
      return { success: true, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      const errData = error.response?.data;
      console.error(`✗ WhatsApp [${templateName}] FAILED — HTTP ${status}:`, JSON.stringify(errData));
      console.error('  Full error:', error.message);
      return { success: false, status, error: errData || error.message };
    }
  }

  /**
   * Core method — sends any approved template message (body variables only, no buttons).
   * @param {string} phone         - Recipient phone number (10 digits or with 91)
   * @param {string} templateName  - Exact template name as saved in ChatMitra dashboard
   * @param {string[]} variables   - Array of variable values in order: {{1}}, {{2}}, ...
   */
  async sendTemplate(phone, templateName, variables = []) {
    const to = this._formatPhone(phone);

    if (this.enabled) {
      const payload = {
        recipient_mobile_number: to,
        customer_name: 'Customer',
        messages: [{
          kind: 'template',
          template: {
            name: templateName,
            language: 'en_US',
            components: variables.length > 0
              ? [{
                type: 'body',
                parameters: variables.map(v => ({ type: 'text', text: String(v) }))
              }]
              : []
          }
        }]
      };
      return this._post(payload, templateName);
    } else {
      // ── MOCK mode ──────────────────────────────────────────────
      console.log('\n📲 MOCK WhatsApp (Benne Cafe Valet):');
      console.log(`   To       : ${to}`);
      console.log(`   Template : ${templateName}`);
      if (variables.length) {
        variables.forEach((v, i) => console.log(`   {{${i + 1}}}     : ${v}`));
      }
      console.log('─────────────────────────────\n');
      return { success: true, mock: true };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HIGH-LEVEL METHODS  (one per notification type)
  // ─────────────────────────────────────────────────────────────

  /**
   * Template: benne_cafe_otp_20260719205024
   * Category: AUTHENTICATION — APPROVED
   * Variables: {{1}} = OTP code
   * Button: Copy Code — "Copy OTP"
   *
   * Message:
   * Your Benne Cafe Valet verification OTP is: *{{1}}*
   * Valid for 10 minutes. Do not share this code with anyone.
   * - Team Benne Cafe
   */
  async sendOTP(phone, otp) {
    const to = this._formatPhone(phone);
    if (this.enabled) {
      const payload = {
        recipient_mobile_number: to,
        customer_name: 'Customer',
        messages: [{
          kind: 'template',
          template: {
            name: 'benne_cafe_otp_20260719205024',
            language: 'en_US',
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: String(otp) }]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: String(otp) }]
              }
            ]
          }
        }]
      };
      return this._post(payload, 'benne_cafe_otp_20260719205024');
    } else {
      console.log(`\n📲 MOCK WhatsApp OTP (Benne Cafe Valet): ${otp} to ${phone}\n`);
      return { success: true, mock: true };
    }
  }

  /**
   * Template: benne_cafe_booking_confirmation_20260719210009
   * Category: UTILITY — PENDING
   * Body variables: {{1}} = customerName, {{2}} = bookingId
   * Button (index 0): Call To Action (URL) — "Track my car"
   *   Base URL: https://<your-app-domain>/customer/access/
   *   URL Suffix variable: {{1}} → accessToken
   *
   * Message:
   * Hi {{1}}, your Benne Cafe Valet booking *{{2}}* is confirmed! 🎉
   * Your car is safely parked. When you're ready to leave, use the Track & Recall link to request your car.
   * - Team Benne Cafe
   */
  async sendBookingConfirmation(phone, customerName, bookingId, accessToken) {
    const to = this._formatPhone(phone);

    if (this.enabled) {
      const payload = {
        recipient_mobile_number: to,
        customer_name: customerName || 'Customer',
        messages: [{
          kind: 'template',
          template: {
            name: 'benne_cafe_booking_confirmation_20260719210009',
            language: 'en_US',
            components: [
              // Body: {{1}} = customerName, {{2}} = bookingId
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customerName || 'Customer' },
                  { type: 'text', text: bookingId }
                ]
              },
              // Button index 0: dynamic URL suffix (accessToken)
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: accessToken }
                ]
              }
            ]
          }
        }]
      };
      return this._post(payload, 'benne_cafe_booking_confirmation_20260719210009');
    } else {
      console.log('\n📲 MOCK WhatsApp (Benne Cafe Valet):');
      console.log(`   To       : ${to}`);
      console.log(`   Template : benne_cafe_booking_confirmation_20260719210009`);
      console.log(`   {{1}}    : ${customerName || 'Customer'}`);
      console.log(`   {{2}}    : ${bookingId}`);
      console.log(`   [Button] : Track my car → accessToken=${accessToken}`);
      console.log('─────────────────────────────\n');
      return { success: true, mock: true };
    }
  }

  /**
   * Template: benne_cafe_recall_notification_20260719210758
   * Category: UTILITY — PENDING
   * Variables: {{1}} = bookingId, {{2}} = estimatedMinutes
   * Buttons: None
   *
   * Message:
   * Benne Cafe Valet: Your car ({{1}}) is on the way! Estimated arrival: *{{2}} minutes*.
   * Please be ready at the pickup point.
   * - Team Benne Cafe
   */
  async sendRecallNotification(phone, bookingId, estimatedMinutes) {
    return this.sendTemplate(phone, 'benne_cafe_recall_notification_20260719210758', [
      bookingId,
      String(estimatedMinutes)
    ]);
  }

  /**
   * ── ARRIVAL NOTIFICATION — 2 messages sent back-to-back ──────────────
   *
   * MSG 1 — Template: benne_cafe_car_arrived_20260719210445  (UTILITY — PENDING)
   * Variables: {{1}} = bookingId  — no auth words, passes UTILITY review
   *
   * Message:
   * Benne Cafe Valet: Your car ({{1}}) has arrived at the pickup point! 🚗
   * Please proceed to collect your vehicle.
   * - Team Benne Cafe
   *
   * MSG 2 — Template: benne_cafe_handover_otp_20260719205148  (AUTHENTICATION — APPROVED)
   * Variables: {{1}} = OTP  — Copy Code button
   *
   * Message:
   * Your Benne Cafe Valet handover OTP is: *{{1}}*
   * Share this OTP with the valet driver to collect your car. Valid for 10 minutes.
   * - Team Benne Cafe
   */
  async sendArrivalNotification(phone, bookingId, otp) {
    // MSG 1: UTILITY — car arrived notice
    const notify = await this.sendTemplate(
      phone,
      'benne_cafe_car_arrived_20260719210445',
      [bookingId]
    );

    // MSG 2: AUTHENTICATION — handover OTP with Copy Code button
    const to = this._formatPhone(phone);
    let otpResult;

    if (this.enabled) {
      const payload = {
        recipient_mobile_number: to,
        customer_name: 'Customer',
        messages: [{
          kind: 'template',
          template: {
            name: 'benne_cafe_handover_otp_20260719205148',
            language: 'en_US',
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: String(otp) }]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: String(otp) }]
              }
            ]
          }
        }]
      };
      otpResult = await this._post(payload, 'benne_cafe_handover_otp_20260719205148');
    } else {
      console.log(`\n📲 MOCK WhatsApp Handover OTP (Benne Cafe Valet): ${otp} to ${phone}\n`);
      otpResult = { success: true, mock: true };
    }

    return { notify, otpResult };
  }

  /**
   * Template: benne_cafe_thank_you_20260719210558
   * Category: UTILITY — PENDING
   * Variables: {{1}} = customerName, {{2}} = bookingId
   * Buttons: None
   *
   * Message:
   * Hi {{1}}, thank you for choosing Benne Cafe Valet! 🙏
   * Your booking {{2}} is complete. We hope to see you again!
   * - Team Benne Cafe
   */
  async sendThankYou(phone, customerName, bookingId) {
    return this.sendTemplate(phone, 'benne_cafe_thank_you_20260719210558', [
      customerName || 'Valued Customer',
      bookingId
    ]);
  }
}

module.exports = new WhatsAppService();
