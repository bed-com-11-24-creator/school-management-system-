import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { query } from './db.js';
import { generateTimetable } from './timetable-solver.js';
import feesAPI from './fees-api.js';
import subjectsAPI from './subjects-api.js';
import attendanceAPI from './attendance-api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'malawi_school_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'forbidden', message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Lockout Gate Middleware
// Intercepts requests for teachers and headteachers if the school is locked due to unpaid fees.
// Master Administrators are NOT locked out, so they can access the monetization/billing panel and pay.
async function checkLockoutGate(req, res, next) {
  try {
    const { school_id, role } = req.user;

    // Fetch lock status of the school
    const schoolRes = await query('SELECT is_locked, balance_due FROM schools WHERE id = ?', [school_id]);
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ error: 'school_not_found', message: 'School not found' });
    }

    const school = schoolRes.rows[0];

    // Lock gate applies if is_locked is true AND user is NOT an admin
    if (school.is_locked && role !== 'admin') {
      return res.status(402).json({
        error: 'school_locked',
        message: 'School account locked due to outstanding licensing fees.',
        balance_due: school.balance_due
      });
    }

    next();
  } catch (err) {
    console.error('Lockout gate middleware error:', err);
    res.status(500).json({ error: 'server_error', message: 'Internal server error checking lock state' });
  }
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// Single Entrance Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'bad_request', message: 'Email and password required' });
  }

  try {
    const userRes = await query(
      `SELECT u.*, s.name as school_name, s.is_locked, s.balance_due, s.logo, s.letterhead, s.academic_headers
       FROM users u
       JOIN schools s ON u.school_id = s.id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'auth_failed', message: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'auth_failed', message: 'Invalid email or password' });
    }

    // Create JWT Token
    const token = jwt.sign(
      { id: user.id, school_id: user.school_id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        school_id: user.school_id,
        school_name: user.school_name,
        school_locked: user.is_locked,
        balance_due: user.balance_due
      },
      branding: {
        name: user.school_name,
        logo: user.logo,
        letterhead: user.letterhead,
        academic_headers: user.academic_headers
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'serverError', message: 'Login failed' });
  }
});

// Admin-only: Create teacher accounts
app.post('/api/auth/register-teacher', authenticateToken, async (req, res) => {
  const { role: adminRole, school_id } = req.user;
  if (adminRole !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Administrators can register teachers' });
  }

  const { email, password, full_name, role, sex } = req.body;
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'bad_request', message: 'All fields are required' });
  }

  if (role !== 'teacher' && role !== 'headteacher') {
    return res.status(400).json({ error: 'bad_request', message: 'Can only register teachers or headteachers' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = randomUUID();
    const normalizedEmail = email.toLowerCase().trim();

    await query(
      `INSERT INTO users (id, school_id, email, password_hash, role, full_name, sex)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, school_id, normalizedEmail, passwordHash, role, full_name, sex || 'M']
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        school_id,
        email: normalizedEmail,
        role,
        full_name,
        sex: sex || 'M'
      }
    });
  } catch (err) {
    console.error('Register user error:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({
        error: 'conflict',
        message: err.message.includes('unique_headteacher_per_school')
          ? 'Rigid Constraint: A Headteacher account already exists for this school!'
          : 'Email already in use'
      });
    }
    res.status(500).json({ error: 'server_error', message: 'Failed to register user' });
  }
});

// -------------------------------------------------------------
// BRANDING CONFIGURATION ENGINE
// -------------------------------------------------------------
app.get('/api/school/branding', authenticateToken, async (req, res) => {
  const { school_id } = req.user;
  try {
    const schoolRes = await query(
      'SELECT name, logo, letterhead, academic_headers FROM schools WHERE id = ?',
      [school_id]
    );
    if (schoolRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'School not found' });
    }
    res.json(schoolRes.rows[0]);
  } catch (err) {
    console.error('Get branding error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load branding' });
  }
});

// Admin-only updates branding
app.post('/api/school/branding', authenticateToken, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Master Admin can modify branding' });
  }

  const { name, logo, letterhead, academic_headers } = req.body;

  try {
    await query(
      `UPDATE schools 
       SET name = COALESCE(?, name), 
           logo = COALESCE(?, logo), 
           letterhead = COALESCE(?, letterhead), 
           academic_headers = COALESCE(?, academic_headers),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, logo, letterhead, academic_headers ? JSON.stringify(academic_headers) : null, school_id]
    );
    res.json({ message: 'Branding updated successfully' });
  } catch (err) {
    console.error('Update branding error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to update branding' });
  }
});

// -------------------------------------------------------------
// BILLING & MONETIZATION PANEL (Admin / Lock Gate exempt)
// -------------------------------------------------------------
app.get('/api/billing/status', authenticateToken, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
  }

  try {
    const schoolRes = await query(
      'SELECT student_count, balance_due, payment_status, is_locked FROM schools WHERE id = ?',
      [school_id]
    );
    const transactionsRes = await query(
      'SELECT * FROM transactions WHERE school_id = ? ORDER BY created_at DESC LIMIT 10',
      [school_id]
    );
    res.json({
      school: schoolRes.rows[0],
      transactions: transactionsRes.rows
    });
  } catch (err) {
    console.error('Get billing status error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load billing status' });
  }
});

// Admin-only mobile money payment simulation
app.post('/api/billing/pay', authenticateToken, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
  }

  const { gateway, phone_number, amount } = req.body;
  if (!gateway || !phone_number || !amount) {
    return res.status(400).json({ error: 'bad_request', message: 'Gateway, phone number, and amount are required' });
  }

  try {
    const ref = 'TX-' + gateway.toUpperCase().substring(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000);

    // Begin database transaction
    await query('BEGIN');

    // Insert simulated transaction
    await query(
      `INSERT INTO transactions (school_id, amount, gateway, phone_number, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, 'SUCCESS')`,
      [school_id, amount, gateway, phone_number, ref]
    );

    // Update school table - Clear balance and unlock immediately
    await query(
      `UPDATE schools 
       SET balance_due = 0.00, 
           payment_status = 'PAID', 
           is_locked = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [school_id]
    );

    await query('COMMIT');

    res.json({
      success: true,
      message: 'Payment completed successfully!',
      transaction_ref: ref
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Payment processing error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to process simulated payment' });
  }
});

// -------------------------------------------------------------
// STUDENT REGISTRY & AUTOMATIC BILLING UPDATE
// -------------------------------------------------------------
app.get('/api/students', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id } = req.user;
  try {
    // Get active term
    const schoolRes = await query('SELECT academic_headers FROM schools WHERE id = ?', [school_id]);
    const schoolHeaders = schoolRes.rows[0]?.academic_headers || {};
    const term = req.query.term || schoolHeaders.term || 'Term 1 2026';

    const studentsRes = await query(
      `SELECT s.*, 
              COALESCE(sf.fee_amount, c.fee_amount, 0) as fee_amount,
              COALESCE(sf.amount_paid, 0) as amount_paid,
              (COALESCE(sf.fee_amount, c.fee_amount, 0) - COALESCE(sf.amount_paid, 0)) as balance,
              COALESCE(sf.status, 'pending') as fee_status
       FROM students s
       LEFT JOIN classes c ON s.class_name = c.class_name AND c.school_id = s.school_id
       LEFT JOIN student_fees sf ON s.id = sf.student_id AND sf.term = ?
       WHERE s.school_id = ? 
       ORDER BY s.class_name ASC, s.full_name ASC`,
      [school_id, term]
    );
    res.json(studentsRes.rows);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load students' });
  }
});

// Admin-only: Add student (automatically increments counter and updates invoice balance due)
app.post('/api/students', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin' && role !== 'teacher') {
    return res.status(403).json({ error: 'forbidden', message: 'Unauthorized role to add students' });
  }

  const { full_name, class_name, parent_name, parent_phone, sex, disability, amount_paid } = req.body;
  if (!full_name || !class_name) {
    return res.status(400).json({ error: 'bad_request', message: 'Student name and class are required' });
  }

  // Generate unique roll number
  const roll_number = 'STD-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);

  try {
    await query('BEGIN');

    const studentId = randomUUID();
    await query(
      `INSERT INTO students (id, school_id, full_name, roll_number, class_name, sex, disability, parent_name, parent_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, school_id, full_name, roll_number, class_name, sex || 'M', disability || null, parent_name, parent_phone]
    );

    // Get active term
    const schoolRes = await query('SELECT academic_headers FROM schools WHERE id = ?', [school_id]);
    const schoolHeaders = schoolRes.rows[0]?.academic_headers || {};
    const term = schoolHeaders.term || 'Term 1 2026';

    // Get class fee amount
    const classRes = await query('SELECT fee_amount FROM classes WHERE school_id = ? AND class_name = ?', [school_id, class_name]);
    const feeAmount = classRes.rows.length > 0 ? parseFloat(classRes.rows[0].fee_amount) : 0.00;

    const paid = parseFloat(amount_paid || 0);
    const balance = feeAmount - paid;
    const feeStatus = balance <= 0 ? 'paid' : 'pending';

    await query(
      `INSERT INTO student_fees (student_id, school_id, term, fee_amount, amount_paid, balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [studentId, school_id, term, feeAmount, paid, balance, feeStatus]
    );

    await query(
      `UPDATE schools 
       SET student_count = student_count + 1,
           balance_due = (student_count + 1) * 500.00,
           payment_status = CASE WHEN (student_count + 1) * 500.00 > 0 THEN 'UNPAID' ELSE 'PAID' END,
           is_locked = CASE WHEN (student_count + 1) * 500.00 > 0 THEN TRUE ELSE FALSE END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [school_id]
    );

    const schoolBillingRes = await query(
      'SELECT student_count, balance_due, payment_status, is_locked FROM schools WHERE id = ?',
      [school_id]
    );

    await query('COMMIT');

    res.status(201).json({
      student: {
        id: studentId,
        school_id,
        full_name,
        roll_number,
        class_name,
        sex: sex || 'M',
        disability,
        parent_name,
        parent_phone,
        fee_amount: feeAmount,
        amount_paid: paid,
        balance,
        fee_status: feeStatus
      },
      billing: schoolBillingRes.rows[0]
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Add student error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'conflict', message: 'Student roll number already exists in this school' });
    }
    res.status(500).json({ error: 'server_error', message: 'Failed to add student' });
  }
});

// Admin-only: Remove student
app.delete('/api/students/:id', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Administrators can delete students' });
  }

  const studentId = req.params.id;

  try {
    await query('BEGIN');

    const deleteRes = await query('DELETE FROM students WHERE id = ? AND school_id = ?', [studentId, school_id]);

    if (deleteRes.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Student not found' });
    }

    await query(
      `UPDATE schools 
       SET student_count = GREATEST(0, student_count - 1),
           balance_due = GREATEST(0, student_count - 1) * 500.00,
           payment_status = CASE WHEN GREATEST(0, student_count - 1) * 500.00 > 0 THEN payment_status ELSE 'PAID' END,
           is_locked = CASE WHEN GREATEST(0, student_count - 1) * 500.00 > 0 THEN is_locked ELSE FALSE END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [school_id]
    );

    const schoolBillingRes = await query('SELECT student_count, balance_due, payment_status, is_locked FROM schools WHERE id = ?', [school_id]);

    await query('COMMIT');

    res.json({
      message: 'Student deleted successfully',
      billing: schoolBillingRes.rows[0]
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to delete student' });
  }
});

// -------------------------------------------------------------
// ATTENDANCE MANAGEMENT ROUTES
// -------------------------------------------------------------
app.get('/api/attendance', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id } = req.user;
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'bad_request', message: 'Date parameter required' });

  try {
    const attendanceRes = await query(
      `SELECT a.*, s.full_name, s.roll_number, s.class_name
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE s.school_id = ? AND a.date = ?`,
      [school_id, date]
    );
    res.json(attendanceRes.rows);
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load attendance' });
  }
});

app.post('/api/attendance', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, id: userId, role } = req.user;
  if (role !== 'teacher') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Teachers can submit daily registers' });
  }

  const { student_id, date, status } = req.body;
  if (!student_id || !date || !status) {
    return res.status(400).json({ error: 'bad_request', message: 'student_id, date, and status are required' });
  }

  try {
    // Check if student belongs to this school
    const studentCheck = await query('SELECT full_name, parent_phone, parent_name FROM students WHERE id = ? AND school_id = ?', [student_id, school_id]);
    if (studentCheck.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Student not found in this school' });
    }

    // UPSERT attendance
    await query(
      `INSERT INTO attendance (student_id, date, status, marked_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = ?, marked_by = ?`,
      [student_id, date, status, userId, status, userId]
    );

    // Automated trigger: if status is ABSENT, check config and queue SMS
    if (status === 'absent') {
      const configRes = await query(
        `SELECT message_template, is_enabled, channel FROM notifications_config 
         WHERE school_id = ? AND template_type = 'attendance_alert'`,
        [school_id]
      );

      const stud = studentCheck.rows[0];
      if (configRes.rows.length > 0 && configRes.rows[0].is_enabled && stud.parent_phone) {
        const conf = configRes.rows[0];

        // Fetch school name
        const schoolRes = await query('SELECT name FROM schools WHERE id = ?', [school_id]);
        const schoolName = schoolRes.rows[0].name;

        // Format text
        let message = conf.message_template
          .replace(/{parent_name}/g, stud.parent_name || 'Parent')
          .replace(/{student_name}/g, stud.full_name)
          .replace(/{school_name}/g, schoolName)
          .replace(/{date}/g, date);

        // Save to outbox
        await query(
          `INSERT INTO sent_notifications (school_id, student_id, recipient_phone, message_content, channel, status)
           VALUES (?, ?, ?, ?, ?, 'SENT')`,
          [school_id, student_id, stud.parent_phone, message, conf.channel]
        );
      }
    }

    res.json({ success: true, message: 'Attendance marked successfully' });
  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to mark attendance' });
  }
});

// -------------------------------------------------------------
// REPORT CARDS & GRADING ROUTES
// -------------------------------------------------------------
app.get('/api/scores', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id } = req.user;
  const { term, class_name } = req.query;

  if (!term) return res.status(400).json({ error: 'bad_request', message: 'Term is required' });

  try {
    let q = `
      SELECT r.*, s.full_name, s.roll_number, s.class_name
      FROM report_cards r
      JOIN students s ON r.student_id = s.id
      WHERE s.school_id = ? AND r.term = ?
    `;
    const params = [school_id, term];

    if (class_name) {
      q += ` AND s.class_name = ?`;
      params.push(class_name);
    }

    const scoresRes = await query(q, params);
    res.json(scoresRes.rows);
  } catch (err) {
    console.error('Get scores error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load scores' });
  }
});

// Teacher only: enter scores and dropdown remarks
app.post('/api/scores', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'teacher') {
    return res.status(403).json({ error: 'forbidden', message: 'Only teachers can input scores' });
  }

  const { student_id, term, subject, score, remarks } = req.body;
  if (!student_id || !term || !subject || score === undefined) {
    return res.status(400).json({ error: 'bad_request', message: 'student_id, term, subject, and score are required' });
  }

  try {
    // Verify student belongs to this school
    const studentCheck = await query('SELECT full_name FROM students WHERE id = ? AND school_id = ?', [student_id, school_id]);
    if (studentCheck.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Student not found in school' });
    }

    // UPSERT score entry
    await query(
      `INSERT INTO report_cards (student_id, term, subject, score, teacher_remarks, headteacher_approved)
       VALUES (?, ?, ?, ?, ?, false)
       ON DUPLICATE KEY UPDATE score = VALUES(score), teacher_remarks = VALUES(teacher_remarks), headteacher_approved = false, updated_at = CURRENT_TIMESTAMP`,
      [student_id, term, subject, score, remarks]
    );

    const reportRes = await query(
      'SELECT * FROM report_cards WHERE student_id = ? AND term = ? AND subject = ?',
      [student_id, term, subject]
    );

    res.json({ success: true, report: reportRes.rows[0] });
  } catch (err) {
    console.error('Enter score error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to save score' });
  }
});

// Headteacher only: approve report cards
app.post('/api/scores/approve', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role, id: userId } = req.user;
  if (role !== 'headteacher') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Headteacher can approve report cards' });
  }

  const { report_ids, approve_all, term } = req.body;
  let targetIds = report_ids;

  if (approve_all) {
    try {
      const pendingRes = await query(
        `SELECT r.id FROM report_cards r
         JOIN students s ON r.student_id = s.id
         WHERE s.school_id = ? AND r.headteacher_approved = false AND r.term = ?`,
        [school_id, term || 'Term 2']
      );
      targetIds = pendingRes.rows.map(row => row.id);
    } catch (err) {
      console.error('Fetch pending reports error:', err);
      return res.status(500).json({ error: 'server_error', message: 'Failed to fetch pending report cards' });
    }
  }

  if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    return res.json({ success: true, message: 'No report cards to approve' });
  }

  try {
    const placeholders = targetIds.map(() => '?').join(',');
    await query(
      `UPDATE report_cards 
       SET headteacher_approved = true, 
           approved_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})`,
      [userId, ...targetIds]
    );

    // Trigger Notifications for approved reports
    // For each student who has newly approved report cards, construct report summary and queue SMS/WhatsApp
    for (const rid of targetIds) {
      const repRes = await query(
        `SELECT r.term, r.subject, r.score, r.teacher_remarks, s.id as student_id, s.full_name, s.parent_name, s.parent_phone, s.school_id
         FROM report_cards r
         JOIN students s ON r.student_id = s.id
         WHERE r.id = ?`,
        [rid]
      );

      if (repRes.rows.length > 0) {
        const rep = repRes.rows[0];
        if (rep.parent_phone) {
          const configRes = await query(
            `SELECT message_template, is_enabled, channel FROM notifications_config 
             WHERE school_id = ? AND template_type = 'report_card_ready'`,
            [rep.school_id]
          );

          if (configRes.rows.length > 0 && configRes.rows[0].is_enabled) {
            const conf = configRes.rows[0];
            const schoolRes = await query('SELECT name FROM schools WHERE id = ?', [rep.school_id]);
            const schoolName = schoolRes.rows[0].name;

            const scoresDetails = `${rep.subject}: ${rep.score}% (${rep.teacher_remarks || 'No remarks'})`;
            const paymentLink = `http://localhost:5173/pay/student/${rep.student_id}`;

            let message = conf.message_template
              .replace(/{parent_name}/g, rep.parent_name || 'Parent')
              .replace(/{student_name}/g, rep.full_name)
              .replace(/{school_name}/g, schoolName)
              .replace(/{academic_header}/g, rep.term)
              .replace(/{score_details}/g, scoresDetails)
              .replace(/{payment_link}/g, paymentLink);

            await query(
              `INSERT INTO sent_notifications (school_id, student_id, recipient_phone, message_content, channel, status)
               VALUES (?, ?, ?, ?, ?, 'SENT')`,
              [rep.school_id, rep.student_id, rep.parent_phone, message, conf.channel]
            );
          }
        }
      }
    }

    res.json({ success: true, message: 'Reports approved and parent alerts sent' });
  } catch (err) {
    console.error('Approve reports error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to approve report cards' });
  }
});

// -------------------------------------------------------------
// PARENT NOTIFICATION CONFIG AND OUTBOX
// -------------------------------------------------------------
app.get('/api/notifications/config', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id } = req.user;
  try {
    const configRes = await query('SELECT * FROM notifications_config WHERE school_id = ?', [school_id]);
    res.json(configRes.rows);
  } catch (err) {
    console.error('Get notification config error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load notifications configurations' });
  }
});

app.post('/api/notifications/config', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Master Admin can modify notification config' });
  }

  const configs = req.body; // Expect array of configurations
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: 'bad_request', message: 'Array of configurations required' });
  }

  try {
    await query('BEGIN');
    for (const c of configs) {
      await query(
        `INSERT INTO notifications_config (school_id, template_type, message_template, time_limit_days, is_enabled, channel)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE message_template = ?,
                       time_limit_days = ?,
                       is_enabled = ?,
                       channel = ?`,
        [school_id, c.template_type, c.message_template, c.time_limit_days || 0, c.is_enabled, c.channel || 'sms', c.message_template, c.time_limit_days || 0, c.is_enabled, c.channel || 'sms']
      );
    }
    await query('COMMIT');
    res.json({ success: true, message: 'Notifications config updated successfully' });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Update notification config error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to update configurations' });
  }
});

// Admin-only: Fetch Outbox log
app.get('/api/notifications/outbox', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
  }

  try {
    const outboxRes = await query(
      `SELECT n.*, s.full_name as student_name
       FROM sent_notifications n
       LEFT JOIN students s ON n.student_id = s.id
       WHERE n.school_id = ?
       ORDER BY n.sent_at DESC LIMIT 50`,
      [school_id]
    );
    res.json(outboxRes.rows);
  } catch (err) {
    console.error('Get outbox error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to load outbox logs' });
  }
});

// Admin-only: Manually trigger a parent alert (e.g. general fees reminder)
app.post('/api/notifications/send', authenticateToken, checkLockoutGate, async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Only Administrators can manually fire alert broadcasts' });
  }

  const { template_type, class_name } = req.body;
  if (!template_type) {
    return res.status(400).json({ error: 'bad_request', message: 'template_type is required' });
  }

  try {
    // 1. Fetch template config
    const configRes = await query(
      'SELECT message_template, channel, is_enabled FROM notifications_config WHERE school_id = ? AND template_type = ?',
      [school_id, template_type]
    );

    if (configRes.rows.length === 0 || !configRes.rows[0].is_enabled) {
      return res.status(404).json({ error: 'disabled_or_missing', message: 'Template config is either disabled or not configured.' });
    }

    const config = configRes.rows[0];

    // 2. Fetch target students
    let studQuery = 'SELECT id, full_name, parent_name, parent_phone FROM students WHERE school_id = ?';
    const params = [school_id];

    if (class_name) {
      studQuery += ' AND class_name = ?';
      params.push(class_name);
    }

    const studentsRes = await query(studQuery, params);
    if (studentsRes.rows.length === 0) {
      return res.json({ success: true, count: 0, message: 'No students found in target audience' });
    }

    // Fetch school metadata for variables
    const schoolRes = await query('SELECT name, balance_due FROM schools WHERE id = ?', [school_id]);
    const school = schoolRes.rows[0];

    let sentCount = 0;
    for (const stud of studentsRes.rows) {
      if (stud.parent_phone) {
        const paymentLink = `http://localhost:5173/pay/student/${stud.id}`;

        let message = config.message_template
          .replace(/{parent_name}/g, stud.parent_name || 'Parent')
          .replace(/{student_name}/g, stud.full_name)
          .replace(/{school_name}/g, school.name)
          .replace(/{balance_due}/g, '500') // Individual student term fee
          .replace(/{payment_link}/g, paymentLink);

        await query(
          `INSERT INTO sent_notifications (school_id, student_id, recipient_phone, message_content, channel, status)
           VALUES (?, ?, ?, ?, ?, 'SENT')`,
          [school_id, stud.id, stud.parent_phone, message, config.channel]
        );
        sentCount++;
      }
    }

    res.json({ success: true, count: sentCount, message: `Dispatched ${sentCount} notifications successfully.` });
  } catch (err) {
    console.error('Trigger notifications error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to execute broadcast' });
  }
});

// -------------------------------------------------------------
// CHATBOT TIMETABLE SOLVER ENGINE
// -------------------------------------------------------------
app.post('/api/timetable/generate', authenticateToken, checkLockoutGate, async (req, res) => {
  const { classes, subjects, days, slotsPerDay } = req.body;
  if (!classes || !subjects || !days || !slotsPerDay) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing parameters (classes, subjects, days, slotsPerDay)' });
  }

  try {
    const result = generateTimetable({
      classes,
      subjects,
      days,
      slotsPerDay: parseInt(slotsPerDay, 10)
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(422).json({ error: 'schedule_conflict', message: result.error });
    }
  } catch (err) {
    console.error('Timetable generator error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to run CSP solver' });
  }
});

// -------------------------------------------------------------
// STANDALONE MOBILE PARENT PAYMENT PORTAL (UNAUTHENTICATED)
// -------------------------------------------------------------
app.get('/api/parent/student/:id', async (req, res) => {
  const studentId = req.params.id;
  try {
    const studRes = await query(
      `SELECT s.id, s.full_name, s.roll_number, s.class_name, s.parent_name, s.parent_phone,
              sc.name as school_name, sc.letterhead
       FROM students s
       JOIN schools sc ON s.school_id = sc.id
       WHERE s.id = ?`,
      [studentId]
    );

    if (studRes.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Student record not found' });
    }

    res.json({
      student: studRes.rows[0],
      term_fee: 500.00 // Malawi School licensing fee per student per term
    });
  } catch (err) {
    console.error('Parent lookup error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to look up student invoice details' });
  }
});

app.post('/api/parent/pay', async (req, res) => {
  const { student_id, phone_number, amount, gateway } = req.body;
  if (!student_id || !phone_number || !amount || !gateway) {
    return res.status(400).json({ error: 'bad_request', message: 'Student ID, phone number, amount, and gateway required' });
  }

  try {
    await query('BEGIN');

    // Fetch student info
    const studRes = await query('SELECT school_id, full_name FROM students WHERE id = ?', [student_id]);
    if (studRes.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', message: 'Student not found' });
    }

    const schoolId = studRes.rows[0].school_id;
    const ref = 'TX-PRNT-' + gateway.toUpperCase().substring(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000);

    // Record student transaction
    await query(
      `INSERT INTO transactions (school_id, amount, gateway, phone_number, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, 'SUCCESS')`,
      [schoolId, amount, gateway, phone_number, ref]
    );

    // Update school outstanding balance (parent pays fee for this student, subtracting K500 from school debt)
    await query(
      `UPDATE schools 
       SET balance_due = GREATEST(0.00, balance_due - 500.00),
           is_locked = CASE WHEN GREATEST(0.00, balance_due - 500.00) > 0 THEN is_locked ELSE FALSE END,
           payment_status = CASE WHEN GREATEST(0.00, balance_due - 500.00) > 0 THEN payment_status ELSE 'PAID' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [schoolId]
    );

    await query('COMMIT');

    res.json({
      success: true,
      message: `Successfully processed fees payment for ${studRes.rows[0].full_name}.`,
      transaction_ref: ref
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Parent payment error:', err);
    res.status(500).json({ error: 'server_error', message: 'Failed to process student payment' });
  }
});

// -------------------------------------------------------------
// PWA OFFLINE SYNC BATCH ENDPOINT
// -------------------------------------------------------------
app.post('/api/sync', authenticateToken, checkLockoutGate, async (req, res) => {
  const { id: userId, school_id } = req.user;
  const { operations } = req.body; // Array of operations: { type: 'attendance'|'score', data: {...} }

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'bad_request', message: 'Operations array is required' });
  }

  const results = { succeeded: 0, failed: 0, errors: [] };

  for (const op of operations) {
    try {
      if (op.type === 'attendance') {
        const { student_id, date, status } = op.data;
        // Verify student
        const check = await query('SELECT id FROM students WHERE id = ? AND school_id = ?', [student_id, school_id]);
        if (check.rowCount > 0) {
          await query(
            `INSERT INTO attendance (student_id, date, status, marked_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = ?, marked_by = ?`,
            [student_id, date, status, userId, status, userId]
          );
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push(`Student ${student_id} not found in this school during attendance sync`);
        }
      } else if (op.type === 'score') {
        const { student_id, term, subject, score, remarks } = op.data;
        const check = await query('SELECT id FROM students WHERE id = ? AND school_id = ?', [student_id, school_id]);
        if (check.rowCount > 0) {
          await query(
            `INSERT INTO report_cards (student_id, term, subject, score, teacher_remarks, headteacher_approved)
             VALUES (?, ?, ?, ?, ?, false)
             ON DUPLICATE KEY UPDATE score = ?, teacher_remarks = ?, headteacher_approved = false`,
            [student_id, term, subject, score, remarks, score, remarks]
          );
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push(`Student ${student_id} not found in this school during score sync`);
        }
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`DB error during sync operation: ${err.message}`);
    }
  }

  res.json({
    message: 'Synchronization processed',
    sync_results: results
  });
});

// Mount API routers with authentication middleware
app.use(authenticateToken, checkLockoutGate, feesAPI);
app.use(authenticateToken, checkLockoutGate, subjectsAPI);
app.use(authenticateToken, checkLockoutGate, attendanceAPI);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
