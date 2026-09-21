import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
async function run() {
  await client.connect();
  const res = await client.query("SELECT id FROM gsa_tv_media_items WHERE id='media-auto-27566c4e-2955-4d55-a972-c4b39c971ed6'");
  console.log(res.rows);
  await client.end();
}
run();
