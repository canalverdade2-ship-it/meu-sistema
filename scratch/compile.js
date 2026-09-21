const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    const res1 = await pool.query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date='2026-09-15' and state='published' order by version desc limit 1");
    const vid = res1.rows[0].id;
    const payload = JSON.stringify({date: '2026-09-15', schedule_version_id: vid, producer: 'rescue'});
    const res2 = await pool.query("insert into gsa_tv_jobs(channel_id,job_type,payload) values('ch-main','compile_playlist',$1::jsonb) returning id", [payload]);
    console.log('Inserted job:', res2.rows[0].id);
    await pool.end();
}
run().catch(console.error);
