import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE || 'malawi_sms'
});

async function addTable() {
  try {
    console.log('Creating class_subjects table...');
    
    const query = `
      CREATE TABLE IF NOT EXISTS class_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (class_id, subject_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
      CREATE INDEX IF NOT EXISTS idx_class_subjects_subject ON class_subjects(subject_id);
    `;
    
    await pool.query(query);
    console.log('class_subjects table created successfully!');
  } catch (err) {
    console.error('Error creating table:', err.message);
    if (err.code === '42P07') {
      console.log('Table already exists.');
    }
  } finally {
    await pool.end();
  }
}

addTable();
