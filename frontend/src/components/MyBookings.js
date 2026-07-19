import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Car, Clock, Phone, MapPin, AlertCircle, Pencil, X, Check, User, Copy } from 'lucide-react';
import api from '../services/api';
import './MyBookings.css';

const valuableOptions = ['Laptop', 'Phone', 'Wallet', 'Gift', 'Snacks', 'Charger', 'HeadPhone'];

/* ============================================================
   HELPERS FOR RECENT DRIVER NAMES
   ============================================================ */
const getDriverSuggestions = () => {
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const loggedInName = loggedInUser.name || '';
  
  const suggestions = loggedInName ? [loggedInName] : [];
  const seeds = ['Andheri Driver 1', 'Andheri Driver 2', 'Andheri Supervisor'];
  
  try {
    const recents = JSON.parse(localStorage.getItem('recent_drivers') || '[]');
    recents.forEach(name => {
      if (!suggestions.includes(name)) {
        suggestions.push(name);
      }
    });
  } catch (e) {}

  seeds.forEach(name => {
    if (!suggestions.includes(name)) {
      suggestions.push(name);
    }
  });

  return suggestions;
};

const saveRecentDriver = (name) => {
  if (!name || name.trim() === '') return;
  try {
    const recents = JSON.parse(localStorage.getItem('recent_drivers') || '[]');
    if (!recents.includes(name.trim())) {
      const updated = [name.trim(), ...recents].slice(0, 10);
      localStorage.setItem('recent_drivers', JSON.stringify(updated));
    }
  } catch (e) {}
};

/* ============================================================
   EDIT MODAL
   ============================================================ */
const EditBookingModal = ({ booking, onClose, onSaved }) => {
  const isCashBooking = booking.payment?.method === 'cash';

  const [form, setForm] = useState({
    customerName:  booking.customer?.name  || '',
    vehicleNumber: booking.vehicle?.number || '',
    notes:         booking.notes           || '',
    hasValuables:  booking.vehicle?.hasValuables || false,
    valuables:     booking.vehicle?.valuables    || [],
    driverName:    booking.vehicle?.driverName   || '',
    complementary: false,
    cashPaymentStatus: booking.paymentStatus || 'unpaid', // 'paid' | 'unpaid'
  });
  const [newImages, setNewImages]   = useState([]);
  const [saving,   setSaving]       = useState(false);

  const existingImages = booking.vehicle?.images || [];

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const toggleValuables = () => {
    const nextVal = !form.hasValuables;
    setForm({ 
      ...form, 
      hasValuables: nextVal, 
      valuables: nextVal ? form.valuables : [],
    });
  };

  const toggleItem = (v) => {
    const updated = form.valuables.includes(v)
      ? form.valuables.filter(x => x !== v)
      : [...form.valuables, v];
    setForm({ ...form, valuables: updated });
  };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files);
    const total = existingImages.length + newImages.length + files.length;
    if (total > 4) { toast.error('Max 4 images total'); return; }
    setNewImages(prev => [...prev, ...files]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = new FormData();
      data.append('customerName',  form.customerName.trim());
      data.append('vehicleNumber', form.vehicleNumber.trim().toUpperCase());
      data.append('notes',         form.notes);
      data.append('hasValuables',  form.hasValuables);
      data.append('valuables',     JSON.stringify(form.valuables));
      data.append('driverName',    form.driverName.trim());
      if (form.complementary) data.append('complementary', 'true');
      // For cash bookings, save the payment received/remaining status
      if (isCashBooking && !form.complementary) {
        data.append('paymentStatus', form.cashPaymentStatus);
      }
      newImages.forEach(f => data.append('carImages', f));

      const res = await api.put(`/bookings/${booking._id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      saveRecentDriver(form.driverName.trim());
      toast.success('Booking updated!');
      onSaved(res.data.booking);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <motion.div
        className="edit-modal"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="edit-modal-header">
          <div>
            <h3>Edit Booking</h3>
            <span className="edit-booking-id">{booking.bookingId}</span>
          </div>
          <button className="edit-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="edit-modal-body">

          {/* Customer Info */}
          <div className="edit-section">
            <div className="edit-section-title">Customer</div>
            <div className="edit-field">
              <label>Customer Name</label>
              <input
                type="text"
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                placeholder="Customer full name"
              />
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="edit-section">
            <div className="edit-section-title">Vehicle</div>
            <div className="edit-field">
              <label>Vehicle Number</label>
              <input
                type="text"
                name="vehicleNumber"
                value={form.vehicleNumber}
                onChange={handleChange}
                placeholder="MH12AB1234 or 1234"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          {/* Vehicle Security */}
          <div className="edit-section">
            <div className="edit-section-title">Vehicle Security</div>

            <div className="edit-toggle-row">
              <span>Valuables in car?</span>
              <label className="cbf-toggle">
                <input type="checkbox" checked={form.hasValuables} onChange={toggleValuables} />
                <span className="cbf-toggle-slider" />
              </label>
            </div>

            {form.hasValuables && (
              <div className="edit-chips-wrap">
                <p className="edit-chips-label">Select items:</p>
                <div className="edit-chips">
                  {valuableOptions.map(v => (
                    <button
                      key={v}
                      type="button"
                      className={`edit-chip ${form.valuables.includes(v) ? 'selected' : ''}`}
                      onClick={() => toggleItem(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Driver who collected — always visible */}
            <div className="edit-field" style={{ marginTop: '12px' }}>
              <label>Driver Name (Who collected the car)</label>
              <input
                type="text"
                name="driverName"
                value={form.driverName}
                onChange={handleChange}
                placeholder="Enter driver name"
                list="driver-names-list"
                autoComplete="off"
              />
              <datalist id="driver-names-list">
                {getDriverSuggestions().map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Cash Payment Status — only for cash bookings, not complementary */}
            {isCashBooking && !form.complementary && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>
                  Cash Payment Status
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cashPaymentStatus: 'paid' })}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: '10px', border: 'none',
                      cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                      background: form.cashPaymentStatus === 'paid' ? '#D1FAE5' : '#F3F4F6',
                      color:      form.cashPaymentStatus === 'paid' ? '#065F46' : '#6B7280',
                      outline:    form.cashPaymentStatus === 'paid' ? '2px solid #10B981' : '2px solid transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    ✓ Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cashPaymentStatus: 'unpaid' })}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: '10px', border: 'none',
                      cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                      background: form.cashPaymentStatus === 'unpaid' ? '#FEF3C7' : '#F3F4F6',
                      color:      form.cashPaymentStatus === 'unpaid' ? '#92400E' : '#6B7280',
                      outline:    form.cashPaymentStatus === 'unpaid' ? '2px solid #F59E0B' : '2px solid transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    ⏳ Payment Remaining
                  </button>
                </div>
              </div>
            )}

            {/* Complementary toggle — only for cash bookings */}
            {isCashBooking && (
              <div className="edit-toggle-row" style={{ marginTop: '12px', background: form.complementary ? '#F0FDF4' : '#FFFBEB', border: `1.5px solid ${form.complementary ? '#86EFAC' : '#FDE68A'}`, borderRadius: '10px', padding: '10px 14px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: form.complementary ? '#15803D' : '#92400E' }}>
                    {form.complementary ? '🎁 Marked as Complementary' : '🎁 Mark as Complementary?'}
                  </span>
                  <p style={{ fontSize: '11.5px', color: '#6B7280', margin: '2px 0 0' }}>
                    Customer will not be charged for this booking.
                  </p>
                </div>
                <label className="cbf-toggle">
                  <input
                    type="checkbox"
                    checked={form.complementary}
                    onChange={() => setForm({ ...form, complementary: !form.complementary })}
                  />
                  <span className="cbf-toggle-slider" />
                </label>
              </div>
            )}

            {/* Images */}
            <div className="edit-images">
              <p className="edit-img-label">Car Images ({existingImages.length + newImages.length}/4)</p>

              {/* Existing images */}
              {existingImages.length > 0 && (
                <div className="edit-preview-grid">
                  {existingImages.map((url, i) => (
                    <div key={i} className="edit-preview">
                      <img src={url} alt={`car-${i}`} />
                      <span className="edit-preview-badge">Saved</span>
                    </div>
                  ))}
                </div>
              )}

              {/* New images */}
              {newImages.length > 0 && (
                <div className="edit-preview-grid" style={{ marginTop: 8 }}>
                  {newImages.map((f, i) => (
                    <div key={i} className="edit-preview new">
                      <img src={URL.createObjectURL(f)} alt={`new-${i}`} />
                      <button
                        type="button"
                        className="edit-rm-img"
                        onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {existingImages.length + newImages.length < 4 && (
                <div className="edit-img-add-row">
                  {/* Browse */}
                  <input type="file" id="editBrowse" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
                  <label htmlFor="editBrowse" className="edit-img-btn">
                    <Car size={16} /> Add Photos
                  </label>

                  {/* Camera */}
                  <input type="file" id="editCamera" accept="image/*" capture="environment" onChange={handleImageAdd} style={{ display: 'none' }} />
                  <label htmlFor="editCamera" className="edit-img-btn camera">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Camera
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="edit-section">
            <div className="edit-section-title">Notes</div>
            <div className="edit-field">
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Special instructions..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="edit-modal-footer">
          <button className="edit-cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="edit-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : <><Check size={16} /> Update Booking</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   MY BOOKINGS (main component)
   ============================================================ */
const MyBookings = () => {
  const [bookings,          setBookings]          = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [selectedBooking,   setSelectedBooking]   = useState(null);
  const [estimatedTime,     setEstimatedTime]     = useState('');
  const [otp,               setOtp]               = useState('');
  const [verifyMode,        setVerifyMode]        = useState('otp');   // 'otp' | 'phone'
  const [customerPhoneInput,setCustomerPhoneInput]= useState('');
  const [paymentMethod,     setPaymentMethod]     = useState('cash');
  const [activeTab,         setActiveTab]         = useState('active');
  const [editingBooking,    setEditingBooking]    = useState(null);  // booking being edited

  useEffect(() => {
    fetchBookings();
    fetchCompletedBookings();
  }, []);

  const [processingId,      setProcessingId]      = useState(null);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my-bookings');
      setBookings(res.data.bookings);
    } catch {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedBookings = async () => {
    try {
      const res = await api.get('/bookings/my-bookings?status=completed');
      setCompletedBookings(res.data.bookings);
    } catch { console.error('Failed to fetch completed bookings'); }
  };

  // Called when edit modal saves successfully
  const handleBookingSaved = (updatedBooking) => {
    setBookings(prev =>
      prev.map(b => b._id === updatedBooking._id ? updatedBooking : b)
    );
  };

  // Auto-set arrival time to 10 minutes (fixed for Benne Cafe)
  const handleEstimateArrival = async (bookingId) => {
    if (processingId) return;
    setProcessingId(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/estimate-arrival`, { estimatedMinutes: 10 });
      toast.success('Car recalled! Customer notified — arriving in 10 min.');
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to recall car'); }
    finally { setProcessingId(null); }
  };

  const handleMarkArrived = async (bookingId) => {
    if (processingId) return;
    setProcessingId(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/arrived`);
      toast.success('Car marked as arrived! OTP sent to customer.');
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to mark as arrived'); }
    finally { setProcessingId(null); }
  };

  const handleRecallCar = async (bookingId) => {
    if (processingId) return;
    setProcessingId(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/driver-recall`);
      toast.success('Car recall initiated! Set arrival time.');
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to recall car'); }
    finally { setProcessingId(null); }
  };

  const handleCompleteBooking = async (bookingId) => {
    if (verifyMode === 'otp') {
      if (!otp || otp.length !== 6) { toast.error('Please enter valid 6-digit OTP'); return; }
    } else {
      if (!customerPhoneInput || customerPhoneInput.replace(/\D/g, '').length < 10) {
        toast.error('Please enter a valid 10-digit phone number'); return;
      }
    }
    if (processingId) return;
    setProcessingId(bookingId);
    try {
      const payload = verifyMode === 'otp'
        ? { otp }
        : { customerPhone: customerPhoneInput };
      await api.post(`/bookings/${bookingId}/verify-complete`, payload);
      toast.success('Booking completed successfully!');
      setOtp(''); setCustomerPhoneInput(''); setSelectedBooking(null);
      fetchBookings(); fetchCompletedBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to complete booking'); }
    finally { setProcessingId(null); }
  };

  const getStatusColor = (status) => ({
    'parked':           '#10B981',
    'recall-requested': '#F59E0B',
    'in-transit':       '#3B82F6',
    'arrived':          '#8B5CF6',
    'completed':        '#6B7280'
  }[status] || '#666');

  if (loading) return <div className="loading">Loading bookings...</div>;

  return (
    <>
      {/* Edit Modal */}
      <AnimatePresence>
        {editingBooking && (
          <EditBookingModal
            booking={editingBooking}
            onClose={() => setEditingBooking(null)}
            onSaved={handleBookingSaved}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="my-bookings-container">
        <h2>My Bookings</h2>

        {/* Tabs */}
        <div className="bookings-tabs">
          <button className={`tab-btn ${activeTab === 'active'    ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
            Active Bookings ({bookings.length})
          </button>
          <button className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
            Completed ({completedBookings.length})
          </button>
        </div>

        {/* Active Bookings */}
        {activeTab === 'active' && (
          <>
            {bookings.length === 0 ? (
              <div className="empty-state">
                <Car size={80} color="#CCC" />
                <h3>No active bookings</h3>
                <p>Create a new booking to get started</p>
              </div>
            ) : (
              <div className="bookings-grid">
                {bookings
                  .sort((a, b) => {
                    const p = { 'recall-requested': 0, 'in-transit': 1, 'arrived': 2, 'parked': 3 };
                    return (p[a.status] || 99) - (p[b.status] || 99);
                  })
                  .map((booking, index) => {
                    const isRecalled = ['recall-requested', 'in-transit', 'arrived'].includes(booking.status);
                    return (
                      <motion.div
                        key={booking._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`booking-card ${isRecalled ? 'recalled' : ''}`}
                      >
                        <div className="booking-header">
                          <div>
                            <h3>{booking.bookingId}</h3>
                            <p className="booking-time">{new Date(booking.createdAt).toLocaleString()}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="status-badge" style={{ background: getStatusColor(booking.status) }}>
                              {booking.status.replace('-', ' ').toUpperCase()}
                            </span>
                            {/* Edit button */}
                            <button
                              className="edit-booking-btn"
                              title="Edit booking"
                              onClick={() => setEditingBooking(booking)}
                            >
                              <Pencil size={15} />
                            </button>
                          </div>
                        </div>

                        <div className="booking-details">
                          <div className="detail-row">
                            <Car size={18} color="#FF6B35" />
                            <div>
                              <strong>{booking.vehicle?.number}</strong>
                              <span className="detail-meta">
                                {booking.vehicle?.type?.toUpperCase() || ''}
                                {booking.vehicle?.model && ` - ${booking.vehicle.model}`}
                              </span>
                            </div>
                          </div>

                          <div className="detail-row">
                              <Phone size={18} color="#FF6B35" />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div>
                                  <strong>{booking.customer?.name}</strong>
                                  <span className="detail-meta">{booking.customer?.phone}</span>
                                </div>
                                <button
                                  title="Copy phone number"
                                  onClick={() => {
                                    navigator.clipboard.writeText(booking.customer?.phone || '');
                                    toast.success('Phone copied!');
                                  }}
                                  style={{
                                    background: 'none', border: '1px solid #E5E7EB',
                                    borderRadius: '6px', padding: '3px 6px',
                                    cursor: 'pointer', color: '#6B7280',
                                    display: 'flex', alignItems: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            </div>

                          {booking.location?.venue && (
                            <div className="detail-row">
                              <MapPin size={18} color="#FF6B35" />
                              <span>{booking.location.venue}</span>
                            </div>
                          )}

                          {/* Security indicators */}
                          {booking.vehicle?.hasValuables && booking.vehicle?.valuables?.length > 0 && (
                            <div className="detail-row security-row">
                              <AlertCircle size={16} color="#F59E0B" />
                              <span className="valuables-tag">
                                Valuables: {booking.vehicle.valuables.join(', ')}
                              </span>
                            </div>
                          )}

                          {booking.vehicle?.driverName && (
                            <div className="detail-row" style={{ marginTop: '4px' }}>
                              <User size={18} color="#FF6B35" />
                              <div style={{ fontSize: '13px', color: '#10B981', fontWeight: 600 }}>
                                Handled by: {booking.vehicle.driverName}
                              </div>
                            </div>
                          )}

                          {/* Cash payment status banner */}
                          {booking.payment?.method === 'cash' && booking.payment?.method !== 'foc' && (
                            booking.paymentStatus === 'paid' ? (
                              <div style={{
                                marginTop: '8px', padding: '7px 12px', borderRadius: '8px',
                                background: '#D1FAE5', border: '1.5px solid #6EE7B7',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '12.5px', fontWeight: 700, color: '#065F46'
                              }}>
                                <Check size={14} color="#059669" />
                                Cash Received
                              </div>
                            ) : (
                              <div style={{
                                marginTop: '8px', padding: '7px 12px', borderRadius: '8px',
                                background: '#FEF3C7', border: '1.5px solid #FCD34D',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '12.5px', fontWeight: 700, color: '#92400E'
                              }}>
                                <AlertCircle size={14} color="#D97706" />
                                Cash Pending — Collect ₹{booking.payment?.amount || ''} from customer
                              </div>
                            )
                          )}
                        </div>

                        {/* Parked action */}
                        {booking.status === 'parked' && (
                          <div className="action-section">
                            <button className="action-btn primary" onClick={() => handleRecallCar(booking._id)}>
                              🚗 Recall Car
                            </button>
                          </div>
                        )}

                        {/* Recall requested — auto 10 min */}
                        {booking.status === 'recall-requested' && (
                          <div className="action-section">
                            <AlertCircle size={20} color="#F59E0B" />
                            <p className="action-title">Customer requested recall!</p>
                            <button
                              className="action-btn primary"
                              onClick={() => handleEstimateArrival(booking._id)}
                              disabled={processingId === booking._id}
                            >
                              {processingId === booking._id ? 'Processing...' : '🚗 Recall Car (10 min)'}
                            </button>
                          </div>
                        )}

                        {/* In transit */}
                        {booking.status === 'in-transit' && (
                          <div className="action-section">
                            <p className="action-title">🕐 ETA: {booking.recall?.estimatedArrival ?? 10} minutes</p>
                            <button
                              className="action-btn primary"
                              onClick={() => handleMarkArrived(booking._id)}
                              disabled={processingId === booking._id}
                            >
                              {processingId === booking._id ? 'Processing...' : 'Mark as Arrived'}
                            </button>
                          </div>
                        )}

                        {/* Arrived */}
                        {booking.status === 'arrived' && (
                          <div className="action-section">
                            <p className="action-title">Car arrived. Verify customer identity.</p>
                            {selectedBooking === booking._id ? (
                              <div className="action-form">
                                {/* Mode toggle */}
                                <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #E5E7EB', marginBottom: '10px' }}>
                                  <button
                                    type="button"
                                    onClick={() => { setVerifyMode('otp'); setCustomerPhoneInput(''); }}
                                    style={{
                                      flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                                      fontWeight: 700, fontSize: '12.5px',
                                      background: verifyMode === 'otp' ? '#FF6B35' : '#F9FAFB',
                                      color:      verifyMode === 'otp' ? '#fff' : '#6B7280',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    🔢 Enter OTP
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setVerifyMode('phone'); setOtp(''); }}
                                    style={{
                                      flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                                      fontWeight: 700, fontSize: '12.5px',
                                      background: verifyMode === 'phone' ? '#FF6B35' : '#F9FAFB',
                                      color:      verifyMode === 'phone' ? '#fff' : '#6B7280',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    📱 Use Phone No.
                                  </button>
                                </div>

                                {verifyMode === 'otp' ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Enter 6-digit OTP from customer"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength="6"
                                  />
                                ) : (
                                  <>
                                    <input
                                      type="tel"
                                      inputMode="numeric"
                                      placeholder="Enter customer's registered mobile number"
                                      value={customerPhoneInput}
                                      onChange={(e) => setCustomerPhoneInput(e.target.value)}
                                      maxLength="10"
                                    />
                                    <p style={{ fontSize: '11.5px', color: '#6B7280', margin: '5px 0 0', lineHeight: 1.4 }}>
                                      ⚠️ Use only if customer is unable to provide OTP (e.g., phone switched off).
                                    </p>
                                  </>
                                )}

                                <div className="action-buttons" style={{ marginTop: '8px' }}>
                                  <button className="action-btn primary" onClick={() => handleCompleteBooking(booking._id)}>Complete Booking</button>
                                  <button className="action-btn secondary" onClick={() => { setSelectedBooking(null); setOtp(''); setCustomerPhoneInput(''); setVerifyMode('otp'); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button className="action-btn primary" onClick={() => setSelectedBooking(booking._id)}>Complete Booking</button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {/* Completed Bookings */}
        {activeTab === 'completed' && (
          <>
            {completedBookings.length === 0 ? (
              <div className="empty-state">
                <Car size={80} color="#CCC" />
                <h3>No completed bookings</h3>
                <p>Completed bookings will appear here</p>
              </div>
            ) : (
              <div className="bookings-grid">
                {completedBookings.map((booking) => (
                  <motion.div
                    key={booking._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="booking-card completed"
                  >
                    <div className="booking-header">
                      <h3>{booking.bookingId}</h3>
                      <span className="status-badge" style={{ backgroundColor: '#6B7280' }}>COMPLETED</span>
                    </div>
                    <div className="booking-info">
                      <div className="info-row"><Car size={18} /><span>{booking.vehicle?.number} - {booking.vehicle?.type}</span></div>
                      <div className="info-row"><Phone size={18} /><span>{booking.customer?.name} - {booking.customer?.phone}</span></div>
                      {booking.location?.venue && (
                        <div className="info-row"><MapPin size={18} /><span>{booking.location.venue}</span></div>
                      )}
                      <div className="info-row">
                        <Clock size={18} />
                        <span>Completed: {new Date(booking.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </>
  );
};

export default MyBookings;
