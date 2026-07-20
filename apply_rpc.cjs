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
    
    const sql = fs.readFileSync(path.join('C:', 'Users', 'Adriano Farias', '.gemini', 'antigravity-ide', 'brain', '19932f5b-a793-4675-ba9b-69c62af8e6fa', 'rpc_cancelar_pedido_loja.sql'), 'utf8');
    
    await client.query(sql);
    console.log('Successfully executed rpc_cancelar_pedido_loja.sql');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}
run();
