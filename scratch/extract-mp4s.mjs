import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\Adriano Farias\\.gemini\\antigravity\\brain\\c6c9049f-c55a-4d14-9335-f1cc78667b6d\\.system_generated\\steps\\4953\\content.md', 'utf8');
const mp4Matches = content.match(/https:\/\/[^"' ]+\.mp4/g) || [];
console.log('Found MP4s:', Array.from(new Set(mp4Matches)).slice(0, 20));
