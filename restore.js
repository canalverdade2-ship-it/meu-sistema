import fs from 'fs';
const file = 'src/components/public/GSAEnterpriseHome.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const missing = `  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="mx-auto my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"`.split('\n');

const targetIdx = lines.findIndex(l => l.includes('setIsSubmitting(false);'));

if (targetIdx !== -1 && lines[targetIdx + 2].includes('onClick={(event) => event.stopPropagation()}')) {
    lines.splice(targetIdx + 2, 0, ...missing);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Restored correctly!');
} else {
    console.log('Could not find target, idx:', targetIdx);
}
