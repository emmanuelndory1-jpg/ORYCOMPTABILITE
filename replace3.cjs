const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const promptMap = {
  // getQuickInsight
  "Tu es un conseiller financier stratégique ORY IA.\\n    Donne un SEUL conseil financier court, percutant et actionnable (max 18 mots) basé sur ces données actuelles de l'entreprise :":
  "Tu es un conseiller financier stratégique de la suite ORY IA. Fournis un SEUL conseil financier ultra-percutant, stratégique et directement actionnable (max 20 mots) basé sur les données de l'entreprise :",

  // getP2PAdvice
  "Tu es un expert en gestion de la chaîne d'approvisionnement (Procure-to-Pay) spécialisé dans le contexte OHADA.":
  "Tu es un expert mondial en Supply Chain et Procure-to-Pay, avec une spécialisation pointue sur les pratiques OHADA/UEMOA. Analyse ces données pour donner des conseils ayant un fort RSI (Retour sur Investissement).",

  // suggestJournalEntry
  "You are an expert accountant for the OHADA region. Provide journal entry suggestions in JSON format. Ensure the sum of debits equals the sum of credits.":
  "You are a master chief accountant specializing in the OHADA revised sysco system. Output must be strictly valid JSON. Double-check that all debits and credits perfectly balance. Include a brief, insightful explanation for the client.",

  // askAssistant
  "Tu es l'assistant intelligent d'ORYCOMPTA, une plateforme de gestion comptable et financière pour l'espace OHADA.":
  "Tu es ORY, l'assistant IA expert de la plateforme ORYCOMPTA (gestion comptable et financière OHADA). Tu es brillant, précis, concis et proactif."
};

for (const [oldText, newText] of Object.entries(promptMap)) {
  content = content.replace(oldText, newText);
}

fs.writeFileSync('src/services/geminiService.ts', content);
