import { GoogleGenAI, Modality, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not defined in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

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
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  vat_rate: number;
  operation_type: string;
  invoice_number?: string;
  currency?: string;
  entries: {
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
}

export const analyzeInvoice = async (
  imageBase64: string,
  scanType: 'vente' | 'achat',
  vatSettings: any[]
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
      Analyse cette facture ou reçu. ${typeContext}
      Ta priorité absolue est l'exactitude des informations extraites.
      Extrais les informations suivantes au format JSON :
      - date (YYYY-MM-DD)
      - description (Objet sommaire de la facture)
      - third_party (Nom du tiers : ${scanType === 'vente' ? 'Client' : 'Fournisseur'})
      - amount_ht (Montant Hors Taxes)
      - amount_tva (Montant de la TVA)
      - amount_ttc (Montant Total Toutes Taxes Comprises)
      - vat_rate (Taux de TVA en pourcentage, ex: 18)
      - invoice_number (Numéro de facture si présent)
      - currency (Devise, ex: XOF, EUR, USD)
      - operation_type (Choisis STRICTEMENT parmi : 'achat_marchandises', 'achat_services', 'vente_marchandises', 'vente_services', 'frais_generaux')
      - entries: Un tableau d'écritures comptables (SYSCOHADA révisé) représentant cette facture.
        Chaque écriture doit avoir :
        - account_code (ex: "6011", "4452", "4011")
        - debit (montant au débit, 0 si crédit)
        - credit (montant au crédit, 0 si débit)
        - description (Libellé spécifique court pour cette ligne, ex: "Achat Marchandises", "TVA Déductible", "Net à payer")
        Prends en compte les différentes lignes de la facture et les différentes taxes (TVA, etc.) si présentes.
        Assure-toi que le total des débits est égal au total des crédits.
      ${vatContext}
      
      Réponds UNIQUEMENT avec le JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: "image/jpeg" } }
        ]
      },
      config: {
        systemInstruction: "Tu es un expert en OCR comptable spécialisé dans le SYSCOHADA. Ton but est d'extraire des données 100% exactes à partir de documents financiers. Ne devine jamais si une information est illisible, laisse le champ vide ou utilise une valeur par défaut sûre.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            third_party: { type: Type.STRING },
            amount_ht: { type: Type.NUMBER },
            amount_tva: { type: Type.NUMBER },
            amount_ttc: { type: Type.NUMBER },
            vat_rate: { type: Type.NUMBER },
            invoice_number: { type: Type.STRING },
            currency: { type: Type.STRING },
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
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error analyzing invoice:", error);
    return null;
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert accountant for the OHADA region. Provide journal entry suggestions in JSON format. Ensure the sum of debits equals the sum of credits.",
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
    });

    if (response.text) {
      return JSON.parse(response.text);
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error suggesting correction:", error);
    return null;
  }
};

export const getQuickInsight = async (ca: number, charges: number, cash: number) => {
  try {
    const systemPrompt = `Tu es un conseiller financier intelligent.
    Donne un SEUL conseil financier court (max 15 mots) basé sur ces données :
    - CA : ${ca} FCFA
    - Charges : ${charges} FCFA
    - Trésorerie : ${cash} FCFA
    Sois direct et professionnel.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: systemPrompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error getting quick insight:", error);
    return null;
  }
};

export const generateAudit = async (auditData: any) => {
  try {
    const systemPrompt = `Tu es un Auditeur Financier Senior spécialisé dans le référentiel SYSCOHADA.
    Ton rôle est d'analyser les données financières d'une entreprise et de fournir un rapport d'audit stratégique.
    
    DONNÉES FINANCIÈRES :
    - Chiffre d'Affaires : ${auditData.ca} FCFA
    - Charges Totales : ${auditData.charges} FCFA
    - Trésorerie : ${auditData.cash} FCFA
    - Ratio de Rentabilité : ${auditData.ca > 0 ? ((auditData.ca - auditData.charges) / auditData.ca * 100).toFixed(2) : 0}%
    
    TOP CHARGES :
    ${auditData.topExpenses.map((e: any) => `- ${e.account_name} (${e.account_code}): ${e.total} FCFA`).join('\n')}
    
    STRUCTURE DU RAPPORT (Format JSON) :
    {
      "summary": "Résumé exécutif de la situation",
      "healthScore": 0-100,
      "strengths": ["Force 1", "Force 2"],
      "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
      "recommendations": [
        {"title": "Titre", "description": "Détail", "impact": "Haut/Moyen/Bas"}
      ],
      "ratios": [
        {"name": "Liquidité", "value": 0-100},
        {"name": "Solvabilité", "value": 0-100},
        {"name": "Rentabilité", "value": 0-100},
        {"name": "Efficacité", "value": 0-100},
        {"name": "Croissance", "value": 0-100}
      ]
    }
    
    Réponds UNIQUEMENT en JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating audit:", error);
    return null;
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    });

    if (response.text) {
      const data = JSON.parse(response.text);
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
      1. OCR : Extrais toutes les données clés (Date, Numéro, Fournisseur, Montants).
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
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
    });

    if (response.text) {
      return JSON.parse(response.text);
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
      parts.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: "Tu es un expert en fiscalité OHADA (UEMOA/CEMAC). Ton rôle est d'aider les entreprises à rester en conformité avec les Codes Généraux des Impôts locaux. Réponds de manière précise, cite les articles de loi si possible, et sois pédagogique.",
        tools: [{ googleSearch: {} }]
      }
    });

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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    });

    return JSON.parse(response.text);
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

    const systemInstruction = `Tu es l'assistant intelligent d'ORYCOMPTA, une plateforme de gestion comptable et financière pour l'espace OHADA.
    Ton rôle est d'aider l'utilisateur dans sa gestion quotidienne : comptabilité, fiscalité, paie, trésorerie.
    
    CONTEXTE ACTUEL :
    ${context ? JSON.stringify(context) : 'Aucun contexte spécifique fourni.'}
    
    DIRECTIVES :
    1. Sois professionnel, précis et pédagogique.
    2. Utilise le format Markdown pour tes réponses.
    3. Si l'utilisateur pose une question fiscale, utilise tes outils de recherche pour vérifier les dernières lois OHADA/UEMOA.
    4. Si l'utilisateur demande une analyse de document (image), sois très précis sur les montants et les dates.
    5. Ne donne jamais de conseils d'investissement, reste sur la gestion comptable et fiscale.`;

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      history: chatHistory.slice(0, -1), // History excluding the last message
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      }
    });

    const lastMessage = chatHistory[chatHistory.length - 1];
    const response = await chat.sendMessage({ message: lastMessage.parts[0].text });
    
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
    return "Désolé, je n'ai pas pu traiter votre demande pour le moment.";
  }
};

export const askGemini = async (prompt: string, history: { role: 'user' | 'model', content: string }[] = []) => {
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: "You are a highly accurate accounting and business assistant specializing in the OHADA (Organization for the Harmonization of Business Law in Africa) region. Your primary goal is to provide verified, factually correct information. Always use Google Search to verify tax laws, business regulations, and current financial standards if you are not 100% certain. Cite your sources when possible.",
      tools: [{ googleSearch: {} }],
    },
  });

  const response = await chat.sendMessage({ message: prompt });
  
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

export const findNearbyBusinessResources = async (query: string, location?: { latitude: number, longitude: number }) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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
  });

  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};
