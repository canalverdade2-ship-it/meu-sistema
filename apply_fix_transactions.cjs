const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:%40Ad98653200%40@db.ocgajvagxagutfvgxwsy.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase');
    
    const sql = fs.readFileSync(path.join(__dirname, 'fix_database_transactions.sql'), 'utf8');
    
    await client.query(sql);
    console.log('Successfully executed fix_database_transactions.sql');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}
run();
