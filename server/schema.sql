-- MySQL Schema - Converted from PostgreSQL
-- Drop tables if they exist (clean setup)
DROP TABLE IF EXISTS fee_reminders;
DROP TABLE IF EXISTS student_fees;
DROP TABLE IF EXISTS teacher_assignments;
DROP TABLE IF EXISTS student_subjects;
DROP TABLE IF EXISTS class_subjects;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS report_cards;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS sent_notifications;
DROP TABLE IF EXISTS notifications_config;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schools;

-- Create tables
CREATE TABLE schools (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    logo LONGTEXT,
    letterhead LONGTEXT,
    academic_headers JSON,
    student_count INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    balance_due DECIMAL(12, 2) DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'PAID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'headteacher', 'teacher')),
    full_name VARCHAR(255) NOT NULL,
    sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'm', 'f')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_school_id (school_id),
    INDEX idx_role (role)
);

-- Note: MySQL doesn't support partial unique indexes like PostgreSQL
-- The uniqueness constraints for admin/headteacher per school are enforced at the application level

CREATE TABLE students (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(100) NOT NULL,
    sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'm', 'f')),
    disability TEXT,
    class_name VARCHAR(100) NOT NULL,
    parent_name VARCHAR(255),
    parent_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'transferred', 'dropped')),
    graduation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_roll (school_id, roll_number),
    INDEX idx_school_id (school_id),
    INDEX idx_class_name (class_name)
);

CREATE TABLE notifications_config (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    template_type VARCHAR(50) CHECK (template_type IN ('fees_reminder', 'report_card_ready', 'attendance_alert')),
    message_template LONGTEXT NOT NULL,
    time_limit_days INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    channel VARCHAR(20) DEFAULT 'sms',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_config (school_id, template_type),
    INDEX idx_school_id (school_id)
);

CREATE TABLE sent_notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    student_id CHAR(36),
    recipient_phone VARCHAR(50) NOT NULL,
    message_content LONGTEXT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'SENT',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    INDEX idx_school_id (school_id),
    INDEX idx_student_id (student_id),
    INDEX idx_sent_at (sent_at)
);

CREATE TABLE attendance (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('present', 'absent', 'late')),
    marked_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_attendance (student_id, date),
    INDEX idx_student_id (student_id),
    INDEX idx_date (date)
);

CREATE TABLE report_cards (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id CHAR(36) NOT NULL,
    term VARCHAR(50) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    score INT CHECK (score BETWEEN 0 AND 100),
    teacher_remarks LONGTEXT,
    headteacher_approved BOOLEAN DEFAULT FALSE,
    approved_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_report (student_id, term, subject),
    INDEX idx_student_id (student_id),
    INDEX idx_term (term)
);

CREATE TABLE transactions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    gateway VARCHAR(50) CHECK (gateway IN ('airtel_money', 'tnm_mpamba')),
    phone_number VARCHAR(50) NOT NULL,
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_school_id (school_id),
    INDEX idx_status (status)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES FOR FEE MANAGEMENT & SUBJECT/TEACHER ASSIGNMENT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE subjects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_subject (school_id, subject_name),
    INDEX idx_school_id (school_id)
);

CREATE TABLE classes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    fee_amount DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_class (school_id, class_name),
    INDEX idx_school_id (school_id)
);

-- Class Subjects (which subjects are taught in each class)
CREATE TABLE class_subjects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    class_id CHAR(36) NOT NULL,
    subject_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_class_subject (class_id, subject_id),
    INDEX idx_class_id (class_id),
    INDEX idx_subject_id (subject_id)
);

-- Student Subject Registration (which subjects a student is taking in which class)
CREATE TABLE student_subjects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id CHAR(36) NOT NULL,
    subject_id CHAR(36) NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_subject (student_id, subject_id),
    INDEX idx_student_id (student_id),
    INDEX idx_subject_id (subject_id)
);

-- Teacher Assignment to Class + Subject (so a teacher teaches Form 1 Mathematics, etc)
CREATE TABLE teacher_assignments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id CHAR(36) NOT NULL,
    subject_id CHAR(36) NOT NULL,
    class_id CHAR(36) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_assignment (teacher_id, subject_id, class_id),
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_subject_id (subject_id),
    INDEX idx_class_id (class_id)
);

-- Student Fee Management (per student per term)
CREATE TABLE student_fees (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    student_id CHAR(36) NOT NULL,
    school_id CHAR(36) NOT NULL,
    term VARCHAR(50) NOT NULL,
    fee_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0.00,
    balance DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_fee (student_id, term),
    INDEX idx_student_id (student_id),
    INDEX idx_school_id (school_id),
    INDEX idx_status (status)
);

-- Fee Reminder Settings and Tracking
CREATE TABLE fee_reminders (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    school_id CHAR(36) NOT NULL,
    student_id CHAR(36),
    reminder_type VARCHAR(50) DEFAULT 'automatic' CHECK (reminder_type IN ('automatic', 'manual')),
    message_sent LONGTEXT NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    channel VARCHAR(20) DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    INDEX idx_school_id (school_id),
    INDEX idx_student_id (student_id),
    INDEX idx_sent_at (sent_at),
    INDEX idx_status (status)
);
