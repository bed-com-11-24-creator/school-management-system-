import express from 'express';
import { query } from './db.js';

const router = express.Router();

function teacherOrAdmin(req, res, next) {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Teacher/Admin only' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE MANAGEMENT FOR TEACHERS
// ─────────────────────────────────────────────────────────────────────────────

// Get attendance for a teacher's class on a specific date
router.get('/api/attendance/:date', teacherOrAdmin, async (req, res) => {
  const { date } = req.params;
  const { subject_id, class_id } = req.query;
  const { id: userId, role } = req.user;

  if (!subject_id || !class_id) {
    return res.status(400).json({ error: 'bad_request', message: 'Subject ID and Class ID required' });
  }

  try {
    // If teacher, verify they teach this subject+class
    if (role === 'teacher') {
      const verifyRes = await query(
        `SELECT id FROM teacher_assignments 
         WHERE teacher_id = ? AND subject_id = ? AND class_id = ?`,
        [userId, subject_id, class_id]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(403).json({ error: 'forbidden', message: 'You do not teach this class/subject' });
      }
    }

    // Get students for this class+subject with their attendance
    const attendanceRes = await query(
      `SELECT 
        s.id, s.full_name, s.roll_number, s.sex, s.disability,
        COALESCE(a.status, 'not_marked') as status,
        COALESCE(a.id, NULL) as attendance_id
       FROM students s
       JOIN classes c ON s.class_name = c.class_name AND s.school_id = c.school_id
       JOIN class_subjects cs ON c.id = cs.class_id
       LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
       WHERE c.id = ?
       AND cs.subject_id = ?
       AND s.status = 'active'
       ORDER BY s.full_name`,
      [date, class_id, subject_id]
    );

    res.json({ attendance: attendanceRes.rows, date });
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Mark/Update attendance for a student
router.post('/api/attendance', teacherOrAdmin, async (req, res) => {
  const { id: userId, role } = req.user;
  const { student_id, date, status } = req.body;

  if (!student_id || !date || !['present', 'absent', 'late'].includes(status)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid attendance data' });
  }

  try {
    // If teacher, verify they can mark this student (student is in one of their classes)
    if (role === 'teacher') {
      const verifyRes = await query(
        `SELECT 1 FROM students s
         JOIN classes c ON s.class_name = c.class_name AND s.school_id = c.school_id
         JOIN teacher_assignments ta ON c.id = ta.class_id
         WHERE s.id = ? AND ta.teacher_id = ?`,
        [student_id, userId]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(403).json({ error: 'forbidden', message: 'You cannot mark this student' });
      }
    }

    await query(
      `INSERT INTO attendance (student_id, date, status, marked_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = ?, marked_by = ?, created_at = CURRENT_TIMESTAMP`,
      [student_id, date, status, userId, status, userId]
    );

    const attendanceRes = await query(
      'SELECT * FROM attendance WHERE student_id = ? AND date = ?',
      [student_id, date]
    );

    res.json({ message: 'Attendance recorded', attendance: attendanceRes.rows[0] });
  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get attendance summary for a student
router.get('/api/attendance/student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const summaryRes = await query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM attendance
       WHERE student_id = ?
       GROUP BY status`,
      [studentId]
    );

    const total = summaryRes.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    const summary = {
      total,
      present: 0,
      absent: 0,
      late: 0
    };

    summaryRes.rows.forEach(row => {
      summary[row.status] = parseInt(row.count);
    });

    res.json(summary);
  } catch (err) {
    console.error('Get attendance summary error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get attendance records for date range
router.get('/api/attendance/range', teacherOrAdmin, async (req, res) => {
  const { start_date, end_date, student_id } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'bad_request', message: 'Start and end dates required' });
  }

  try {
    let sql = `
      SELECT 
        a.*, s.full_name, s.roll_number
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.date BETWEEN ? AND ?
    `;
    const params = [start_date, end_date];

    if (student_id) {
      sql += ` AND a.student_id = ?`;
      params.push(student_id);
    }

    sql += ` ORDER BY a.date DESC, s.full_name`;

    const attendanceRes = await query(sql, params);
    res.json({ records: attendanceRes.rows });
  } catch (err) {
    console.error('Get attendance range error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

export default router;
