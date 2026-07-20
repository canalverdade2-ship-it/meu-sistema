const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const missingTags = `          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-emerald-600" />
              </div>
`;

const searchStr = `{onboardingStep === 'login' && clientLoginStep === 'create_pin' && (
              </div>`;

if (c.includes(searchStr)) {
  c = c.replace(searchStr, `{onboardingStep === 'login' && clientLoginStep === 'create_pin' && (\n` + missingTags + `              </div>`);
  fs.writeFileSync('src/pages/Home.tsx', c);
  console.log('Fixed create_pin tags');
} else {
  console.log('search string not found');
}
