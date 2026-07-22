import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import {
  LogOut, Activity, Car, Clock, TrendingUp, Download,
  CreditCard, CheckCircle, XCircle, BarChart2, Calendar
} from 'lucide-react';
import api from '../services/api';
import logo from '../logo.png';
import './SupervisorDashboard.css';

/* ─── Mini Bar Chart (pure SVG) ──────────────────────────── */
const MiniBarChart = ({ data, height = 100 }) => {
  if (!data || data.length === 0) return <div className="svtx-no-data">No data for this period</div>;
  const max = Math.max(...data.map(d => d.amount), 1);
  const barW = Math.max(6, Math.floor(460 / data.length) - 4);
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={data.length * (barW + 4)} height={height + 22} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const bH = Math.max(3, Math.round((d.amount / max) * height));
          const x = i * (barW + 4);
          const y = height - bH;
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bH} rx={3}
                fill={isLast ? '#FF6B35' : d.amount > 0 ? '#8B5CF6' : '#E5E7EB'} opacity={isLast ? 1 : 0.8}>
                <title>₹{d.amount.toLocaleString()} • {d.count} txn(s) • {d.label}</title>
              </rect>
              {(i % Math.ceil(data.length / 8) === 0 || isLast) && (
                <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize="8" fill="#9CA3AF">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const SupervisorDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket, on, off } = useSocket();
  const [stats,    setStats]    = useState({});
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('active');
  const [dateFilter, setDateFilter] = useState('today');
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'transactions'

  // Transaction-specific state
  const [txnData, setTxnData]   = useState(null);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnChartView, setTxnChartView] = useState('daily');

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/bookings/stats/overview');
      setStats(response.data);
    } catch { console.error('Failed to fetch stats'); }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      let fromDate = new Date();
      let toDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      if (dateFilter === 'week') {
        fromDate.setDate(fromDate.getDate() - 7);
      } else if (dateFilter === 'month') {
        fromDate.setMonth(fromDate.getMonth() - 1);
      } else if (dateFilter === 'all') {
        fromDate = new Date(2020, 0, 1);
      }

      const params = filter === 'all'
        ? {}
        : { status: filter === 'active' ? 'parked,recall-requested,in-transit,arrived' : 'completed' };

      params.from = fromDate.toISOString();
      params.to   = toDate.toISOString();

      const response = await api.get('/bookings/all', { params });
      setBookings(response.data.bookings);
    } catch { toast.error('Failed to fetch bookings'); }
    finally { setLoading(false); }
  }, [filter, dateFilter]);

  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      const res = await api.get('/admin/revenue-stats');
      setTxnData(res.data);
    } catch { toast.error('Failed to load transaction data'); }
    finally { setTxnLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchBookings();
  }, [filter, dateFilter, fetchStats, fetchBookings]);

  useEffect(() => {
    if (activeTab === 'transactions' && !txnData) {
      fetchTransactions();
    }
  }, [activeTab, txnData, fetchTransactions]);

  useEffect(() => {
    if (socket) {
      const handleNewBooking = () => {
        toast.success('New booking created!');
        fetchStats();
        fetchBookings();
      };
      on('new-booking', handleNewBooking);
      return () => { off('new-booking', handleNewBooking); };
    }
  }, [socket, on, off, fetchStats, fetchBookings]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const formatTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (booking) => {
    const start = booking.createdAt;
    const end   = booking.parking?.actualEndTime || booking.updatedAt;
    if (!start) return '—';
    if (booking.status !== 'completed') return 'Active';
    const ms = new Date(end) - new Date(start);
    if (ms <= 0) return '—';
    const totalMins = Math.floor(ms / 60000);
    const hrs  = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const exportToCSV = () => {
    try {
      const headers = [
        'Booking ID', 'Customer Name', 'Customer Phone',
        'Vehicle Number', 'Driver Name', 'Status',
        'Booking Time', 'Recall Time', 'Complete Time',
        'Duration', 'Venue', 'Parking Spot'
      ];
      const rows = bookings.map(b => [
        b.bookingId || '', b.customer?.name || '', b.customer?.phone || '',
        b.vehicle?.number || '', b.driver?.name || 'N/A', b.status || '',
        formatTime(b.createdAt), formatTime(b.recall?.requestedAt),
        formatTime(b.parking?.actualEndTime), formatDuration(b),
        b.location?.venue || '', b.location?.parkingSpot || ''
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `bookings-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV downloaded!');
    } catch { toast.error('Failed to export CSV'); }
  };

  const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const txnChartData = {
    daily: txnData?.dailyBreakdown || [],
    weekly: txnData?.weeklyBreakdown || [],
    monthly: txnData?.monthlyBreakdown || []
  }[txnChartView];

  const paymentMethodColors = {
    razorpay: '#6366F1', cash: '#10B981', upi: '#F59E0B',
    card: '#3B82F6', qr: '#8B5CF6', staff: '#EC4899', foc: '#14B8A6', pending: '#9CA3AF'
  };

  const getPaymentMethodLabel = (m) => ({
    razorpay: '💳 Razorpay', cash: '💵 Cash', upi: '📱 UPI',
    card: '🃏 Card', qr: '🔲 QR', staff: '👷 Staff', foc: '🎁 FOC', pending: '⏳ Pending'
  }[m] || m);

  const statCards = [
    { label: "Today's Bookings", value: stats.todayBookings  || 0, icon: TrendingUp, color: '#3B82F6' },
    { label: 'Active Bookings',  value: stats.activeBookings || 0, icon: Activity,   color: '#FF6B35' },
    { label: 'Completed',        value: stats.completedBookings || 0, icon: Car,     color: '#10B981' },
    { label: 'Total Bookings',   value: stats.totalBookings  || 0, icon: Clock,      color: '#8B5CF6' }
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <img src={logo} alt="Logo" style={{ width: '42px', height: 'auto', objectFit: 'contain' }} />
          <div>
            <h2>Supervisor Dashboard</h2>
            <p>{user?.name}</p>
          </div>
        </div>
        <div className="header-right">
          {activeTab === 'bookings' && (
            <button onClick={exportToCSV} className="export-btn" style={{ marginRight: '10px' }}>
              <Download size={18} /> Export CSV
            </button>
          )}
          {activeTab === 'transactions' && (
            <button onClick={fetchTransactions} className="export-btn" style={{ marginRight: '10px' }} disabled={txnLoading}>
              <BarChart2 size={18} /> {txnLoading ? 'Loading…' : 'Refresh'}
            </button>
          )}
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </header>

      <main className="supervisor-content">

        {/* Stats Cards */}
        <div className="stats-grid">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="stat-card"
              style={{ borderTop: `3px solid ${stat.color}` }}
            >
              <div className="stat-icon" style={{ background: `${stat.color}18` }}>
                <stat.icon size={24} color={stat.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p className="stat-label">{stat.label}</p>
                <h3 className="stat-value">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab Switcher */}
        <div className="sv-tab-row">
          <button
            className={`sv-tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <Car size={16} /> Bookings
          </button>
          <button
            className={`sv-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <CreditCard size={16} /> Transactions
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ══ BOOKINGS TAB ══ */}
          {activeTab === 'bookings' && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bookings-section"
            >
              <div className="section-header">
                <h3>All Bookings</h3>
                <div className="filter-buttons">
                  {['active', 'completed', 'all'].map(f => (
                    <button
                      key={f}
                      className={filter === f ? 'active' : ''}
                      onClick={() => setFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="date-filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {['today','week','month','all'].map(df => (
                  <button
                    key={df}
                    className={`filter-btn ${dateFilter === df ? 'active' : ''}`}
                    onClick={() => setDateFilter(df)}
                  >
                    {df === 'today' ? 'Today' : df === 'week' ? 'This Week' : df === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="bookings-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Booking Time</th>
                        <th>Recall Time</th>
                        <th>Complete Time</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => {
                        const duration = formatDuration(booking);
                        const isActive = booking.status !== 'completed';
                        return (
                          <tr key={booking._id}>
                            <td><strong>{booking.bookingId}</strong></td>
                            <td>
                              {booking.customer?.name || booking.customer?.phone}<br/>
                              <small>{booking.customer?.phone}</small>
                            </td>
                            <td>{booking.vehicle?.number}</td>
                            <td>{booking.driver?.name || 'N/A'}</td>
                            <td>
                              <span className={`status-badge status-${booking.status}`}>
                                {booking.status}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 9px',
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                background: (paymentMethodColors[booking.payment?.method] || '#9CA3AF') + '20',
                                color: paymentMethodColors[booking.payment?.method] || '#6B7280'
                              }}>
                                {getPaymentMethodLabel(booking.payment?.method || 'pending')}
                                {booking.payment?.amount ? ` ₹${booking.payment.amount}` : ''}
                              </span>
                            </td>
                            <td><small>{formatTime(booking.createdAt)}</small></td>
                            <td><small>{formatTime(booking.recall?.requestedAt)}</small></td>
                            <td><small>{formatTime(booking.parking?.actualEndTime)}</small></td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                background: isActive ? '#FFF5F2' : '#ECFDF5',
                                color: isActive ? '#FF6B35' : '#10B981',
                                border: `1px solid ${isActive ? '#FFD9CC' : '#A7F3D0'}`
                              }}>
                                <Clock size={11} />
                                {duration}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {bookings.length === 0 && (
                    <div className="empty-table">No bookings found</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ══ TRANSACTIONS TAB ══ */}
          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="svtx-container"
            >
              {txnLoading ? (
                <div className="loading">Loading transaction data...</div>
              ) : (
                <>
                  {/* Revenue Cards */}
                  <div className="svtx-cards">
                    {[
                      { label: "Today", value: fmt(txnData?.today?.amount), count: txnData?.today?.count, icon: Calendar, color: '#FF6B35' },
                      { label: "This Week", value: fmt(txnData?.week?.amount), count: txnData?.week?.count, icon: TrendingUp, color: '#6366F1' },
                      { label: "This Month", value: fmt(txnData?.month?.amount), count: txnData?.month?.count, icon: BarChart2, color: '#10B981' },
                      { label: "All Time", value: fmt(txnData?.allTime?.amount), count: txnData?.allTime?.count, icon: Activity, color: '#F59E0B' },
                    ].map((c, i) => (
                      <motion.div
                        key={c.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="svtx-card"
                        style={{ '--svtx-color': c.color, borderTop: `3px solid ${c.color}` }}
                      >
                        <div className="svtx-card-icon" style={{ background: c.color + '18' }}>
                          <c.icon size={20} color={c.color} />
                        </div>
                        <div>
                          <p className="svtx-card-label">{c.label}</p>
                          <h3 className="svtx-card-value">{c.value}</h3>
                          <span className="svtx-card-count">{c.count || 0} transactions</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Payment Status */}
                  <div className="svtx-status-row">
                    <div className="svtx-status-item success">
                      <CheckCircle size={24} color="#10B981" />
                      <div>
                        <span className="svtx-si-count">{txnData?.paymentStatus?.successful?.count || 0}</span>
                        <span className="svtx-si-label">Successful</span>
                        <span className="svtx-si-amt">{fmt(txnData?.paymentStatus?.successful?.total)}</span>
                      </div>
                    </div>
                    <div className="svtx-status-item failed">
                      <XCircle size={24} color="#EF4444" />
                      <div>
                        <span className="svtx-si-count">{txnData?.paymentStatus?.failed?.count || 0}</span>
                        <span className="svtx-si-label">Failed</span>
                        <span className="svtx-si-amt">{fmt(txnData?.paymentStatus?.failed?.total)}</span>
                      </div>
                    </div>
                    <div className="svtx-status-item pending">
                      <Clock size={24} color="#F59E0B" />
                      <div>
                        <span className="svtx-si-count">{txnData?.paymentStatus?.pending?.count || 0}</span>
                        <span className="svtx-si-label">Pending</span>
                        <span className="svtx-si-amt">{fmt(txnData?.paymentStatus?.pending?.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="svtx-chart-card">
                    <div className="svtx-chart-header">
                      <h3>Revenue Trend</h3>
                      <div className="svtx-chart-tabs">
                        {['daily','weekly','monthly'].map(v => (
                          <button
                            key={v}
                            className={`svtx-tab ${txnChartView === v ? 'active' : ''}`}
                            onClick={() => setTxnChartView(v)}
                          >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <MiniBarChart data={txnChartData} height={100} />
                  </div>

                  {/* Payment Method Breakdown */}
                  <div className="svtx-method-card">
                    <h3><CreditCard size={15} /> Payment Method Breakdown</h3>
                    <div className="svtx-method-list">
                      {Object.entries(txnData?.paymentBreakdown || {}).map(([method, val]) => (
                        <div key={method} className="svtx-method-item">
                          <div className="svtx-method-left">
                            <span className="svtx-method-dot" style={{ background: paymentMethodColors[method] || '#9CA3AF' }} />
                            <span>{getPaymentMethodLabel(method)}</span>
                          </div>
                          <div className="svtx-method-right">
                            <span className="svtx-method-amount">{fmt(val.amount)}</span>
                            <span className="svtx-method-count">{val.count} txns</span>
                          </div>
                        </div>
                      ))}
                      {Object.keys(txnData?.paymentBreakdown || {}).length === 0 && (
                        <div className="svtx-no-data">No payment data yet</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default SupervisorDashboard;
