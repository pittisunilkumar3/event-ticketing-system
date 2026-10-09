const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const app = express();
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ---- Middleware ----
app.use(cors()); // allow frontend (Vite :5173) to call the API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded banners: http://localhost:5001/uploads/<file>
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- Routes ----
app.get('/', (req, res) => {
  res.json({ success: true, message: '🎟️ Ticketing API is running', version: '1.0.0' });
});

// Public (customer site — no auth)
app.use('/api', require('./routes/publicRoutes'));

// Auth
app.use('/api/auth', require('./routes/authRoutes'));

// Admin (JWT protected)
app.use('/api/admin/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/admin/events', require('./routes/eventRoutes'));
app.use('/api/admin/ticket-types', require('./routes/ticketTypeRoutes'));
app.use('/api/admin/orders', require('./routes/orderRoutes'));
app.use('/api/admin/tickets', require('./routes/ticketRoutes'));

// ---- Errors ----
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
