const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' });
async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM public.loja_carrinhos');
  console.log('Cart Items:', res.rows);
  const pol = await client.query('SELECT * FROM pg_policies WHERE tablename=\'loja_carrinhos\'');
  console.log('Policies:', pol.rows);
  await client.end();
}
run().catch(console.error);
