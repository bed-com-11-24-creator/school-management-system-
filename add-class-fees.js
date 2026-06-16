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

async function addFeeColumn() {
  try {
    console.log('Adding fee_amount column to classes table...');
    
    // Add column if it doesn't exist
    const alterQuery = `
      ALTER TABLE classes
      ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(12, 2) DEFAULT 0.00;
    `;
    
    await pool.query(alterQuery);
    console.log('fee_amount column added successfully!');
    
    // Drop existing classes if resetting
    console.log('Clearing existing classes...');
    await pool.query('DELETE FROM classes WHERE school_id IS NOT NULL;');
    
    // Insert Standard 1-8 classes
    console.log('Creating Standard 1-8 classes...');
    const schoolQuery = 'SELECT id FROM schools LIMIT 1;';
    const schoolResult = await pool.query(schoolQuery);
    
    if (schoolResult.rows.length === 0) {
      console.log('No school found. Skipping class creation.');
    } else {
      const schoolId = schoolResult.rows[0].id;
      
      for (let i = 1; i <= 8; i++) {
        const className = `Standard ${i}`;
        const insertQuery = `
          INSERT INTO classes (school_id, class_name, fee_amount)
          VALUES ($1, $2, 0.00)
          ON CONFLICT (school_id, class_name) DO NOTHING;
        `;
        await pool.query(insertQuery, [schoolId, className]);
      }
      console.log('Classes Standard 1-8 created successfully!');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code !== '42701') { // Ignore "column already exists" error
      throw err;
    } else {
      console.log('Column already exists. Skipping.');
    }
  } finally {
    await pool.end();
  }
}

addFeeColumn();
