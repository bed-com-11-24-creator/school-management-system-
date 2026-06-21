import express from 'express';
import { query } from './db.js';
import axios from 'axios';

const router = express.Router();

// Middleware - assumes authenticateToken already applied
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Admin only' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE MANAGEMENT APIs
// ─────────────────────────────────────────────────────────────────────────────

// Get all students with their fee status (colored: red for pending, green for paid)
router.get('/api/fees/students', async (req, res) => {
  const { school_id } = req.user;
  const { term, search } = req.query;

  try {
    let sql = `
      SELECT 
        s.id, s.full_name, s.roll_number, s.class_name, s.parent_phone, s.status, s.sex, s.disability,
        COALESCE(sf.fee_amount, 0) as fee_amount,
        COALESCE(sf.amount_paid, 0) as amount_paid,
        COALESCE(sf.balance, 0) as balance,
        COALESCE(sf.status, 'no_fees') as fee_status,
        COALESCE(sf.term, ?) as current_term,
        GROUP_CONCAT(DISTINCT subj.subject_name ORDER BY subj.subject_name SEPARATOR ', ') as subjects
      FROM students s
      LEFT JOIN student_fees sf ON s.id = sf.student_id AND sf.term = ?
      LEFT JOIN classes c ON s.class_name = c.class_name AND s.school_id = c.school_id
      LEFT JOIN class_subjects cs ON c.id = cs.class_id
      LEFT JOIN subjects subj ON cs.subject_id = subj.id
      WHERE s.school_id = ? AND s.status = 'active'
    `;

    const params = [term || 'Term 1 2026', school_id];

    if (search) {
      sql += ` AND (LOWER(s.full_name) LIKE LOWER(?) OR LOWER(s.roll_number) LIKE LOWER(?))`;
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    sql += ` GROUP BY s.id, s.full_name, s.roll_number, s.class_name, s.parent_phone, s.status, s.sex, s.disability,
             sf.id, sf.fee_amount, sf.amount_paid, sf.balance, sf.status, sf.term
             ORDER BY s.full_name`;

    const studentsRes = await query(sql, params);

    res.json({
      students: studentsRes.rows.map(s => ({
        ...s,
        fee_color: s.balance > 0 ? 'red' : 'green', // Red = debt, Green = paid
        balance: parseFloat(s.balance) || 0
      }))
    });
  } catch (err) {
    console.error('Get fee students error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Set/Update student fee for a term
router.post('/api/fees/set', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { student_id, term, fee_amount } = req.body;

  if (!student_id || !term || !fee_amount) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing required fields' });
  }

  try {
    const studentRes = await query('SELECT id FROM students WHERE id = ? AND school_id = ?', [student_id, school_id]);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Student not found' });
    }

    await query(
      `INSERT INTO student_fees (student_id, school_id, term, fee_amount, balance, status)
       VALUES (?, ?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE fee_amount = ?, balance = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP`,
      [student_id, school_id, term, fee_amount, fee_amount, fee_amount, fee_amount]
    );

    const feeRes = await query(
      'SELECT * FROM student_fees WHERE student_id = ? AND term = ? AND school_id = ?',
      [student_id, term, school_id]
    );

    res.json({ message: 'Fee set successfully', fee: feeRes.rows[0] });
  } catch (err) {
    console.error('Set fee error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Record fee payment
router.post('/api/fees/payment', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { student_id, term, amount_paid } = req.body;

  if (!student_id || !term || !amount_paid) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing required fields' });
  }

  try {
    const feeRes = await query(
      'SELECT * FROM student_fees WHERE student_id = ? AND term = ? AND school_id = ?',
      [student_id, term, school_id]
    );

    if (feeRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Fee record not found' });
    }

    const fee = feeRes.rows[0];
    const newPaid = parseFloat(fee.amount_paid) + parseFloat(amount_paid);
    const newBalance = parseFloat(fee.fee_amount) - newPaid;
    const status = newBalance <= 0 ? 'paid' : 'partial';

    await query(
      `UPDATE student_fees 
       SET amount_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE student_id = ? AND term = ? AND school_id = ?`,
      [newPaid, newBalance, status, student_id, term, school_id]
    );

    const updatedFeeRes = await query(
      'SELECT * FROM student_fees WHERE student_id = ? AND term = ? AND school_id = ?',
      [student_id, term, school_id]
    );

    res.json({ message: 'Payment recorded', fee: updatedFeeRes.rows[0] });
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATIC FEE REMINDER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Configure fee reminder settings (time limit, message template, etc)
router.post('/api/fees/reminder-config', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { time_limit_days, message_template, channel, is_enabled } = req.body;

  if (!time_limit_days || !message_template) {
    return res.status(400).json({ error: 'bad_request', message: 'Time limit and message template required' });
  }

  try {
    await query(
      `INSERT INTO notifications_config 
       (school_id, template_type, message_template, time_limit_days, channel, is_enabled)
       VALUES (?, 'fees_reminder', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE message_template = ?, time_limit_days = ?, channel = ?, is_enabled = ?`,
      [school_id, message_template, time_limit_days, channel || 'sms', is_enabled !== false]
    );

    res.json({ message: 'Fee reminder configuration updated' });
  } catch (err) {
    console.error('Config reminder error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get reminder configuration
router.get('/api/fees/reminder-config', adminOnly, async (req, res) => {
  const { school_id } = req.user;

  try {
    const configRes = await query(
      `SELECT * FROM notifications_config 
       WHERE school_id = ? AND template_type = 'fees_reminder'`,
      [school_id]
    );

    res.json(configRes.rows[0] || null);
  } catch (err) {
    console.error('Get reminder config error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Helper function to send SMS via Airtel Money or TNM Mpamba API
async function sendSMS(phoneNumber, message, channel = 'sms') {
  try {
    // Example: TNM Mpamba SMS API integration
    // Replace with your actual API credentials and endpoint
    const apiUrl = process.env.SMS_API_URL || 'https://api.sms-provider.com/send';
    const apiKey = process.env.SMS_API_KEY;

    const response = await axios.post(apiUrl, {
      phone: phoneNumber,
      message: message,
      gateway: channel === 'whatsapp' ? 'whatsapp' : 'sms'
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    return { success: true, data: response.data };
  } catch (err) {
    console.error('SMS sending error:', err.message);
    return { success: false, error: err.message };
  }
}

// Automatically send fee reminders based on time limit
router.post('/api/fees/send-reminders', adminOnly, async (req, res) => {
  const { school_id } = req.user;

  try {
    // Get reminder configuration
    const configRes = await query(
      `SELECT * FROM notifications_config 
       WHERE school_id = ? AND template_type = 'fees_reminder' AND is_enabled = true`,
      [school_id]
    );

    if (configRes.rows.length === 0) {
      return res.status(400).json({ error: 'not_configured', message: 'Fee reminder not configured' });
    }

    const config = configRes.rows[0];
    const timeLimitDays = config.time_limit_days;

    // Find students with fee balances (and created_at older than time_limit_days)
    const studentsRes = await query(
      `SELECT s.id, s.full_name, s.parent_phone, sf.balance, sf.term
       FROM students s
       JOIN student_fees sf ON s.id = sf.student_id
       WHERE s.school_id = ? 
       AND sf.balance > 0 
       AND s.status = 'active'
       AND s.parent_phone IS NOT NULL
       AND sf.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [school_id, timeLimitDays]
    );

    let sentCount = 0;
    let failedCount = 0;

    // Send reminders for each student with outstanding fees
    for (const student of studentsRes.rows) {
      const message = config.message_template
        .replace('{STUDENT_NAME}', student.full_name)
        .replace('{BALANCE}', student.balance)
        .replace('{TERM}', student.term);

      const smsResult = await sendSMS(student.parent_phone, message, config.channel);

      if (smsResult.success) {
        // Log sent reminder
        await query(
          `INSERT INTO fee_reminders 
           (school_id, student_id, message_sent, phone_number, channel, status, reminder_type)
           VALUES (?, ?, ?, ?, ?, 'sent', 'automatic')`,
          [school_id, student.id, message, student.parent_phone, config.channel]
        );
        sentCount++;
      } else {
        await query(
          `INSERT INTO fee_reminders 
           (school_id, student_id, message_sent, phone_number, channel, status, reminder_type)
           VALUES (?, ?, ?, ?, ?, 'failed', 'automatic')`,
          [school_id, student.id, message, student.parent_phone, config.channel]
        );
        failedCount++;
      }
    }

    res.json({
      message: 'Fee reminders sent',
      sent: sentCount,
      failed: failedCount,
      total: studentsRes.rows.length
    });
  } catch (err) {
    console.error('Send reminders error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get sent reminder history
router.get('/api/fees/reminders-history', adminOnly, async (req, res) => {
  const { school_id } = req.user;

  try {
    const remindersRes = await query(
      `SELECT fr.*, s.full_name, s.roll_number 
       FROM fee_reminders fr
       JOIN students s ON fr.student_id = s.id
       WHERE fr.school_id = ?
       ORDER BY fr.sent_at DESC
       LIMIT 100`,
      [school_id]
    );

    res.json({ reminders: remindersRes.rows });
  } catch (err) {
    console.error('Get reminders history error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get alumni/graduated students list
router.get('/api/students/alumni', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { search } = req.query;

  try {
    let sql = `
      SELECT id, full_name, roll_number, class_name, graduation_date, parent_name, parent_phone
      FROM students
      WHERE school_id = ? AND status IN ('graduated', 'transferred', 'dropped')
    `;
    const params = [school_id];

    if (search) {
      sql += ` AND LOWER(full_name) LIKE LOWER(?)`;
      params.push(`%${search.toLowerCase()}%`);
    }

    sql += ` ORDER BY graduation_date DESC`;

    const alumniRes = await query(sql, params);
    res.json({ alumni: alumniRes.rows });
  } catch (err) {
    console.error('Get alumni error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

export default router;
