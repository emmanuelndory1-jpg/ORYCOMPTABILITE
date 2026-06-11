import { parseSafeJSON } from "@/lib/utils";
import { Modality, Type } from "@google/genai";
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { apiFetch } from '../lib/api';

const ai = {
  models: {
    generateContent: async (req: any) => {
      const response = await apiFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      
      let contentType = response.headers.get('content-type');
      let isJson = contentType && contentType.includes('application/json');
      
      if (!response.ok) {
        if (isJson) {
           const errData = await response.json().catch(() => null);
           throw new Error(errData?.error || 'HTTP ' + response.status + ': ' + (errData?.message || 'Unknown error'));
        }
        throw new Error([429, 503].includes(response.status) ? String(response.status) : 'HTTP ' + response.status);
      }
      
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error("Invalid non-JSON response from server: " + text.substring(0, 50));
      }
    }
  }
};

/**
 * Global lock to ensure a minimum interval between requests and handle queuing.
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second minimum gap between requests

/**
 * Helper to wrap AI requests with exponential backoff and retry logic for 429 errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      
      lastRequestTime = Date.now();
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorString = error?.message || String(error);
      const isDailyQuota = errorString.includes('GenerateRequestsPerDay');
      const isRateLimit = errorString.includes('429') || 
                         errorString.includes('503') ||
                         errorString.includes('UNAVAILABLE') ||
                         errorString.includes('RESOURCE_EXHAUSTED') ||
                         errorString.includes('quota');

      if (isRateLimit && !isDailyQuota && attempt < maxRetries) {
        let delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        
        // Try to parse the suggested retry delay from the error message
        const retryMatch = errorString.match(/retry in\s+([\d.]+)s/i);
        if (retryMatch && retryMatch[1]) {
           const suggestedDelay = parseFloat(retryMatch[1]) * 1000;
           delay = Math.max(delay, suggestedDelay + 1000); // Take the max, add 1s buffer
        }
        
        console.warn(`Gemini rate limited or unavailable. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we're out of retries or it's a hard limit, throw a descriptive error
      if (isRateLimit || isDailyQuota) {
        throw new Error(isDailyQuota ? "Quota d'utilisation IA de base atteint pour aujourd'hui. Veuillez revenir demain." : "L'IA est actuellement surchargée ou en cours de refroidissement (trop de requêtes). Veuillez patienter un instant avant de réessayer.");
      }
      throw error;
    }
  }
  throw lastError;
}

export interface AISuggestion {
  entries: {
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
  explanation: string;
  confidence: number;
}

export interface InvoiceAnalysis {
  date: string;
  description: string;
  third_party: string;
  third_party_id?: string; // NIF, IFU, NINEA, RCCM
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  vat_rate: number;
  operation_type: string;
  invoice_number?: string;
  currency?: string;
  confidence?: number;
  items?: {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    account_suggestion?: string;
  }[];
  tax_details?: {
    label: string;
    amount: number;
  }[];
  compliance_score?: number;
  entries: {
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
}

export interface NaturalLanguageEntry {
  amount: number;
  operationType: string;
  thirdPartyName: string | null;
  paymentMode: 'caisse' | 'banque' | 'mobile_money' | 'credit';
  description: string;
  date?: string;
  currency?: string;
}

export const parseNaturalLanguageEntry = async (text: string): Promise<NaturalLanguageEntry | null> => {
  try {
    const prompt = `
      Analysez le texte suivant qui décrit une opération comptable et extrayez les informations structurées.
      Texte : "${text}"
      Date actuelle : ${new Date().toISOString().split('T')[0]}
      
      Instructions :
      - Identifiez le montant, le tiers, le mode de paiement et la nature de l'opération.
      - Si une date est mentionnée (ex: 'hier', 'le 12'), convertissez-la en YYYY-MM-DD. Sinon, utilisez la date actuelle.
      - Associez l'opération au type le plus proche parmis la liste autorisée : achat_marchandises, achat_services, frais_generaux, vente_marchandises, vente_services, paiement_fournisseur, encaissement_client, virement_interne, depot_especes, retrait_especes, frais_bancaires, paiement_impots, salaire, loyer, remboursement_emprunt.
    `;
    
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            operationType: { 
              type: Type.STRING,
              description: "Une valeur parmi: achat_marchandises, achat_services, frais_generaux, vente_marchandises, vente_services, paiement_fournisseur, encaissement_client, virement_interne, depot_especes, retrait_especes, frais_bancaires, paiement_impots, salaire, loyer, remboursement_emprunt"
            },
            thirdPartyName: { type: Type.STRING, nullable: true },
            paymentMode: { 
              type: Type.STRING, 
              enum: ['caisse', 'banque', 'mobile_money', 'credit'],
              description: "Par défaut: caisse"
            },
            description: { type: Type.STRING, description: "Reformulation professionnelle" },
            date: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
            currency: { type: Type.STRING, description: "Code devise ISO (ex: XOF, EUR, USD)" }
          },
          required: ["amount", "operationType", "paymentMode", "description"]
        }
      }
    }));

    const result = response.text;
    if (result) {
      return parseSafeJSON(result) as NaturalLanguageEntry;
    }
  } catch(e) {
    console.error("Error in parseNaturalLanguageEntry:", e);
  }
  return null;
}

export const analyzeInvoice = async (
  imageBase64: string,
  scanType: 'vente' | 'achat',
  vatSettings: any[],
  mimeType: string = "image/jpeg"
): Promise<InvoiceAnalysis | null> => {
  try {
    const vatContext = vatSettings.length > 0 
      ? `\nParamètres de TVA configurés (utilise ces comptes si la TVA correspond à l'un de ces taux) :\n` + 
        vatSettings.map(s => `- Taux: ${s.rate}%, Compte Collectée: ${s.account_collected}, Compte Déductible: ${s.account_deductible}`).join('\n')
      : `\nUtilise les comptes de TVA standard SYSCOHADA (4431 pour la TVA facturée, 4452 pour la TVA récupérable).`;

    const typeContext = scanType === 'vente' 
      ? "Il s'agit d'une VENTE (Facture émise par nous). Le tiers est donc notre CLIENT."
      : "Il s'agit d'un ACHAT (Facture reçue d'un fournisseur). Le tiers est donc le FOURNISSEUR.";

    const prompt = `
      Analyse cette facture ou reçu dans le contexte de l'espace OHADA (UEMOA/CEMAC). ${typeContext}
      Ta priorité absolue est l'exactitude des informations extraites malgré la présence possible de tampons, signatures ou logos.
      
      CONSIGNES GÉOGRAPHIQUES (AFRIQUE DE L'OUEST ET CENTRALE) :
      - Identifiants : Recherche activement les mentions RCCM, IFU, NINEA, NIF ou Agrément. Extraits-les fidèlement.
      - Taxes : Identifie précisément la TVA (18% au Sénégal/Burkina, 19.25% au Cameroun, etc.). 
      - Timbres : Identifie les Timbres Fiscaux (souvent 100, 200, 500, 1000 FCFA), les Précomptes ou Acomptes BIC/AIR.
      - Tiers : Détermine si c'est une grande entreprise (Senelec, Orange, CEET...) ou un commerçant local.
      - Devises : Par défaut XOF (CFA) sauf mention contraire explicite (EUR, USD, GNF, CDF).
      
      CONSIGNES COMPTABLES SYSCOHADA RÉVISÉ :
      - Charges : Utilise les comptes de classe 6 (601: Marchandises, 602: Fournitures, 604: Matériel, 605: Électricité, 61: Transport, 62: Services extérieurs, 63: Frais divers).
      - Produits : Utilise les comptes de classe 7 (701: Vente marchandises, 706: Services).
      - TVA : 4452 (Récupérable sur achats) ou 4431 (Facturée sur ventes).
      - Tiers : 4011 (Fournisseurs) ou 4111 (Clients).
      
      DÉTAILLAGE EXTRÊME :
      - Items : Extrais CHAQUE ligne de la facture individuellement. Ne regroupe pas si possible.
      - Account_suggestion : Pour chaque article, propose un compte SYSCOHADA à 6 chiffres ultra-précis.
      - Conformité : Évalue si le document est une facture "normale" (NIF présent, TVA distincte) ou un simple reçu informel.
      
      Extrais les informations suivantes au format JSON :
      - date (YYYY-MM-DD)
      - description (Libellé professionnel de l'opération)
      - third_party (Nom complet du tiers)
      - third_party_id (Identifiant fiscal type NIF/IFU/RCCM/NINEA)
      - amount_ht (Montant Hors Taxes global)
      - amount_tva (Montant de la TVA globale)
      - amount_ttc (Montant TOTAL Net à Payer)
      - vat_rate (Taux de TVA appliqué, ex: 18)
      - invoice_number (Numéro de facture ou référence)
      - currency (Code ISO ex: XOF)
      - items (Tableau : description, quantity, unit_price, total, account_suggestion)
      - tax_details (Tableau des autres taxes comme timbre fiscal : label, amount)
      - compliance_score (0-100 basés sur : presence NIF, date, montants clairs, detail TVA)
      - operation_type (STRICTEMENT : 'achat_marchandises', 'achat_services', 'vente_marchandises', 'vente_services', 'frais_generaux')
      - entries: Écritures SYSCOHADA complètes, balancées à 6 chiffres.
      - confidence: Score 0-100.
      
      ${vatContext}
      
      IMPORTANT : Ignore les mentions manuscrites 'PAYÉ' ou les tampons circulaires qui cachent le texte si possible.
      Réponds UNIQUEMENT avec le JSON.
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType } }
        ]
      },
      config: {
        systemInstruction: "Tu es un moteur OCR de pointe spécialisé dans les documents financiers africains (UEMOA, CEMAC, OHADA). Tu sais faire abstraction des tampons 'PAYÉ', des logos et des signatures manuscrites pour extraire les données comptables brutes avec une précision de 100%.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            third_party: { type: Type.STRING },
            third_party_id: { type: Type.STRING },
            amount_ht: { type: Type.NUMBER },
            amount_tva: { type: Type.NUMBER },
            amount_ttc: { type: Type.NUMBER },
            vat_rate: { type: Type.NUMBER },
            invoice_number: { type: Type.STRING },
            currency: { type: Type.STRING },
            compliance_score: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER },
                  total: { type: Type.NUMBER },
                  account_suggestion: { type: Type.STRING }
                }
              }
            },
            tax_details: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  amount: { type: Type.NUMBER }
                }
              }
            },
            operation_type: { type: Type.STRING },
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  account_code: { type: Type.STRING },
                  debit: { type: Type.NUMBER },
                  credit: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["account_code", "debit", "credit", "description"]
              }
            }
          },
          required: ["date", "description", "third_party", "amount_ht", "amount_tva", "amount_ttc", "vat_rate", "operation_type", "entries"]
        }
      }
    }));

    if (response.text) {
      return parseSafeJSON(response.text);
    }

    return null;
  } catch (error) {
    console.error("Error analyzing invoice:", error);
    return null;
  }
};

export const logOcrFeedback = async (
  imageBase64: string,
  aiPrediction: InvoiceAnalysis,
  userCorrection: InvoiceAnalysis,
  region: string = 'UEMOA'
) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Generate a quick hash of the image to identify duplicates in training data
    const msgUint8 = new TextEncoder().encode(imageBase64.slice(-2000)); // Use last 2000 chars for speed + uniqueness
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const path = 'ocr_feedback';
    await addDoc(collection(db, path), {
      userId,
      imageHash,
      aiPrediction,
      userCorrection,
      region,
      timestamp: new Date().toISOString()
    });

    console.log("OCR Feedback logged successfully for training improvement.");
  } catch (error) {
    console.error("Error logging OCR feedback:", error);
    // Don't throw here to not block the user flow
  }
};

export const suggestJournalEntry = async (
  description: string, 
  amount: number, 
  accounts: any[], 
  operationType: string,
  paymentMode: string,
  thirdParty?: any,
  vatRate?: number,
  occasionalName?: string
): Promise<AISuggestion | null> => {
  try {
    const prompt = `
      Suggérez une écriture comptable pour l'opération suivante dans le cadre du système SYSCOHADA :
      - Description : "${description}"
      - Montant Hors Taxe (HT) : ${amount}
      - Type d'opération : ${operationType}
      - Mode de règlement : ${paymentMode}
      ${thirdParty ? `- Tiers : ${thirdParty.name} (Compte : ${thirdParty.account_code}, Occasionnel : ${thirdParty.is_occasional ? 'Oui' : 'Non'})` : ''}
      ${occasionalName ? `- Nom du tiers occasionnel : ${occasionalName}` : ''}
      ${vatRate ? `- Taux de TVA : ${vatRate}%` : ''}

      Comptes disponibles (utilisez prioritairement ces codes s'ils correspondent, sinon suggérez les codes OHADA standards à 3 chiffres minimum) :
      ${JSON.stringify(accounts.map(a => ({ code: a.code, name: a.name })))}

      Règles SYSCOHADA et comptables à respecter :
      1. Pour un achat (charge) : Débiter le compte de charge (6x), Débiter la TVA déductible (445) si applicable, Créditer le compte de tiers (401) ou de trésorerie (5x).
      2. Pour une vente (produit) : Créditer le compte de produit (7x), Créditer la TVA collectée (443) si applicable, Débiter le compte de tiers (411) ou de trésorerie (5x).
      3. Si un tiers est fourni, utilisez son compte (${thirdParty?.account_code || '401/411'}).
      4. Si le mode de règlement est immédiat (Banque/Caisse), l'écriture peut être directe ou passer par le compte de tiers puis règlement.
      5. Assurez-vous que le total Débit = total Crédit.
      6. Calculez le montant TTC si une TVA est fournie (TTC = HT * (1 + TVA/100)).
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a master chief accountant specializing in the OHADA revised sysco system. Output must be strictly valid JSON. Double-check that all debits and credits perfectly balance. Include a brief, insightful explanation for the client.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  account_code: { type: Type.STRING },
                  debit: { type: Type.NUMBER },
                  credit: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["account_code", "debit", "credit", "description"]
              }
            },
            explanation: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["entries", "explanation", "confidence"]
        }
      }
    }));

    if (response.text) {
      return parseSafeJSON(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error suggesting journal entry:", error);
    return null;
  }
};

export const suggestCorrection = async (
  transaction: any,
  issue: any,
  accounts: any[]
): Promise<AISuggestion | null> => {
  try {
    const prompt = `
      Corrigez l'écriture comptable suivante qui présente une anomalie selon les normes SYSCOHADA :
      
      Anomalie détectée :
      - Type : ${issue.type}
      - Message : "${issue.message}"
      - Détails : "${issue.details}"
      
      Transaction actuelle :
      - Description : "${transaction.description}"
      - Date : ${transaction.date}
      - Référence : ${transaction.reference}
      - Écritures actuelles : ${JSON.stringify(transaction.entries)}
      
      Comptes disponibles :
      ${JSON.stringify(accounts.slice(0, 100).map(a => ({ code: a.code, name: a.name })))}
      
      Instructions :
      1. Si l'écriture est déséquilibrée, ajustez les montants ou ajoutez une ligne pour équilibrer.
      2. Si un compte est invalide, remplacez-le par le code SYSCOHADA correct le plus proche.
      3. Si des données manquent, suggérez des valeurs cohérentes basées sur la description.
      4. Assurez-vous que le total Débit = total Crédit.
      5. Fournissez l'écriture complète corrigée.
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert forensic accountant for the OHADA region. Provide corrected journal entries in JSON format. Ensure the sum of debits equals the sum of credits.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  account_code: { type: Type.STRING },
                  debit: { type: Type.NUMBER },
                  credit: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["account_code", "debit", "credit", "description"]
              }
            },
            explanation: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ["entries", "explanation", "confidence"]
        }
      }
    }));

    if (response.text) {
      return parseSafeJSON(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error suggesting correction:", error);
    return null;
  }
};

export const getQuickInsight = async (data: any) => {
  try {
    const systemPrompt = `Tu es un conseiller financier stratégique ORY IA.
    Donne un SEUL conseil financier court, percutant et actionnable (max 18 mots) basé sur ces données actuelles de l'entreprise :
    ${JSON.stringify(data)}
    
    CONSIGNES :
    - Sois très spécifique. Si tu vois un risque de trésorerie, mentionne-le.
    - Si la rentabilité est forte, suggère un investissement ou une réserve.
    - Utilise un ton professionnel et stratégique.
    - Réponds en Français.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
    }));

    return response.text.trim();
  } catch (error: any) {
    console.warn("AI Insight temporairement indisponible:", error.message);
    return "Optimisez vos flux de trésorerie en suivant vos créances de près.";
  }
};

export const generateComprehensiveDashboardReport = async (dashboardData: any) => {
  try {
    const systemPrompt = `Tu es ORY, l'analyste financier en chef (Directeur Financier Virtuel).
    Génère un rapport d'analyse exécutif exhaustif et percutant basé sur toutes les données du tableau de bord d'entreprise fournies.
    
    DONNÉES DU TABLEAU DE BORD :
    ${JSON.stringify(dashboardData)}
    
    CONSIGNES :
    - Structure ton rapport en Markdown clair et très élégant (titres, puces, texte en gras).
    - Divise en 4 sections : 
      1. Synthèse Executive (Le constat général, 2 lignes max)
      2. Analyse de la Rentabilité et Trésorerie (Qu'est-ce qui va et ne va pas)
      3. Points de Vigilance (Délai client/fournisseur, échéances critiques)
      4. Recommandations Stratégiques Actionnables (3 étapes prioritaires pour le mois)
    - Sois précis, cite les chiffres fournis dans ton analyse. S'ils sont à 0, adapte l'analyse en suggérant de clôturer l'exercice ou de saisir les écritures.
    - Utilise le français professionnel. Sois direct, pas de blabla.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
    }));

    return response.text;
  } catch (error: any) {
    console.error("Error generating comprehensive dashboard report:", error);
    return "Désolé, l'analyse exhaustive n'a pas pu être générée. Veuillez réessayer.";
  }
};

export const generateAudit = async (auditData: any) => {
  try {
    const systemPrompt = `Tu es un Auditeur Financier Senior spécialisé dans le référentiel SYSCOHADA révisé.
    Ton rôle est d'analyser les données financières d'une entreprise et de fournir un rapport d'audit stratégique et réglementaire rigoureux.
    
    DONNÉES FINANCIÈRES FOURNIES :
    - Chiffre d'Affaires (CA) : ${auditData.ca} FCFA
    - Charges Totales : ${auditData.charges} FCFA
    - Trésorerie : ${auditData.cash} FCFA
    - Résultat Net (estimé) : ${auditData.ca - auditData.charges} FCFA
    - Rentabilité : ${auditData.ca > 0 ? ((auditData.ca - auditData.charges) / auditData.ca * 100).toFixed(2) : 0}%
    
    TOP CHARGES (Dépenses majeures) :
    ${auditData.topExpenses.map((e: any) => `- ${e.account_name} (${e.account_code}): ${e.total} FCFA`).join('\n')}
    
    CONSIGNES D'ANALYSE :
    1. Analyse de la Rentabilité : Évalue la marge nette par rapport aux standards OHADA.
    2. Structure de Coûts : Identifie les anomalies dans les comptes de classe 6.
    3. Trésorerie : Évalue le besoin en fonds de roulement si possible.
    4. Conformité : Précise si la structure des comptes (codes SYSCOHADA) semble respectée.
    5. Recommandations : Propose des actions concrètes pour optimiser la fiscalité ou la gestion.
    
    RÉPONSES SOUHAITÉES (en Français professionnel) :
    - summary: Rapport structuré avec Introduction, Analyse des Coûts, Analyse de la Rentabilité et Conclusion.
    - strengths: Points positifs relevés (ex: gestion efficace des charges 6x).
    - weaknesses: Risques détectés (ex: charges de personnel trop élevées, manque de liquidités).
    - recommendations: Actions prioritaires avec impact estimé.
    - ratios: Scores de 0 à 100 pour 5 indicateurs clés.
    
    Format JSON strictement obligatoire.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Génère l'audit financier complet.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            healthScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING, enum: ["Haut", "Moyen", "Bas"] }
                },
                required: ["title", "description", "impact"]
              }
            },
            ratios: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                },
                required: ["name", "value"]
              }
            }
          },
          required: ["summary", "healthScore", "strengths", "weaknesses", "recommendations", "ratios"]
        }
      }
    }));

    return parseSafeJSON(response.text);
  } catch (error) {
    console.error("Error generating audit:", error);
    return null;
  }
};

export const getP2PAdvice = async (p2pData: any) => {
  try {
    const systemPrompt = `Tu es un expert mondial en Supply Chain et Procure-to-Pay, avec une spécialisation pointue sur les pratiques OHADA/UEMOA. Analyse ces données pour donner des conseils ayant un fort RSI (Retour sur Investissement).
    Analyse les données suivantes et donne de 1 à 3 conseils stratégiques courts pour optimiser les achats, la trésorerie ou la relation fournisseur.
    
    DONNÉES P2P :
    - Demandes d'Achat : ${p2pData.requisitions.length}
    - Bons de Commande : ${p2pData.purchaseOrders.length} (Total: ${p2pData.poTotal} FCFA)
    - Factures en écart : ${p2pData.discrepanciesCount}
    - Moyenne fiabilité fournisseurs : ${p2pData.avgReliability}%
    
    CONSIGNES :
    - Sois proactif (ex: suggère des achats groupés si tu vois des micro-demandes récurrentes).
    - Sois vigilant sur la trésorerie (ex: suggère de retarder un paiement non critique).
    - Réponds en Français sous forme de tableau de strings.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advices: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["advices"]
        }
      }
    }));

    const data = parseSafeJSON(response.text);
    return data.advices as string[];
  } catch (error) {
    console.error("Error getting P2P advice:", error);
    return [];
  }
};

export interface AccountSuggestion {
  account_code: string;
  account_name: string;
  confidence: number;
  explanation: string;
}

export const suggestAccountCode = async (
  description: string,
  history: any[] = [],
  accounts: any[] = []
): Promise<AccountSuggestion[] | null> => {
  try {
    const historyContext = history.length > 0 
      ? `Historique récent / Habitudes (Comptes fréquemment utilisés ou opérations passées) :\n${history.slice(0, 15).map(h => {
          if (h.description) return `- Opération "${h.description}" -> ${h.entries?.[0]?.account_code || h.account_code || 'Inconnu'}`;
          if (h.account_name) return `- Compte souvent utilisé : ${h.account_code} (${h.account_name})`;
          return JSON.stringify(h);
      }).join('\n')}`
      : "Aucun historique d'opérations similaires disponible.";

    const accountsContext = accounts.length > 0
      ? `Liste partielle des comptes du plan comptable (suggérez les codes qui s'y trouvent si pertinents) :\n${accounts.slice(0, 200).map(a => `${a.code}: ${a.name}`).join('\n')}`
      : "Utilise les comptes standards du référentiel SYSCOHADA révisé.";

    const prompt = `
      Ta mission est de suggérer de 1 à 3 COMPTES COMPTABLES les plus appropriés pour l'opération suivante.
      Référentiel : SYSCOHADA révisé.
      
      LIBELLÉ DE L'OPÉRATION : "${description}"
      
      ${historyContext}
      
      ${accountsContext}
      
      CONSIGNES :
      1. Analyse le libellé pour déterminer la nature de l'opération (achat, vente, prestation, frais, etc.).
      2. Vérifie dans l'historique pour comprendre les habitudes comptables si applicables.
      3. Propose les meilleurs comptes d'imputation (classe 6, 7 ou autre selon l'opération). 
      4. Renvoie un tableau de MIEUX AU MOINS BIEN adapté.
      
      RENVOIE UNIQUEMENT UN JSON contenant un tableau 'suggestions' :
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un expert-comptable senior spécialisé en SYSCOHADA. Ton rôle est d'aider à la classification précise des opérations comptables. Retourne toujours un objet contenant un tableau de suggestions.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  account_code: { type: Type.STRING },
                  account_name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  explanation: { type: Type.STRING }
                },
                required: ["account_code", "account_name", "confidence", "explanation"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    }));

    if (response.text) {
      const data = parseSafeJSON(response.text);
      return data.suggestions || null;
    }
    return null;
  } catch (error) {
    console.error("Error suggesting account code:", error);
    return null;
  }
};

export interface TaxDocumentAnalysis {
  document_type: string;
  date: string;
  vendor_name: string;
  invoice_number: string;
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  vat_rate: number;
  currency: string;
  confidence?: number;
  items?: {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  accounting_suggestions: {
    account_code: string;
    account_name: string;
    debit: number;
    credit: number;
    reason: string;
  }[];
  compliance_check: {
    status: 'compliant' | 'warning' | 'non-compliant';
    issues: string[];
    advice: string;
  };
}

export const analyzeTaxDocument = async (imageBase64: string): Promise<TaxDocumentAnalysis | null> => {
  try {
    const prompt = `
      Analyse ce document fiscal (facture, reçu, avis d'imposition, etc.) pour une entreprise opérant dans la zone OHADA.
      
      TACHES :
      1. OCR : Extrais toutes les données clés (Date, Numéro, Fournisseur, Montants, LIGNES D'ARTICLES).
      2. COMPTABILITÉ : Suggère l'écriture comptable complète selon le référentiel SYSCOHADA révisé.
      3. CONFORMITÉ : Vérifie si le document respecte les mentions obligatoires (NIF, RCCM, TVA apparente, etc.) selon le Code Général des Impôts (UEMOA/CEMAC).
      
      RÈGLES DE COMPTABILISATION :
      - Achats : Débit 6x (Charge), Débit 445 (TVA déductible), Crédit 401 (Fournisseur).
      - Ventes : Crédit 7x (Produit), Crédit 443 (TVA collectée), Débit 411 (Client).
      - Frais Généraux : Utilise les comptes 62/63 appropriés.
      
      Réponds UNIQUEMENT au format JSON avec la structure suivante :
      {
        "document_type": "Facture d'achat / Facture de vente / Reçu / etc.",
        "date": "YYYY-MM-DD",
        "vendor_name": "Nom de l'entreprise émettrice",
        "invoice_number": "Numéro du document",
        "amount_ht": 0,
        "amount_tva": 0,
        "amount_ttc": 0,
        "vat_rate": 0,
        "currency": "XOF/EUR/USD/etc.",
        "items": [
           { "description": "Libellé", "quantity": 1, "unit_price": 0, "total": 0 }
        ],
        "accounting_suggestions": [
          { "account_code": "Code", "account_name": "Libellé", "debit": 0, "credit": 0, "reason": "Pourquoi ce compte ?" }
        ],
        "compliance_check": {
          "status": "compliant | warning | non-compliant",
          "issues": ["Problème 1", "Problème 2"],
          "advice": "Conseil pour régulariser ou optimiser"
        }
      }
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: "image/jpeg" } }
        ]
      },
      config: {
        systemInstruction: "Tu es un expert en audit fiscal et comptable spécialisé dans le système SYSCOHADA et les réglementations fiscales de l'Afrique de l'Ouest (UEMOA) et Centrale (CEMAC). Ton analyse doit être rigoureuse et basée sur les textes de loi réels.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            document_type: { type: Type.STRING },
            date: { type: Type.STRING },
            vendor_name: { type: Type.STRING },
            invoice_number: { type: Type.STRING },
            amount_ht: { type: Type.NUMBER },
            amount_tva: { type: Type.NUMBER },
            amount_ttc: { type: Type.NUMBER },
            vat_rate: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER },
                  total: { type: Type.NUMBER }
                }
              }
            },
            accounting_suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  account_code: { type: Type.STRING },
                  account_name: { type: Type.STRING },
                  debit: { type: Type.NUMBER },
                  credit: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                },
                required: ["account_code", "account_name", "debit", "credit", "reason"]
              }
            },
            compliance_check: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ["compliant", "warning", "non-compliant"] },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                advice: { type: Type.STRING }
              },
              required: ["status", "issues", "advice"]
            }
          },
          required: ["document_type", "date", "vendor_name", "invoice_number", "amount_ht", "amount_tva", "amount_ttc", "vat_rate", "currency", "accounting_suggestions", "compliance_check"]
        }
      }
    }));

    if (response.text) {
      return parseSafeJSON(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error in analyzeTaxDocument:", error);
    return null;
  }
};

export const getTaxCompliance = async (message: string, imageBase64?: string | null) => {
  try {
    const parts: any[] = [{ text: message }];
    if (imageBase64) {
      parts.push({ inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: "image/jpeg" } });
    }

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction: "Tu es un expert en fiscalité OHADA (UEMOA/CEMAC). Ton rôle est d'aider les entreprises à rester en conformité avec les Codes Généraux des Impôts locaux. Réponds de manière précise, cite les articles de loi si possible, et sois pédagogique.",
        tools: [{ googleSearch: {} }]
      }
    }));

    return response.text;
  } catch (error) {
    console.error("Error getting tax compliance:", error);
    return "Désolé, je n'ai pas pu traiter votre demande concernant la conformité fiscale.";
  }
};

export const aiReconcileBank = async (bankEntries: any[], internalEntries: any[]) => {
  try {
    const prompt = `
      Effectue un rapprochement bancaire intelligent entre le relevé bancaire et la comptabilité interne.
      
      RELEVÉ BANCAIRE (Extraits) :
      ${JSON.stringify(bankEntries)}
      
      COMPTABILITÉ INTERNE (Extraits compte 521) :
      ${JSON.stringify(internalEntries)}
      
      INSTRUCTIONS :
      1. Identifie les correspondances exactes (montant et date proche).
      2. Identifie les écarts (opérations au relevé mais pas en compta, et vice-versa).
      3. Suggère des écritures de régularisation pour les frais bancaires, agios, ou virements reçus non encore saisis.
      4. Calcule le solde théorique de rapprochement.
      
      FORMAT DE RÉPONSE (JSON) :
      {
        "matches": [{"bankId": "...", "internalId": "...", "confidence": 0-100}],
        "discrepancies": [{"source": "bank/internal", "amount": 0, "description": "..."}],
        "suggestions": [{"description": "...", "account_code": "...", "debit": 0, "credit": 0}],
        "reconciliationSummary": "Explication textuelle du rapprochement"
      }
    `;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es un expert en audit bancaire. Ton but est de réconcilier parfaitement les comptes bancaires avec la comptabilité.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bankId: { type: Type.STRING },
                  internalId: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                }
              }
            },
            discrepancies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                }
              }
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  account_code: { type: Type.STRING },
                  debit: { type: Type.NUMBER },
                  credit: { type: Type.NUMBER }
                }
              }
            },
            reconciliationSummary: { type: Type.STRING }
          },
          required: ["matches", "discrepancies", "suggestions", "reconciliationSummary"]
        }
      }
    }));

    return parseSafeJSON(response.text);
  } catch (error) {
    console.error("Error reconciling bank:", error);
    return null;
  }
};

export const askAssistant = async (
  message: string, 
  history: { role: 'user' | 'assistant', content: string, image?: string }[] = [],
  context?: any
) => {
  try {
    const chatHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [
        { text: msg.content },
        ...(msg.image ? [{ inlineData: { data: msg.image.split(',')[1] || msg.image, mimeType: "image/jpeg" } }] : [])
      ]
    }));

    const systemInstruction = `Tu es ORY, l'assistant IA de confiance et expert ultra-précis de la plateforme ORYCOMPTA (gestion comptable, analytique, budgétaire, fiscale et RH sous le référentiel SYSCOHADA révisé).

IMPORTANT : L'utilisateur exige une exactitude absolue. Absolument toutes les informations fournies — chiffres, nombres, libellés de comptes, noms, lettres, calculs et statuts — doivent être rigoureusement exactes, vérifiées et conformes aux données réelles de l'application et de l'entreprise.

CONSIGNES DE SÉCURITÉ ET D'EXACTITUDE :
1. N'invente, ne simule, ni n'estime JAMAIS de chiffres ou de noms de comptes ou de pièces comptables. Reste humble face aux limites de ton contexte.
2. Pour toute question financière ou budgétaire, utilise SYSTÉMATIQUEMENT les outils à ta disposition :
   - 'get_accounting_summary' : pour obtenir la synthèse financière exacte (soldes réels, CA mensuel, créances clients, dettes fournisseurs).
   - 'get_recent_transactions' : pour inspecter les écritures comptables réelles du journal (débit/crédit, comptes de la classe 1 à 8).
   - 'get_outstanding_invoices' : pour citer précisément les factures de tiers (clients/fournisseurs) en retard ou impayées.
   - 'get_budget_status' : pour comparer le réel au prévisionnel.
   - 'get_auditor_recommendations' : pour déceler l'ensemble des anomalies réelles (écarts de rapprochement bancaire, écritures déséquilibrées).
3. Si un utilisateur te demande les chiffres de ses comptes, de son entreprise, de sa trésorerie ou de ses factures, appelle immédiatement l'outil adéquat, traite le retour, puis présente-lui les données réelles en indiquant explicitement la source des données ("Vérifié en temps réel dans vos registres comptables OHADA").
4. Pour toute question de doctrine comptable ou fiscale, utilise 'googleSearch' si tu as le moindre doute, afin d'assurer une réponse parfaitement conforme aux décrets, bulletins officiels locaux ou dispositions du Code Général des Impôts (CGI) des pays membres de l'UEMOA/CEMAC.
5. Utilise un format Markdown soigné (tableaux pour les listes de chiffres, listes à puces claires, caractères gras pour faire ressortir les soldes ou termes cardinaux).

CONTEXTE ACTUEL TRANSMIS :
${context ? JSON.stringify(context) : 'Aucun contexte spécifique fourni.'}

Garde un ton professionnel, précis, rassurant et rigoureux.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatHistory,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      }
    }));
    
    let text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (groundingChunks && groundingChunks.length > 0) {
      text += "\n\n**Sources vérifiées :**\n";
      const uniqueLinks = new Set();
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri && !uniqueLinks.has(chunk.web.uri)) {
          uniqueLinks.add(chunk.web.uri);
          text += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
        }
      });
    }

    return text;
  } catch (error) {
    console.error("Error in askAssistant:", error);
    return "Désolé, je n'ai pas pu traiter votre demande pour le moment. Une erreur s'est produite lors de la connexion pour récupérer vos informations réelles.";
  }
};

export const askGemini = async (prompt: string, history: { role: 'user' | 'model', content: string }[] = []) => {
  const contents = [
    ...history.map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.content }] })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents,
    config: {
      systemInstruction: "You are a highly accurate accounting and business assistant specializing in the OHADA (Organization for the Harmonization of Business Law in Africa) region. Your primary goal is to provide verified, factually correct information. Always use Google Search to verify tax laws, business regulations, and current financial standards if you are not 100% certain. Cite your sources when possible.",
      tools: [{ googleSearch: {} }],
    },
  }));
  
  // Extract grounding metadata if available
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  let text = response.text;

  if (groundingChunks && groundingChunks.length > 0) {
    text += "\n\n**Sources vérifiées :**\n";
    const uniqueLinks = new Set();
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri && !uniqueLinks.has(chunk.web.uri)) {
        uniqueLinks.add(chunk.web.uri);
        text += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
      }
    });
  }

  return text;
};

export const generateCashFlowForecast = async (historicalData: any, scenarios: any[]) => {
  const prompt = `
En tant qu'expert financier et analyste de trésorerie (système OHADA), analyse les données historiques suivantes (y-compris les factures récurrentes) et génère une prévision de trésorerie détaillée sur les 90 prochains jours (3 mois).
Prends en compte les scénarios hypothétiques (What-If) fournis par l'utilisateur pour simuler leur impact.

## Données historiques et factures récurrentes et état actuel:
${JSON.stringify(historicalData, null, 2)}

## Scénarios "What-If" à appliquer:
${JSON.stringify(scenarios, null, 2)}

Tu dois renvoyer le résultat au format JSON STRICT respectant la structure suivante:
{
  "forecastPoints": [
    { "day": "YYYY-MM-DD", "solde": 15000200, "inflow": 500000, "outflow": 200000 }
  ],
  "alerts": [
    {
      "date": "YYYY-MM-DD",
      "type": "warning" | "critical" | "opportunity",
      "message": "Message explicatif de l'alerte"
    }
  ],
  "insights": "Analyse textuelle détaillée (paragraphe) des tendances et de l'impact des scénarios."
}

Consignes:
- Applique des modèles saisonniers basés sur l'historique fourni.
- Calcule rigoureusement l'impact des scénarios aux dates spécifiées.
- Les jours doivent être consécutifs sans trou.
- Formate la réponse uniquement en JSON.
`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "Tu es un directeur de la trésorerie expert du système OHADA. Tu ne réponds qu'au format JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          forecastPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                solde: { type: Type.NUMBER },
                inflow: { type: Type.NUMBER },
                outflow: { type: Type.NUMBER }
              },
              required: ["day", "solde", "inflow", "outflow"]
            }
          },
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["warning", "critical", "opportunity"] },
                message: { type: Type.STRING }
              },
              required: ["date", "type", "message"]
            }
          },
          insights: { type: Type.STRING }
        },
        required: ["forecastPoints", "alerts", "insights"]
      }
    }
  }));

  try {
    return parseSafeJSON(response.text);
  } catch (err) {
    console.error("Erreur parsing LLM:", err);
    throw new Error("Impossible d'analyser les prévisions : " + err);
  }
};

export const findNearbyBusinessResources = async (query: string, location?: { latitude: number, longitude: number }) => {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: query,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: location || {
            latitude: 5.3484, // Default to Abidjan if no location
            longitude: -4.0305
          }
        }
      }
    },
  }));

  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};
