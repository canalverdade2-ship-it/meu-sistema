from __future__ import annotations

from pathlib import Path


def replace_exact(path: Path, old: str, new: str, *, required: bool = True) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        if required:
            raise RuntimeError(f"Trecho esperado não encontrado em {path}: {old[:120]!r}")
        return
    path.write_text(text.replace(old, new), encoding="utf-8")


def replace_all(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        return
    path.write_text(text.replace(old, new), encoding="utf-8")


public_page = Path("src/components/public/AdvertisingPage.tsx")
admin_page = Path("src/components/admin/AdvertisingAdminModule.tsx")
portal_page = Path("src/pages/AdvertiserPortal.tsx")

# Página pública: recuperar fundo escuro com luz dourada, divisões sutis e formulário original.
replace_exact(
    public_page,
    'sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur',
    'sticky top-0 z-30 border-b border-white/10 bg-neutral-950/90 backdrop-blur-xl',
)
replace_exact(
    public_page,
    '<section className="border-b border-white/10 px-5 py-20 text-center">',
    '<section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_35%)] px-5 py-20 text-center sm:py-28">',
)
replace_exact(
    public_page,
    '<section className="px-5 py-14">',
    '<section className="border-y border-white/10 bg-white/[0.03] px-5 py-16">',
)
replace_exact(
    public_page,
    '<section className="px-5 pb-10">',
    '<section className="px-5 py-16">',
)
replace_exact(
    public_page,
    '<section id="formulario-anunciante" className="px-5 py-16">',
    '<section id="formulario-anunciante" className="scroll-mt-20 border-t border-white/10 bg-neutral-900 px-5 py-16">',
)
replace_exact(
    public_page,
    'mx-auto max-w-5xl space-y-8 rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-2xl sm:p-10',
    'mx-auto max-w-5xl space-y-8 rounded-[2rem] border border-white/10 bg-neutral-950 p-6 shadow-2xl sm:p-10',
)
replace_all(
    public_page,
    'rounded-xl border border-white/10 bg-neutral-950 px-4 py-3',
    'rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300',
)
replace_all(
    public_page,
    'rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-neutral-950',
    'rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-amber-300',
)

# Administrativo: recuperar bordas, cartões claros, sombras e foco dourado da versão anterior.
replace_exact(
    admin_page,
    'rounded-3xl border border-white/10 bg-white p-10 text-center text-sm font-bold text-neutral-500',
    'rounded-3xl border border-neutral-200 bg-white p-10 text-center text-sm font-bold text-neutral-500',
)
replace_exact(
    admin_page,
    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold',
    'flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50',
)
replace_all(
    admin_page,
    'rounded-2xl border bg-white p-4',
    'rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm',
)
replace_exact(
    admin_page,
    'flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2',
    'flex gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-2',
)
replace_exact(
    admin_page,
    'w-full rounded-xl border bg-white py-2.5 pl-10 pr-4',
    'w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 outline-none focus:border-amber-400',
)
replace_all(
    admin_page,
    'rounded-2xl border bg-white p-5',
    'rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm',
)
replace_all(
    admin_page,
    'rounded-xl border px-3 py-2',
    'rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-amber-400',
)
replace_exact(
    admin_page,
    'rounded-2xl border border-dashed bg-white p-10 text-center text-sm font-bold text-neutral-400',
    'rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm font-bold text-neutral-400',
)
replace_exact(
    admin_page,
    'mt-1 w-full rounded-xl border px-3 py-2 font-normal',
    'mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-normal outline-none focus:border-amber-400',
)

# Portal: restaurar cabeçalho claro, menu lateral escuro e detalhes dourados originais.
replace_exact(
    portal_page,
    '<main className="flex min-h-screen items-center justify-center bg-neutral-950 p-5 text-white">',
    '<main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10 text-white sm:py-16">',
)
replace_exact(
    portal_page,
    'w-full max-w-xl rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-2xl sm:p-10',
    'w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-10',
)
replace_exact(
    portal_page,
    'rounded-2xl bg-amber-400 p-3 text-neutral-950',
    'flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20',
)
replace_exact(
    portal_page,
    'mb-6 grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1',
    'mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-black/40 p-1.5',
)
replace_all(
    portal_page,
    "? 'bg-amber-400 text-neutral-950' : 'text-white/60'",
    "? 'bg-amber-400 text-neutral-950 shadow-md' : 'text-white/60 hover:text-white'",
)
replace_exact(
    portal_page,
    '<main className="min-h-screen bg-neutral-100 text-neutral-950">',
    '<main className="min-h-screen bg-neutral-100 text-neutral-900">',
)
old_header = '<header className="border-b bg-neutral-950 px-5 py-4 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between"><div className="flex items-center gap-3"><Megaphone className="h-6 w-6 text-amber-300" /><div><h1 className="font-black">Portal do Anunciante</h1><p className="text-xs text-white/50">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div></div><div className="flex gap-2"><button onClick={() => void load(true)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${refreshing ? \'animate-spin\' : \'\'}`} /></button><button onClick={() => void logout()} className="flex items-center gap-1 rounded-lg p-2 text-sm font-bold hover:bg-white/10"><LogOut className="h-4 w-4" />Sair</button></div></div></header>'
new_header = '<header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">GSA Anúncios</p><p className="truncate font-black">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div><div className="flex items-center gap-2"><button onClick={() => void load(true)} className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${refreshing ? \'animate-spin\' : \'\'}`} /></button><button onClick={() => void logout()} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"><LogOut className="h-4 w-4" />Sair</button></div></div></header>'
replace_exact(portal_page, old_header, new_header)
replace_exact(
    portal_page,
    'mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[240px_1fr]',
    'mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]',
)
replace_exact(
    portal_page,
    '<aside className="h-fit rounded-2xl border bg-white p-2">',
    '<aside className="h-fit rounded-2xl bg-neutral-950 p-3 text-white lg:sticky lg:top-22">',
)
replace_all(
    portal_page,
    "tab === id ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'",
    "tab === id ? 'bg-white text-neutral-950' : 'text-white/55 hover:bg-white/5 hover:text-white'",
)
replace_exact(
    portal_page,
    'rounded-2xl border bg-white p-5 shadow-sm',
    'rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm',
)
replace_exact(
    portal_page,
    'rounded-2xl border border-dashed bg-white p-10 text-center text-sm font-bold text-neutral-400',
    'rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm font-bold text-neutral-400',
)
replace_all(
    portal_page,
    "${dark ? 'border-white/10 bg-neutral-950 text-white' : 'bg-white'}",
    "${dark ? 'border-white/10 bg-neutral-950 text-white focus:border-amber-400' : 'border-neutral-200 bg-white focus:border-amber-400'}",
)

print("Identidade visual original do GSA Anúncios restaurada sem alterar a lógica operacional.")
