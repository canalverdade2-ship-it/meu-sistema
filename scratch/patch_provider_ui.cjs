const fs=require('fs');
function patch(path,mutator){let s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');s=mutator(s);fs.writeFileSync(path,s.replace(/\n/g,'\r\n'),'utf8');}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw new Error(`${label}: ${n}`);return s.replace(a,b);}
patch('src/components/auth/WhatsAppPinVerification.tsx',s=>{
  s=once(s,"import { whatsappNotificationService } from '../../lib/whatsappNotificationService';\n",'', 'remove-wa');
  s=once(s,'  onVerified: (verifiedPhone: string) => void;','  onVerified: (verifiedPhone: string, verificationToken: string) => void;','callback');
  s=once(s,"  const [pin, setPin] = useState(['', '', '', '']);\n  const [timeLeft, setTimeLeft] = useState(60);", "  const [pin, setPin] = useState(['', '', '', '', '', '']);\n  const [timeLeft, setTimeLeft] = useState(300);\n  const [challengeId, setChallengeId] = useState<string | null>(null);",'state');
  return s;
});
console.log('provider verification base patched');