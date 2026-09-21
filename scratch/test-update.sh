docker exec -i gsa-tv-control-plane node -e '
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  try {
    const res = await p.query("UPDATE gsa_tv_media_items SET duration_s = $1 WHERE id = $2 RETURNING id, duration_s", [1508.134, "media-ent-desenhos-sabado"]);
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("SQL Error:", err.message);
  } finally {
    await p.end();
  }
}
test();
'
