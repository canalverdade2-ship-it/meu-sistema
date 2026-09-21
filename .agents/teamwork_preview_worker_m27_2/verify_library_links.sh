docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const versionId = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef';
  const q = await p.query(\`
    select 
      b.id as block_id,
      b.program_id,
      p.name as program_name,
      b.planned_start_offset_s,
      b.planned_duration_s,
      b.media_item_id,
      b.is_reprise,
      b.metadata as block_metadata,
      m.id as media_id,
      m.title as media_title,
      m.drive_path as media_drive_path,
      m.duration_s as media_duration_s,
      m.state as media_state,
      m.approval_state as media_approval_state,
      m.rights_ok as media_rights_ok,
      m.metadata as media_metadata
    from gsa_tv_program_blocks b
    left join gsa_tv_programs p on p.id = b.program_id
    left join gsa_tv_media_items m on m.id = b.media_item_id
    where b.schedule_version_id = \\\$1
      and (b.metadata->>'content_mode' = 'library' or b.is_reprise = true)
    order by b.planned_start_offset_s
  \`, [versionId]);

  console.log('=== VERIFICATION OF ALL LIBRARY BLOCKS ===');
  console.log(\`Total library blocks found: \${q.rows.length}\`);
  
  let allValid = true;
  q.rows.forEach((r, idx) => {
    const valid = r.media_item_id && r.media_id && r.media_state === 'ready' && r.media_approval_state === 'approved' && r.media_rights_ok === true;
    if (!valid) allValid = false;
    console.log(\`\n[\${idx + 1}] Block: \${r.program_name} (ID: \${r.block_id})\`);
    console.log(\`    Start Offset: \${r.planned_start_offset_s}s | Planned Duration: \${r.planned_duration_s}s\`);
    console.log(\`    Media Item ID: \${r.media_item_id}\`);
    console.log(\`    Media Title: \${r.media_title}\`);
    console.log(\`    Drive Path: \${r.media_drive_path}\`);
    console.log(\`    Media Duration: \${r.media_duration_s}s\`);
    console.log(\`    State: \${r.media_state} | Approval: \${r.media_approval_state} | Rights OK: \${r.media_rights_ok}\`);
    console.log(\`    Block Metadata: \${JSON.stringify(r.block_metadata)}\`);
    console.log(\`    Media Metadata: \${JSON.stringify(r.media_metadata)}\`);
    console.log(\`    STATUS: \${valid ? 'PASS (VALID & APPROVED)' : 'FAIL (INCOMPLETE)'}\`);
  });

  console.log('\n========================================');
  console.log(\`OVERALL VERIFICATION: \${allValid ? 'ALL BLOCKS SUCCESSFULLY LINKED AND APPROVED' : 'SOME BLOCKS FAILED'}\`);

  // Also verify count of unlinked blocks in the entire schedule
  const qUnlinked = await p.query(\`
    select count(*) as count
    from gsa_tv_program_blocks
    where schedule_version_id = \\\$1
      and (metadata->>'content_mode' = 'library' or is_reprise = true)
      and media_item_id is null
  \`, [versionId]);
  console.log(\`Unlinked library blocks count: \${qUnlinked.rows[0].count}\`);

  await p.end();
  if (!allValid || parseInt(qUnlinked.rows[0].count) > 0) {
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
"
