from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: assinatura não encontrada exatamente: {old[:100]}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


admin = 'src/components/admin/AdvertisingAdminModule.tsx'
replace_exact(admin,
    '{ request: AdvertisingRequest; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean>; hasProposal: boolean }',
    '{ key?: string; request: AdvertisingRequest; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean>; hasProposal: boolean }')
replace_exact(admin,
    '{ proposal: AdvertisingProposal; request?: AdvertisingRequest; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void }',
    '{ key?: string; proposal: AdvertisingProposal; request?: AdvertisingRequest; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void }')
replace_exact(admin,
    '{ campaign: AdvertisingCampaign }',
    '{ key?: string; campaign: AdvertisingCampaign }')
replace_exact(admin,
    '{ campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (creative: AdvertisingCreative, approved: boolean) => Promise<void> }',
    '{ key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (creative: AdvertisingCreative, approved: boolean) => Promise<void> }')
replace_exact(admin,
    "{ campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (payment: AdvertisingPayment, status: AdvertisingPayment['status']) => Promise<void> }",
    "{ key?: string; campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (payment: AdvertisingPayment, status: AdvertisingPayment['status']) => Promise<void> }")

portal = 'src/pages/AdvertiserPortal.tsx'
replace_exact(portal,
    '{ proposal: AdvertisingProposal; busy: boolean; onAccept: (id: string) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void }',
    '{ key?: string; proposal: AdvertisingProposal; busy: boolean; onAccept: (id: string) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void }')
replace_exact(portal,
    '{ campaign: AdvertisingCampaign }',
    '{ key?: string; campaign: AdvertisingCampaign }')
replace_exact(portal,
    '{ campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onSubmit: (creative: AdvertisingCreative) => Promise<void> }',
    '{ key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onSubmit: (creative: AdvertisingCreative) => Promise<void> }')
replace_exact(portal,
    '{ campaign: AdvertisingCampaign }',
    '{ key?: string; campaign: AdvertisingCampaign }')

print('Propriedades JSX especiais corrigidas.')
