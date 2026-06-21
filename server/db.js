import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_DATABASE || 'malawi_sms',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle MySQL client:', err);
});

export const query = async (sql, params = []) => {
  const connection = await pool.getConnection();
  try {
    const [rows, fields] = await connection.execute(sql, params);
    const isSelect = Array.isArray(rows);
    return {
      rows: isSelect ? rows : [],
      rowCount: isSelect ? rows.length : rows.affectedRows || 0,
      meta: isSelect ? undefined : rows,
      fields,
    };
  } finally {
    connection.release();
  }
};

export default pool;
