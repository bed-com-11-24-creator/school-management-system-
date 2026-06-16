import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// database configuration
const config = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

async function init() {
  console.log('Connecting to PostgreSQL to check database existence...');
  // Connect to default 'postgres' database
  const client = new pg.Client({ ...config, database: 'postgres' });
  
  try {
    await client.connect();
    console.log('Connected to default database successfully.');
    
    const dbName = process.env.DB_DATABASE || 'malawi_sms';
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // CREATE DATABASE cannot run in a transaction block
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('Error checking database:', err.message);
    console.log('Please double check database credentials in your .env file.');
    process.exit(1);
  } finally {
    await client.end();
  }
  
  // Connect to target database
  const dbName = process.env.DB_DATABASE || 'malawi_sms';
  const targetClient = new pg.Client({ ...config, database: dbName });
  
  try {
    await targetClient.connect();
    console.log(`Connected to target database "${dbName}" successfully.`);
    
    // Read and run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema.sql to build tables and constraints...');
    await targetClient.query(schemaSql);
    console.log('Tables and unique partial indices created.');
    
    // Seed default school
    console.log('Seeding school information...');
    const schoolRes = await targetClient.query(
      `INSERT INTO schools (name, logo, letterhead, academic_headers, student_count, balance_due, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        'Malawi Heights Academy',
        '',
        'Malawi Heights Academy, P.O. Box 123, Lilongwe, Malawi\nEmail: info@malawiheights.ac.mw | Tel: +265 1 789 456',
        JSON.stringify({ term: 'Term 2', year: '2026', exam_type: 'Terminal Exams' }),
        4, // 4 students seeded initially
        2000.00, // 4 students * K500 = K2000.00 initial invoice
        'UNPAID' // Starts unpaid for demonstration of Lockout Gate
      ]
    );
    const schoolId = schoolRes.rows[0].id;
    console.log(`School seeded: "Malawi Heights Academy" with ID ${schoolId}`);
    
    // Seed users
    console.log('Hashing passwords and seeding default roles...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    
    const users = [
      { email: 'admin@school.mw', password_hash: passwordHash, role: 'admin', full_name: 'Hastings Banda', sex: 'M' },
      { email: 'headteacher@school.mw', password_hash: passwordHash, role: 'headteacher', full_name: 'Dorothy Nkhoma', sex: 'F' },
      { email: 'teacher1@school.mw', password_hash: passwordHash, role: 'teacher', full_name: 'John Phiri', sex: 'M' },
      { email: 'teacher2@school.mw', password_hash: passwordHash, role: 'teacher', full_name: 'Chimwemwe Mwale', sex: 'F' }
    ];
    
    for (const u of users) {
      await targetClient.query(
        `INSERT INTO users (school_id, email, password_hash, role, full_name, sex)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [schoolId, u.email, u.password_hash, u.role, u.full_name, u.sex]
      );
      console.log(`Seeded user: ${u.full_name} (${u.role})`);
    }
    
    // Test constraints
    try {
      console.log('Verifying role constraint: Attempting to insert a duplicate Headteacher account...');
      await targetClient.query(
        `INSERT INTO users (school_id, email, password_hash, role, full_name, sex)
         VALUES ($1, $2, $3, $4, $5, $6)`,
         [schoolId, 'another_head@school.mw', passwordHash, 'headteacher', 'Duplicate Headteacher', 'F']
      );
      console.log('WARNING: Duplicate Headteacher was inserted! Database constraint failed.');
    } catch (err) {
      console.log('SUCCESS: Rigid database-level index successfully blocked duplicate Headteacher:', err.message);
    }
    
    // Seed students
    console.log('Seeding student registry...');
    const students = [
      { name: 'Blessings Mphepo', roll: 'MHA-2026-001', className: 'Standard 1', sex: 'M', disability: null, pName: 'Chikondi Mphepo', pPhone: '+265999123456' },
      { name: 'Tiwonge Kumwenda', roll: 'MHA-2026-002', className: 'Standard 1', sex: 'F', disability: 'Visual (difficulty seeing)', pName: 'Isaac Kumwenda', pPhone: '+265888123456' },
      { name: 'Yamikani Chomba', roll: 'MHA-2026-003', className: 'Standard 2', sex: 'M', disability: null, pName: 'Grace Chomba', pPhone: '+265999789012' },
      { name: 'Limbani Phiri', roll: 'MHA-2026-004', className: 'Standard 2', sex: 'M', disability: 'Physical (difficulty walking)', pName: 'John Phiri', pPhone: '+265999345678' }
    ];
    
    const studentIds = [];
    for (const s of students) {
      const studRes = await targetClient.query(
        `INSERT INTO students (school_id, full_name, roll_number, class_name, sex, disability, parent_name, parent_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [schoolId, s.name, s.roll, s.className, s.sex, s.disability, s.pName, s.pPhone]
      );
      studentIds.push(studRes.rows[0].id);
      console.log(`Seeded student: ${s.name} (${s.className})`);
    }
    
    // Seed Notification Configurations
    console.log('Seeding parent notifications templates...');
    const configs = [
      { type: 'fees_reminder', template: 'Dear {parent_name}, this is a reminder that the school fees balance for {student_name} at {school_name} is K{balance_due}. Please click here to pay: {payment_link}', limit: 14 },
      { type: 'report_card_ready', template: 'Dear {parent_name}, the academic report card for {student_name} ({academic_header}) is ready. Subject grades: {score_details}. View details at: {payment_link}', limit: 0 },
      { type: 'attendance_alert', template: 'Dear {parent_name}, your child {student_name} was marked absent on {date}. Please contact the administration.', limit: 0 }
    ];
    
    for (const c of configs) {
      await targetClient.query(
        `INSERT INTO notifications_config (school_id, template_type, message_template, time_limit_days, is_enabled, channel)
         VALUES ($1, $2, $3, $4, true, 'sms')`,
        [schoolId, c.type, c.template, c.limit]
      );
      console.log(`Seeded notification config for: ${c.type}`);
    }
    
    // Seed report cards scores
    console.log('Seeding sample report cards scores for testing...');
    await targetClient.query(
      `INSERT INTO report_cards (student_id, term, subject, score, teacher_remarks, headteacher_approved)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentIds[0], 'Term 2', 'Mathematics', 45, 'Needs to put in more effort. Keep practicing.', false]
    );
    await targetClient.query(
      `INSERT INTO report_cards (student_id, term, subject, score, teacher_remarks, headteacher_approved)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentIds[1], 'Term 2', 'Mathematics', 88, 'Superb performance! Keep it up.', false]
    );
    await targetClient.query(
      `INSERT INTO report_cards (student_id, term, subject, score, teacher_remarks, headteacher_approved)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentIds[1], 'Term 2', 'English', 72, 'Good expression, can improve vocabulary.', false]
    );
    
    console.log('Database initialization and seeding completed successfully!');
  } catch (err) {
    console.error('Seeding transaction failed:', err);
  } finally {
    await targetClient.end();
  }
}

init();
