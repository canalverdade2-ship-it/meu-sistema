import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const password=fs.readFileSync('CREDENCIAIS_SISTEMA_GSA.md','utf8').match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw Error('Database credential unavailable');
const prefix=`export PGPASSWORD=$(printf '%s' '${Buffer.from(password).toString('base64')}' | base64 -d)\n`;
const psql='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1';
const migration=fs.readFileSync('supabase/migrations/20260921203000_marketplace_admin_notifications.sql','utf8');
const tests=`
CREATE TEMP TABLE notification_test_orders(id uuid,cliente_id uuid,origem_gsa_store boolean,codigo_orcamento text);
CREATE TEMP TABLE notification_test_invoices(id uuid,cliente_id uuid,status text,codigo_fatura text);
CREATE TRIGGER test_orders AFTER INSERT ON notification_test_orders FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_marketplace_admin_event('order');
CREATE TRIGGER test_invoices AFTER INSERT OR UPDATE OF status ON notification_test_invoices FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_marketplace_admin_event('invoice');
DO $$ DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); BEGIN
 INSERT INTO notification_test_orders VALUES(a,null,true,'TEST'),(b,null,false,'TEST');
 INSERT INTO notification_test_invoices VALUES(c,null,'pendente','TEST'),(d,null,'pago','TEST');
 UPDATE notification_test_invoices SET status='pago' WHERE id=c;
 UPDATE notification_test_invoices SET status='pago' WHERE id=c;
 UPDATE notification_test_invoices SET status='pendente' WHERE id=c;
 UPDATE notification_test_invoices SET status='pago' WHERE id=c;
 IF (SELECT count(*) FROM public.notificacoes WHERE item_id=a::text AND acao_origem='checkout_loja')<>1 THEN RAISE EXCEPTION 'Order failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.notificacoes WHERE item_id=b::text) THEN RAISE EXCEPTION 'Non store order notified'; END IF;
 IF (SELECT count(*) FROM public.notificacoes WHERE item_id=c::text AND acao_origem='pagamento_confirmado_admin')<>1 THEN RAISE EXCEPTION 'Payment dedup failed'; END IF;
 IF (SELECT count(*) FROM public.notificacoes WHERE item_id=d::text AND acao_origem='pagamento_confirmado_admin')<>1 THEN RAISE EXCEPTION 'Initially paid invoice failed'; END IF;
 RAISE NOTICE 'PASS: purchase, non-store exclusion, settlement, initially-paid, retry dedup';
END $$;
ROLLBACK;
`;
const validation=migration.replace(/NOTIFY pgrst, 'reload schema';\s*COMMIT;/,()=>tests);
async function run(sql){const r=await runSshScript(prefix+`printf '%s' '${Buffer.from(sql).toString('base64')}' | base64 -d | ${psql}`,60000);console.log(r.stdout,r.stderr);}
await run(validation);
if(process.argv.includes('--apply')){
 const backup=await runSshScript(prefix+`umask 077\nmkdir -p /home/opc/backups/notifications-20260921\npg_dump -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub --schema-only > /home/opc/backups/notifications-20260921/schema-before-$(date -u +%H%M%S).sql\ntest $? -eq 0`,60000);
 console.log('Schema backup completed');
 await run(migration);
}
