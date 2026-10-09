/**
 * Seed sample data.
 * Usage: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Order = require('../models/Order');

function daysFromNow(days, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
}

async function seed() {
  try {
    console.log('🌱 Seeding database...\n');

    // ---- Admin ----
    const existingAdmin = await Admin.findByEmail('admin@ticketing.com');
    if (!existingAdmin) {
      const hash = await bcrypt.hash('admin123', 10);
      await Admin.create({ name: 'Super Admin', email: 'admin@ticketing.com', passwordHash: hash, role: 'super_admin' });
      console.log('👤 Admin created: admin@ticketing.com / admin123');
    } else {
      console.log('👤 Admin already exists (admin@ticketing.com)');
    }

    // ---- Events ----
    const [existingEvents] = await db.query('SELECT COUNT(*) AS c FROM events');
    if (existingEvents[0].c > 0) {
      console.log('🎤 Events already seeded — skipping.');
      process.exit(0);
    }

    const eventsData = [
      {
        title: 'Neon Nights Music Festival',
        description: 'The biggest outdoor music festival of the year featuring top artists across three stages. Food trucks, light shows and an unforgettable night.',
        category: 'Music', venue: 'Central Park Grounds', city: 'New York', status: 'published',
        start_datetime: daysFromNow(30, 18), end_datetime: daysFromNow(30, 23),
      },
      {
        title: 'Tech Summit 2025',
        description: 'Annual conference for developers, founders and tech leaders. 40+ speakers, workshops and networking.',
        category: 'Conference', venue: 'Grand Convention Center', city: 'San Francisco', status: 'published',
        start_datetime: daysFromNow(45, 9), end_datetime: daysFromNow(46, 17),
      },
      {
        title: 'City Marathon 5K Fun Run',
        description: 'Join thousands of runners for the annual charity fun run. Medals, t-shirts and post-run breakfast included.',
        category: 'Sports', venue: 'Riverside Boulevard', city: 'Chicago', status: 'published',
        start_datetime: daysFromNow(15, 6), end_datetime: daysFromNow(15, 11),
      },
      {
        title: 'Stand-up Comedy Special',
        description: 'An evening of laughter with touring comedians. 18+ only.',
        category: 'Comedy', venue: 'Laugh Factory', city: 'New York', status: 'published',
        start_datetime: daysFromNow(7, 20), end_datetime: daysFromNow(7, 22),
      },
      {
        title: 'Food & Wine Expo (Draft)',
        description: 'Taste wines and dishes from 50+ local restaurants and vineyards.',
        category: 'Food', venue: 'Expo Hall', city: 'Austin', status: 'draft',
        start_datetime: daysFromNow(60, 12), end_datetime: daysFromNow(61, 20),
      },
    ];

    const createdEvents = [];
    for (const e of eventsData) {
      const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const ev = await Event.create({ ...e, slug });
      createdEvents.push(ev);
      console.log(`🎤 Event: ${e.title} [${e.status}]`);
    }

    // ---- Ticket types ----
    const ttData = [
      // [eventIndex, name, description, price, quantity]
      [0, 'General Admission', 'Standing area access', 49.99, 500],
      [0, 'VIP', 'Front stage + lounge access + free drink', 149.99, 100],
      [0, 'Early Bird', 'Limited discounted tickets', 29.99, 50],
      [1, 'Standard Pass', 'All talks both days', 199.00, 300],
      [1, 'Pro Pass', 'Talks + workshops + swag bag', 399.00, 100],
      [2, 'Runner Entry', 'Official race entry + t-shirt', 25.00, 1000],
      [3, 'Regular Seat', 'General seating', 35.00, 200],
      [3, 'Front Row', 'Best seats in the house', 75.00, 30],
    ];

    const ttIds = {};
    for (const [evIdx, name, description, price, quantity] of ttData) {
      const [result] = await db.query(
        'INSERT INTO ticket_types (event_id, name, description, price, quantity, sales_start, sales_end) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [createdEvents[evIdx].id, name, description, price, quantity, daysFromNow(-5, 0), daysFromNow(evIdx === 0 ? 20 : 40, 23)]
      );
      ttIds[`${evIdx}-${name}`] = { id: result.insertId, price };
      console.log(`🎟️  Ticket type: ${name} ($${price}) → ${createdEvents[evIdx].title}`);
    }

    // ---- Sample orders (paid, with tickets) ----
    const samples = [
      { evIdx: 0, name: 'John Doe', email: 'john@example.com', phone: '555-0101', items: [{ key: '0-General Admission', qty: 2 }, { key: '0-VIP', qty: 1 }] },
      { evIdx: 0, name: 'Sarah Smith', email: 'sarah@example.com', phone: '555-0102', items: [{ key: '0-Early Bird', qty: 2 }] },
      { evIdx: 1, name: 'Raj Patel', email: 'raj@example.com', phone: '555-0103', items: [{ key: '1-Pro Pass', qty: 1 }] },
      { evIdx: 2, name: 'Emma Wilson', email: 'emma@example.com', phone: '555-0104', items: [{ key: '2-Runner Entry', qty: 4 }] },
      { evIdx: 3, name: 'Mike Brown', email: 'mike@example.com', phone: '555-0105', items: [{ key: '3-Front Row', qty: 2 }] },
    ];

    for (const s of samples) {
      await Order.createWithTickets({
        event_id: createdEvents[s.evIdx].id,
        customer_name: s.name,
        email: s.email,
        phone: s.phone,
        items: s.items.map((i) => ({ ticket_type_id: ttIds[i.key].id, qty: i.qty })),
      });
      console.log(`📦 Order: ${s.name} × ${s.items.map((i) => `${i.qty}× ${i.key.split('-')[1]}`).join(', ')}`);
    }

    console.log('\n🎉 Seed complete!');
    console.log('   Admin login → admin@ticketing.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
