python3 -c "
path = '/opt/gsa-tv/control-plane/src/gemini.js'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

target = '''async function generateText({ apiKey, model, prompt, instructions, webSearch = false, temperature = null, thinkingBudget = null, maxOutputTokens = 6000 }) {
  const preferred = model || 'gemini-flash-latest';
  const models = [
    preferred,
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash'
  ].filter((m, i, arr) => arr.indexOf(m) === i);'''

replacement = '''async function generateText({ apiKey, model, prompt, instructions, webSearch = false, temperature = null, thinkingBudget = null, maxOutputTokens = 6000 }) {
  const preferred = model || 'gemini-3.1-flash-lite';
  const models = [
    preferred,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash'
  ].filter((m, i, arr) => arr.indexOf(m) === i);'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf8') as f:
        f.write(content)
    print('gemini.js successfully patched')
else:
    print('Target not found or already patched')
"
