import fs from 'node:fs';
const p='C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/supabase/migrations/20260829211500_marketplace_security_refund_checkout_hardening.sql';
let s=fs.readFileSync(p,'utf8');
const reps=[
['"Acesso total loja_reembolsos"','"Acesso total para public"'],
['"Acesso total carteira_lancamentos"','"Acesso total"'],
['"Acesso total produtos"','"Acesso total"'],
['"Allow anon all produtos"','"Allow anon all on produtos"'],
['"Acesso total orcamentos"','"Acesso total"'],
['"Acesso total ordens_compra"','"Acesso total"'],
['"Acesso total cupons_loja"','"Acesso total para cupons"'],
['"Ativacoes podem ser deletadas"','"cliente_delete_cupons_ativados"'],
['"Ativacoes podem ser inseridas"','"cliente_insert_cupons_ativados"'],
];for(const [a,b] of reps){
  if(!s.includes(a)) throw new Error(`missing ${a}`);
  s=s.replace(a,b);
}
const joined='TO anon,authenticated;GRANT EXECUTE ON FUNCTION public.gsa_admin_process_store_refund';
if(s.includes(joined)) s=s.replace(joined,'TO anon,authenticated;\nGRANT EXECUTE ON FUNCTION public.gsa_admin_process_store_refund');
fs.writeFileSync(p,s,'utf8');
console.log('LOCAL_POLICY_NAMES_OK');