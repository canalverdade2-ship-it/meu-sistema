const fs = require('fs');
const file = 'src/pages/ClientPortal.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file got slightly broken:
// It looks like this now:
/*
  const [modalIndicacaoConfig, setModalIndicacaoConfig] = useState({
    ativo: true,
    titulo: 'Você foi indicado!',
  }, []);
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);
*/

const oldContent = `  const [modalIndicacaoConfig, setModalIndicacaoConfig] = useState({
    ativo: true,
    titulo: 'Você foi indicado!',
  }, []);
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);`;

const newContent = `  const [modalIndicacaoConfig, setModalIndicacaoConfig] = useState({
    ativo: true,
    titulo: 'Você foi indicado!',
    descricao: 'Para validar a segunda etapa da sua indicação e garantir seu bônus, siga estes passos:',
    acaoBotao: 'url',
    moduloDestino: 'orcamentos',
    urlBotao: 'https://getsemani-gsa.netlify.app/',
    textoBotao: 'Solicitar Serviços',
    tamanho: 'md'
  });
  const [isOpeningTicket, setIsOpeningTicket] = useState(false);`;

if (content.includes(oldContent)) {
  fs.writeFileSync(file, content.replace(oldContent, newContent));
  console.log('Fixed syntax error in ClientPortal.tsx');
} else {
  console.log('Target string not found');
}
