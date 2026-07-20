const fs = require('fs');
const file = 'src/components/client/ClientProfile.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add isRecoveryMode state and effect
if (!content.includes('const [isRecoveryMode, setIsRecoveryMode] = useState(false);')) {
  content = content.replace(
    `const [isPinModalOpen, setIsPinModalOpen] = useState(false);`,
    `const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    const s = sessionService.getCurrentSession();
    if (s?.precisa_trocar_senha) {
      setIsRecoveryMode(true);
      setIsPinModalOpen(true);
      setPinStep('new');
    }
  }, []);`
  );
}

// 2. Modify handleChangePin 
const oldCall = `const { data, error } = await supabase.rpc('gsa_change_own_pin', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_current_pin: currentPin,
        p_new_pin: newPin,
      });`;

const newCall = `let rpcName = isRecoveryMode ? 'gsa_update_client_pin' : 'gsa_change_own_pin';
      let rpcParams = isRecoveryMode 
        ? { p_sessao_id: session.sessaoId, p_session_token: session.sessionToken, p_new_pin: newPin }
        : { p_sessao_id: session.sessaoId, p_session_token: session.sessionToken, p_current_pin: currentPin, p_new_pin: newPin };
      const { data, error } = await supabase.rpc(rpcName, rpcParams as any);`;

content = content.replace(oldCall, newCall);

// 3. Modify resetPinModal
content = content.replace(
  `const resetPinModal = () => {
    setCurrentPin('');`,
  `const resetPinModal = () => {
    if (isRecoveryMode) return;
    setCurrentPin('');`
);

// 4. Modify Modal onClose
content = content.replace(
  `<Modal isOpen={isPinModalOpen} onClose={resetPinModal} title={pinStep === 'current' ? 'Senha Atual' : 'Nova Senha'}>`,
  `<Modal isOpen={isPinModalOpen} onClose={isRecoveryMode ? () => {} : resetPinModal} title={isRecoveryMode ? 'Criar Nova Senha' : (pinStep === 'current' ? 'Senha Atual' : 'Nova Senha')}>`
);

// 5. Hide cancel button in recovery mode
content = content.replace(
  `<button onClick={resetPinModal} className="btn-secondary flex-1">Cancelar</button>`,
  `{!isRecoveryMode && <button onClick={resetPinModal} className="btn-secondary flex-1">Cancelar</button>}`
);

// 6. Handle success
content = content.replace(
  `toast.success('Senha alterada com sucesso!');
      resetPinModal();`,
  `toast.success('Senha alterada com sucesso!');
      if (isRecoveryMode) {
        window.location.href = '/cliente/dashboard';
      } else {
        resetPinModal();
      }`
);

fs.writeFileSync(file, content);
console.log('Fixed ClientProfile.tsx');
