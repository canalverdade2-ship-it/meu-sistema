from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: assinatura não encontrada exatamente: {old[:120]}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


admin = 'src/components/admin/AdvertisingAdminModule.tsx'
replace_exact(admin,
    'function RequestCard({ request, busy, onStatus, onProposal, onInvite, hasProposal }: { request: AdvertisingRequest; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean>; hasProposal: boolean }) {',
    'function RequestCard({ request, busy, onStatus, onProposal, onInvite, hasProposal }: { key?: string; request: AdvertisingRequest; busy: boolean; onStatus: (id: string, status: AdvertisingRequestStatus) => Promise<void>; onProposal: (request: AdvertisingRequest) => void; onInvite: (id: string) => Promise<boolean>; hasProposal: boolean }) {')
replace_exact(admin,
    'function ProposalRow({ proposal, request, onEdit, onInvite }: { proposal: AdvertisingProposal; request?: AdvertisingRequest; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void }) {',
    'function ProposalRow({ proposal, request, onEdit, onInvite }: { key?: string; proposal: AdvertisingProposal; request?: AdvertisingRequest; onEdit: (request?: AdvertisingRequest) => void; onInvite: () => void }) {')
replace_exact(admin,
    'function CampaignRow({ campaign }: { campaign: AdvertisingCampaign }) {',
    'function CampaignRow({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {')
replace_exact(admin,
    'function CreativeReviewRow({ campaign, creative, busy, onReview }: { campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (creative: AdvertisingCreative, approved: boolean) => Promise<void> }) {',
    'function CreativeReviewRow({ campaign, creative, busy, onReview }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onReview: (creative: AdvertisingCreative, approved: boolean) => Promise<void> }) {')
replace_exact(admin,
    "function PaymentRow({ campaign, payment, busy, onMark }: { campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (payment: AdvertisingPayment, status: AdvertisingPayment['status']) => Promise<void> }) {",
    "function PaymentRow({ campaign, payment, busy, onMark }: { key?: string; campaign: AdvertisingCampaign; payment: AdvertisingPayment; busy: boolean; onMark: (payment: AdvertisingPayment, status: AdvertisingPayment['status']) => Promise<void> }) {")

portal = 'src/pages/AdvertiserPortal.tsx'
replace_exact(portal,
    'function ProposalCard({ proposal, busy, onAccept, onCounter }: { proposal: AdvertisingProposal; busy: boolean; onAccept: (id: string) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void }) {',
    'function ProposalCard({ proposal, busy, onAccept, onCounter }: { key?: string; proposal: AdvertisingProposal; busy: boolean; onAccept: (id: string) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void }) {')
replace_exact(portal,
    'function CampaignCard({ campaign }: { campaign: AdvertisingCampaign }) {',
    'function CampaignCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {')
replace_exact(portal,
    'function CreativeRow({ campaign, creative, busy, onSubmit }: { campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onSubmit: (creative: AdvertisingCreative) => Promise<void> }) {',
    'function CreativeRow({ campaign, creative, busy, onSubmit }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onSubmit: (creative: AdvertisingCreative) => Promise<void> }) {')
replace_exact(portal,
    'function PaymentCard({ campaign }: { campaign: AdvertisingCampaign }) {',
    'function PaymentCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {')

print('Propriedades JSX especiais corrigidas.')
