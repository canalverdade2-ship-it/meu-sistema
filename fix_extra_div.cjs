const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const searchStr = `<ShieldAlert className="w-8 h-8 text-emerald-600" />
              </div>
              </div>`;
const replaceStr = `<ShieldAlert className="w-8 h-8 text-emerald-600" />
              </div>`;

if (c.includes(searchStr)) {
  c = c.replace(searchStr, replaceStr);
  fs.writeFileSync('src/pages/Home.tsx', c);
  console.log('Removed extra div');
} else {
  console.log('Extra div not found');
}
