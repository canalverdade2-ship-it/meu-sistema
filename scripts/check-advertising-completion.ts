import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function includesAll(path: string, values: string[]) {
  const content = read(path);
  for (const value of values) assert.ok(content.includes(value), `${path} deve conter ${value}`);
}

includesAll('supabase/migrations/20260721223000_complete_advertising_platform.sql', [
  'gsa_ad_payments',
  'gsa_ad_payment_events',
  'gsa_ad_delivery_events',
  'gsa_current_advertiser_id',
  'gsa_admin_create_ad_proposal',
  'gsa_advertiser_portal_snapshot',
  'gsa_advertiser_counter_proposal',
  'gsa_advertiser_accept_proposal',
  'gsa_advertiser_save_creative',
  'gsa_admin_review_ad_creative',
  'gsa_ads_process_payment_event',
  'gsa_ads_serve',
  'gsa_ads_record_event',
  "bucket_id = 'gsa-ad-creatives'",
  'GRANT EXECUTE ON FUNCTION public.gsa_ads_serve',
]);

includesAll('supabase/migrations/20260722090000_harden_ad_delivery_atomicity.sql', [
  'pg_advisory_xact_lock',
  "hashtextextended('gsa_ads_serve:global', 0)",
  'REVOKE ALL ON FUNCTION public.gsa_ads_serve',
  'GRANT EXECUTE ON FUNCTION public.gsa_ads_serve',
]);

includesAll('supabase/migrations/20260722090100_cleanup_orphan_ad_creatives.sql', [
  'gsa_ads_list_orphan_creative_paths',
  "object_row.bucket_id = 'gsa-ad-creatives'",
  "object_row.created_at < now() - interval '1 hour'",
  'GRANT EXECUTE ON FUNCTION public.gsa_ads_list_orphan_creative_paths() TO service_role',
]);

includesAll('src/pages/AdvertiserPortal.tsx', [
  'requestMagicLink',
  'gsa_advertiser_accept_proposal',
  'gsa_advertiser_counter_proposal',
  "from('gsa-ad-creatives').upload",
  'gsa_advertiser_save_creative',
  'gsa_advertiser_submit_creative',
  'Relatórios',
]);

includesAll('src/components/admin/AdvertisingAdminModule.tsx', [
  'gsa_admin_advertising_overview',
  'gsa_admin_create_ad_proposal',
  "'gsa-advertiser-admin'",
  'gsa_admin_review_ad_creative',
  'gsa_admin_mark_ad_payment',
]);

includesAll('src/components/ads/AdvertisingSlot.tsx', [
  "'gsa-ad-delivery'",
  "action: 'serve'",
  "action: 'event'",
  "record('viewable')",
  'rel="sponsored noopener noreferrer"',
]);

includesAll('supabase/functions/gsa-ad-delivery/index.ts', [
  'MAX_BODY_BYTES',
  'AD_DELIVERY_HASH_SALT',
  'gsa_auth_rate_limit_check',
  "`ads:delivery:${action || 'unknown'}:ip:${ipHash}`",
  '`ads:delivery:viewer:${viewerHash}`',
  'too_many_attempts',
  'gsa_ads_serve',
  'gsa_ads_record_event',
  "createSignedUrl(data.ad.storage_path, 300)",
]);

includesAll('supabase/functions/gsa-advertiser-admin/index.ts', [
  'inviteUserByEmail',
  'gsa_admin_get_advertiser_invite_target',
  'gsa_admin_link_advertiser_auth',
]);

includesAll('supabase/functions/gsa-advertising-webhook/index.ts', [
  'ADVERTISING_WEBHOOK_SECRET',
  "request.headers.get('x-gsa-signature')",
  'gsa_ads_process_payment_event',
  'safeEqual',
]);

includesAll('supabase/functions/gsa-advertising-scheduler/index.ts', [
  'ADVERTISING_CRON_SECRET',
  'safeEqual',
  'gsa_ads_refresh_campaign_states',
  'gsa_ads_list_orphan_creative_paths',
  "from('gsa-ad-creatives').remove(orphanPaths)",
]);

console.log('ADVERTISING_COMPLETION_CONTRACTS_OK');
