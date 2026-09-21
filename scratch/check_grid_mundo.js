const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@gsa-tv-db:5432/gsa_tv' });
client.connect().then(() => {
    return client.query("SELECT program, slot_start, slot_end FROM gsa_tv_grid WHERE date = '2026-09-15' AND program = 'gsa-mundo' ORDER BY slot_start ASC");
}).then(res => {
    console.table(res.rows);
    client.end();
}).catch(err => {
    console.error(err);
    client.end();
});
