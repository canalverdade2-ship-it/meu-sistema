const { Client } = require('pg');
const connectionString = process.env.GSA_TV_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Configure GSA_TV_DATABASE_URL ou DATABASE_URL fora do repositório.');
}
const client = new Client({ connectionString });
client.connect().then(() => {
    return client.query("SELECT program, slot_start, slot_end FROM gsa_tv_grid WHERE date = '2026-09-15' ORDER BY slot_start ASC");
}).then(res => {
    console.table(res.rows);
    client.end();
}).catch(err => {
    console.error(err);
    client.end();
});
