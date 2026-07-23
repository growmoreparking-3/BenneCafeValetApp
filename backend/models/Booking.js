const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    default: function() {
      return `VLT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    phone: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: false  // Optional for now, can make required later
    }
  },
  vehicle: {
    type: {
      type: String,
      required: true,
      enum: ['car', 'bike', 'suv']
    },
    number: {
      type: String,
      required: true,
      uppercase: true
    },
    model: String,
    color: String,
    images: [{
      type: String  // Store image URLs/paths
    }],
    hasValuables: {
      type: Boolean,
      default: false
    },
    valuables: [{
      type: String
    }],
    driverName: {
      type: String,
      required: false
    }
  },
  parking: {
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    actualEndTime: Date
  },
  status: {
    type: String,
    enum: ['parked', 'recall-requested', 'in-transit', 'arrived', 'completed', 'cancelled'],
    default: 'parked'
  },
  recall: {
    requestedAt: Date,
    estimatedArrival: Number, // in minutes
    arrivedAt: Date
  },
  verification: {
    otp: String,
    otpExpiry: Date,
    verified: {
      type: Boolean,
      default: false
    }
  },
  accessToken: {
    type: String,
    unique: true,
    default: function() {
      return require('crypto').randomBytes(32).toString('hex');
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['cash', 'qr', 'upi', 'card', 'staff', 'foc', 'pending', 'razorpay'],
      default: 'pending'
    },
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    paidAt: Date,
    razorpay: {
      orderId: { type: String, index: true, sparse: true },
      paymentId: { type: String, index: true, sparse: true },
      signature: String
    }
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  location: {
    parkingSpot: String,
    venue: String
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
