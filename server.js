const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'petrol-pump-secret';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'petrol_pump.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function getCurrentISTDate() {
  const now = new Date();
  const offset = 5.5 * 60;
  const ist = new Date(now.getTime() + offset * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getCurrentISTDateTime() {
  const now = new Date();
  const offset = 5.5 * 60;
  return new Date(now.getTime() + offset * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','employee')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nozzles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      nozzle_number INTEGER NOT NULL,
      fuel_type TEXT NOT NULL,
      product_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      current_meter_reading REAL DEFAULT 0,
      current_fuel_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(machine_id) REFERENCES machines(id)
    );

    CREATE TABLE IF NOT EXISTS fuel_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fuel_type TEXT NOT NULL,
      rate REAL NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shift_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      report_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      submitted_at TEXT,
      approved_by INTEGER,
      approved_at TEXT,
      owner_comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(employee_id) REFERENCES users(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      nozzle_id INTEGER NOT NULL,
      opening_reading REAL DEFAULT 0,
      closing_reading REAL DEFAULT 0,
      net_litres REAL DEFAULT 0,
      fuel_rate REAL DEFAULT 0,
      sale_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id),
      FOREIGN KEY(nozzle_id) REFERENCES nozzles(id)
    );

    CREATE TABLE IF NOT EXISTS miscellaneous_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      customer_name TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id)
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      is_credit INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id)
    );

    CREATE TABLE IF NOT EXISTS cash_reconciliation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      expected_cash REAL NOT NULL,
      actual_cash REAL NOT NULL,
      cash_difference REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shift_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      decision TEXT NOT NULL,
      reviewer_id INTEGER,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id),
      FOREIGN KEY(reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS credit_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      outstanding REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_record_id INTEGER NOT NULL,
      customer_id INTEGER,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shift_record_id) REFERENCES shift_records(id),
      FOREIGN KEY(customer_id) REFERENCES credit_customers(id)
    );
  `);
}

function seedDefaultData() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const empHash = bcrypt.hashSync('emp123', 10);

    db.prepare(`
      INSERT INTO users (name, username, password_hash, role) VALUES
      ('Owner Admin', 'admin', ?, 'owner'),
      ('Amit Sharma', 'emp1', ?, 'employee'),
      ('Rohit Verma', 'emp2', ?, 'employee')
    `).run(adminHash, empHash, empHash);
  }

  const shiftCount = db.prepare('SELECT COUNT(*) AS count FROM shifts').get().count;
  if (shiftCount === 0) {
    db.prepare(`
      INSERT INTO shifts (name, start_time, end_time, is_active) VALUES
      ('Morning Shift', '06:00', '14:00', 1),
      ('Evening Shift', '14:00', '22:00', 1)
    `).run();
  }

  const machineCount = db.prepare('SELECT COUNT(*) AS count FROM machines').get().count;
  if (machineCount === 0) {
    db.prepare(`
      INSERT INTO machines (name, status) VALUES
      ('Machine 1', 'active'),
      ('Machine 2', 'active')
    `).run();

    const machine1 = db.prepare('SELECT id FROM machines WHERE name = ?').get('Machine 1');
    const machine2 = db.prepare('SELECT id FROM machines WHERE name = ?').get('Machine 2');

    db.prepare(`
      INSERT INTO nozzles (machine_id, nozzle_number, fuel_type, product_name, is_active, current_meter_reading, current_fuel_rate) VALUES
      (?, 1, 'Petrol', 'Petrol', 1, 12000, 106.5),
      (?, 2, 'Petrol', 'Petrol', 1, 14000, 106.5),
      (?, 3, 'Diesel', 'Diesel', 1, 9000, 94.5),
      (?, 4, 'Diesel', 'Diesel', 1, 9600, 94.5)
    `).run(machine1.id, machine1.id, machine2.id, machine2.id);
  }

  const rateCount = db.prepare('SELECT COUNT(*) AS count FROM fuel_rates').get().count;
  if (rateCount === 0) {
    db.prepare(`
      INSERT INTO fuel_rates (fuel_type, rate, valid_from, valid_to) VALUES
      ('Petrol', 106.5, ?, NULL),
      ('Diesel', 94.5, ?, NULL)
    `).run(getCurrentISTDate(), getCurrentISTDate());
  }

  const shiftRecordCount = db.prepare('SELECT COUNT(*) AS count FROM shift_records').get().count;
  if (shiftRecordCount === 0) {
    const employee = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('employee');
    const morningShift = db.prepare('SELECT id FROM shifts WHERE name = ?').get('Morning Shift');
    const eveningShift = db.prepare('SELECT id FROM shifts WHERE name = ?').get('Evening Shift');

    const morningRecordId = db.prepare(`
      INSERT INTO shift_records (employee_id, shift_id, report_date, status, submitted_at, approved_by, approved_at, owner_comment)
      VALUES (?, ?, ?, 'approved', ?, 1, ?, 'Auto seeded sample data for testing.')
    `).run(employee.id, morningShift.id, getCurrentISTDate(), getCurrentISTDateTime(), getCurrentISTDateTime()).lastInsertRowid;

    const eveningRecordId = db.prepare(`
      INSERT INTO shift_records (employee_id, shift_id, report_date, status, submitted_at)
      VALUES (?, ?, ?, 'pending_approval', ?)
    `).run(employee.id, eveningShift.id, getCurrentISTDate(), getCurrentISTDateTime()).lastInsertRowid;

    const nozzles = db.prepare('SELECT * FROM nozzles ORDER BY id').all();
    let meterRows = [
      { nozzleId: nozzles[0].id, opening: 12000, closing: 12540, rate: 106.5 },
      { nozzleId: nozzles[1].id, opening: 14500, closing: 14920, rate: 106.5 },
      { nozzleId: nozzles[2].id, opening: 9000, closing: 9300, rate: 94.5 },
      { nozzleId: nozzles[3].id, opening: 9600, closing: 9850, rate: 94.5 }
    ];

    meterRows.forEach((item) => {
      const net = item.closing - item.opening;
      const sale = net * item.rate;
      db.prepare(`
        INSERT INTO meter_readings (shift_record_id, nozzle_id, opening_reading, closing_reading, net_litres, fuel_rate, sale_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(morningRecordId, item.nozzleId, item.opening, item.closing, net, item.rate, sale);
    });

    db.prepare(`
      INSERT INTO miscellaneous_transactions (shift_record_id, description, customer_name, category, amount, payment_mode, remarks)
      VALUES
      (?, 'Lubricant sale', 'Rajesh', 'Lubricant sales', 2400, 'Cash', 'Premium oil sale'),
      (?, 'Engine oil sale', 'Suresh', 'Engine oil sales', 1800, 'Paytm', 'High viscosity oil')
    `).run(morningRecordId, morningRecordId);

    db.prepare(`
      INSERT INTO payment_transactions (shift_record_id, description, amount, payment_mode, is_credit)
      VALUES
      (?, 'Cash sales', 54000, 'Cash', 0),
      (?, 'Paytm sales', 21000, 'Paytm', 0),
      (?, 'Card sales', 16000, 'Debit/Credit Card', 0),
      (?, 'Credit sale', 5500, 'Credit / Udhaar', 1)
    `).run(morningRecordId, morningRecordId, morningRecordId, morningRecordId);

    db.prepare(`
      INSERT INTO cash_reconciliation (shift_record_id, expected_cash, actual_cash, cash_difference, notes)
      VALUES (?, 54000, 53000, -1000, 'Shortage detected due to missing smaller notes')
    `).run(morningRecordId);

    const openingReading = 12540;
    const closingReading = 13060;
    const dieselOpening = 9300;
    const dieselClosing = 9650;

    db.prepare(`
      INSERT INTO meter_readings (shift_record_id, nozzle_id, opening_reading, closing_reading, net_litres, fuel_rate, sale_amount)
      VALUES
      (?, ?, ?, ?, ?, 106.5, ?),
      (?, ?, ?, ?, ?, 106.5, ?),
      (?, ?, ?, ?, ?, 94.5, ?),
      (?, ?, ?, ?, ?, 94.5, ?)
    `).run(
      eveningRecordId, nozzles[0].id, openingReading, closingReading, (closingReading - openingReading), ((closingReading - openingReading) * 106.5),
      eveningRecordId, nozzles[1].id, 14920, 15300, 380, 380 * 106.5,
      eveningRecordId, nozzles[2].id, dieselOpening, dieselClosing, (dieselClosing - dieselOpening), ((dieselClosing - dieselOpening) * 94.5),
      eveningRecordId, nozzles[3].id, 9850, 10100, 250, 250 * 94.5
    );
  }
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid session.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to access this resource.' });
    }
    next();
  };
}

function logAudit(entityType, entityId, userId, action, details) {
  db.prepare(`INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)`)
    .run(entityType, entityId, userId, action, details || '');
}

function getShiftSummary(shiftRecordId) {
  const shiftRecord = db.prepare('SELECT * FROM shift_records WHERE id = ?').get(shiftRecordId);
  if (!shiftRecord) {
    return null;
  }

  const meterReadings = db.prepare(`
    SELECT mr.*, n.nozzle_number, n.fuel_type, n.product_name
    FROM meter_readings mr
    JOIN nozzles n ON n.id = mr.nozzle_id
    WHERE mr.shift_record_id = ?
  `).all(shiftRecordId);

  const miscellaneous = db.prepare('SELECT * FROM miscellaneous_transactions WHERE shift_record_id = ?').all(shiftRecordId);
  const payments = db.prepare('SELECT * FROM payment_transactions WHERE shift_record_id = ?').all(shiftRecordId);

  let totalFuelSales = 0;
  let totalMiscellaneous = 0;
  let totalCash = 0;
  let totalDigital = 0;
  let totalCard = 0;
  let totalCheque = 0;
  let totalCredit = 0;
  let totalOther = 0;
  let totalAccounted = 0;

  meterReadings.forEach((item) => {
    totalFuelSales += Number(item.sale_amount || 0);
  });

  miscellaneous.forEach((item) => {
    totalMiscellaneous += Number(item.amount || 0);
  });

  payments.forEach((item) => {
    const amount = Number(item.amount || 0);
    if (item.is_credit === 1 || item.payment_mode === 'Credit / Udhaar') {
      totalCredit += amount;
    } else if (item.payment_mode === 'Cash') {
      totalCash += amount;
    } else if (['Paytm', 'PhonePe', 'Google Pay', 'Other UPI'].includes(item.payment_mode)) {
      totalDigital += amount;
    } else if (item.payment_mode === 'Debit/Credit Card') {
      totalCard += amount;
    } else if (item.payment_mode === 'Cheque') {
      totalCheque += amount;
    } else if (item.payment_mode === 'Bank Transfer' || item.payment_mode === 'Other') {
      totalOther += amount;
    }
  });

  const totalNet = totalFuelSales + totalMiscellaneous;
  totalAccounted = totalCash + totalDigital + totalCard + totalCheque + totalCredit + totalOther;
  const difference = totalNet - totalAccounted;

  const cashRecord = db.prepare('SELECT * FROM cash_reconciliation WHERE shift_record_id = ?').get(shiftRecordId);
  const expectedCash = cashRecord ? Number(cashRecord.expected_cash || 0) : totalCash;
  const actualCash = cashRecord ? Number(cashRecord.actual_cash || 0) : 0;
  const cashDifference = expectedCash - actualCash;

  return {
    shiftRecord,
    meterReadings,
    miscellaneous,
    payments,
    totalFuelSales,
    totalMiscellaneous,
    totalNet,
    totalCash,
    totalDigital,
    totalCard,
    totalCheque,
    totalCredit,
    totalOther,
    totalAccounted,
    difference,
    expectedCash,
    actualCash,
    cashDifference,
  };
}

function getDailySummary(date = getCurrentISTDate()) {
  const records = db.prepare(`
    SELECT sr.*, u.name AS employee_name, s.name AS shift_name
    FROM shift_records sr
    JOIN users u ON u.id = sr.employee_id
    JOIN shifts s ON s.id = sr.shift_id
    WHERE sr.report_date = ?
    ORDER BY sr.shift_id ASC
  `).all(date);

  const summaries = records.map((record) => ({
    ...record,
    summary: getShiftSummary(record.id),
  }));

  const totals = summaries.reduce((acc, item) => {
    const summary = item.summary || { totalFuelSales: 0, totalMiscellaneous: 0, totalNet: 0, totalCash: 0, totalDigital: 0, totalCard: 0, totalCheque: 0, totalCredit: 0, totalAccounted: 0, difference: 0, expectedCash: 0, actualCash: 0, cashDifference: 0 };
    acc.totalFuelSales += summary.totalFuelSales;
    acc.totalMiscellaneous += summary.totalMiscellaneous;
    acc.totalNet += summary.totalNet;
    acc.totalCash += summary.totalCash;
    acc.totalDigital += summary.totalDigital;
    acc.totalCard += summary.totalCard;
    acc.totalCheque += summary.totalCheque;
    acc.totalCredit += summary.totalCredit;
    acc.totalAccounted += summary.totalAccounted;
    acc.totalDifference += summary.difference;
    acc.totalExpectedCash += summary.expectedCash;
    acc.totalActualCash += summary.actualCash;
    acc.totalCashDifference += summary.cashDifference;
    return acc;
  }, {
    totalFuelSales: 0,
    totalMiscellaneous: 0,
    totalNet: 0,
    totalCash: 0,
    totalDigital: 0,
    totalCard: 0,
    totalCheque: 0,
    totalCredit: 0,
    totalAccounted: 0,
    totalDifference: 0,
    totalExpectedCash: 0,
    totalActualCash: 0,
    totalCashDifference: 0,
  });

  return { date, records: summaries, totals };
}

function generateAIAlerts() {
  const records = db.prepare(`
    SELECT sr.*, u.name AS employee_name, s.name AS shift_name
    FROM shift_records sr
    JOIN users u ON u.id = sr.employee_id
    JOIN shifts s ON s.id = sr.shift_id
    ORDER BY sr.report_date DESC, sr.id DESC
  `).all();

  const alerts = [];
  records.forEach((record) => {
    const summary = getShiftSummary(record.id);
    if (!summary) return;

    summary.meterReadings.forEach((read) => {
      if (read.net_litres < 0) {
        alerts.push({
          type: 'meter_discrepancy',
          severity: 'high',
          title: 'Negative meter difference',
          message: `Machine ${read.nozzle_number}, ${read.fuel_type} Nozzle ${read.nozzle_number}: Reading mismatch detected. Please verify before approval.`,
          shiftName: record.shift_name,
        });
      }
      if (read.closing_reading < read.opening_reading) {
        alerts.push({
          type: 'reading_reset',
          severity: 'high',
          title: 'Possible meter reset',
          message: `Machine ${read.nozzle_number}, ${read.fuel_type}: Closing reading is less than opening reading. Please verify before approving.`,
          shiftName: record.shift_name,
        });
      }
    });

    if (summary.totalNet !== summary.totalAccounted && Math.abs(summary.totalNet - summary.totalAccounted) > 0.01) {
      alerts.push({
        type: 'reconciliation',
        severity: 'warning',
        title: 'Shift reconciliation mismatch',
        message: `Shift ${record.shift_name}: Total net ₹${summary.totalNet.toFixed(2)} vs accounted ₹${summary.totalAccounted.toFixed(2)} difference is ₹${(summary.totalNet - summary.totalAccounted).toFixed(2)}.`,
        shiftName: record.shift_name,
      });
    }

    if (summary.cashDifference !== 0) {
      alerts.push({
        type: 'cash_verification',
        severity: summary.cashDifference > 0 ? 'warning' : 'high',
        title: 'Cash mismatch alert',
        message: `Cash shortfall/excess detected: Expected ₹${summary.expectedCash.toFixed(2)}, Actual ₹${summary.actualCash.toFixed(2)}. Difference ₹${summary.cashDifference.toFixed(2)}.`,
        shiftName: record.shift_name,
      });
    }
  });

  return alerts.slice(0, 20);
}

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'Petrol pump API is healthy.' }));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, username: req.user.username, role: req.user.role } });
});

app.get('/api/dashboard', authenticate, (req, res) => {
  const { date = getCurrentISTDate() } = req.query;
  const summary = getDailySummary(date);
  res.json(summary);
});

app.get('/api/machines', authenticate, (req, res) => {
  const machines = db.prepare(`
    SELECT m.*, COUNT(n.id) AS nozzle_count
    FROM machines m
    LEFT JOIN nozzles n ON n.machine_id = m.id
    GROUP BY m.id
    ORDER BY m.id ASC
  `).all();

  const fullMachines = machines.map((machine) => ({
    ...machine,
    nozzles: db.prepare(`
      SELECT * FROM nozzles WHERE machine_id = ? ORDER BY nozzle_number ASC
    `).all(machine.id),
  }));

  res.json(fullMachines);
});

app.post('/api/machines', authenticate, requireRole('owner'), (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Machine name is required.' });
  }

  const insert = db.prepare('INSERT INTO machines (name, status) VALUES (?, ?)').run(name, 'active');
  logAudit('machines', insert.lastInsertRowid, req.user.id, 'create', `Created machine ${name}`);
  res.status(201).json({ id: insert.lastInsertRowid, name, status: 'active' });
});

app.post('/api/nozzles', authenticate, requireRole('owner'), (req, res) => {
  const { machine_id, nozzle_number, fuel_type, product_name, is_active = 1, current_meter_reading = 0, current_fuel_rate = 0 } = req.body;
  if (!machine_id || !nozzle_number || !fuel_type || !product_name) {
    return res.status(400).json({ message: 'Machine, nozzle number, fuel type and product name are required.' });
  }

  const insert = db.prepare(`
    INSERT INTO nozzles (machine_id, nozzle_number, fuel_type, product_name, is_active, current_meter_reading, current_fuel_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(machine_id, nozzle_number, fuel_type, product_name, is_active ? 1 : 0, current_meter_reading, current_fuel_rate);

  logAudit('nozzles', insert.lastInsertRowid, req.user.id, 'create', `Created nozzle ${nozzle_number} for machine ${machine_id}`);
  res.status(201).json({ id: insert.lastInsertRowid, ...req.body });
});

app.get('/api/shifts', authenticate, (req, res) => {
  const shifts = db.prepare('SELECT * FROM shifts ORDER BY id ASC').all();
  res.json(shifts);
});

app.get('/api/shift-records', authenticate, (req, res) => {
  const { date } = req.query;
  let query = `
    SELECT sr.*, u.name AS employee_name, s.name AS shift_name
    FROM shift_records sr
    JOIN users u ON u.id = sr.employee_id
    JOIN shifts s ON s.id = sr.shift_id
  `;
  const params = [];
  if (date) {
    query += ' WHERE sr.report_date = ?';
    params.push(date);
  }
  query += ' ORDER BY sr.report_date DESC, sr.id DESC';

  const records = db.prepare(query).all(...params);
  const result = records.map((record) => ({ ...record, summary: getShiftSummary(record.id) }));
  res.json(result);
});

app.post('/api/shift-records', authenticate, (req, res) => {
  const { employee_id, shift_id, report_date } = req.body;
  if (!employee_id || !shift_id || !report_date) {
    return res.status(400).json({ message: 'Employee, shift and date are required.' });
  }

  const insert = db.prepare(`
    INSERT INTO shift_records (employee_id, shift_id, report_date, status)
    VALUES (?, ?, ?, 'draft')
  `).run(employee_id, shift_id, report_date);

  logAudit('shift_records', insert.lastInsertRowid, req.user.id, 'create', `Created shift record for employee ${employee_id}`);
  res.status(201).json({ id: insert.lastInsertRowid, employee_id, shift_id, report_date, status: 'draft' });
});

app.get('/api/shift-records/:id', authenticate, (req, res) => {
  const record = db.prepare(`
    SELECT sr.*, u.name AS employee_name, s.name AS shift_name
    FROM shift_records sr
    JOIN users u ON u.id = sr.employee_id
    JOIN shifts s ON s.id = sr.shift_id
    WHERE sr.id = ?
  `).get(req.params.id);

  if (!record) {
    return res.status(404).json({ message: 'Shift record not found.' });
  }

  const meters = db.prepare(`
    SELECT mr.*, n.nozzle_number, n.product_name, n.fuel_type
    FROM meter_readings mr
    JOIN nozzles n ON n.id = mr.nozzle_id
    WHERE mr.shift_record_id = ?
    ORDER BY n.nozzle_number ASC
  `).all(req.params.id);

  const misc = db.prepare('SELECT * FROM miscellaneous_transactions WHERE shift_record_id = ? ORDER BY id ASC').all(req.params.id);
  const payments = db.prepare('SELECT * FROM payment_transactions WHERE shift_record_id = ? ORDER BY id ASC').all(req.params.id);
  const summary = getShiftSummary(req.params.id);

  res.json({ ...record, meters, misc, payments, summary });
});

app.post('/api/shift-records/:id/meter-reading', authenticate, (req, res) => {
  const { nozzle_id, opening_reading, closing_reading, notes } = req.body;
  if (!nozzle_id || opening_reading === undefined || closing_reading === undefined) {
    return res.status(400).json({ message: 'Nozzle, opening reading and closing reading are required.' });
  }

  const nozzle = db.prepare('SELECT * FROM nozzles WHERE id = ?').get(nozzle_id);
  if (!nozzle) {
    return res.status(404).json({ message: 'Nozzle not found.' });
  }

  const netLitres = Number(closing_reading) - Number(opening_reading);
  const fuelRate = Number(nozzle.current_fuel_rate || 0);
  const saleAmount = Number(netLitres * fuelRate).toFixed(2);

  const insert = db.prepare(`
    INSERT INTO meter_readings (shift_record_id, nozzle_id, opening_reading, closing_reading, net_litres, fuel_rate, sale_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, nozzle_id, opening_reading, closing_reading, netLitres, fuelRate, saleAmount, notes || '');

  logAudit('meter_readings', insert.lastInsertRowid, req.user.id, 'create', `Added reading for nozzle ${nozzle_id}`);
  res.status(201).json({ id: insert.lastInsertRowid, net_litres: netLitres, sale_amount: Number(saleAmount) });
});

app.post('/api/shift-records/:id/miscellaneous', authenticate, (req, res) => {
  const { description, customer_name, category, amount, payment_mode, remarks } = req.body;
  if (!description || !category || !amount || !payment_mode) {
    return res.status(400).json({ message: 'Description, category, amount and payment mode are required.' });
  }

  const insert = db.prepare(`
    INSERT INTO miscellaneous_transactions (shift_record_id, description, customer_name, category, amount, payment_mode, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, description, customer_name || '', category, amount, payment_mode, remarks || '');

  logAudit('miscellaneous_transactions', insert.lastInsertRowid, req.user.id, 'create', `Added miscellaneous entry ${description}`);
  res.status(201).json({ id: insert.lastInsertRowid, description, amount, payment_mode });
});

app.post('/api/shift-records/:id/payment', authenticate, (req, res) => {
  const { description, amount, payment_mode, is_credit = 0 } = req.body;
  if (!amount || !payment_mode) {
    return res.status(400).json({ message: 'Amount and payment mode are required.' });
  }

  const insert = db.prepare(`
    INSERT INTO payment_transactions (shift_record_id, description, amount, payment_mode, is_credit)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, description || 'Payment entry', amount, payment_mode, is_credit ? 1 : 0);

  logAudit('payment_transactions', insert.lastInsertRowid, req.user.id, 'create', `Added ${payment_mode} payment amount ${amount}`);
  res.status(201).json({ id: insert.lastInsertRowid, amount, payment_mode, is_credit: is_credit ? 1 : 0 });
});

app.post('/api/shift-records/:id/submit', authenticate, (req, res) => {
  const record = db.prepare('SELECT * FROM shift_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ message: 'Shift record not found.' });

  db.prepare('UPDATE shift_records SET status = ?, submitted_at = ? WHERE id = ?').run('pending_approval', getCurrentISTDateTime(), req.params.id);
  logAudit('shift_records', req.params.id, req.user.id, 'submit', 'Shift submitted for approval');
  res.json({ message: 'Shift submitted successfully. Waiting for owner approval.' });
});

app.post('/api/shift-records/:id/approve', authenticate, requireRole('owner'), (req, res) => {
  const { reason = 'Approved by owner' } = req.body;
  db.prepare(`
    UPDATE shift_records SET status = 'approved', approved_by = ?, approved_at = ?, owner_comment = ? WHERE id = ?
  `).run(req.user.id, getCurrentISTDateTime(), reason, req.params.id);

  db.prepare(`
    INSERT INTO shift_approvals (shift_record_id, decision, reviewer_id, reason)
    VALUES (?, 'approved', ?, ?)
  `).run(req.params.id, req.user.id, reason);

  logAudit('shift_records', req.params.id, req.user.id, 'approve', reason);
  res.json({ message: 'Shift approved successfully.' });
});

app.post('/api/shift-records/:id/reject', authenticate, requireRole('owner'), (req, res) => {
  const { reason = 'Rejected by owner' } = req.body;
  db.prepare(`
    UPDATE shift_records SET status = 'rejected', approved_by = ?, approved_at = ?, owner_comment = ? WHERE id = ?
  `).run(req.user.id, getCurrentISTDateTime(), reason, req.params.id);

  db.prepare(`
    INSERT INTO shift_approvals (shift_record_id, decision, reviewer_id, reason)
    VALUES (?, 'rejected', ?, ?)
  `).run(req.params.id, req.user.id, reason);

  logAudit('shift_records', req.params.id, req.user.id, 'reject', reason);
  res.json({ message: 'Shift rejected and sent back for review.' });
});

app.get('/api/ai-alerts', authenticate, (req, res) => {
  res.json(generateAIAlerts());
});

app.get('/api/reports/daily', authenticate, (req, res) => {
  const { date = getCurrentISTDate() } = req.query;
  res.json(getDailySummary(date));
});

app.get('/api/settings/fuel-rates', authenticate, (req, res) => {
  const fuelRates = db.prepare('SELECT * FROM fuel_rates ORDER BY valid_from DESC').all();
  res.json(fuelRates);
});

app.post('/api/settings/fuel-rates', authenticate, requireRole('owner'), (req, res) => {
  const { fuel_type, rate } = req.body;
  if (!fuel_type || !rate) {
    return res.status(400).json({ message: 'Fuel type and rate are required.' });
  }

  const insert = db.prepare('INSERT INTO fuel_rates (fuel_type, rate, valid_from) VALUES (?, ?, ?)').run(fuel_type, rate, getCurrentISTDate());
  logAudit('fuel_rates', insert.lastInsertRowid, req.user.id, 'update', `Updated ${fuel_type} rate to ₹${rate}`);
  res.status(201).json({ id: insert.lastInsertRowid, fuel_type, rate, valid_from: getCurrentISTDate() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureSchema();
seedDefaultData();

app.listen(PORT, () => {
  console.log(`Petrol Pump Management System running on http://localhost:${PORT}`);
});

module.exports = app;
