const fs = require('fs');

const file = 'src/pages/ClientPortal.tsx';
const content = fs.readFileSync(file, 'utf8');

const targetStr = `      const ticket = await clientOperationalWrite<{ id: string }>(clientId, 'tickets', 'insert', {
        assunto,
        descricao,
        status: 'aberto'
      });
                  <p className="text-xs font-medium tracking-widest text-[#1a1a1a]/40 uppercase">{cliente.codigo_cliente}</p>`;

const newStr = `      const ticket = await clientOperationalWrite<{ id: string }>(clientId, 'tickets', 'insert', {
        assunto,
        descricao,
        status: 'aberto'
      });

      // Notify Client (Feedback)
      await createNotification(
        clientId,
        'Ticket de Suporte Aberto! 💬',
        \`Seu chamado "\${assunto}" foi registrado e nossa equipe retornará em breve.\`,
        'suporte',
        'abertos',
        ticket.id
      );

      // Notify Admin (Alert)
      await createNotification(
        null, // destinatario_tipo = 'admin'
        'Novo Ticket de Suporte (Bloqueio)',
        \`O cliente \${cliente?.nome || clientId} abriu um ticket sobre bloqueio de conta: "\${assunto}"\`,
        'suporte',
        'abertos',
        ticket.id,
        'sistema',
        { prioridade: 'alta' }
      );

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: clientId,
        ator_nome: cliente?.nome,
        acao: 'ABRIR_TICKET',
        detalhes: \`Abriu um ticket de suporte: \${assunto}\`
      });

      navigateClientModule('suporte');
      toast.success('Ticket aberto com sucesso! Prazo de retorno de até 48 horas.');
    } catch (error: any) {
      console.error('Erro ao abrir ticket:', error);
      toast.error('Não foi possível processar sua solicitação no momento. Por favor, tente novamente em instantes ou entre em contato diretamente com nosso suporte.');
    } finally {
      setIsOpeningTicket(false);
    }
  };

  if (!cliente) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f8f7f5]">
        {fetchError ? (
          <div className="text-center">
            <p className="text-red-600 font-medium mb-4">{fetchError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-black"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[#1a1a1a]/60 font-medium">Carregando...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <DashboardLayout
      theme="client"
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      headerTitle={
        <h1 className="text-2xl tracking-tight text-[#1a1a1a] lg:text-3xl">
          {menuItems.find(i => i.id === activeModule)?.label}
        </h1>
      }
      headerContent={
        !isRecoveryRestricted && (
          <UniversalNotificationBell 
            variant="client"
            notifications={notifications}
            unreadCount={unreadNotifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onNavigate={(mod, tab, itemId) => {
              navigateClientModule(mod, tab, itemId);
            }}
          />
        )
      }
      sidebarContent={
        <>
          <div className="flex h-24 items-center justify-between px-8">
            <span className="text-xl tracking-tight text-[#1a1a1a]">Grupo GSA</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-full p-2 hover:bg-black/5 transition-colors lg:hidden">
              <X className="h-5 w-5 text-[#1a1a1a]/60" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div 
              onClick={() => {
                navigateClientModule('perfil');
                setIsMobileMenuOpen(false);
              }}
              className="mb-10 flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 shadow-sm cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-white">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="font-semibold text-[#1a1a1a] whitespace-nowrap leading-tight" style={{ fontSize: clientNameFontSize }} title={clientDisplayName}>{clientDisplayName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs font-medium tracking-widest text-[#1a1a1a]/40 uppercase">{cliente.codigo_cliente}</p>`;

if (content.includes(targetStr)) {
  fs.writeFileSync(file, content.replace(targetStr, newStr), 'utf8');
  console.log('Fixed');
} else {
  console.log('Not found');
}
