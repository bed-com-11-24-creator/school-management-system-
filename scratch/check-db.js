import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_DATABASE || 'malawi_sms',
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB");
    const schools = await client.query("SELECT id, name FROM schools;");
    console.log("Schools:", schools.rows);
    const classes = await client.query("SELECT * FROM classes;");
    console.log("Classes:", classes.rows);
    const users = await client.query("SELECT id, email, role, full_name FROM users;");
    console.log("Users:", users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
