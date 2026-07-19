const mongoose = require('mongoose');
const User = require('./models/User');
const Venue = require('./models/Venue');

const MONGODB_URI = 'mongodb://accountant_db_user:12345@ac-kuqjczw-shard-00-00.6ea1lfr.mongodb.net:27017,ac-kuqjczw-shard-00-01.6ea1lfr.mongodb.net:27017,ac-kuqjczw-shard-00-02.6ea1lfr.mongodb.net:27017/?ssl=true&replicaSet=atlas-jh9ue4-shard-0&authSource=admin&appName=Cluster0';

const seedBenneCafe = async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB —', mongoose.connection.name);
    console.log('');

    // ─────────────────────────────────────────────
    // 1. ADMIN
    // ─────────────────────────────────────────────
    let adminUser = await User.findOne({ phone: '7777777777' });
    if (!adminUser) {
      adminUser = await new User({
        name: 'Admin',
        phone: '7777777777',
        password: 'admin123',
        role: 'admin'
      }).save();
      console.log('✓ Created Admin (7777777777 / admin123)');
    } else {
      console.log('- Admin already exists (7777777777)');
    }

    // ─────────────────────────────────────────────
    // 2. SUPERVISOR
    // supervisor requires a manager ref — use a dummy manager or find existing one
    // ─────────────────────────────────────────────

    // Find or create a manager (required by supervisor schema)
    let managerId;
    let managerUser = await User.findOne({ role: 'manager' });
    if (!managerUser) {
      managerUser = await new User({
        name: 'Benne Cafe Manager',
        phone: '7700000099',
        password: 'Manager123',
        role: 'manager'
      }).save();
      console.log('✓ Created Benne Cafe Manager (7700000099 / Manager123)');
    } else {
      console.log(`- Using existing Manager: ${managerUser.name} (${managerUser.phone})`);
    }
    managerId = managerUser._id;

    // Create supervisor
    let supervisorUser = await User.findOne({ phone: '8888888881' });
    if (!supervisorUser) {
      supervisorUser = await new User({
        name: 'Benne Cafe Supervisor',
        phone: '8888888881',
        password: 'Super123',
        role: 'supervisor',
        manager: managerId
      }).save();
      console.log('✓ Created Supervisor: Benne Cafe Supervisor (8888888881 / Super123)');
    } else {
      console.log('- Supervisor already exists (8888888881)');
    }
    const supervisorId = supervisorUser._id;

    // ─────────────────────────────────────────────
    // 3. DRIVER → assigned to supervisor
    // ─────────────────────────────────────────────
    let driverUser = await User.findOne({ phone: '9999999991' });
    if (!driverUser) {
      driverUser = await new User({
        name: 'Benne Cafe Driver',
        phone: '9999999991',
        password: 'Driver123',
        role: 'driver',
        supervisor: supervisorId
      }).save();
      console.log('✓ Created Driver: Benne Cafe Driver (9999999991 / Driver123) → assigned to Supervisor');
    } else {
      console.log('- Driver already exists (9999999991)');
    }

    // ─────────────────────────────────────────────
    // 4. VENUE — Benne Cafe
    // ─────────────────────────────────────────────
    let venue = await Venue.findOne({ name: 'Benne Cafe' });
    if (!venue) {
      venue = await new Venue({
        name: 'Benne Cafe',
        requiresUpfrontPayment: false,
        supervisor: supervisorId,
        parkingFee: 150,
        isActive: true,
        parkingSpots: ['Benne Cafe']
      }).save();
      console.log('✓ Created Venue: Benne Cafe (assigned to Supervisor 8888888881)');
    } else {
      console.log('- Venue already exists: Benne Cafe');
    }

    // ─────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────
    console.log('\n✅ Seed completed successfully!\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                 BENNE CAFE — LOGIN CREDENTIALS              │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  ADMIN                                                      │');
    console.log('│    Phone:    7777777777                                     │');
    console.log('│    Password: admin123                                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  SUPERVISOR                                                 │');
    console.log('│    Phone:    8888888881                                     │');
    console.log('│    Password: Super123                                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  DRIVER                                                     │');
    console.log('│    Phone:    9999999991                                     │');
    console.log('│    Password: Driver123                                      │');
    console.log('│    QR Link:  /book/9999999991                               │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  VENUE                                                      │');
    console.log('│    Name: Benne Cafe                                         │');
    console.log('│    Parking Fee: ₹150                                        │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed error:', error.message);
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.error('🔐 MongoDB Authentication Failed — check the connection string');
    } else if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('🌐 IP not whitelisted — add your IP in MongoDB Atlas → Network Access');
    } else if (error.code === 11000) {
      console.error('⚠️  Duplicate key — some records may already exist. Check logs above.');
    }
    process.exit(1);
  }
};

seedBenneCafe();
