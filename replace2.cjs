const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const proRegexes = [
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents:\s*"Génère l'audit financier complet.")/g,
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents:\s*prompt,\s*config:\s*\{\s*systemInstruction:\s*"Tu es un expert en audit)/g,
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents:\s*chatHistory,\s*config:\s*\{\s*systemInstruction,)/g,
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents,\s*config:\s*\{\s*systemInstruction:\s*"You are a highly accurate)/g,
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents:\s*prompt,\s*config:\s*\{\s*systemInstruction:\s*"You are an expert forensic accountant)/g,
  /model:\s*"gemini-3\.5-flash"(\s*,\s*contents:\s*\{\s*parts:\s*\[\s*\{\s*text:\s*prompt\s*\}\s*,\s*\{\s*inlineData:\s*\{\s*data.*?mimeType:\s*"image\/jpeg"\s*\}\s*\}\s*\]\s*\},\s*config:\s*\{\s*systemInstruction:\s*"Tu es un expert en audit fiscal)/g,
];

for(const regex of proRegexes) {
  content = content.replace(regex, 'model: "gemini-3.1-pro-preview"$1');
}

fs.writeFileSync('src/services/geminiService.ts', content);
