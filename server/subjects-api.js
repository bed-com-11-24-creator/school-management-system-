import express from 'express';
import { query } from './db.js';

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Admin only' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// Get all subjects for school
router.get('/api/subjects', async (req, res) => {
  const { school_id } = req.user;

  try {
    const subjectsRes = await query(
      'SELECT * FROM subjects WHERE school_id = $1 ORDER BY subject_name',
      [school_id]
    );
    res.json({ subjects: subjectsRes.rows });
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Create subject
router.post('/api/subjects', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { subject_name } = req.body;

  if (!subject_name) {
    return res.status(400).json({ error: 'bad_request', message: 'Subject name required' });
  }

  try {
    const result = await query(
      `INSERT INTO subjects (school_id, subject_name)
       VALUES ($1, $2)
       ON CONFLICT (school_id, subject_name) DO NOTHING
       RETURNING *`,
      [school_id, subject_name]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'conflict', message: 'Subject already exists' });
    }

    res.status(201).json({ subject: result.rows[0] });
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Helper to ensure default classes exist for a school
async function ensureDefaultClasses(schoolId) {
  const targetClasses = [
    'Standard 1',
    'Standard 2',
    'Standard 3',
    'Standard 4',
    'Standard 5',
    'Standard 6',
    'Standard 7',
    'Standard 8'
  ];
  for (const name of targetClasses) {
    await query(
      `INSERT INTO classes (school_id, class_name, fee_amount)
       VALUES ($1, $2, 0.00)
       ON CONFLICT (school_id, class_name) DO NOTHING`,
      [schoolId, name]
    );
  }
}

// Get all classes for school
router.get('/api/classes', async (req, res) => {
  const { school_id } = req.user;

  try {
    await ensureDefaultClasses(school_id);
    const classesRes = await query(
      'SELECT * FROM classes WHERE school_id = $1',
      [school_id]
    );
    
    // Sort Reception Class first, then Standard 1-8
    const sorted = classesRes.rows.sort((a, b) => {
      if (a.class_name === 'Reception Class') return -1;
      if (b.class_name === 'Reception Class') return 1;
      const numA = parseInt(a.class_name.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.class_name.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    res.json({ classes: sorted });
  } catch (err) {
    console.error('Get classes error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Create class
router.post('/api/classes', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { class_name } = req.body;

  if (!class_name) {
    return res.status(400).json({ error: 'bad_request', message: 'Class name required' });
  }

  try {
    const result = await query(
      `INSERT INTO classes (school_id, class_name)
       VALUES ($1, $2)
       ON CONFLICT (school_id, class_name) DO NOTHING
       RETURNING *`,
      [school_id, class_name]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'conflict', message: 'Class already exists' });
    }

    res.status(201).json({ class: result.rows[0] });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT SUBJECT REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

// Register student to subjects
router.post('/api/students/:studentId/subjects', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { studentId } = req.params;
  const { subject_ids } = req.body; // Array of subject IDs

  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'Subject IDs array required' });
  }

  try {
    // Verify student exists
    const studentRes = await query('SELECT id FROM students WHERE id = $1 AND school_id = $2', [studentId, school_id]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Student not found' });
    }

    // First, delete existing registrations
    await query('DELETE FROM student_subjects WHERE student_id = $1', [studentId]);

    // Insert new registrations
    for (const subjectId of subject_ids) {
      await query(
        `INSERT INTO student_subjects (student_id, subject_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [studentId, subjectId]
      );
    }

    res.json({ message: 'Student subjects registered successfully' });
  } catch (err) {
    console.error('Register subject error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get student's registered subjects
router.get('/api/students/:studentId/subjects', async (req, res) => {
  const { studentId } = req.params;
  const { school_id } = req.user;

  try {
    const subjectsRes = await query(
      `SELECT s.id, s.subject_name FROM subjects s
       JOIN class_subjects cs ON s.id = cs.subject_id
       JOIN classes c ON cs.class_id = c.id
       JOIN students st ON c.class_name = st.class_name AND c.school_id = st.school_id
       WHERE st.id = $1 AND st.school_id = $2
       ORDER BY s.subject_name`,
      [studentId, school_id]
    );

    res.json({ subjects: subjectsRes.rows });
  } catch (err) {
    console.error('Get student subjects error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER ASSIGNMENT TO CLASS+SUBJECT
// ─────────────────────────────────────────────────────────────────────────────

// Assign teacher to subject+class
router.post('/api/teachers/:teacherId/assign', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { teacherId } = req.params;
  const { assignments } = req.body; // Array of { subject_id, class_id }

  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'bad_request', message: 'Assignments array required' });
  }

  try {
    // Verify teacher exists in this school
    const teacherRes = await query(
      'SELECT id FROM users WHERE id = $1 AND school_id = $2 AND role = $3',
      [teacherId, school_id, 'teacher']
    );
    if (teacherRes.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Teacher not found' });
    }

    // Delete existing assignments
    await query('DELETE FROM teacher_assignments WHERE teacher_id = $1', [teacherId]);

    // Add new assignments
    for (const assignment of assignments) {
      const { subject_id, class_id } = assignment;
      await query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [teacherId, subject_id, class_id]
      );
    }

    res.json({ message: 'Teacher assignments updated' });
  } catch (err) {
    console.error('Assign teacher error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASS SUBJECTS MANAGEMENT (which subjects taught in which class)
// ─────────────────────────────────────────────────────────────────────────────

// Get subjects for a class
router.get('/api/class-subjects/:classId', async (req, res) => {
  const { classId } = req.params;

  try {
    const classRes = await query('SELECT * FROM classes WHERE id = $1', [classId]);
    if (classRes.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Class not found' });
    }

    const subjectsRes = await query(
      `SELECT s.id, s.subject_name FROM subjects s
       JOIN class_subjects cs ON s.id = cs.subject_id
       WHERE cs.class_id = $1
       ORDER BY s.subject_name`,
      [classId]
    );

    res.json({ subjects: subjectsRes.rows });
  } catch (err) {
    console.error('Get class subjects error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Add subject to class
router.post('/api/class-subjects/:classId', adminOnly, async (req, res) => {
  const { classId } = req.params;
  const { subject_id } = req.body;

  if (!subject_id) {
    return res.status(400).json({ error: 'bad_request', message: 'Subject ID required' });
  }

  try {
    const result = await query(
      `INSERT INTO class_subjects (class_id, subject_id)
       VALUES ($1, $2)
       ON CONFLICT (class_id, subject_id) DO NOTHING
       RETURNING *`,
      [classId, subject_id]
    );

    res.status(201).json({ message: 'Subject added to class', subject: result.rows[0] });
  } catch (err) {
    console.error('Add class subject error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Remove subject from class
router.delete('/api/class-subjects/:classId/:subjectId', adminOnly, async (req, res) => {
  const { classId, subjectId } = req.params;

  try {
    const result = await query(
      'DELETE FROM class_subjects WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Subject not assigned to class' });
    }

    res.json({ message: 'Subject removed from class' });
  } catch (err) {
    console.error('Remove class subject error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Delete teacher
router.delete('/api/teachers/:teacherId', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { teacherId } = req.params;

  try {
    // Verify teacher exists and belongs to school
    const teacherRes = await query(
      'SELECT id FROM users WHERE id = $1 AND school_id = $2 AND role = $3',
      [teacherId, school_id, 'teacher']
    );
    if (teacherRes.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Teacher not found' });
    }

    // Delete teacher (cascades to assignments, attendance records, etc.)
    await query('DELETE FROM users WHERE id = $1', [teacherId]);

    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get teacher's assignments
router.get('/api/teachers/:teacherId/assignments', async (req, res) => {
  const { teacherId } = req.params;

  try {
    const assignmentsRes = await query(
      `SELECT ta.id, s.subject_name, c.class_name, s.id as subject_id, c.id as class_id
       FROM teacher_assignments ta
       JOIN subjects s ON ta.subject_id = s.id
       JOIN classes c ON ta.class_id = c.id
       WHERE ta.teacher_id = $1
       ORDER BY c.class_name, s.subject_name`,
      [teacherId]
    );

    res.json({ assignments: assignmentsRes.rows });
  } catch (err) {
    console.error('Get teacher assignments error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get class subject roster for all classes
router.get('/api/class-rosters', adminOnly, async (req, res) => {
  const { school_id } = req.user;

  try {
    const classesRes = await query(
      'SELECT id, class_name FROM classes WHERE school_id = $1 ORDER BY class_name',
      [school_id]
    );

    const registrationsRes = await query(
      `SELECT st.id as student_id, st.full_name as student_name, st.roll_number, st.class_name,
              subj.id as subject_id, subj.subject_name
       FROM class_subjects cs
       JOIN classes c ON cs.class_id = c.id
       JOIN students st ON c.class_name = st.class_name AND c.school_id = st.school_id
       JOIN subjects subj ON cs.subject_id = subj.id
       WHERE st.school_id = $1 AND st.status = 'active'
       ORDER BY st.class_name, subj.subject_name, st.full_name`,
      [school_id]
    );

    const assignmentsRes = await query(
      `SELECT ta.class_id, subj.id as subject_id, subj.subject_name,
              u.id as teacher_id, u.full_name as teacher_name
       FROM teacher_assignments ta
       JOIN subjects subj ON ta.subject_id = subj.id
       JOIN users u ON ta.teacher_id = u.id
       WHERE u.school_id = $1
       ORDER BY ta.class_id, subj.subject_name`,
      [school_id]
    );

    const classesMap = new Map();
    classesRes.rows.forEach((cls) => {
      classesMap.set(cls.id, {
        class_id: cls.id,
        class_name: cls.class_name,
        subjects: new Map()
      });
    });

    registrationsRes.rows.forEach((row) => {
      const classEntry = Array.from(classesMap.values()).find(
        (cls) => cls.class_name === row.class_name
      );
      if (!classEntry) {
        return;
      }

      let subjectEntry = classEntry.subjects.get(row.subject_id);
      if (!subjectEntry) {
        subjectEntry = {
          subject_id: row.subject_id,
          subject_name: row.subject_name,
          teacher_id: null,
          teacher_name: null,
          students: []
        };
        classEntry.subjects.set(row.subject_id, subjectEntry);
      }

      subjectEntry.students.push({
        student_id: row.student_id,
        student_name: row.student_name,
        roll_number: row.roll_number
      });
    });

    assignmentsRes.rows.forEach((row) => {
      const classEntry = classesMap.get(row.class_id);
      if (!classEntry) return;
      let subjectEntry = classEntry.subjects.get(row.subject_id);
      if (!subjectEntry) {
        subjectEntry = {
          subject_id: row.subject_id,
          subject_name: row.subject_name,
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          students: []
        };
        classEntry.subjects.set(row.subject_id, subjectEntry);
      } else {
        subjectEntry.teacher_id = row.teacher_id;
        subjectEntry.teacher_name = row.teacher_name;
      }
    });

    const classesList = Array.from(classesMap.values()).map((classItem) => ({
      class_id: classItem.class_id,
      class_name: classItem.class_name,
      subjects: Array.from(classItem.subjects.values()).map((subject) => ({
        ...subject,
        students: subject.students.sort((a, b) => a.student_name.localeCompare(b.student_name))
      }))
    }));

    res.json({ classes: classesList });
  } catch (err) {
    console.error('Get class rosters error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Get students for a teacher's class+subject
router.get('/api/teachers/:teacherId/students', async (req, res) => {
  const { teacherId } = req.params;
  const { subject_id, class_id } = req.query;

  if (!subject_id || !class_id) {
    return res.status(400).json({ error: 'bad_request', message: 'Subject ID and Class ID required' });
  }

  try {
    // Get students enrolled in this class since all automatically take the class subjects
    const studentsRes = await query(
      `SELECT DISTINCT s.id, s.full_name, s.roll_number, s.class_name, s.parent_name, s.parent_phone, s.sex, s.disability
       FROM students s
       JOIN classes c ON s.class_name = c.class_name AND s.school_id = c.school_id
       JOIN class_subjects cs ON c.id = cs.class_id
       WHERE c.id = $1
       AND cs.subject_id = $2
       AND s.status = 'active'
       AND s.school_id = (SELECT school_id FROM users WHERE id = $3)
       ORDER BY s.full_name`,
      [class_id, subject_id, teacherId]
    );

    res.json({ students: studentsRes.rows });
  } catch (err) {
    console.error('Get teacher students error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ALL TEACHERS LIST (for admin management)
// ─────────────────────────────────────────────────────────────────────────────

// Get all teachers with their assignments
router.get('/api/teachers', async (req, res) => {
  const { school_id, role } = req.user;
  if (role !== 'admin' && role !== 'headteacher') {
    return res.status(403).json({ error: 'forbidden', message: 'Access denied' });
  }
  const { search } = req.query;

  try {
    let sql = `
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.role,
        u.sex,
        u.created_at,
        -- Distinct assignments list
        COALESCE(
          (SELECT STRING_AGG(DISTINCT CONCAT(sub.subject_name, ' - ', cl.class_name), ', ')
           FROM teacher_assignments ta
           JOIN subjects sub ON ta.subject_id = sub.id
           JOIN classes cl ON ta.class_id = cl.id
           WHERE ta.teacher_id = u.id), 
          'None'
        ) as assignments_list,
        -- Distinct classes array
        COALESCE(
          (SELECT JSON_AGG(DISTINCT cl.class_name)
           FROM teacher_assignments ta
           JOIN classes cl ON ta.class_id = cl.id
           WHERE ta.teacher_id = u.id),
          '[]'::json
        ) as assigned_classes,
        -- Distinct subjects array
        COALESCE(
          (SELECT JSON_AGG(DISTINCT sub.subject_name)
           FROM teacher_assignments ta
           JOIN subjects sub ON ta.subject_id = sub.id
           WHERE ta.teacher_id = u.id),
          '[]'::json
        ) as assigned_subjects,
        -- Number of students in assigned classes
        (SELECT COUNT(DISTINCT s.id) 
         FROM students s
         JOIN classes cl ON s.class_name = cl.class_name AND s.school_id = cl.school_id
         WHERE cl.id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = u.id)
         AND s.status = 'active') as student_count,
        -- Daily attendance summary (today)
        (SELECT COUNT(DISTINCT a.id)
         FROM attendance a
         JOIN students s ON a.student_id = s.id
         JOIN classes cl ON s.class_name = cl.class_name AND s.school_id = cl.school_id
         WHERE cl.id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = u.id)
         AND a.date = CURRENT_DATE AND a.status = 'present') as attendance_present,
        (SELECT COUNT(DISTINCT a.id)
         FROM attendance a
         JOIN students s ON a.student_id = s.id
         JOIN classes cl ON s.class_name = cl.class_name AND s.school_id = cl.school_id
         WHERE cl.id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = u.id)
         AND a.date = CURRENT_DATE AND a.status = 'absent') as attendance_absent,
        (SELECT COUNT(DISTINCT a.id)
         FROM attendance a
         JOIN students s ON a.student_id = s.id
         JOIN classes cl ON s.class_name = cl.class_name AND s.school_id = cl.school_id
         WHERE cl.id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = u.id)
         AND a.date = CURRENT_DATE AND a.status = 'late') as attendance_late
      FROM users u
      WHERE u.school_id = $1 AND u.role = 'teacher'
    `;
    const params = [school_id];

    if (search) {
      sql += ` AND (u.full_name ILIKE $2 OR u.email ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY u.full_name`;

    const teachersRes = await query(sql, params);
    res.json({ teachers: teachersRes.rows });
  } catch (err) {
    console.error('Get teachers error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Search teacher by name/email
router.get('/api/teachers/search', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'bad_request', message: 'Search query too short' });
  }

  try {
    const teachersRes = await query(
      `SELECT id, full_name, email, created_at FROM users
       WHERE school_id = $1 
       AND role = 'teacher'
       AND (full_name ILIKE $2 OR email ILIKE $2)
       ORDER BY full_name
       LIMIT 20`,
      [school_id, `%${q}%`]
    );

    res.json({ teachers: teachersRes.rows });
  } catch (err) {
    console.error('Search teacher error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLASS FEES MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// Get all classes with fees for school
router.get('/api/classes-with-fees', async (req, res) => {
  const { school_id } = req.user;

  try {
    await ensureDefaultClasses(school_id);
    const classesRes = await query(
      'SELECT id, class_name, fee_amount FROM classes WHERE school_id = $1',
      [school_id]
    );

    // Sort Reception Class first, then Standard 1-8
    const sorted = classesRes.rows.sort((a, b) => {
      if (a.class_name === 'Reception Class') return -1;
      if (b.class_name === 'Reception Class') return 1;
      const numA = parseInt(a.class_name.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.class_name.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    res.json({ classes: sorted });
  } catch (err) {
    console.error('Get classes with fees error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Update fee amount for a class (single)
router.post('/api/class-fees/:classId', adminOnly, async (req, res) => {
  const { classId } = req.params;
  const { fee_amount } = req.body;
  const { school_id } = req.user;

  if (fee_amount === undefined || fee_amount === null) {
    return res.status(400).json({ error: 'bad_request', message: 'Fee amount required' });
  }

  try {
    const result = await query(
      'UPDATE classes SET fee_amount = $1 WHERE id = $2 AND school_id = $3 RETURNING *',
      [parseFloat(fee_amount), classId, school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Class not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update class fee error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// Bulk update fee amount for classes
router.post('/api/class-fees/bulk', adminOnly, async (req, res) => {
  const { school_id } = req.user;
  const { fees } = req.body; // Array of { id, fee_amount }

  if (!Array.isArray(fees)) {
    return res.status(400).json({ error: 'bad_request', message: 'Fees array is required' });
  }

  try {
    await query('BEGIN');
    for (const f of fees) {
      await query(
        'UPDATE classes SET fee_amount = $1 WHERE id = $2 AND school_id = $3',
        [parseFloat(f.fee_amount || 0), f.id, school_id]
      );
    }
    await query('COMMIT');
    res.json({ message: 'Class fees updated successfully' });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Bulk update class fees error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

export default router;
