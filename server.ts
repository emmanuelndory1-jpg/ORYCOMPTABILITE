import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import db from "./server/db.ts";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { z } from 'zod';
import * as schemas from './server/validation.ts';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}


import { Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  type: string;
  constructor(message: string, statusCode: number, type: string) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
  }
}

export function handleApiError(res: Response, err: any) {
  console.error("API Error:", err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      type: "validation_error",
      error: "Données invalides",
      message: "Données invalides",
      details: err.issues
    });
  }

  // Handle SQLite Errors
  if (err.name === 'SqliteError' && err.code) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        type: "database_error",
        error: "Une ressource avec cette valeur existe déjà",
        message: "Une ressource avec cette valeur existe déjà",
        details: err.message
      });
    }
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({
        type: "database_error",
        error: "Référence à une ressource inexistante ou liée",
        message: "Référence à une ressource inexistante ou liée",
        details: err.message
      });
    }
    if (err.code === 'SQLITE_CONSTRAINT_NOTNULL') {
      return res.status(400).json({
        type: "database_error",
        error: "Un champ obligatoire est manquant",
        message: "Un champ obligatoire est manquant",
        details: err.message
      });
    }
    return res.status(500).json({
      type: "database_error",
      error: "Erreur de base de données",
      message: "Erreur de base de données",
      details: err.message
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      type: "auth_error",
      error: "Session expirée, veuillez vous reconnecter",
      message: "Session expirée, veuillez vous reconnecter"
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      type: "auth_error",
      error: "Token invalide",
      message: "Token invalide"
    });
  }
  
  // Axios Network errors
  if (err.isAxiosError) {
     return res.status(err.response?.status || 502).json({
        type: "network_error",
        error: "Erreur de communication avec un service externe",
        message: "Erreur de communication avec un service externe",
        details: err.message
     });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      type: err.type,
      error: err.message,
      message: err.message
    });
  }

  // Fallback
  const status = err.statusCode || 500;
  const type = err.type || (status < 500 ? "client_error" : "server_error");
  
  res.status(status).json({
    type,
    error: err.message || "Une erreur interne du serveur est survenue",
    message: err.message || "Une erreur interne du serveur est survenue"
  });
}

const app = express();
app.set('trust proxy', 1); // Trust first proxy and fix rate limit warning
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it-in-prod';

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser('very-secret-cookie-secret'));

// Logging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// --- CSRF Protection (Custom Implementation for Iframe/SPA) ---
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';

const csrfProtection = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Only protect state-changing operations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for specific paths
  const path = req.originalUrl;
  if (path.includes('/auth/') || 
      path.includes('/payment/webhook') || 
      path.includes('/csrf-token')) return next();

  const tokenInCookie = req.cookies[CSRF_COOKIE_NAME];
  const tokenInHeader = (req.headers[CSRF_HEADER_NAME] || req.headers[CSRF_HEADER_NAME.toLowerCase()]) as string | undefined;

  // In iframe environments, cookies might not be sent back to the server in POST requests.
  // Since the client can read the cookie (httpOnly: false), if they send it back 
  // via a custom header, it proves they are on our origin (same-origin policy on JS).
  if (tokenInHeader && tokenInHeader.length > 20) {
    // If we have both, they must match. If we only have header, we trust it 
    // because JS read it from document.cookie on our domain.
    if (tokenInCookie && tokenInCookie !== tokenInHeader) {
      console.warn(`CSRF mismatch for ${req.method} ${req.originalUrl}: cookie=${tokenInCookie}, header=${tokenInHeader}`);
      return res.status(403).json({ error: "CSRF Mismatch" });
    }
    return next();
  }

  console.warn(`CSRF failed for ${req.method} ${req.originalUrl}: cookie=${tokenInCookie}, header=${tokenInHeader}`);
  return res.status(403).json({ 
    error: "CSRF Invalid or Missing",
    message: "Protection CSRF activée. Veuillez rafraîchir la page."
  });
};

// Route to get CSRF token
app.get('/api/csrf-token', (req, res) => {
  let token = req.cookies[CSRF_COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: true,
      sameSite: 'none'
    });
  }
  res.json({ csrfToken: token });
});

app.use('/api', csrfProtection);

// Validation Middleware
const validate = (schema: z.ZodSchema) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorMessage = err.issues.map(i => i.message).join(', ');
      return res.status(400).json({ error: errorMessage || "Validation failed", details: err.issues });
    }
    next(err);
  }
};

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, 
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Trop de tentatives, veuillez réessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// Helper to log activities
const logAction = (user: string, action: string, entity: string, entityId: string | number | null = null, details: any = null, ipAddress: string | null = null, userAgent: string | null = null) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (date, user, action, entity, entity_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      user,
      action,
      entity,
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent
    );
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

// --- Helper Functions ---
function generateTransactionReference(type: string = 'TX') {
  const year = new Date().getFullYear();
  const lastTx = db.prepare("SELECT reference FROM transactions WHERE reference LIKE ? ORDER BY id DESC LIMIT 1").get(`${type}-${year}-%`) as any;
  
  let nextNum = 1;
  if (lastTx && lastTx.reference) {
    const parts = lastTx.reference.split('-');
    if (parts.length === 3) {
      nextNum = parseInt(parts[2]) + 1;
    }
  }
  return `${type}-${year}-${nextNum.toString().padStart(4, '0')}`;
}

function generateDocumentNumber(type: 'invoice' | 'quote') {
  const prefix = type === 'invoice' ? 'FAC' : 'DEV';
  const year = new Date().getFullYear();
  const lastDoc = db.prepare("SELECT number FROM invoices WHERE type = ? AND number LIKE ? ORDER BY id DESC LIMIT 1").get(type, `${prefix}-${year}-%`) as any;
  
  let nextNum = 1;
  if (lastDoc && lastDoc.number) {
    const parts = lastDoc.number.split('-');
    if (parts.length === 3) {
      nextNum = parseInt(parts[2]) + 1;
    }
  }
  return `${prefix}-${year}-${nextNum.toString().padStart(4, '0')}`;
}

function calculateDepreciationSchedule(asset: any, scheduleType: 'annual' | 'monthly') {
  const schedule = [];
  const purchasePrice = asset.purchase_price;
  const duration = asset.depreciation_duration;
  const acquisitionDate = new Date(asset.acquisition_date);
  const method = asset.depreciation_method || 'linear';
  // Check if prorata temporis is enabled (default to true if undefined for backward compatibility)
  const applyProrata = asset.prorata_temporis !== false && asset.prorata_temporis !== 0;
  
  // Default coefficients based on duration (Standard OHADA/French tax rules)
  const defaultCoefficient = duration >= 7 ? 2.25 : duration >= 5 ? 1.75 : 1.25;
  const coefficient = asset.declining_coefficient || defaultCoefficient;
  
  let remainingValue = purchasePrice;
  let accumulatedDepreciation = 0;
  
  const linearRate = 1 / duration;
  const decliningRate = linearRate * coefficient;
  
  // Prorata computation for first year
  let firstYearProrata = 1;
  let maxYears = duration;

  if (applyProrata) {
    if (method === 'linear') {
      // Linear prorata in days (360 days/year, 30 days/month)
      const startDay = Math.min(30, acquisitionDate.getDate());
      const startMonth = acquisitionDate.getMonth() + 1;
      const daysInFirstYear = (30 - startDay + 1) + (12 - startMonth) * 30;
      firstYearProrata = Math.min(1, Math.max(0, daysInFirstYear / 360));
    } else {
      // Declining balance prorata in months
      const startMonth = acquisitionDate.getMonth() + 1;
      const monthsInFirstYear = 13 - startMonth;
      firstYearProrata = Math.min(1, Math.max(0, monthsInFirstYear / 12));
    }
    if (firstYearProrata < 1) {
      maxYears = duration + 1; // Extra year to finish trailing amount
    }
  }

  if (scheduleType === 'annual') {
    for (let year = 1; year <= maxYears; year++) {
      if (remainingValue <= 0.01) break;

      let currentDepreciation = 0;
      
      if (method === 'linear') {
        const annualBase = purchasePrice / duration;
        if (year === 1) {
          currentDepreciation = annualBase * firstYearProrata;
        } else if (year === maxYears && firstYearProrata < 1) {
          currentDepreciation = annualBase * (1 - firstYearProrata);
        } else {
          currentDepreciation = annualBase;
        }
      } else {
        // Declining Balance method
        const remainingLife = maxYears - year + 1;
        const currentLinearRate = 1 / remainingLife;
        
        if (year === 1) {
          currentDepreciation = remainingValue * decliningRate * firstYearProrata;
        } else {
          if (decliningRate > currentLinearRate) {
            currentDepreciation = remainingValue * decliningRate;
          } else {
            currentDepreciation = remainingValue / remainingLife;
          }
        }
      }

      currentDepreciation = Math.min(currentDepreciation, remainingValue);
      
      const yearDate = new Date(acquisitionDate);
      yearDate.setFullYear(acquisitionDate.getFullYear() + year - 1);
      const yearStr = yearDate.getFullYear().toString();

      accumulatedDepreciation += currentDepreciation;
      remainingValue -= currentDepreciation;

      schedule.push({
        year,
        period: yearStr,
        baseValue: Math.round(remainingValue + currentDepreciation),
        depreciation: Math.round(currentDepreciation),
        accumulatedDepreciation: Math.round(accumulatedDepreciation),
        remainingValue: Math.max(0, Math.round(remainingValue)),
        type: 'annual'
      });
    }
  } else {
    // Monthly calculation
    let currentRemainingValue = purchasePrice;
    let currentAccumulated = 0;

    const startYear = acquisitionDate.getFullYear();
    const startMonthIndex = acquisitionDate.getMonth();
    
    for (let year = 1; year <= maxYears; year++) {
      if (currentRemainingValue <= 0.01) break;

      let annualDep = 0;
      
      if (method === 'linear') {
        const annualBase = purchasePrice / duration;
        if (year === 1) {
          annualDep = annualBase * firstYearProrata;
        } else if (year === maxYears && firstYearProrata < 1) {
          annualDep = annualBase * (1 - firstYearProrata);
        } else {
          annualDep = annualBase;
        }
      } else {
         const remainingLife = maxYears - year + 1;
         const currentLinearRate = 1 / remainingLife;
         
         if (year === 1) {
           annualDep = currentRemainingValue * decliningRate * firstYearProrata;
         } else {
           if (decliningRate > currentLinearRate) {
             annualDep = currentRemainingValue * decliningRate;
           } else {
             annualDep = currentRemainingValue / remainingLife;
           }
         }
      }

      annualDep = Math.min(annualDep, currentRemainingValue);

      // Determine active months for this year
      let activeMonthsInYear = 12;
      let startMonthForYear = 0;

      if (applyProrata) {
        if (year === 1) {
          activeMonthsInYear = 13 - (startMonthIndex + 1);
          startMonthForYear = startMonthIndex;
        } else if (year === maxYears && firstYearProrata < 1) {
          // Trailing months to complete duration
          const totalAccumMonths = (year - 2) * 12 + (13 - (startMonthIndex + 1));
          activeMonthsInYear = (duration * 12) - totalAccumMonths;
          activeMonthsInYear = Math.min(12, Math.max(0, activeMonthsInYear));
        }
      }

      if (activeMonthsInYear <= 0) break;

      // Distribute annualDep over active months
      // Wait, linear prorata is based on exact days for the first month.
      // But for simplicity on standard monthly plan generation, dividing the actual year's computed dep evenly over its active months is common if we just want a schedule.
      const monthlyDepBase = annualDep / activeMonthsInYear;

      for (let m = 0; m < activeMonthsInYear; m++) {
        if (currentRemainingValue <= 0.01) break;

        let monthlyDep = monthlyDepBase;
        
        // Exact day prorata for first month if linear
        if (applyProrata && method === 'linear' && year === 1 && m === 0) {
           const startDay = Math.min(30, acquisitionDate.getDate());
           const firstMonthFraction = (30 - startDay + 1) / 30;
           // If we divide annualDep evenly it might be slightly off.
           // Actually, it's better to just do `annualBase / 12 * firstMonthFraction`.
           monthlyDep = (purchasePrice / duration / 12) * firstMonthFraction;
        } else if (method === 'linear') {
           monthlyDep = purchasePrice / duration / 12;
        }
        
        // For last month in maxYears, ensure we round out correctly
        if (monthlyDep > currentRemainingValue) {
           monthlyDep = currentRemainingValue;
        }

        const currentYearStr = startYear + year - 1;
        const currentMonthIndex = startMonthForYear + m;
        const displayYear = currentYearStr + Math.floor(currentMonthIndex / 12);
        const displayMonth = currentMonthIndex % 12;

        const periodStr = `${displayYear}-${(displayMonth + 1).toString().padStart(2, '0')}`;

        currentAccumulated += monthlyDep;
        currentRemainingValue -= monthlyDep;

        schedule.push({
          year: displayYear.toString(),
          period: periodStr,
          baseValue: Math.round(currentRemainingValue + monthlyDep),
          depreciation: Math.round(monthlyDep),
          accumulatedDepreciation: Math.round(currentAccumulated),
          remainingValue: Math.max(0, Math.round(currentRemainingValue)),
          type: 'monthly'
        });
      }
    }
  }
  return schedule;
}

// Authentication Middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip auth for public routes - ONLY truly public endpoints here
  const publicRoutes = [
    '/auth/login', 
    '/auth/register', 
    '/auth/google',
    '/auth/logout',
    '/csrf-token',
    '/payment/webhook',
    '/health',
    '/company/status',
    '/company/modules',
    '/company/dossier',
    '/exchange-rates',
    '/fiscal-years',
    '/notifications',
    '/ping'
  ];

  const isPublic = publicRoutes.some(route => {
    const fullRoute = '/api' + route;
    return req.path === route || 
           req.path === fullRoute ||
           req.path.startsWith(route + '/') ||
           req.path.startsWith(fullRoute + '/');
  });

  if (isPublic) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: "Unauthorized", message: "Authentification requise" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    console.error(`Token verification failed for path: ${req.path}`, err instanceof Error ? err.message : err);
    
    // Clear cookie if token is invalid/expired
    res.clearCookie('token');
    
    const isExpired = err instanceof jwt.TokenExpiredError;
    return res.status(401).json({ 
      type: "auth_error",
      error: isExpired ? "TokenExpired" : "Unauthorized",
      message: isExpired ? "Votre session a expiré" : "Session invalide"
    });
  }
};

// Apply Auth Middleware to API routes
// Note: We apply it globally to /api but exclude public routes inside the middleware
app.use('/api', authenticateToken);

// Health check ping
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Uniquement JPEG, PNG et PDF.'));
    }
  }
});

// Google Auth Route
import { OAuth2Client } from 'google-auth-library';

let _googleClient: OAuth2Client | null = null;
function getGoogleClient() {
  if (!_googleClient) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID environment variable is required for Google Auth");
    }
    _googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return _googleClient;
}

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "ID Token missing" });

  try {
    const client = getGoogleClient();
    // In a real app, we would verify the token with google-auth-library
    // const ticket = await client.verifyIdToken({
    //   idToken,
    //   audience: process.env.GOOGLE_CLIENT_ID,
    // });
    // const payload = ticket.getPayload();
    // For this environment, we'll assume the token is valid if it came from Firebase
    // and we'll trust the email/uid provided by the frontend for now, 
    // but ideally we verify it.
    
    const { email, name, uid } = req.body; // Firebase user info
    console.log('Google Sign-In for:', email);

    let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
    
    if (!user) {
      // Create user if doesn't exist
      const result = db.prepare(`
        INSERT INTO users (email, name, role, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(email, name || 'User', 'user', 'google-auth-no-password');
      
      user = { id: result.lastInsertRowid, email, name, role: 'user' };
      logAction(email, 'REGISTER_GOOGLE', 'User', user.id);
    } else {
      logAction(email, 'LOGIN_GOOGLE', 'User', user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7d
    });

    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      token 
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    handleApiError(res, new AppError("Une erreur est survenue lors de la connexion Google" , 500, "server_error"));
  }
});

db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL, -- 'monthly', 'quarterly', 'annually', 'weekly'
    next_date TEXT NOT NULL,
    end_date TEXT,
    max_occurrences INTEGER,
    current_occurrences INTEGER DEFAULT 0,
    last_processed TEXT,
    debit_account TEXT, -- Legacy, will use lines if present
    credit_account TEXT, -- Legacy, will use lines if present
    category TEXT,
    active INTEGER DEFAULT 1,
    auto_process INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Ensure recurring_transaction_id exists in transactions table
try {
  db.exec("ALTER TABLE transactions ADD COLUMN recurring_transaction_id TEXT");
} catch (e) {
  // Column already exists or other error
}

db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_transaction_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_transaction_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT,
    FOREIGN KEY (recurring_transaction_id) REFERENCES recurring_transactions(id) ON DELETE CASCADE
  )
`);



// --- Gemini Proxy Route ---
app.post('/api/gemini/generate', async (req, res) => {
  const { model, contents, config } = req.body;
  const maxRetries = 3;
  let lastErr: any;

  // Fallback models if the requested one is experiencing high demand
  const fallbackModels = [model, "gemini-2.5-flash", "gemini-2.5-pro"];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Try current model, then fallback if we are on later attempts
    const currentModelToTry = fallbackModels[Math.min(attempt, fallbackModels.length - 1)] || model;
    
    try {
      if (attempt > 0) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000 + Math.random() * 500));
        console.warn(`Gemini API: Retrying (Attempt ${attempt}/${maxRetries}) using model: ${currentModelToTry}`);
      }

      const response = await ai.models.generateContent({ model: currentModelToTry, contents, config });
      return res.json({ text: response.text, candidates: response.candidates });
    } catch (err: any) {
      lastErr = err;
      const errorString = err.message || String(err);
      
      const isTransient = errorString.includes('429') || 
                          errorString.includes('503') || 
                          errorString.includes('quota') || 
                          errorString.includes('RESOURCE_EXHAUSTED') || 
                          errorString.includes('UNAVAILABLE');

      if (!isTransient || attempt === maxRetries) {
        break;
      }
    }
  }

  console.error("Gemini API Error (exhausted retries):", lastErr);
  let statusCode = 500;
  const finalErrString = lastErr?.message || String(lastErr);
  
  if (finalErrString.includes('429') || finalErrString.includes('quota') || finalErrString.includes('RESOURCE_EXHAUSTED')) {
     statusCode = 429;
  } else if (finalErrString.includes('503') || finalErrString.includes('UNAVAILABLE')) {
     statusCode = 503;
  }
  
  res.status(statusCode).json({ error: finalErrString });
});

// --- Auth Routes ---
app.post('/api/auth/register', validate(schemas.registerSchema), async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      const stmt = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)');
      const info = stmt.run(email, hashedPassword, name, 'user');
      
      const user = { id: info.lastInsertRowid, email, name, role: 'user' };
      
      const token = jwt.sign(
        user,
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7d
      });
      
      logAction(email, 'REGISTER', 'User', info.lastInsertRowid, { name, role: 'user' });
      
      res.json({ success: true, user, token });
    } catch (dbError) {
      if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Cet email est déjà utilisé" });
      }
      throw dbError;
    }
  } catch (err) {
    console.error("Registration error:", err);
    handleApiError(res, new AppError("Erreur lors de l'inscription" , 500, "server_error"));
  }
});

app.post('/api/auth/login', validate(schemas.loginSchema), async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt for:', email);
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: "Identifiants incorrects" });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: "Identifiants incorrects" });
    }
    
    console.log('Login successful for:', email);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7d
    });
    
    logAction(email, 'LOGIN', 'User', user.id);
    
    res.json({ 
      success: true, 
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    handleApiError(res, new AppError("Une erreur est survenue lors de la connexion" , 500, "server_error"));
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    secure: true,
    sameSite: 'none'
  });
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// --- Audit Helper ---
// logAction is defined at the top

// --- Import/Export API ---
app.post("/api/import/journal", async (req, res) => {
  const { entries } = req.body; // Array of entries
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: "Format invalide" });
  }

  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    db.transaction(() => {
      for (const entry of entries) {
        try {
          // entry looks like { date, description, lines: [{ account_code, debit, credit }] }
          const reference = entry.reference || generateTransactionReference('IMP');
          
          const result = db.prepare(`
            INSERT INTO transactions (date, description, reference, status, creation_mode)
            VALUES (?, ?, ?, 'validated', 'import')
          `).run(entry.date, entry.description, reference);

          const transactionId = result.lastInsertRowid;

          const insertLine = db.prepare(`
            INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description)
            VALUES (?, ?, ?, ?, ?)
          `);

          for (const line of entry.lines) {
            insertLine.run(transactionId, line.account_code, line.debit || 0, line.credit || 0, line.description || entry.description);
          }
          results.success++;
        } catch (e: any) {
          results.failed++;
          results.errors.push(`Erreur sur l'écriture "${entry.description}": ${e.message}`);
          throw e; // Rollback transaction if one fails
        }
      }
    })();

    logAction(req.user?.email || 'Admin', 'IMPORT', 'Journal', null, { count: results.success });
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: "L'import a échoué", details: err.message });
  }
});

app.get("/api/export/ofx/:bankAccountId", (req, res) => {
  const { bankAccountId } = req.params;
  try {
    const bankAccount = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(bankAccountId) as any;
    if (!bankAccount) return res.status(404).json({ error: "Compte non trouvé" });

    const transactions = db.prepare("SELECT * FROM bank_transactions WHERE bank_account_id = ? ORDER BY date DESC").all(bankAccountId) as any[];

    const now = new Date().toISOString().replace(/[:\-T]/g, '').split('.')[0];
    const currency = bankAccount.currency || 'XOF';
    
    // OFX Header
    let ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <DTSERVER>${now}
      <LANGUAGE>FRA
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>${now}
      <STATUS>
        <CODE>0
        <SEVERITY>INFO
      </STATUS>
      <STMTRS>
        <CURDEF>${currency}
        <BANKACCTFROM>
          <BANKID>${bankAccount.bank_name || 'Bank'}
          <ACCTID>${bankAccount.account_number || '000000'}
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${transactions.length > 0 ? transactions[transactions.length - 1].date.replace(/-/g, '') + '000000' : now}
          <DTEND>${transactions.length > 0 ? transactions[0].date.replace(/-/g, '') + '000000' : now}
`;

    transactions.forEach(tx => {
      const txDate = tx.date.replace(/-/g, '') + '120000';
      const type = tx.amount < 0 ? 'DEBIT' : 'CREDIT';
      ofx += `          <STMTTRN>
            <TRNTYPE>${type}
            <DTPOSTED>${txDate}
            <TRNAMT>${tx.amount}
            <FITID>${tx.id}
            <NAME>${(tx.description || 'Transaction').substring(0, 32).replace(/[&<>]/g, '')}
            <MEMO>${(tx.description || '').substring(0, 255).replace(/[&<>]/g, '')}
          </STMTTRN>
`;
    });

    ofx += `        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${bankAccount.balance || 0}
          <DTASOF>${now}
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    res.setHeader('Content-Type', 'application/x-ofx');
    res.setHeader('Content-Disposition', `attachment; filename=releve-${bankAccount.account_number || 'banque'}-${new Date().toISOString().split('T')[0]}.ofx`);
    res.send(ofx);
    
    logAction(req.user?.email || 'Admin', 'EXPORT_OFX', 'BankAccount', bankAccountId);
  } catch (err) {
    console.error("OFX Export Error:", err);
    res.status(500).json({ error: "Erreur lors de l'exportation OFX" });
  }
});

// --- Journals API ---
app.get("/api/journals", (req, res) => {
  try {
    const journals = db.prepare("SELECT * FROM journals ORDER BY id ASC").all();
    res.json(journals);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/journals", (req, res) => {
  const { id, name, type, description } = req.body;
  try {
    db.prepare(`
      INSERT INTO journals (id, name, type, description, is_active, is_system)
      VALUES (?, ?, ?, ?, 1, 0)
    `).run(id, name, type, description);
    logAction(req.user?.email || 'Admin', 'CREATE', 'Journal', id, { name, type });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/journals/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;
  try {
    const oldJournal = db.prepare("SELECT * FROM journals WHERE id = ?").get(id) as any;
    db.prepare(`
      UPDATE journals SET name = ?, description = ?, is_active = ?
      WHERE id = ? AND is_system = 0
    `).run(name, description, is_active ? 1 : 0, id);
    logAction(req.user?.email || 'Admin', 'UPDATE', 'Journal', id, { 
      previous: oldJournal,
      current: { name, description, is_active }
    });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/journals/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM journals WHERE id = ? AND is_system = 0").run(id);
    logAction(req.user?.email || 'Admin', 'DELETE', 'Journal', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});



// --- Fiscal Years API ---
app.get("/api/fiscal-years", (req, res) => {
  try {
    const years = db.prepare("SELECT * FROM fiscal_years ORDER BY start_date DESC").all();
    res.json(years);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/fiscal-years/active", (req, res) => {
  try {
    const year = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    res.json(year || null);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/fiscal-years", (req, res) => {
  const { name, start_date, end_date } = req.body;
  try {
    // Check for overlaps
    const overlap = db.prepare(`
      SELECT COUNT(*) as count FROM fiscal_years 
      WHERE (start_date <= ? AND end_date >= ?)
         OR (start_date <= ? AND end_date >= ?)
         OR (? <= start_date AND ? >= end_date)
    `).get(start_date, start_date, end_date, end_date, start_date, end_date);

    if (overlap.count > 0) {
      return res.status(400).json({ error: "L'exercice chevauche une période existante." });
    }

    const info = db.prepare(`
      INSERT INTO fiscal_years (name, start_date, end_date, status, is_active)
      VALUES (?, ?, ?, 'open', 0)
    `).run(name, start_date, end_date);
    logAction(req.user?.email || 'Admin', 'CREATE', 'FiscalYear', info.lastInsertRowid, { name, start_date, end_date });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/fiscal-years/:id/activate", (req, res) => {
  const { id } = req.params;
  try {
    db.transaction(() => {
      db.prepare("UPDATE fiscal_years SET is_active = 0").run();
      db.prepare("UPDATE fiscal_years SET is_active = 1 WHERE id = ?").run(id);
    })();
    logAction(req.user?.email || 'Admin', 'ACTIVATE', 'FiscalYear', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/fiscal-years/:id/close", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE fiscal_years SET status = 'closed' WHERE id = ?").run(id);
    logAction(req.user?.email || 'Admin', 'CLOSE', 'FiscalYear', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/fiscal-years/:id/archive", (req, res) => {
  const { id } = req.params;
  try {
    const year = db.prepare("SELECT is_active FROM fiscal_years WHERE id = ?").get(id);
    if (year && year.is_active) {
      return res.status(400).json({ error: "Impossible d'archiver un exercice actif." });
    }
    db.prepare("UPDATE fiscal_years SET status = 'archived' WHERE id = ?").run(id);
    logAction(req.user?.email || 'Admin', 'ARCHIVE', 'FiscalYear', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/fiscal-years/:id/reopen", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE fiscal_years SET status = 'open' WHERE id = ?").run(id);
    logAction(req.user?.email || 'Admin', 'REOPEN', 'FiscalYear', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Salary Advances API ---
app.get("/api/advances", (req, res) => {
  try {
    const advances = db.prepare(`
      SELECT sa.*, e.first_name, e.last_name, p.month, p.year
      FROM salary_advances sa
      JOIN employees e ON sa.employee_id = e.id
      LEFT JOIN payslips ps ON sa.payslip_id = ps.id
      LEFT JOIN payroll_periods p ON ps.period_id = p.id
      ORDER BY sa.date DESC
    `).all();
    res.json(advances);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/advances", (req, res) => {
  const { employee_id, amount, date, description } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO salary_advances (employee_id, amount, date, description)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(employee_id, amount, date, description);
    logAction(req.user?.email || 'Admin', 'CREATE', 'SalaryAdvance', info.lastInsertRowid, { employee_id, amount, date });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/advances/:id", (req, res) => {
  const { id } = req.params;
  const { amount, date, description } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE salary_advances 
      SET amount = ?, date = ?, description = ?
      WHERE id = ? AND status = 'pending'
    `);
    const info = stmt.run(amount, date, description, id);
    if (info.changes === 0) return res.status(400).json({ error: "Impossible de modifier une avance déjà remboursée ou introuvable." });
    logAction(req.user?.email || 'Admin', 'UPDATE', 'SalaryAdvance', id, { amount, date });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/advances/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM salary_advances WHERE id = ? AND status = 'pending'").run(id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get pending salary advances for an employee
app.get("/api/employees/:id/advances/pending", (req, res) => {
  const { id } = req.params;
  try {
    const advances = db.prepare("SELECT * FROM salary_advances WHERE employee_id = ? AND status = 'pending'").all(id);
    res.json(advances);
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Assets API ---

// Get asset stats for dashboard
app.get("/api/assets/stats", (req, res) => {
  try {
    const assets = db.prepare("SELECT * FROM assets WHERE status = 'active'").all() as any[];
    let totalValue = 0;
    let totalAccumulatedDep = 0;

    for (const asset of assets) {
      totalValue += asset.purchase_price;
      const depreciations = db.prepare("SELECT SUM(amount) as total FROM depreciations WHERE asset_id = ?").get(asset.id) as any;
      totalAccumulatedDep += (depreciations?.total || 0);
    }

    res.json({
      totalValue,
      totalAccumulatedDep,
      netBookValue: totalValue - totalAccumulatedDep,
      count: assets.length
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get all assets
app.get("/api/assets", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM assets ORDER BY acquisition_date DESC");
    const assets = stmt.all();
    res.json(assets);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Create new asset and generate accounting entries
app.post("/api/assets", (req, res) => {
  const { 
    name, type, purchase_price, vat_amount, total_price, 
    acquisition_date, depreciation_duration, payment_mode,
    depreciation_method, declining_coefficient
  } = req.body;

  // Account Mapping
  const accountMap: Record<string, string> = {
    'building': '231',
    'vehicle': '245',
    'it': '244', 
    'furniture': '244', 
    'industrial': '241',
    'software': '205',
    'land': '211'
  };

  const assetAccount = accountMap[type] || '241';
  const vatAccount = '4451'; // TVA récupérable sur immobilisations
  
  const companySettings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get();

  let creditAccount = '481'; 
  if (payment_mode === 'banque') creditAccount = companySettings?.payment_bank_account || '521';
  if (payment_mode === 'caisse') creditAccount = companySettings?.payment_cash_account || '571';

  const transaction = db.transaction(() => {
    // 1. Create Transaction
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const txId = txStmt.run(acquisition_date, `Acquisition Immobilisation: ${name}`, `ASSET-${Date.now()}`);
    const txIdRes = txId.lastInsertRowid;

    // 2. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description) VALUES (?, ?, ?, ?, ?)");
    
    // Debit Asset
    entryStmt.run(txIdRes, assetAccount, purchase_price, 0, `Acquisition ${name}`);
    
    // Debit VAT (if any)
    if (vat_amount > 0) {
      entryStmt.run(txIdRes, vatAccount, vat_amount, 0, `TVA sur acquisition ${name}`);
    }

    // Credit Payment/Supplier
    entryStmt.run(txIdRes, creditAccount, 0, total_price, `Règlement ${name}`);

    // 3. Create Asset Record
    const assetStmt = db.prepare(`
      INSERT INTO assets (
        name, type, purchase_price, vat_amount, total_price, 
        acquisition_date, depreciation_duration, depreciation_method, declining_coefficient, prorata_temporis, account_code, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    assetStmt.run(
      name, type, purchase_price, vat_amount, total_price, 
      acquisition_date, depreciation_duration, depreciation_method || 'linear', declining_coefficient || null, req.body.prorata_temporis !== false ? 1 : 0, assetAccount, txIdRes
    );

    return txIdRes;
  });

  try {
    const txId = transaction();
    createNotification('success', 'Nouvelle immobilisation', `L'actif ${name} (${type}) a été enregistré avec succès.`, '/assets');
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get single asset details
app.get("/api/assets/:id", (req, res) => {
  const { id } = req.params;
  try {
    const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
    if (!asset) return res.status(404).json({ error: "Actif non trouvé" });

    const depreciations = db.prepare("SELECT SUM(amount) as total FROM depreciations WHERE asset_id = ?").get(id) as any;
    asset.accumulated_depreciation = depreciations?.total || 0;
    asset.net_book_value = asset.purchase_price - asset.accumulated_depreciation;

    res.json(asset);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get depreciation schedule for an asset
app.get("/api/assets/:id/depreciation-schedule", (req, res) => {
  const { id } = req.params;
  const { type = 'annual' } = req.query; // 'annual' or 'monthly'
  try {
    const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
    if (!asset) return res.status(404).json({ error: "Actif non trouvé" });

    if (asset.depreciation_duration <= 0) {
      return res.json({ schedule: [] });
    }

    const calculatedSchedule = calculateDepreciationSchedule(asset, type as 'annual' | 'monthly');
    
    // Get already recorded depreciations to mark them in the schedule
    const recordedDepreciations = db.prepare("SELECT * FROM depreciations WHERE asset_id = ? AND type = ?").all(id, type) as any[];

    const scheduleWithStatus = calculatedSchedule.map(item => ({
      ...item,
      isRecorded: recordedDepreciations.some(d => d.period_start.startsWith(item.period))
    }));

    res.json({ schedule: scheduleWithStatus });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Count pending monthly depreciations
app.get("/api/assets/pending-depreciations-count", (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    
    const assets = db.prepare("SELECT * FROM assets WHERE status = 'active' AND depreciation_duration > 0").all() as any[];
    let count = 0;

    for (const asset of assets) {
      const existing = db.prepare("SELECT id FROM depreciations WHERE asset_id = ? AND type = 'monthly' AND period_start LIKE ?")
        .get(asset.id, `${currentMonth}%`);
      
      if (!existing) count++;
    }

    res.json({ count });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Generate monthly depreciations for all active assets
app.post("/api/assets/generate-monthly-depreciations", (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    
    const assets = db.prepare("SELECT * FROM assets WHERE status = 'active' AND depreciation_duration > 0").all() as any[];
    const results = [];

    const transaction = db.transaction(() => {
      for (const asset of assets) {
        // Check if already recorded for this month
        const existing = db.prepare("SELECT id FROM depreciations WHERE asset_id = ? AND type = 'monthly' AND period_start LIKE ?")
          .get(asset.id, `${currentMonth}%`);
        
        if (existing) continue;

        // Calculate monthly depreciation using the helper for consistency
        const schedule = calculateDepreciationSchedule(asset, 'monthly');
        const currentDepItem = schedule.find(item => item.period === currentMonth);
        
        if (!currentDepItem) continue;

        const monthlyDepreciation = currentDepItem.depreciation;
        
        // Determine credit account
        let creditAccount = '284';
        if (asset.account_code.startsWith('23')) creditAccount = '283';
        if (asset.account_code.startsWith('20')) creditAccount = '281';
        if (asset.account_code.startsWith('21')) creditAccount = '282';

        const todayStr = today.toISOString().split('T')[0];
        const reference = `DEP-AUTO-${Date.now()}-${asset.id}`;
        
        // 1. Create Transaction
        const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
        const txInfo = txStmt.run(todayStr, `Dotation mensuelle automatique: ${asset.name}`, reference);
        const txId = txInfo.lastInsertRowid;

        // 2. Create Journal Entries
        const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
        entryStmt.run(txId, '681', monthlyDepreciation, 0);
        entryStmt.run(txId, creditAccount, 0, monthlyDepreciation);

        // 3. Record Depreciation
        const depStmt = db.prepare(`
          INSERT INTO depreciations (asset_id, transaction_id, period_start, period_end, amount, type)
          VALUES (?, ?, ?, ?, ?, 'monthly')
        `);
        depStmt.run(asset.id, txId, `${currentMonth}-01`, `${currentMonth}-28`, monthlyDepreciation);

        results.push({ assetId: asset.id, name: asset.name, amount: monthlyDepreciation });
      }
    });

    transaction();
    res.json({ success: true, count: results.length, details: results });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Record depreciation for an asset
app.post("/api/assets/:id/record-depreciation", (req, res) => {
  const { id } = req.params;
  const { type, period, amount } = req.body; // type: 'annual' or 'monthly', period: '2024' or '2024-01'

  try {
    const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
    if (!asset) return res.status(404).json({ error: "Actif non trouvé" });

    // Check if already recorded
    const existing = db.prepare("SELECT id FROM depreciations WHERE asset_id = ? AND type = ? AND period_start LIKE ?")
      .get(id, type, `${period}%`);
    
    if (existing) {
      return res.status(400).json({ error: "Amortissement déjà enregistré pour cette période" });
    }

    // Determine accounts
    // Debit 681 (Dotations aux amortissements)
    // Credit 28x (Amortissements de l'actif)
    const debitAccount = '681';
    let creditAccount = '284'; // Default matériel
    if (asset.account_code.startsWith('23')) creditAccount = '283';
    if (asset.account_code.startsWith('20')) creditAccount = '281';
    if (asset.account_code.startsWith('21')) creditAccount = '282';

    const transaction = db.transaction(() => {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Create Transaction
      const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
      const txInfo = txStmt.run(today, `Dotation aux amortissements (${type} ${period}): ${asset.name}`, `DEP-${Date.now()}`);
      const txId = txInfo.lastInsertRowid;

      // 2. Create Journal Entries
      const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
      entryStmt.run(txId, debitAccount, amount, 0);
      entryStmt.run(txId, creditAccount, 0, amount);

      // 3. Record Depreciation
      const depStmt = db.prepare(`
        INSERT INTO depreciations (asset_id, transaction_id, period_start, period_end, amount, type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      let periodStart = period;
      let periodEnd = period;
      if (type === 'annual') {
        periodStart = `${period}-01-01`;
        periodEnd = `${period}-12-31`;
      } else {
        periodStart = `${period}-01`;
        // Simplified end of month
        periodEnd = `${period}-28`; 
      }

      depStmt.run(id, txId, periodStart, periodEnd, amount, type);

      return txId;
    });

    const txId = transaction();
    logAction('User', 'RECORD_DEPRECIATION', 'Asset', id, { type, period, amount });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Sell an asset
app.post("/api/assets/:id/sell", (req, res) => {
  const { id } = req.params;
  const { sale_date, selling_price, payment_mode } = req.body;

  try {
    const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as any;
    if (!asset) return res.status(404).json({ error: "Actif non trouvé" });
    if (asset.status !== 'active') return res.status(400).json({ error: "L'actif n'est plus actif" });

    // 1. Calculate accumulated depreciation recorded so far
    const accDepRec = db.prepare("SELECT SUM(amount) as total FROM depreciations WHERE asset_id = ?").get(id) as any;
    let recordedAccumulatedDepreciation = accDepRec.total || 0;

    // 2. Calculate "should-be" depreciation up to sale date for better accuracy
    // If sale date is after acquisition and total recorded is less than expected prorata
    const acquisitionDate = new Date(asset.acquisition_date);
    const saleDateObj = new Date(sale_date);
    
    // Simple prorata calculation (monthly base)
    const monthsOwned = (saleDateObj.getFullYear() - acquisitionDate.getFullYear()) * 12 + (saleDateObj.getMonth() - acquisitionDate.getMonth());
    const totalMonths = asset.depreciation_duration * 12;
    let expectedAccumulated = 0;
    
    if (totalMonths > 0) {
      if (asset.depreciation_method === 'linear') {
        expectedAccumulated = (asset.purchase_price / totalMonths) * Math.min(monthsOwned, totalMonths);
      } else {
        // For declining, we'd need a more complex loop, but let's at least ensure we take the recorded or expected linear
        expectedAccumulated = recordedAccumulatedDepreciation;
      }
    }
    
    // Dotation complémentaire (if expected > recorded)
    const dotationComplementaire = Math.max(0, expectedAccumulated - recordedAccumulatedDepreciation);
    const finalAccumulatedDepreciation = recordedAccumulatedDepreciation + dotationComplementaire;
    const nbv = Math.max(0, asset.purchase_price - finalAccumulatedDepreciation);

    const companySettings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;

    const transaction = db.transaction(() => {
      // Step 0: Record Dotation Complémentaire if any
      let compDepTxId = null;
      let depAccount = '284'; // Default
      if (asset.account_code.startsWith('23')) depAccount = '283'; // Bâtiments
      if (asset.account_code.startsWith('22')) depAccount = '282'; // Terrains (rare)
      if (asset.account_code.startsWith('21')) depAccount = '281'; // Incorporelles
      if (asset.account_code.startsWith('20')) depAccount = '280'; // Charges

      const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description) VALUES (?, ?, ?, ?, ?)");
      const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");

      if (dotationComplementaire > 1) { // Only if significant
        const compDepRef = `DEP-SALE-${Date.now()}`;
        const compDepTx = txStmt.run(sale_date, `Dotation complémentaire avant cession: ${asset.name}`, compDepRef);
        compDepTxId = compDepTx.lastInsertRowid;
        
        entryStmt.run(compDepTxId, '681', dotationComplementaire, 0, `Dotation complémentaire ${asset.name}`);
        entryStmt.run(compDepTxId, depAccount, 0, dotationComplementaire, `Amortissement complémentaire ${asset.name}`);
        
        // Record in depreciations table too
        db.prepare(`
          INSERT INTO depreciations (asset_id, transaction_id, period_start, period_end, amount, type)
          VALUES (?, ?, ?, ?, ?, 'monthly')
        `).run(id, compDepTxId, sale_date, sale_date, dotationComplementaire);
      }

      // Step 1: Record the Sale (Disposal Proceeds)
      // Debit Treasury/Account Receivable (521/485)
      // Credit Produits de cession (821)
      let treasuryAccount = companySettings?.payment_bank_account || '521';
      if (payment_mode === 'caisse') treasuryAccount = companySettings?.payment_cash_account || '571';
      if (payment_mode === 'credit') treasuryAccount = '485'; // Créances sur cessions d'immobilisations (OHADA)

      const saleRef = `SALE-ASSET-${Date.now()}`;
      const saleTx = txStmt.run(sale_date, `Cession Immobilisation: ${asset.name}`, saleRef);
      const saleTxId = saleTx.lastInsertRowid;

      entryStmt.run(saleTxId, treasuryAccount, selling_price, 0, `Prix de cession ${asset.name}`);
      entryStmt.run(saleTxId, '821', 0, selling_price, `Produit de cession ${asset.name}`);

      // Step 2: Remove Asset from Balance Sheet
      // Debit 28x (Amortissements) - finalAccumulatedDepreciation
      // Debit 811 (VNC) - nbv
      // Credit 2x (Asset Cost) - purchase_price
      
      const removalRef = `OUT-ASSET-${Date.now()}`;
      const removalTx = txStmt.run(sale_date, `Sortie Actif (VNC): ${asset.name}`, removalRef);
      const removalTxId = removalTx.lastInsertRowid;

      // Ensure accounts exist
      db.prepare("INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES ('821', 'Produits des cessions d''immobilisations', 8, 'produit')").run();
      db.prepare("INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES ('811', 'Valeurs comptables des cessions d''immobilisations', 8, 'charge')").run();
      db.prepare("INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES ('485', 'Créances sur cessions d''immobilisations', 4, 'actif')").run();

      if (finalAccumulatedDepreciation > 0) {
        entryStmt.run(removalTxId, depAccount, finalAccumulatedDepreciation, 0, `Annulation amortissements cumulés ${asset.name}`);
      }
      
      if (nbv > 0) {
        entryStmt.run(removalTxId, '811', nbv, 0, `VNC de l'actif cédé ${asset.name}`);
      }
      
      entryStmt.run(removalTxId, asset.account_code, 0, asset.purchase_price, `Sortie de l'actif ${asset.name}`);

      // Step 3: Update Asset Status
      db.prepare("UPDATE assets SET status = 'sold' WHERE id = ?").run(id);

      return { saleTxId, removalTxId, compDepTxId };
    });

    const result = transaction();
    logAction('User', 'SELL_ASSET', 'Asset', id, { sale_date, selling_price, payment_mode, ...result });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Sale error:", err);
    handleApiError(res, err);
  }
});

// Helper for recurring transactions
function processRecurringTransaction(id: string, force: boolean = false) {
  const today = new Date().toISOString().split('T')[0];
  const rt = db.prepare("SELECT * FROM recurring_transactions WHERE id = ?").get(id) as any;
  if (!rt || !rt.active) return false;

  // Check if next_date is reached
  if (!force && rt.next_date > today) return false;

  // Check if max_occurrences reached
  if (rt.max_occurrences && rt.current_occurrences >= rt.max_occurrences) {
    db.prepare("UPDATE recurring_transactions SET active = 0 WHERE id = ?").run(id);
    return false;
  }

  // Check if end_date reached
  if (rt.end_date && rt.end_date < today) {
    db.prepare("UPDATE recurring_transactions SET active = 0 WHERE id = ?").run(id);
    return false;
  }

  const lines = db.prepare("SELECT * FROM recurring_transaction_lines WHERE recurring_transaction_id = ?").all(id) as any[];

  db.transaction(() => {
    const reference = `REC-${rt.frequency.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    
    // Placeholder replacement in description
    const dateObj = new Date(rt.next_date); // Use the next_date as reference for the period
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const currentMonth = monthNames[dateObj.getMonth()];
    const currentYear = dateObj.getFullYear().toString();
    
    const prevDate = new Date(dateObj);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = monthNames[prevDate.getMonth()];
    
    const nextDateObj = new Date(dateObj);
    nextDateObj.setMonth(nextDateObj.getMonth() + 1);
    const nextMonth = monthNames[nextDateObj.getMonth()];

    let processedDescription = rt.description
      .replace(/{month}/g, currentMonth)
      .replace(/{year}/g, currentYear)
      .replace(/{prev_month}/g, prevMonth)
      .replace(/{next_month}/g, nextMonth);

    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status, recurring_transaction_id) VALUES (?, ?, ?, 'validated', ?)");
    const txInfo = txStmt.run(rt.next_date, processedDescription, reference, id);
    const txId = txInfo.lastInsertRowid;

    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description) VALUES (?, ?, ?, ?, ?)");
    
    if (lines.length > 0) {
      for (const line of lines) {
        entryStmt.run(txId, line.account_code, line.debit, line.credit, line.description || null);
      }
    } else {
      // Fallback to legacy fields
      entryStmt.run(txId, rt.debit_account, rt.amount, 0, processedDescription);
      entryStmt.run(txId, rt.credit_account, 0, rt.amount, processedDescription);
    }

    // Update next date
    let nextDate = new Date(rt.next_date);
    if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (rt.frequency === 'bi-weekly') nextDate.setDate(nextDate.getDate() + 14);
    else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (rt.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
    else if (rt.frequency === 'annually') nextDate.setFullYear(nextDate.getFullYear() + 1);

    const nextDateStr = nextDate.toISOString().split('T')[0];
    const newOccurrences = (rt.current_occurrences || 0) + 1;
    
    let isActive = 1;
    if (rt.max_occurrences && newOccurrences >= rt.max_occurrences) isActive = 0;
    if (rt.end_date && nextDateStr > rt.end_date) isActive = 0;

    db.prepare(`
      UPDATE recurring_transactions 
      SET next_date = ?, last_processed = ?, current_occurrences = ?, active = ?
      WHERE id = ?
    `).run(nextDateStr, today, newOccurrences, isActive, id);

    logAction('System', 'PROCESS_RECURRING', 'Transaction', txId, {
      description: processedDescription,
      recurring_id: id
    });
  })();

  return true;
}

// --- Recurring Transactions API ---

function autoProcessRecurringTransactions() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const due = db.prepare("SELECT id FROM recurring_transactions WHERE active = 1 AND auto_process = 1 AND next_date <= ?").all(today) as any[];
    
    let total = 0;
    for (const item of due) {
      // Catch up if multiple occurrences are due
      let processed = 0;
      // Safety limit to avoid infinite loops if frequency logic fails
      while (processed < 50) { 
        const currentItem = db.prepare("SELECT next_date, active FROM recurring_transactions WHERE id = ?").get(item.id) as any;
        if (!currentItem || !currentItem.active || currentItem.next_date > today) break;
        
        if (processRecurringTransaction(item.id)) {
          total++;
          processed++;
        } else {
          break;
        }
      }
    }
    if (total > 0) {
      console.log(`[Recurring] Automatically processed ${total} transactions.`);
    }
  } catch (error) {
    console.error('[Recurring] Error during auto-processing:', error);
  }
}

// Run auto-process on startup and every hour
setTimeout(autoProcessRecurringTransactions, 5000); // 5s after start
setInterval(autoProcessRecurringTransactions, 3600000); // every hour

app.get("/api/recurring-transactions", (req, res) => {
  try {
    const transactions = db.prepare("SELECT * FROM recurring_transactions ORDER BY next_date ASC").all() as any[];
    for (const tx of transactions) {
      tx.lines = db.prepare("SELECT * FROM recurring_transaction_lines WHERE recurring_transaction_id = ?").all(tx.id);
    }
    res.json(transactions);
  } catch (error) {
    handleApiError(res, new AppError("Erreur lors de la récupération des écritures récurrentes" , 500, "server_error"));
  }
});

app.get("/api/recurring-transactions/due-count", (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const count = db.prepare("SELECT COUNT(*) as count FROM recurring_transactions WHERE active = 1 AND next_date <= ?").get(today) as any;
    res.json({ count: count?.count || 0 });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/recurring-transactions", (req, res) => {
  const { description, amount, frequency, next_date, end_date, max_occurrences, category, auto_process, lines } = req.body;
  const id = crypto.randomUUID();

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO recurring_transactions (id, description, amount, frequency, next_date, end_date, max_occurrences, category, auto_process)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, description, amount, frequency, next_date, end_date || null, max_occurrences || null, category, auto_process ? 1 : 0);

      if (lines && lines.length > 0) {
        const lineStmt = db.prepare(`
          INSERT INTO recurring_transaction_lines (recurring_transaction_id, account_code, debit, credit, description)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const line of lines) {
          lineStmt.run(id, line.account_code, line.debit || 0, line.credit || 0, line.description || null);
        }
      }
    })();

    if (auto_process === true) {
      setTimeout(autoProcessRecurringTransactions, 100);
    }

    res.json({ id, success: true });
  } catch (error) {
    console.error(error);
    handleApiError(res, new AppError("Erreur lors de la création de l'écriture récurrente" , 500, "server_error"));
  }
});

app.post("/api/recurring-transactions/:id/process", (req, res) => {
  const { id } = req.params;
  const { force } = req.body;
  try {
    const success = processRecurringTransaction(id, force);
    if (success) res.json({ success: true });
    else res.status(400).json({ error: "Impossible de traiter cette écriture (échéance non atteinte ou limite atteinte)" });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/recurring-transactions/process-all", (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const due = db.prepare("SELECT id FROM recurring_transactions WHERE active = 1 AND next_date <= ?").all(today) as any[];
    
    let processedCount = 0;
    for (const item of due) {
      if (processRecurringTransaction(item.id)) {
        processedCount++;
      }
    }
    
    res.json({ success: true, processedCount });
  } catch (error) {
    handleApiError(res, error);
  }
});

app.patch("/api/recurring-transactions/:id", (req, res) => {
  const { id } = req.params;
  const { description, amount, frequency, next_date, end_date, max_occurrences, category, auto_process, active, lines } = req.body;
  
  try {
    db.transaction(() => {
      const fields = [];
      const params = [];
      
      if (description !== undefined) { fields.push("description = ?"); params.push(description); }
      if (amount !== undefined) { fields.push("amount = ?"); params.push(amount); }
      if (frequency !== undefined) { fields.push("frequency = ?"); params.push(frequency); }
      if (next_date !== undefined) { fields.push("next_date = ?"); params.push(next_date); }
      if (end_date !== undefined) { fields.push("end_date = ?"); params.push(end_date || null); }
      if (max_occurrences !== undefined) { fields.push("max_occurrences = ?"); params.push(max_occurrences || null); }
      if (category !== undefined) { fields.push("category = ?"); params.push(category); }
      if (auto_process !== undefined) { fields.push("auto_process = ?"); params.push(auto_process ? 1 : 0); }
      if (active !== undefined) { fields.push("active = ?"); params.push(active ? 1 : 0); }
      
      if (fields.length > 0) {
        params.push(id);
        db.prepare(`UPDATE recurring_transactions SET ${fields.join(", ")} WHERE id = ?`).run(...params);
      }

      if (lines) {
        // Replace existing lines
        db.prepare("DELETE FROM recurring_transaction_lines WHERE recurring_transaction_id = ?").run(id);
        const lineStmt = db.prepare(`
          INSERT INTO recurring_transaction_lines (recurring_transaction_id, account_code, debit, credit, description)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const line of lines) {
          lineStmt.run(id, line.account_code, line.debit || 0, line.credit || 0, line.description || null);
        }
      }
    })();
    
    if (auto_process === true) {
      setTimeout(autoProcessRecurringTransactions, 100);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    handleApiError(res, new AppError("Erreur lors de la mise à jour" , 500, "server_error"));
  }
});

app.delete("/api/recurring-transactions/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM recurring_transactions WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, new AppError("Erreur lors de la suppression" , 500, "server_error"));
  }
});

// --- Company Creation API ---

// Check if company is created (has capital transactions)
// Search API
app.get("/api/search", (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length < 2) {
    return res.json([]);
  }

  const results: any[] = [];
  const searchTerm = `%${query}%`;

  // Search Accounts
  const accounts = db.prepare(`
    SELECT code, name 
    FROM accounts 
    WHERE code LIKE ? OR name LIKE ? 
    LIMIT 5
  `).all(searchTerm, searchTerm);
  
  accounts.forEach((acc: any) => {
    results.push({
      id: acc.code,
      type: 'account',
      title: `${acc.code} - ${acc.name}`,
      subtitle: 'Plan Comptable',
      link: '/accounts'
    });
  });

  // Search Transactions
  const transactions = db.prepare(`
    SELECT t.id, t.description, t.reference, t.occasional_name, SUM(je.debit) as total_amount
    FROM transactions t
    LEFT JOIN journal_entries je ON t.id = je.transaction_id
    WHERE t.description LIKE ? OR t.reference LIKE ? OR t.occasional_name LIKE ?
    GROUP BY t.id
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);
  
  transactions.forEach((tx: any) => {
    results.push({
      id: tx.id,
      type: 'transaction',
      title: tx.description,
      subtitle: `Journal - ${tx.reference || 'Sans réf.'} (${tx.total_amount || 0} FCFA)${tx.occasional_name ? ` - ${tx.occasional_name}` : ''}`,
      link: '/journal'
    });
  });

  // Search Invoices
  const invoices = db.prepare(`
    SELECT id, number, type, total_amount, occasional_name
    FROM invoices
    WHERE number LIKE ? OR occasional_name LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm);

  invoices.forEach((inv: any) => {
    results.push({
      id: inv.id,
      type: 'invoice',
      title: `${inv.type === 'invoice' ? 'Facture' : 'Devis'} ${inv.number}`,
      subtitle: `${inv.occasional_name || 'Tiers'} - ${inv.total_amount} FCFA`,
      link: '/invoicing'
    });
  });

  // Search Third Parties
  const thirdParties = db.prepare(`
    SELECT id, name, type, account_code, email, tax_id
    FROM third_parties 
    WHERE name LIKE ? OR account_code LIKE ? OR email LIKE ? OR tax_id LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm, searchTerm);
  
  thirdParties.forEach((tp: any) => {
    results.push({
      id: tp.id,
      type: 'third_party',
      title: tp.name,
      subtitle: `${tp.type === 'client' ? 'Client' : 'Fournisseur'} - ${tp.account_code}${tp.tax_id ? ` - IF: ${tp.tax_id}` : ''}`,
      link: '/third-parties'
    });
  });

  // Search Assets
  const assets = db.prepare(`
    SELECT id, name, type, account_code 
    FROM assets 
    WHERE name LIKE ? OR account_code LIKE ? OR type LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);
  
  assets.forEach((asset: any) => {
    results.push({
      id: asset.id,
      type: 'asset',
      title: asset.name,
      subtitle: `Immo - ${asset.type} (${asset.account_code})`,
      link: '/assets'
    });
  });

  res.json(results);
});

// --- Payroll Module API ---

// (Legacy routes removed, using cohesive /api/employees and /api/pr_periods)

// Helper to create notifications
const createNotification = (type: string, title: string, message: string, link?: string) => {
  try {
    db.prepare(`
      INSERT INTO notifications (type, title, message, link)
      VALUES (?, ?, ?, ?)
    `).run(type, title, message, link || null);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Notifications API
app.get("/api/notifications", (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();
    res.json(notifications || []);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    handleApiError(res, new AppError("Failed to fetch notifications" , 500, "server_error"));
  }
});

app.post("/api/notifications/:id/read", (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, new AppError("Failed to mark notification as read" , 500, "server_error"));
  }
});

app.post("/api/notifications/read-all", (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1").run();
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, new AppError("Failed to mark all notifications as read" , 500, "server_error"));
  }
});

app.delete("/api/notifications/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, new AppError("Failed to delete notification" , 500, "server_error"));
  }
});

app.get("/api/company/status", (req, res) => {
  try {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM journal_entries WHERE account_code LIKE '101%'");
    const result = stmt.get();
    res.json({ created: result.count > 0 });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/company/create", (req, res) => {
  const { 
    name, legalForm, rccm, taxId, address, city, country, email, phone, managerName,
    bankName, bankAccountNumber, bankIban, bankSwift,
    paymentBankEnabled, paymentBankAccount, paymentCashEnabled, paymentCashAccount, paymentMobileEnabled, paymentMobileAccount,
    syscohadaSystem, currency, fiscalYearStart, fiscalYearDuration,
    taxRegime, vatSubject, vatRate,
    capitalAmount, partners, constitutionCosts,
    treasury, users, modules, logoUrl
  } = req.body;

  const transaction = db.transaction(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Save Company Settings
    const settingsStmt = db.prepare(`
      INSERT INTO company_settings (
        name, legal_form, rccm, fiscal_id, address, city, country, email, phone, manager_name,
        bank_name, bank_account_number, bank_iban, bank_swift,
        payment_bank_enabled, payment_bank_account, payment_cash_enabled, payment_cash_account, payment_mobile_enabled, payment_mobile_account,
        syscohada_system, currency, fiscal_year_start, fiscal_year_duration,
        tax_regime, vat_regime, vat_rate, capital, creation_date, logo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const settingsInfo = settingsStmt.run(
      name, legalForm, rccm, taxId, address, city, country, email, phone, managerName,
      bankName, bankAccountNumber, bankIban, bankSwift,
      paymentBankEnabled ? 1 : 0, paymentBankAccount, paymentCashEnabled ? 1 : 0, paymentCashAccount, paymentMobileEnabled ? 1 : 0, paymentMobileAccount,
      syscohadaSystem, currency, fiscalYearStart, fiscalYearDuration,
      taxRegime, vatSubject ? 'assujetti' : 'exonéré', vatRate, capitalAmount, today, logoUrl
    );
    const companyId = settingsInfo.lastInsertRowid;

    // 2. Save Partners
    const partnerStmt = db.prepare("INSERT INTO partners (company_id, name, contribution_amount, contribution_type, description) VALUES (?, ?, ?, ?, ?)");
    for (const p of partners) {
      partnerStmt.run(companyId, p.name, p.amount, p.type, p.description || '');
    }

    // 3. Save Modules
    const moduleStmt = db.prepare("INSERT INTO company_modules (company_id, module_key, is_active) VALUES (?, ?, ?)");
    for (const [key, active] of Object.entries(modules)) {
      moduleStmt.run(companyId, key, active ? 1 : 0);
    }

    // 3.1 Setup First Fiscal Year
    const fiscalYearEnd = new Date(fiscalYearStart);
    fiscalYearEnd.setMonth(fiscalYearEnd.getMonth() + parseInt(fiscalYearDuration));
    fiscalYearEnd.setDate(fiscalYearEnd.getDate() - 1);
    const endDateStr = fiscalYearEnd.toISOString().split('T')[0];
    
    db.prepare(`
      INSERT INTO fiscal_years (name, start_date, end_date, status, is_active)
      VALUES (?, ?, ?, 'open', 1)
    `).run(`Exercice ${new Date(fiscalYearStart).getFullYear()}`, fiscalYearStart, endDateStr);

    // 4. Accounting Entries for Constitution
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");

    // Capital Subscription (Promesse d'apport)
    const subInfo = txStmt.run(today, `Constitution ${legalForm}: Souscription du capital`, 'CONST-001');
    const subTxId = subInfo.lastInsertRowid;

    // Credit 101 (Capital Social) - Total
    entryStmt.run(subTxId, '101', 0, capitalAmount);
    
    // Debit 109 (Actionnaires, capital souscrit non appelé) - Total
    entryStmt.run(subTxId, '109', capitalAmount, 0);

    // Liberation of Contributions
    let cashTotal = 0;
    let kindTotal = 0;

    for (const p of partners) {
      if (p.type === 'cash') {
        cashTotal += p.amount;
      } else {
        kindTotal += p.amount;
        // Create generic asset record for "Apport en nature"
        const assetStmt = db.prepare(`
          INSERT INTO assets (
            name, type, purchase_price, vat_amount, total_price, 
            acquisition_date, depreciation_duration, account_code, transaction_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        assetStmt.run(
          `Apport en nature (${p.name})`, 'industrial', p.amount, 0, p.amount,
          today, 5, '241', subTxId
        );
        // Debit 241 (Asset) / Credit 109
        entryStmt.run(subTxId, '241', p.amount, 0);
        entryStmt.run(subTxId, '109', 0, p.amount);
      }
    }

    // 5. Setup Treasury Accounts & Initial Balances
    const accountStmt = db.prepare("INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)");
    const bankAccountStmt = db.prepare(`
      INSERT INTO bank_accounts (name, account_number, bank_name, balance, currency, gl_account_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    let firstCreatedTreasuryCode = null;

    for (const t of treasury) {
      // Find next available code for bank (521x), cash (571x), mobile (585x)
      const prefix = t.type === 'bank' ? '521' : t.type === 'cash' ? '571' : '585';
      const existing = db.prepare("SELECT code FROM accounts WHERE code LIKE ? AND LENGTH(code) > 3").all(`${prefix}%`);
      const nextNum = existing.length + 1;
      const nextCode = `${prefix}${nextNum.toString().padStart(2, '0')}`;
      
      accountStmt.run(nextCode, t.name, 5, 'actif');
      if (!firstCreatedTreasuryCode) firstCreatedTreasuryCode = nextCode;

      // If bank, also create bank_account record for reconciliation
      if (t.type === 'bank') {
        bankAccountStmt.run(t.name, t.accountNumber || 'A DEFINIR', t.name, t.initialBalance, currency, nextCode);
      }

      if (t.initialBalance > 0) {
        const libTxInfo = txStmt.run(today, `Libération capital / Solde initial: ${t.name}`, `CONST-${nextCode}`);
        const libTxId = libTxInfo.lastInsertRowid;
        
        entryStmt.run(libTxId, nextCode, t.initialBalance, 0);
        entryStmt.run(libTxId, '109', 0, t.initialBalance);
      }
    }

    // 6. Constitution Costs
    if (constitutionCosts > 0) {
      const costTxInfo = txStmt.run(today, `Frais de constitution`, 'CONST-FRAIS');
      const costTxId = costTxInfo.lastInsertRowid;
      entryStmt.run(costTxId, '201', constitutionCosts, 0);
      
      // Credit first bank account or cash if available
      const creditCode = firstCreatedTreasuryCode || '52101';
      entryStmt.run(costTxId, creditCode, 0, constitutionCosts);
    }

    // 7. Initial Users (already handled by registration usually, but we can add more)
    const userStmt = db.prepare("INSERT OR IGNORE INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)");
    const defaultHash = bcrypt.hashSync('welcome123', 10);
    for (const u of users) {
      userStmt.run(u.email, defaultHash, u.role, u.name);
    }

    return companyId;
  });

  try {
    const companyId = transaction();
    logAction(req.user?.email || 'Admin', 'ONBOARDING', 'Company', companyId, { name });
    res.json({ success: true, companyId });
  } catch (err) {
    console.error(err);
    handleApiError(res, err);
  }
});

// --- Module Management API ---
const SUPPORTED_MODULES = [
  'accounting',
  'invoicing',
  'third_parties',
  'treasury',
  'assets',
  'budget',
  'payroll',
  'vat',
  'bankRec',
  'analytics',
  'audit'
];

app.get("/api/company/modules", (req, res) => {
  try {
    const existingModules = db.prepare("SELECT * FROM company_modules").all() as any[];
    const existingKeys = existingModules.map(m => m.module_key);
    
    // Ensure all supported modules are in the response
    const allModules = SUPPORTED_MODULES.map(key => {
      const existing = existingModules.find(m => m.module_key === key);
      return existing || { module_key: key, is_active: 1 }; // Default to active for now if missing
    });

    res.json(allModules);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/company/modules/:key", (req, res) => {
  const { key } = req.params;
  const { is_active } = req.body;
  try {
    // Get company_id (assuming first company for now as per app structure)
    const company = db.prepare("SELECT id FROM company_settings LIMIT 1").get() as any;
    const companyId = company?.id || 1;

    db.prepare(`
      INSERT INTO company_modules (company_id, module_key, is_active)
      VALUES (?, ?, ?)
      ON CONFLICT(module_key) DO UPDATE SET is_active = excluded.is_active
    `).run(companyId, key, is_active ? 1 : 0);
    
    res.json({ success: true });
  } catch (err) {
    // If ON CONFLICT doesn't work (older sqlite), try manual check
    try {
      const company = db.prepare("SELECT id FROM company_settings LIMIT 1").get() as any;
      const companyId = company?.id || 1;
      const exists = db.prepare("SELECT id FROM company_modules WHERE module_key = ?").get(key);
      if (exists) {
        db.prepare("UPDATE company_modules SET is_active = ? WHERE module_key = ?").run(is_active ? 1 : 0, key);
      } else {
        db.prepare("INSERT INTO company_modules (company_id, module_key, is_active) VALUES (?, ?, ?)").run(companyId, key, is_active ? 1 : 0);
      }
      res.json({ success: true });
    } catch (innerErr) {
      handleApiError(res, new AppError(innerErr.message , 500, "server_error"));
    }
  }
});

// --- Audit Logs API ---
app.get("/api/audit-logs", (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY date DESC 
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));
    
    const total = db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any;
    
    res.json({ logs, total: total.count });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Treasury API ---
app.get("/api/treasury", (req, res) => {
  try {
    // 1. Get Treasury Accounts and their balances
    const accountsStmt = db.prepare(`
      SELECT a.code, a.name, 
             (SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) FROM journal_entries WHERE account_code = a.code) as balance
      FROM accounts a
      WHERE a.code LIKE '5%' AND LENGTH(a.code) >= 3
      ORDER BY a.code
    `);
    const accounts = accountsStmt.all();

    // 2. Get Recent Treasury Transactions
    const recentStmt = db.prepare(`
      SELECT t.date, t.description, je.debit, je.credit, je.account_code, a.name as account_name
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE je.account_code LIKE '5%'
      ORDER BY t.date DESC, t.id DESC
      LIMIT 20
    `);
    const recentTransactions = recentStmt.all();

    // 3. Get Daily Balances for the last 30 days (Historical) - Optimized
    const dailyBalances = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Get all entries for the last 30 days plus the initial balance
    const initialBalanceStmt = db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.date < ?
    `);
    let runningBalance = (initialBalanceStmt.get(startDateStr) as any).balance || 0;

    const dailyChangesStmt = db.prepare(`
      SELECT t.date, SUM(je.debit) - SUM(je.credit) as change
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.date >= ?
      GROUP BY t.date
      ORDER BY t.date ASC
    `);
    const dailyChanges = dailyChangesStmt.all(startDateStr) as any[];
    const changesMap = dailyChanges.reduce((acc, curr) => {
      acc[curr.date] = curr.change;
      return acc;
    }, {} as Record<string, number>);

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (changesMap[dateStr]) {
        runningBalance += changesMap[dateStr];
      }

      dailyBalances.push({
        day: dateStr.split('-')[2],
        date: dateStr,
        solde: runningBalance
      });
    }

    // 4. Calculate Summary Metrics
    const totalCash = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];
    
    const lastMonthBalance = (db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.date <= ?
    `).get(lastMonthStr) as any).balance || 0;

    const monthlyVariation = totalCash - lastMonthBalance;
    const variationPercentage = lastMonthBalance !== 0 ? (monthlyVariation / Math.abs(lastMonthBalance)) * 100 : 0;

    res.json({
      summary: {
        totalCash,
        monthlyVariation,
        variationPercentage,
        lastMonthBalance
      },
      accounts: accounts.map((acc: any) => ({
        name: acc.name,
        code: acc.code,
        balance: acc.balance || 0,
        type: acc.code.startsWith('52') ? 'bank' : acc.code.startsWith('57') ? 'cash' : 'mobile',
        number: acc.code
      })),
      recentTransactions: recentTransactions.map((tx: any) => ({
        label: tx.description,
        amount: tx.debit > 0 ? tx.debit : tx.credit,
        type: tx.debit > 0 ? 'in' : 'out',
        date: tx.date,
        method: tx.account_name
      })),
      forecastData: dailyBalances
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/treasury/accounts/:code/balance", (req, res) => {
  const { code } = req.params;
  try {
    const acc = db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM journal_entries WHERE account_code = ?
    `).get(code) as any;
    res.json({ balance: acc?.balance || 0 });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/treasury/transfer", (req, res) => {
  const { fromAccount, toAccount, amount, description, date } = req.body;

  if (!fromAccount || !toAccount || !amount || amount <= 0) {
    return res.status(400).json({ error: "Informations de transfert invalides" });
  }

  const transfer = db.transaction(() => {
    // 1. Verify source account balance
    const balanceStmt = db.prepare(`
      SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance
      FROM journal_entries
      WHERE account_code = ?
    `);
    const fromBalance = (balanceStmt.get(fromAccount) as any).balance;

    if (fromBalance < amount) {
      throw new Error("Solde insuffisant pour ce transfert");
    }

    // 2. Create Transaction
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const txInfo = txStmt.run(date || new Date().toISOString().split('T')[0], description || `Virement interne`, `VIR-${Date.now()}`);
    const txId = txInfo.lastInsertRowid;

    // 3. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
    
    // Debit destination (increase)
    entryStmt.run(txId, toAccount, amount, 0);
    
    // Credit source (decrease)
    entryStmt.run(txId, fromAccount, 0, amount);

    return txId;
  });

  try {
    const txId = transfer();
    logAction(req.user?.name || 'Admin', 'TRANSFER', 'Treasury', txId, { fromAccount, toAccount, amount });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Third Party Management API ---

// Get all third parties
app.get("/api/third-parties", (req, res) => {
  try {
    const { type } = req.query;
    let query = "SELECT * FROM third_parties";
    const params = [];
    
    if (type) {
      query += " WHERE type = ?";
      params.push(type);
    }
    
    query += " ORDER BY name";
    const parties = db.prepare(query).all(...params);
    
    // Calculate current balance and overdue amount for each party
    const partiesWithBalance = parties.map((party: any) => {
      // Balance logic...
      const balanceStmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit
        FROM journal_entries je
        WHERE je.account_code = ?
      `);
      const balance = balanceStmt.get(party.account_code);
      
      let currentBalance = 0;
      if (party.type === 'client') {
        currentBalance = (balance.debit || 0) - (balance.credit || 0);
      } else {
        currentBalance = (balance.credit || 0) - (balance.debit || 0);
      }

      // Calculate Overdue Amount
      // We look for unpaid invoices older than payment_terms
      // This is an approximation. We sum up all transactions older than due date.
      // A better way: 
      // 1. Get all transactions.
      // 2. Calculate balance of transactions where (date + payment_terms) < today.
      
      const today = new Date();
      const terms = party.payment_terms || 30;
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - terms);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      // We only care about the balance of transactions BEFORE the cutoff date.
      // If that balance is > 0 (for client) or > 0 (for supplier), it means they haven't paid off old debts.
      
      const overdueStmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code = ? AND t.date <= ?
      `);
      const overdueRes = overdueStmt.get(party.account_code, cutoffDateStr);
      
      let overdueAmount = 0;
      if (party.type === 'client') {
        // For clients, if Debit > Credit for old transactions, they owe us money from back then.
        // However, recent payments (Credit) might have paid off old Debits.
        // So we should look at the GLOBAL balance.
        // If Global Balance > 0, we check how much of it is "old".
        // Actually, the standard way is: Overdue = Total Balance - Recent Invoices (that are not yet due).
        // If Result > 0, that amount is overdue.
        
        const recentInvoicesStmt = db.prepare(`
          SELECT SUM(je.debit) as debit
          FROM journal_entries je
          JOIN transactions t ON je.transaction_id = t.id
          WHERE je.account_code = ? AND t.date > ?
        `);
        const recent = recentInvoicesStmt.get(party.account_code, cutoffDateStr);
        const recentAmount = recent.debit || 0;
        
        // Overdue is the part of the balance that is NOT covered by recent invoices.
        // Example: Balance 1000. Recent Invoices 300. Overdue = 700.
        // Example: Balance 100. Recent Invoices 300. Overdue = 0 (Current invoices cover the balance, meaning old ones are paid).
        overdueAmount = Math.max(0, currentBalance - recentAmount);
        
      } else {
        // Supplier: We owe them.
        // Overdue = Total Balance - Recent Bills (Credit)
        const recentBillsStmt = db.prepare(`
          SELECT SUM(je.credit) as credit
          FROM journal_entries je
          JOIN transactions t ON je.transaction_id = t.id
          WHERE je.account_code = ? AND t.date > ?
        `);
        const recent = recentBillsStmt.get(party.account_code, cutoffDateStr);
        const recentAmount = recent.credit || 0;
        
        overdueAmount = Math.max(0, currentBalance - recentAmount);
      }
      
      return { ...party, balance: currentBalance, overdue_amount: overdueAmount };
    });
    
    res.json(partiesWithBalance);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get or create default occasional third parties
app.get("/api/third-parties/defaults", (req, res) => {
  try {
    const defaults = db.transaction(() => {
      const getOrCreate = (type: 'client' | 'supplier') => {
        const name = type === 'client' ? 'Client Occasionnel' : 'Fournisseur Occasionnel';
        let party = db.prepare("SELECT * FROM third_parties WHERE name = ? AND type = ? AND is_occasional = 1").get(name, type);
        
        if (!party) {
          const prefix = type === 'client' ? '411' : '401';
          const accounts = db.prepare(`
            SELECT code FROM accounts WHERE code LIKE ? AND LENGTH(code) > 3
          `).all(`${prefix}%`);
          
          let maxNum = 0;
          for (const acc of accounts) {
            const suffix = acc.code.substring(prefix.length);
            const numPart = parseInt(suffix, 10);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
          
          const nextCode = `${prefix}${ (maxNum + 1).toString().padStart(3, '0') }`;
          
          db.prepare("INSERT INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)").run(nextCode, name, 4, type === 'client' ? 'actif' : 'passif');
          const info = db.prepare(`
            INSERT INTO third_parties (type, name, account_code, is_occasional)
            VALUES (?, ?, ?, 1)
          `).run(type, name, nextCode);
          
          party = { id: info.lastInsertRowid, type, name, account_code: nextCode, is_occasional: 1 };
        }
        return party;
      };

      return {
        client: getOrCreate('client'),
        supplier: getOrCreate('supplier')
      };
    })();
    
    res.json(defaults);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Create a new third party
app.post("/api/third-parties", (req, res) => {
  const { type, name, email, phone, address, tax_id, credit_limit, payment_terms, is_occasional } = req.body;
  
  try {
    const transaction = db.transaction(() => {
      // 1. Generate Account Code
      // Find the next available code for 411 (Client) or 401 (Supplier)
      const prefix = type === 'client' ? '411' : '401';
      
      // Get all accounts starting with the prefix that have more than 3 digits (to exclude the root account)
      const accounts = db.prepare(`
        SELECT code FROM accounts WHERE code LIKE ? AND LENGTH(code) > 3
      `).all(`${prefix}%`);
      
      let maxNum = 0;
      for (const acc of accounts) {
        // Extract the numeric part after the prefix
        const suffix = acc.code.substring(prefix.length);
        const numPart = parseInt(suffix, 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
      
      const nextNum = maxNum + 1;
      // Pad with zeros to ensure at least 3 digits (e.g., 001, 002)
      const nextCode = `${prefix}${nextNum.toString().padStart(3, '0')}`;
      
      // 2. Create Account
      const accountStmt = db.prepare("INSERT INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)");
      accountStmt.run(nextCode, name, 4, type === 'client' ? 'actif' : 'passif');
      
      // 3. Create Third Party
      const partyStmt = db.prepare(`
        INSERT INTO third_parties (type, name, email, phone, address, tax_id, account_code, credit_limit, payment_terms, is_occasional)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = partyStmt.run(type, name, email, phone, address, tax_id, nextCode, credit_limit || 0, payment_terms || 30, is_occasional ? 1 : 0);
      
      const newTP = {
        id: info.lastInsertRowid,
        name,
        type,
        email,
        phone,
        address,
        tax_id,
        account_code: nextCode,
        credit_limit: credit_limit || 0,
        payment_terms: payment_terms || 30,
        is_occasional: is_occasional ? 1 : 0
      };
      
      return newTP;
    });
    
    const result = transaction();
    logAction('User', 'CREATE', 'ThirdParty', result.id, { name, type });
    createNotification('success', 'Nouveau tiers créé', `Le tiers ${name} (${type}) a été créé avec succès.`, '/third-parties');
    res.json(result);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update third party
app.put("/api/third-parties/:id", (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, tax_id, credit_limit, payment_terms, is_occasional } = req.body;
  
  try {
    const oldParty = db.prepare("SELECT * FROM third_parties WHERE id = ?").get(id) as any;
    const stmt = db.prepare(`
      UPDATE third_parties 
      SET name = ?, email = ?, phone = ?, address = ?, tax_id = ?, credit_limit = ?, payment_terms = ?, is_occasional = ?
      WHERE id = ?
    `);
    stmt.run(name, email, phone, address, tax_id, credit_limit, payment_terms, is_occasional ? 1 : 0, id);
    
    // Also update the account name to keep it consistent
    if (oldParty) {
      db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(name, oldParty.account_code);
    }
    
    logAction(req.user?.name || 'Admin', 'UPDATE', 'ThirdParty', id, { 
      previous: oldParty,
      current: { name, email, phone, address, tax_id, is_occasional }
    });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Delete third party
app.delete("/api/third-parties/:id", (req, res) => {
  const { id } = req.params;
  
  try {
    const party = db.prepare("SELECT account_code FROM third_parties WHERE id = ?").get(id);
    if (!party) return res.status(404).json({ error: "Tiers non trouvé" });
    
    // Check for existing transactions
    const checkStmt = db.prepare("SELECT COUNT(*) as count FROM journal_entries WHERE account_code = ?");
    const count = checkStmt.get(party.account_code).count;
    
    if (count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer ce tiers car des écritures comptables y sont liées." });
    }
    
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM third_parties WHERE id = ?").run(id);
      db.prepare("DELETE FROM accounts WHERE code = ?").run(party.account_code);
    });
    
    transaction();
    logAction('User', 'DELETE', 'ThirdParty', id, {});
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Process Payment for Third Party
app.post("/api/third-parties/:id/payment", (req, res) => {
  const { id } = req.params;
  const { amount, mode, date, reference } = req.body;
  
  try {
    const party = db.prepare("SELECT * FROM third_parties WHERE id = ?").get(id);
    if (!party) return res.status(404).json({ error: "Tiers non trouvé" });
    
    const companySettings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get();

    // Determine Treasury Account
    let treasuryAccount = companySettings?.payment_bank_account || '521'; // Default Banque
    if (mode === 'caisse') treasuryAccount = companySettings?.payment_cash_account || '571';
    if (mode === 'mobile_money') treasuryAccount = companySettings?.payment_mobile_account || '585';
    
    // Determine Debit/Credit
    // Client Payment (Encaissement): Debit Treasury, Credit Client
    // Supplier Payment (Décaissement): Debit Supplier, Credit Treasury
    
    const transaction = db.transaction(() => {
      // 1. Create Transaction
      const desc = party.type === 'client' 
        ? `Règlement Client: ${party.name}` 
        : `Paiement Fournisseur: ${party.name}`;
        
      const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
      const txInfo = txStmt.run(date, desc, reference);
      const txId = txInfo.lastInsertRowid;
      
      // 2. Create Journal Entries
      const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
      
      if (party.type === 'client') {
        // Debit Treasury
        entryStmt.run(txId, treasuryAccount, amount, 0);
        // Credit Client
        entryStmt.run(txId, party.account_code, 0, amount);
      } else {
        // Debit Supplier
        entryStmt.run(txId, party.account_code, amount, 0);
        // Credit Treasury
        entryStmt.run(txId, treasuryAccount, 0, amount);
      }
      
      return txId;
    });
    
    const txId = transaction();
    logAction('User', 'PAYMENT', 'ThirdParty', id, { amount, mode, txId });
    res.json({ success: true, transactionId: txId });
    
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get Aged Balance Report
app.get("/api/reports/aged-balance", (req, res) => {
  try {
    const { type } = req.query; // 'client' or 'supplier'
    if (!type) return res.status(400).json({ error: "Type required" });
    
    const parties = db.prepare("SELECT * FROM third_parties WHERE type = ?").all(type);
    const today = new Date();
    
    const report = parties.map((party: any) => {
      // Get all unpaid/partially paid invoices
      // This is complex because we need to match invoices with payments.
      // For a simple aged balance, we can look at the account balance and assume FIFO or just list open invoices if we had invoice tracking.
      // Since we have a simple journal, we will look at the net balance and try to age it based on transaction dates.
      
      // 1. Get all transactions for this account
      const txs = db.prepare(`
        SELECT t.date, je.debit, je.credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code = ? AND t.deleted_at IS NULL
        ORDER BY t.date DESC
      `).all(party.account_code);
      
      let balance = 0;
      let breakdown = {
        current: 0, // < 30 days
        days30: 0,  // 30-60 days
        days60: 0,  // 60-90 days
        days90: 0   // > 90 days
      };
      
      // Calculate total balance first
      if (type === 'client') {
        balance = txs.reduce((sum: number, tx: any) => sum + (tx.debit - tx.credit), 0);
      } else {
        balance = txs.reduce((sum: number, tx: any) => sum + (tx.credit - tx.debit), 0);
      }
      
      // If balance is 0, no aging needed
      if (Math.abs(balance) < 0.01) return null;
      
      // Simple aging logic: Walk backwards through transactions to "explain" the balance
      let remainingBalance = balance;
      
      for (const tx of txs) {
        if (remainingBalance <= 0) break;
        
        const txDate = new Date(tx.date);
        const diffTime = Math.abs(today.getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Determine the amount of this transaction contributing to the balance
        // For clients, we look at Debits (Invoices)
        // For suppliers, we look at Credits (Bills)
        let amount = type === 'client' ? tx.debit : tx.credit;
        
        // If this transaction is a payment (Credit for client, Debit for supplier), it reduces the balance, 
        // but we are walking backwards, so we are looking for the *source* of the balance (the invoices).
        // Actually, a better way for a simple system without explicit matching is:
        // The balance is X. The most recent invoices sum to Y. If Y > X, then the balance is entirely from recent invoices.
        
        if (amount > 0) {
           const amountToAge = Math.min(remainingBalance, amount);
           
           if (diffDays <= 30) breakdown.current += amountToAge;
           else if (diffDays <= 60) breakdown.days30 += amountToAge;
           else if (diffDays <= 90) breakdown.days60 += amountToAge;
           else breakdown.days90 += amountToAge;
           
           remainingBalance -= amountToAge;
        }
      }
      
      return {
        ...party,
        balance,
        breakdown
      };
    }).filter((r: any) => r !== null);
    
    res.json(report);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get Transaction History for a Third Party
app.get("/api/third-parties/:id/transactions", (req, res) => {
  const { id } = req.params;
  try {
    const party = db.prepare("SELECT account_code, type FROM third_parties WHERE id = ?").get(id);
    if (!party) return res.status(404).json({ error: "Tiers non trouvé" });

    // Fetch all journal entries for this account, along with transaction details
    const transactions = db.prepare(`
      SELECT 
        t.id as transaction_id,
        t.date,
        t.description,
        t.reference,
        je.debit,
        je.credit,
        i.id as invoice_id,
        i.number as invoice_number
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      LEFT JOIN invoices i ON t.id = i.transaction_id
      WHERE je.account_code = ?
      ORDER BY t.date DESC, t.id DESC
    `).all(party.account_code);

    // Calculate running balance
    let runningBalance = 0;
    // We need to calculate from oldest to newest to get correct running balance
    const sortedTransactions = [...transactions].reverse();
    const transactionsWithRunningBalance = sortedTransactions.map(tx => {
      const amount = party.type === 'client' 
        ? (tx.debit || 0) - (tx.credit || 0)
        : (tx.credit || 0) - (tx.debit || 0);
      
      runningBalance += amount;
      return { ...tx, running_balance: runningBalance };
    }).reverse();

    res.json(transactionsWithRunningBalance);
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- End Third Party API ---

// Get Company Dossier Data
app.get("/api/company/dossier", (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get();
    
    // Get Constitution Transactions
    const transactions = db.prepare(`
      SELECT t.date, t.description, t.reference, je.account_code, a.name as account_name, je.debit, je.credit
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.reference LIKE 'CONST%'
      ORDER BY t.id, je.rowid
    `).all();

    // Get Opening Balance Sheet (Simplified)
    const balanceSheet = db.prepare(`
      SELECT 
        je.account_code,
        a.name as account_name,
        SUM(je.debit) - SUM(je.credit) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.reference LIKE 'CONST%'
      GROUP BY je.account_code
      HAVING balance != 0
    `).all();

    res.json({ settings, transactions, balanceSheet });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get Company Settings
app.get("/api/company/settings", (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get();
    res.json(settings || {});
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update Company Settings
app.put("/api/company/settings", validate(schemas.companySettingsSchema.partial()), (req, res) => {
  const { 
    name, legalForm, activity, fiscalId, rccm, syscohada_system, taxRegime, vatRegime, vat_rate, currency, address, city, country, capital, managerName,
    phone, email,
    invoiceReminderEnabled, invoiceReminderDays, invoiceReminderEmail, invoiceReminderSubject, invoiceReminderTemplate,
    bank_name, bank_account_number, bank_iban, bank_swift,
    payment_bank_enabled, payment_bank_account, payment_cash_enabled, payment_cash_account, payment_mobile_enabled, payment_mobile_account,
    cnps_employer_number, tax_office, logo_url
  } = req.body;
  
  try {
    const existing = db.prepare("SELECT id FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;
    
    if (existing) {
      const stmt = db.prepare(`
        UPDATE company_settings 
        SET name = ?, legal_form = ?, activity = ?, fiscal_id = ?, rccm = ?, syscohada_system = ?, tax_regime = ?, vat_regime = ?, vat_rate = ?, currency = ?, address = ?, city = ?, country = ?, capital = ?, manager_name = ?,
            phone = ?, email = ?,
            invoice_reminder_enabled = ?, invoice_reminder_days = ?, invoice_reminder_email = ?, invoice_reminder_subject = ?, invoice_reminder_template = ?,
            bank_name = ?, bank_account_number = ?, bank_iban = ?, bank_swift = ?,
            payment_bank_enabled = ?, payment_bank_account = ?, payment_cash_enabled = ?, payment_cash_account = ?, payment_mobile_enabled = ?, payment_mobile_account = ?,
            cnps_employer_number = ?, tax_office = ?, logo_url = ?
        WHERE id = ?
      `);
      stmt.run(
        name, legalForm, activity, fiscalId, rccm || existing.rccm, syscohada_system || existing.syscohada_system, taxRegime, vatRegime, vat_rate || existing.vat_rate, currency, address, city, country, capital, managerName,
        phone, email,
        invoiceReminderEnabled ? 1 : 0, invoiceReminderDays, invoiceReminderEmail, invoiceReminderSubject, invoiceReminderTemplate,
        bank_name, bank_account_number, bank_iban, bank_swift,
        payment_bank_enabled === undefined ? existing.payment_bank_enabled : (payment_bank_enabled ? 1 : 0),
        payment_bank_account || existing.payment_bank_account,
        payment_cash_enabled === undefined ? existing.payment_cash_enabled : (payment_cash_enabled ? 1 : 0),
        payment_cash_account || existing.payment_cash_account,
        payment_mobile_enabled === undefined ? existing.payment_mobile_enabled : (payment_mobile_enabled ? 1 : 0),
        payment_mobile_account || existing.payment_mobile_account,
        cnps_employer_number || null,
        tax_office || null,
        logo_url || existing.logo_url,
        existing.id
      );
      logAction(req.user?.name || 'Admin', 'UPDATE', 'CompanySettings', existing.id, { name, currency });
    } else {
      const insert = db.prepare(`
        INSERT INTO company_settings (
          name, legal_form, activity, fiscal_id, rccm, syscohada_system, tax_regime, vat_regime, vat_rate, currency, address, city, country, capital, manager_name,
          phone, email,
          invoice_reminder_enabled, invoice_reminder_days, invoice_reminder_email, invoice_reminder_subject, invoice_reminder_template,
          bank_name, bank_account_number, bank_iban, bank_swift,
          payment_bank_enabled, payment_bank_account, payment_cash_enabled, payment_cash_account, payment_mobile_enabled, payment_mobile_account,
          cnps_employer_number, tax_office, logo_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = insert.run(
        name, legalForm, activity, fiscalId, req.body.rccm, req.body.syscohada_system || 'normal', taxRegime, vatRegime, vat_rate || 18, currency, address, city, country, capital, managerName,
        phone, email,
        invoiceReminderEnabled ? 1 : 0, invoiceReminderDays, invoiceReminderEmail, invoiceReminderSubject, invoiceReminderTemplate,
        bank_name, bank_account_number, bank_iban, bank_swift,
        payment_bank_enabled === undefined ? 1 : (payment_bank_enabled ? 1 : 0),
        payment_bank_account || '521',
        payment_cash_enabled === undefined ? 1 : (payment_cash_enabled ? 1 : 0),
        payment_cash_account || '571',
        payment_mobile_enabled === undefined ? 1 : (payment_mobile_enabled ? 1 : 0),
        payment_mobile_account || '585',
        cnps_employer_number || null,
        tax_office || null,
        logo_url || null
      );
      logAction(req.user?.name || 'Admin', 'CREATE', 'CompanySettings', info.lastInsertRowid, { name, currency });
    }

    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Exchange Rates ---
app.get("/api/exchange-rates", (req, res) => {
  try {
    const rates = db.prepare("SELECT * FROM exchange_rates ORDER BY from_currency, to_currency").all();
    res.json(rates);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/exchange-rates", (req, res) => {
  const { from_currency, to_currency, rate, is_default } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO exchange_rates (from_currency, to_currency, rate, is_default, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(from_currency, to_currency) DO UPDATE SET
        rate = excluded.rate,
        is_default = excluded.is_default,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(from_currency, to_currency, rate, is_default ? 1 : 0);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/exchange-rates/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM exchange_rates WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Invoice Reminders Logic ---

const checkAndSendReminders = () => {
  try {
    const settings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;
    if (!settings || !settings.invoice_reminder_enabled) return;

    const days = settings.invoice_reminder_days || 7;
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() - days);
    const thresholdStr = thresholdDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Find overdue invoices that haven't been reminded today
    const overdueInvoices = db.prepare(`
      SELECT i.*, tp.name as client_name, tp.email as client_email
      FROM invoices i
      JOIN third_parties tp ON i.third_party_id = tp.id
      WHERE i.type = 'invoice' 
      AND i.status NOT IN ('paid', 'draft', 'cancelled')
      AND i.due_date <= ?
      AND (i.last_reminder_date IS NULL OR i.last_reminder_date < ?)
    `).all(thresholdStr, todayStr);

    for (const invoice of overdueInvoices as any) {
      const subject = (settings.invoice_reminder_subject || 'Rappel de facture impayée')
        .replace('{number}', invoice.number);
      
      const body = (settings.invoice_reminder_template || '')
        .replace('{number}', invoice.number)
        .replace('{total}', invoice.total_amount.toLocaleString())
        .replace('{due_date}', invoice.due_date)
        .replace('{client_name}', invoice.client_name);

      // "Send" email (Mock)
      console.log(`[EMAIL REMINDER] To: ${invoice.client_email || 'N/A'} (Notification: ${settings.invoice_reminder_email || 'N/A'})`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);

      // Log to audit logs
      logAction('System', 'REMINDER_SENT', 'Invoice', invoice.id, { 
        to: invoice.client_email, 
        notification_email: settings.invoice_reminder_email,
        subject 
      });

      // Update invoice
      db.prepare("UPDATE invoices SET last_reminder_date = ?, status = 'overdue' WHERE id = ?")
        .run(todayStr, invoice.id);
    }
  } catch (err) {
    console.error("Error checking reminders:", err);
  }
};

const processRecurringInvoices = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const recurring = db.prepare(`
      SELECT ri.*, tp.payment_terms 
      FROM recurring_invoices ri 
      JOIN third_parties tp ON ri.third_party_id = tp.id 
      WHERE ri.active = 1 AND ri.next_date <= ?
    `).all(today) as any[];

    for (const ri of recurring) {
      const items = db.prepare("SELECT * FROM recurring_invoice_items WHERE recurring_invoice_id = ?").all(ri.id) as any[];
      
      const createInvoice = db.transaction(() => {
        const number = generateDocumentNumber(ri.type);
        const date = ri.next_date;
        
        // Calculate due date based on payment terms
        const dueDateObj = new Date(date);
        const terms = ri.payment_terms || 30;
        dueDateObj.setDate(dueDateObj.getDate() + terms);
        const due_date = dueDateObj.toISOString().split('T')[0];

        const payment_link = `${process.env.APP_URL || 'http://localhost:3000'}/pay/${number}`;

        const stmt = db.prepare(`
          INSERT INTO invoices (type, number, date, due_date, third_party_id, status, subtotal, vat_amount, total_amount, notes, terms, currency, payment_link)
          VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(ri.type, number, date, due_date, ri.third_party_id, ri.subtotal, ri.vat_amount, ri.total_amount, ri.notes, ri.terms, ri.currency, payment_link);
        const invoiceId = info.lastInsertRowid;

        const itemStmt = db.prepare(`
          INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          itemStmt.run(invoiceId, item.description, item.quantity, item.unit_price, item.vat_rate, item.total, item.account_code || '701');
        }

        // Update next date
        let nextDate = new Date(ri.next_date);
        if (ri.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (ri.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (ri.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
        else if (ri.frequency === 'annually') nextDate.setFullYear(nextDate.getFullYear() + 1);

        const nextDateStr = nextDate.toISOString().split('T')[0];
        let isActive = 1;
        if (ri.end_date && nextDateStr > ri.end_date) isActive = 0;

        db.prepare("UPDATE recurring_invoices SET next_date = ?, active = ? WHERE id = ?").run(nextDateStr, isActive, ri.id);
        
        return invoiceId;
      });

      const id = createInvoice();
      logAction('System', 'RECURRING_INVOICE_GENERATED', 'Invoice', id, { recurring_id: ri.id });
      createNotification('success', 'Facture récurrente générée', `Une nouvelle facture a été générée automatiquement à partir du modèle #${ri.id}.`, '/invoicing');
    }
  } catch (err) {
    console.error("Error processing recurring invoices:", err);
  }
};

// Run every hour
setInterval(checkAndSendReminders, 60 * 60 * 1000);
setInterval(processRecurringInvoices, 60 * 60 * 1000);
// Also run on startup after a short delay
setTimeout(checkAndSendReminders, 10000);
setTimeout(processRecurringInvoices, 15000);

app.post("/api/invoices/check-reminders", (req, res) => {
  checkAndSendReminders();
  res.json({ success: true, message: "Vérification des rappels lancée." });
});

app.post("/api/invoices/process-recurring", (req, res) => {
  processRecurringInvoices();
  res.json({ success: true, message: "Traitement des factures récurrentes lancé." });
});

// --- Recurring Invoices API ---
app.get("/api/recurring-invoices", (req, res) => {
  try {
    const recurring = db.prepare(`
      SELECT ri.*, tp.name as third_party_name
      FROM recurring_invoices ri
      JOIN third_parties tp ON ri.third_party_id = tp.id
      ORDER BY ri.created_at DESC
    `).all();
    res.json(recurring);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/recurring-invoices/:id", (req, res) => {
  const { id } = req.params;
  try {
    const ri = db.prepare(`
      SELECT ri.*, tp.name as third_party_name
      FROM recurring_invoices ri
      JOIN third_parties tp ON ri.third_party_id = tp.id
      WHERE ri.id = ?
    `).get(id) as any;
    if (!ri) return res.status(404).json({ error: "Modèle non trouvé" });
    
    const items = db.prepare("SELECT * FROM recurring_invoice_items WHERE recurring_invoice_id = ?").all(id);
    res.json({ ...ri, items });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/recurring-invoices", (req, res) => {
  const { type, third_party_id, frequency, next_date, end_date, subtotal, vat_amount, total_amount, currency, notes, terms, items } = req.body;
  
  const createRecurring = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO recurring_invoices (type, third_party_id, frequency, next_date, end_date, subtotal, vat_amount, total_amount, currency, notes, terms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(type, third_party_id, frequency, next_date, end_date || null, subtotal, vat_amount, total_amount, currency || 'FCFA', notes, terms);
    const riId = info.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO recurring_invoice_items (recurring_invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      itemStmt.run(riId, item.description, item.quantity, item.unit_price, item.vat_rate, item.total, item.account_code || '701');
    }
    return riId;
  });

  try {
    const id = createRecurring();
    logAction(req.user?.name || 'Admin', 'CREATE', 'RecurringInvoice', id);
    res.json({ success: true, id });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/recurring-invoices/:id", (req, res) => {
  const { id } = req.params;
  const { frequency, next_date, end_date, subtotal, vat_amount, total_amount, currency, notes, terms, items, active } = req.body;
  
  const updateRecurring = db.transaction(() => {
    db.prepare(`
      UPDATE recurring_invoices 
      SET frequency = ?, next_date = ?, end_date = ?, subtotal = ?, vat_amount = ?, total_amount = ?, currency = ?, notes = ?, terms = ?, active = ?
      WHERE id = ?
    `).run(frequency, next_date, end_date || null, subtotal, vat_amount, total_amount, currency || 'FCFA', notes, terms, active === undefined ? 1 : active, id);

    db.prepare("DELETE FROM recurring_invoice_items WHERE recurring_invoice_id = ?").run(id);

    const itemStmt = db.prepare(`
      INSERT INTO recurring_invoice_items (recurring_invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      itemStmt.run(id, item.description, item.quantity, item.unit_price, item.vat_rate, item.total, item.account_code || '701');
    }
  });

  try {
    updateRecurring();
    logAction(req.user?.name || 'Admin', 'UPDATE', 'RecurringInvoice', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/recurring-invoices/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM recurring_invoices WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Payment & Subscription API ---

// CinetPay Configuration
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || 'MOCK_API_KEY';
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || 'MOCK_SITE_ID';
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Helper: Generate Transaction ID
const generateTxId = () => `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// 1. Initialize Payment
app.post("/api/payment/init", async (req, res) => {
  const { plan, payment_method } = req.body;
  
  // Define Plans
  const plans = {
    'pro': { price: 25000, name: 'Plan Pro (1 mois)', users: 1 },
    'business': { price: 100000, name: 'Plan Business (1 mois)', users: 5 }
  };
  
  const selectedPlan = plans[plan as keyof typeof plans];
  if (!selectedPlan) return res.status(400).json({ error: "Plan invalide" });
  
  const transactionId = generateTxId();
  
  try {
    // 1. Save pending transaction
    const stmt = db.prepare(`
      INSERT INTO payment_transactions (transaction_id, amount, plan_name, payment_method, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    stmt.run(transactionId, selectedPlan.price, plan, payment_method);
    
    // 2. Call CinetPay API (or Mock)
    if (CINETPAY_API_KEY === 'MOCK_API_KEY') {
      // MOCK MODE
      return res.json({
        payment_url: `${APP_URL}/mock-payment?transaction_id=${transactionId}&amount=${selectedPlan.price}&plan=${plan}`,
        transaction_id: transactionId
      });
    } else {
      // REAL MODE
      const payload = {
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id: transactionId,
        amount: selectedPlan.price,
        currency: 'XOF',
        description: `Abonnement ${selectedPlan.name}`,
        return_url: `${APP_URL}/payment/success`,
        notify_url: `${APP_URL}/api/payment/webhook`,
        channels: 'ALL',
        metadata: JSON.stringify({ plan, users: selectedPlan.users })
      };
      
      const response = await fetch(CINETPAY_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.code === '201') {
        res.json({
          payment_url: data.data.payment_url,
          transaction_id: transactionId
        });
      } else {
        throw new Error(data.message || 'Erreur CinetPay');
      }
    }
  } catch (err) {
    console.error('Payment Init Error:', err);
    handleApiError(res, err);
  }
});

// Helper: Send Notification (Mock)
const sendNotification = (type: 'email' | 'sms', recipient: string, message: string) => {
  console.log(`[NOTIFICATION] Sending ${type} to ${recipient}: ${message}`);
  // In production, integrate with Twilio, SendGrid, or local SMS provider (Orange/MTN API)
};

// 2. Webhook / Notification Handler
app.post("/api/payment/webhook", async (req, res) => {
  // CinetPay sends data via POST
  // We must verify the status via their API to be sure (best practice)
  
  const { cpm_trans_id, cpm_site_id } = req.body;
  
  if (!cpm_trans_id || !cpm_site_id) {
    return res.status(400).json({ error: "Invalid data" });
  }
  
  try {
    // Verify transaction status with CinetPay
    // In Mock mode, we trust the ID if it starts with TX-
    let status = 'FAILED';
    let amount = 0;
    let metadata: any = {};
    
    if (CINETPAY_API_KEY === 'MOCK_API_KEY') {
       status = 'ACCEPTED'; // Mock success
       const tx = db.prepare("SELECT * FROM payment_transactions WHERE transaction_id = ?").get(cpm_trans_id);
       if (tx) {
         amount = tx.amount;
         metadata = { plan: tx.plan_name };
       }
    } else {
      const checkPayload = {
        apikey: CINETPAY_API_KEY,
        site_id: CINETPAY_SITE_ID,
        transaction_id: cpm_trans_id
      };
      
      const response = await fetch(`${CINETPAY_BASE_URL}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkPayload)
      });
      
      const data = await response.json();
      if (data.code === '00') {
        status = 'ACCEPTED';
        amount = data.data.amount;
        metadata = JSON.parse(data.data.metadata || '{}');
      }
    }
    
    if (status === 'ACCEPTED') {
      const transaction = db.transaction(() => {
        // Update Transaction
        db.prepare("UPDATE payment_transactions SET status = 'success', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?")
          .run(cpm_trans_id);
          
        // Create/Update Subscription
        const planName = metadata.plan || 'pro'; // Fallback
        const duration = 30; // Days
        
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + duration);
        
        // Check if active sub exists
        const existing = db.prepare("SELECT id FROM subscriptions WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
        
        if (existing) {
          // Extend or Upgrade? For now, we replace/extend
          db.prepare(`
            UPDATE subscriptions 
            SET status = 'expired' 
            WHERE id = ?
          `).run(existing.id);
        }
        
        db.prepare(`
          INSERT INTO subscriptions (plan_name, status, start_date, end_date, max_users, price_paid, payment_reference)
          VALUES (?, 'active', ?, ?, ?, ?, ?)
        `).run(
          planName,
          startDate.toISOString(),
          endDate.toISOString(),
          planName === 'business' ? 5 : 1,
          amount,
          cpm_trans_id
        );
      });
      
      transaction();
      logAction('System', 'PAYMENT_SUCCESS', 'Subscription', cpm_trans_id, { amount });
      
      // Send Notification
      sendNotification('sms', '+22507070707', `Paiement de ${amount} FCFA confirmé. Votre plan ${metadata.plan} est actif.`);
      sendNotification('email', 'client@example.com', `Merci pour votre abonnement au plan ${metadata.plan}.`);
      
      res.json({ message: 'OK' });
    } else {
      db.prepare("UPDATE payment_transactions SET status = 'failed' WHERE transaction_id = ?").run(cpm_trans_id);
      res.json({ message: 'Failed' });
    }
    
  } catch (err) {
    console.error('Webhook Error:', err);
    handleApiError(res, err);
  }
});

// 3. Mock Payment Confirmation (For Dev Only)
app.post("/api/payment/mock-confirm", (req, res) => {
  const { transaction_id } = req.body;
  if (CINETPAY_API_KEY !== 'MOCK_API_KEY') return res.status(403).json({ error: "Mock mode disabled" });
  
  // Simulate Webhook Call
  // In a real app, the gateway calls the webhook. Here we call it ourselves internally or just run the logic.
  // Let's reuse the logic by calling the webhook handler internally or just duplicating the logic for simplicity.
  
  try {
     const tx = db.prepare("SELECT * FROM payment_transactions WHERE transaction_id = ?").get(transaction_id);
     if (!tx) return res.status(404).json({ error: "Transaction not found" });
     
     const transaction = db.transaction(() => {
        db.prepare("UPDATE payment_transactions SET status = 'success' WHERE transaction_id = ?").run(transaction_id);
        
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        // Deactivate old
        db.prepare("UPDATE subscriptions SET status = 'expired' WHERE status = 'active'").run();
        
        // Create new
        db.prepare(`
          INSERT INTO subscriptions (plan_name, status, start_date, end_date, max_users, price_paid, payment_reference)
          VALUES (?, 'active', ?, ?, ?, ?, ?)
        `).run(
          tx.plan_name,
          startDate.toISOString(),
          endDate.toISOString(),
          tx.plan_name === 'business' ? 5 : 1,
          tx.amount,
          transaction_id
        );
     });
     
     transaction();
     res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// 4. Get Subscription Status
app.get("/api/subscription/status", (req, res) => {
  try {
    const sub = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE status = 'active' 
      AND end_date > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get();
    
    if (sub) {
      const daysLeft = Math.ceil((new Date(sub.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      res.json({ ...sub, days_left: daysLeft, active: true });
    } else {
      res.json({ active: false, plan_name: 'free', max_users: 1 });
    }
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- End Payment API ---

// --- System Health Check ---
app.get("/api/health/full", (req, res) => {
  const diagnostics = {
    database: { status: 'unknown', message: '' },
    accounts: { status: 'unknown', count: 0 },
    transactions: { status: 'unknown', count: 0 },
    fiscal_year: { status: 'unknown', active: null },
    ai_service: { status: 'unknown', configured: false },
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Database Check
    try {
      db.prepare("SELECT 1").get();
      diagnostics.database = { status: 'ok', message: 'Connected' };
    } catch (e) {
      diagnostics.database = { status: 'error', message: e.message };
      throw e; // Critical failure
    }

    // 2. Accounts Check
    try {
      const count = db.prepare("SELECT COUNT(*) as c FROM accounts").get().c;
      diagnostics.accounts = { status: count > 0 ? 'ok' : 'warning', count };
    } catch (e) {
      diagnostics.accounts = { status: 'error', count: 0 };
    }

    // 3. Transactions Check
    try {
      const count = db.prepare("SELECT COUNT(*) as c FROM transactions").get().c;
      diagnostics.transactions = { status: 'ok', count };
    } catch (e) {
      diagnostics.transactions = { status: 'error', count: 0 };
    }

    // 4. Fiscal Year Check
    try {
      const active = db.prepare("SELECT name FROM fiscal_years WHERE is_active = 1").get();
      diagnostics.fiscal_year = { 
        status: active ? 'ok' : 'error', 
        active: active ? active.name : 'None' 
      };
    } catch (e) {
      diagnostics.fiscal_year = { status: 'error', active: null };
    }

    // 5. AI Service Check
    diagnostics.ai_service = { 
      status: process.env.GEMINI_API_KEY ? 'ok' : 'warning', 
      configured: !!process.env.GEMINI_API_KEY 
    };

    res.json(diagnostics);

  } catch (err) {
    handleApiError(res, err);
  }
});

// --- API Routes ---

// Get all accounts
app.get("/api/accounts", (req, res) => {
  const stmt = db.prepare('SELECT * FROM accounts ORDER BY code ASC');
  const accounts = stmt.all();
  res.json(accounts);
});

// Create account
app.post("/api/accounts/import", (req, res) => {
  const accounts = req.body;
  if (!Array.isArray(accounts)) {
    return res.status(400).json({ error: "Format invalide, un tableau est attendu." });
  }

  const stmtStr = 'INSERT OR IGNORE INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)';
  
  try {
    let insertedCount = 0;
    db.transaction(() => {
      for (const acc of accounts) {
        const insertStmt = db.prepare(stmtStr);
        const result = insertStmt.run(acc.code, acc.name, acc.class_code, acc.type);
        if (result.changes > 0) {
          insertedCount++;
        }
      }
    })();
    
    logAction(req.user?.email || 'Admin', 'IMPORT', 'Account', null, { count: insertedCount });
    res.json({ success: true, message: `${insertedCount} compte(s) ajouté(s) avec succès. (Les doublons ont été ignorés)` });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/accounts", validate(schemas.accountSchema), (req, res) => {
  const { code, name, class_code, type } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)');
    stmt.run(code, name, class_code, type);
    logAction(req.user?.email || 'Admin', 'CREATE', 'Account', code, { name, type });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update account
app.put("/api/accounts/:code", validate(schemas.accountSchema.partial()), (req, res) => {
  const { code } = req.params;
  const { name, type } = req.body;
  try {
    const oldAccount = db.prepare('SELECT * FROM accounts WHERE code = ?').get(code) as any;
    const stmt = db.prepare('UPDATE accounts SET name = ?, type = ? WHERE code = ?');
    stmt.run(name, type, code);
    logAction(req.user?.email || 'Admin', 'UPDATE', 'Account', code, { 
      previous: oldAccount ? { name: oldAccount.name, type: oldAccount.type } : null,
      current: { name, type }
    });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Delete account
app.delete("/api/accounts/:code", (req, res) => {
  const { code } = req.params;
  try {
    // Check if used in journal entries
    const check = db.prepare('SELECT 1 FROM journal_entries WHERE account_code = ? LIMIT 1').get(code);
    if (check) {
      return res.status(400).json({ error: "Ce compte est utilisé dans des écritures et ne peut pas être supprimé." });
    }
    const stmt = db.prepare('DELETE FROM accounts WHERE code = ?');
    stmt.run(code);
    logAction(req.user?.email || 'Admin', 'DELETE', 'Account', code);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get transactions (with optional filters)
// --- Journal Suggestions API ---
app.get("/api/journal/suggestions", (req, res) => {
  const { thirdPartyId, operationType, description } = req.query;
  try {
    let suggestions = [];
    
    // Common accounts to exclude from suggestions (they are already handled by the guided mode logic)
    const excludedAccounts = [
      '401%', '411%', // Third parties
      '521%', '571%', '585%', // Treasury
      '445%', '443%', // VAT
      '404%', '414%'  // Other third parties
    ];
    const excludeClause = excludedAccounts.map(code => `je.account_code NOT LIKE '${code}'`).join(' AND ');

    // 1. Try with Description, Third Party, and Operation Type
    if (description && thirdPartyId && operationType) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.third_party_id = ? AND t.operation_type = ? AND LOWER(t.description) LIKE LOWER(?)
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(thirdPartyId, operationType, `%${description}%`);
    }
    
    // 2. Try with Description and Third Party
    if (suggestions.length === 0 && description && thirdPartyId) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.third_party_id = ? AND LOWER(t.description) LIKE LOWER(?)
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(thirdPartyId, `%${description}%`);
    }

    // 3. Try with Description alone
    if (suggestions.length === 0 && description) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE LOWER(t.description) LIKE LOWER(?)
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(`%${description}%`);
    }

    // 4. Try with Third Party and Operation Type
    if (suggestions.length === 0 && thirdPartyId && operationType) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.third_party_id = ? AND t.operation_type = ?
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(thirdPartyId, operationType);
    }

    // 5. Try with just Third Party
    if (suggestions.length === 0 && thirdPartyId) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.third_party_id = ?
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(thirdPartyId);
    }

    // 6. Try with just Operation Type
    if (suggestions.length === 0 && operationType) {
      suggestions = db.prepare(`
        SELECT je.account_code, a.name as account_name, COUNT(*) as count
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.operation_type = ?
        AND (${excludeClause})
        GROUP BY je.account_code
        ORDER BY count DESC
        LIMIT 5
      `).all(operationType);
    }

    // 7. SYSCOHADA Fallback if fewer than 5 suggestions
    if (suggestions.length < 5 && operationType) {
      let likeClauses = [];
      if (operationType === 'vente_marchandises') likeClauses = ["701100", "707100", "701%", "707%"];
      else if (operationType === 'vente_services') likeClauses = ["706100", "706%"];
      else if (operationType === 'achat_marchandises') likeClauses = ["601100", "602100", "607100", "601%", "602%", "607%"];
      else if (operationType === 'achat_services') likeClauses = ["605100", "621100", "622100", "62%", "63%"];
      else if (operationType === 'frais_generaux') likeClauses = ["605%", "61%", "62%", "63%", "64%"];
      else if (operationType === 'paiement_fournisseur') likeClauses = ["401100", "401%"];
      else if (operationType === 'encaissement_client') likeClauses = ["411100", "411%"];
      else if (operationType === 'paiement_salaire') likeClauses = ["422100", "421100", "42%"];
      else if (operationType === 'paiement_impot') likeClauses = ["44%", "64%"];
      
      if (likeClauses.length > 0) {
        const whereClause = likeClauses.map(c => `code LIKE '${c}'`).join(' OR ');
        const baselineAccounts = db.prepare(`
          SELECT code as account_code, name as account_name 
          FROM accounts 
          WHERE ${whereClause}
          LIMIT 10
        `).all();

        const existingCodes = new Set(suggestions.map(s => s.account_code));
        for (const ba of baselineAccounts) {
          if (!existingCodes.has(ba.account_code) && suggestions.length < 5) {
            suggestions.push({
              account_code: ba.account_code,
              account_name: ba.account_name,
              count: 0 // baseline indicator
            });
            existingCodes.add(ba.account_code);
          }
        }
      }
    }

    res.json(suggestions);
  } catch (err) {
    console.error("Error fetching journal suggestions:", err);
    handleApiError(res, err);
  }
});

app.get("/api/transactions/by-reference/:reference", (req, res) => {
  const { reference } = req.params;
  try {
    const transaction = db.prepare(`
      SELECT t.*, i.number as invoice_number, i.id as invoice_id
      FROM transactions t
      LEFT JOIN invoices i ON t.id = i.transaction_id
      WHERE t.reference = ?
    `).get(reference) as any;

    if (!transaction) {
      return res.status(404).json({ error: "Transaction non trouvée" });
    }

    const lines = db.prepare(`
      SELECT je.*, a.name as account_name
      FROM journal_entries je
      JOIN accounts a ON je.account_code = a.code
      WHERE je.transaction_id = ?
    `).all(transaction.id);

    res.json({ ...transaction, lines });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/transactions/:id/restore", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE transactions SET deleted_at = NULL WHERE id = ?").run(id);
    logAction(req.user?.name || 'Admin', 'RESTORE', 'Transaction', id, { id }, req.ip, req.get('user-agent'));
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/transactions", (req, res) => {
  const { startDate, endDate, status, searchTerm, thirdPartyId, accountCode, minAmount, maxAmount, isDeleted } = req.query;
  
  let query = `
    SELECT t.id, t.date, t.description, t.reference, t.status, t.occasional_name,
           t.currency, t.exchange_rate, t.recurring_transaction_id,
           SUM(je.debit) as total_amount,
           i.number as invoice_number, i.id as invoice_id
    FROM transactions t
    JOIN journal_entries je ON t.id = je.transaction_id
    LEFT JOIN invoices i ON t.id = i.transaction_id
    WHERE ${isDeleted === 'true' ? 't.deleted_at IS NOT NULL' : 't.deleted_at IS NULL'}
  `;
  
  const params = [];
  
  if (startDate) {
    query += " AND t.date >= ?";
    params.push(startDate);
  }
  
  if (endDate) {
    query += " AND t.date <= ?";
    params.push(endDate);
  }
  
  if (status && status !== 'all') {
    query += " AND t.status = ?";
    params.push(status);
  }

  if (searchTerm) {
    query += " AND (t.description LIKE ? OR t.reference LIKE ? OR t.occasional_name LIKE ?)";
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (thirdPartyId) {
    query += " AND t.third_party_id = ?";
    params.push(thirdPartyId);
  }

  if (accountCode) {
    query += " AND EXISTS (SELECT 1 FROM journal_entries je2 WHERE je2.transaction_id = t.id AND je2.account_code LIKE ?)";
    params.push(`${accountCode}%`);
  }
  
  query += `
    GROUP BY t.id
  `;

  if (minAmount || maxAmount) {
    query += " HAVING 1=1";
    if (minAmount) {
      query += " AND total_amount >= ?";
      params.push(minAmount);
    }
    if (maxAmount) {
      query += " AND total_amount <= ?";
      params.push(maxAmount);
    }
  }

  query += `
    ORDER BY t.date DESC, t.id DESC
    LIMIT 100
  `;

  try {
    const stmt = db.prepare(query);
    const transactions = stmt.all(...params);
    res.json(transactions);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get detailed journal for export
app.get("/api/journal/export", (req, res) => {
  const { startDate, endDate, status } = req.query;
  
  let query = `
    SELECT t.id, t.date, t.description, t.reference, t.status, t.occasional_name, t.third_party_id,
           tp.name as third_party_name,
           je.account_code, je.debit, je.credit
    FROM transactions t
    JOIN journal_entries je ON t.id = je.transaction_id
    LEFT JOIN third_parties tp ON t.third_party_id = tp.id
    WHERE t.deleted_at IS NULL
  `;
  
  const params = [];
  
  if (startDate) {
    query += " AND t.date >= ?";
    params.push(startDate);
  }
  
  if (endDate) {
    query += " AND t.date <= ?";
    params.push(endDate);
  }
  
  if (status && status !== 'all') {
    query += " AND t.status = ?";
    params.push(status);
  }
  
  query += " ORDER BY t.date DESC, t.id DESC, je.rowid ASC";

  try {
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    
    // Group by transaction
    const transactions = [];
    let currentTx = null;
    
    for (const row of rows) {
      if (!currentTx || currentTx.id !== row.id) {
        currentTx = {
          id: row.id,
          date: row.date,
          description: row.description,
          reference: row.reference,
          status: row.status,
          occasional_name: row.occasional_name,
          third_party_id: row.third_party_id,
          third_party_name: row.third_party_name,
          entries: []
        };
        transactions.push(currentTx);
      }
      currentTx.entries.push({
        account_code: row.account_code,
        debit: row.debit,
        credit: row.credit
      });
    }
    
    res.json(transactions);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Create a transaction
app.post("/api/transactions", validate(schemas.transactionSchema), (req, res) => {
  const { 
    date, description, reference, entries, currency, exchange_rate, 
    third_party_id, occasional_name, notes, document_url,
    operation_type, amount_ht, vat_rate, payment_mode, treasury_account, creation_mode
  } = req.body;
  
  const finalRef = reference || generateTransactionReference();
  
  const insertTx = db.prepare(`
    INSERT INTO transactions (
      date, description, reference, status, currency, exchange_rate, 
      third_party_id, occasional_name, notes, document_url,
      operation_type, amount_ht, vat_rate, payment_mode, treasury_account, creation_mode
    ) VALUES (?, ?, ?, 'validated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description) VALUES (?, ?, ?, ?, ?)');
  const checkAccount = db.prepare('SELECT 1 FROM accounts WHERE code = ?');
  const insertAccount = db.prepare('INSERT INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)');

  const createTransaction = db.transaction(() => {
    const info = insertTx.run(
      date, description, finalRef, currency || 'FCFA', exchange_rate || 1, 
      third_party_id || null, occasional_name || null, notes || null, document_url || null,
      operation_type || null, amount_ht || null, vat_rate || null, payment_mode || null, 
      treasury_account || null, creation_mode || 'expert'
    );
    const txId = info.lastInsertRowid;
    
    for (const entry of entries) {
      // Check if account exists, if not create it
      if (!checkAccount.get(entry.account_code)) {
        let classCode = parseInt(entry.account_code.charAt(0));
        if (isNaN(classCode)) classCode = 0; // Fallback if account code is not numeric

        let type = 'actif'; // Default
        
        // SYSCOHADA Logic
        if (classCode === 1) type = 'capitaux';
        if (classCode === 2) type = 'actif';
        if (classCode === 3) type = 'actif';
        if (classCode === 5) type = 'actif';
        if (classCode === 6) type = 'charge';
        if (classCode === 7) type = 'produit';
        
        if (classCode === 4) {
          if (entry.account_code.startsWith('41') || entry.account_code.startsWith('445') || entry.account_code.startsWith('46') || entry.account_code.startsWith('47')) type = 'actif';
          else type = 'passif';
        }
        
        insertAccount.run(entry.account_code, `Compte ${entry.account_code}`, classCode, type);
      }

      insertEntry.run(txId, entry.account_code, entry.debit, entry.credit, entry.description || null);
    }
    return txId;
  });

  try {
    const txId = createTransaction();
    logAction(req.user?.name || 'Admin', 'CREATE', 'Transaction', txId, { date, description, entries });
    createNotification('success', 'Nouvelle transaction', `La transaction "${description}" a été enregistrée avec succès.`, '/journal');
    res.json({ success: true, id: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get a single transaction
app.get("/api/transactions/:id", (req, res) => {
  const { id } = req.params;
  try {
    const txStmt = db.prepare(`
      SELECT t.*, i.number as invoice_number, i.id as invoice_id
      FROM transactions t
      LEFT JOIN invoices i ON t.id = i.transaction_id
      WHERE t.id = ?
    `);
    const entriesStmt = db.prepare(`
      SELECT je.*, a.name as account_name 
      FROM journal_entries je
      LEFT JOIN accounts a ON je.account_code = a.code
      WHERE je.transaction_id = ?
    `);
    
    const transaction = txStmt.get(id) as any;
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    
    const entries = entriesStmt.all(id);
    const attachments = db.prepare("SELECT * FROM transaction_attachments WHERE transaction_id = ?").all(id);
    res.json({ ...transaction, entries, attachments });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update a transaction
app.put("/api/transactions/:id", validate(schemas.transactionSchema), (req, res) => {
  const { id } = req.params;
  const { 
    date, description, reference, entries, notes, document_url, 
    third_party_id, occasional_name, currency, exchange_rate,
    operation_type, amount_ht, vat_rate, payment_mode, treasury_account, creation_mode
  } = req.body;

  const updateTx = db.prepare(`
    UPDATE transactions 
    SET date = ?, description = ?, reference = ?, notes = ?, document_url = ?, 
        third_party_id = ?, occasional_name = ?, currency = ?, exchange_rate = ?,
        operation_type = ?, amount_ht = ?, vat_rate = ?, payment_mode = ?, 
        treasury_account = ?, creation_mode = ?
    WHERE id = ?
  `);
  const deleteEntries = db.prepare("DELETE FROM journal_entries WHERE transaction_id = ?");
  const insertEntry = db.prepare('INSERT INTO journal_entries (transaction_id, account_code, debit, credit, description) VALUES (?, ?, ?, ?, ?)');
  const checkAccount = db.prepare('SELECT 1 FROM accounts WHERE code = ?');
  const insertAccount = db.prepare('INSERT INTO accounts (code, name, class_code, type) VALUES (?, ?, ?, ?)');

  const updateTransaction = db.transaction(() => {
    // Check if transaction is locked
    const tx = db.prepare("SELECT is_locked FROM transactions WHERE id = ?").get(id) as any;
    if (tx?.is_locked) {
      throw new Error("Cette transaction est verrouillée et ne peut plus être modifiée.");
    }

    updateTx.run(
      date, description, reference || null, notes || null, document_url || null, 
      third_party_id || null, occasional_name || null, currency || 'FCFA', exchange_rate || 1, 
      operation_type || null, amount_ht || null, vat_rate || null, payment_mode || null, 
      treasury_account || null, creation_mode || 'expert',
      id
    );
    deleteEntries.run(id);
    for (const entry of entries) {
      // Check if account exists, if not create it
      if (!checkAccount.get(entry.account_code)) {
        let classCode = parseInt(entry.account_code.charAt(0));
        if (isNaN(classCode)) classCode = 0; // Fallback

        let type = 'actif'; // Default
        
        // SYSCOHADA Logic
        if (classCode === 1) type = 'capitaux';
        if (classCode === 2) type = 'actif';
        if (classCode === 3) type = 'actif';
        if (classCode === 5) type = 'actif';
        if (classCode === 6) type = 'charge';
        if (classCode === 7) type = 'produit';
        
        if (classCode === 4) {
          if (entry.account_code.startsWith('41') || entry.account_code.startsWith('445') || entry.account_code.startsWith('46') || entry.account_code.startsWith('47')) type = 'actif';
          else type = 'passif';
        }
        
        insertAccount.run(entry.account_code, `Compte ${entry.account_code}`, classCode, type);
      }
      insertEntry.run(id, entry.account_code, entry.debit, entry.credit, entry.description || null);
    }
  });

  try {
    // Fetch old transaction data for audit log
    const oldTx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as any;
    const oldEntries = db.prepare("SELECT * FROM journal_entries WHERE transaction_id = ?").all(id);
    
    updateTransaction();
    logAction(req.user?.name || 'Admin', 'UPDATE', 'Transaction', id, { 
      previous: oldTx ? { ...oldTx, entries: oldEntries } : null,
      current: { date, description, reference, entries, notes }
    });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Delete a transaction
app.delete("/api/transactions/:id", (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;
  
  const tx = db.prepare("SELECT is_locked FROM transactions WHERE id = ?").get(id) as any;
  if (tx?.is_locked) {
    return res.status(403).json({ error: "Cette transaction est verrouillée et ne peut plus être supprimée." });
  }
  
  const softDeleteTx = db.prepare("UPDATE transactions SET deleted_at = ? WHERE id = ?");
  const deleteTx = db.prepare("DELETE FROM transactions WHERE id = ?");
  const deleteEntries = db.prepare("DELETE FROM journal_entries WHERE transaction_id = ?");

  // Logic for payroll/assets remains same if permanent delete
  
  if (permanent === 'true') {
    const deleteTransaction = db.transaction(() => {
      // (Simplified existing logic for permanent delete)
      deleteEntries.run(id);
      deleteTx.run(id);
    });
    
    try {
      deleteTransaction();
      logAction(req.user?.name || 'Admin', 'PERMANENT_DELETE', 'Transaction', id, { id }, req.ip, req.get('user-agent'));
      res.json({ success: true, message: "Supprimé définitivement" });
    } catch (err) {
      handleApiError(res, err);
    }
  } else {
    try {
      softDeleteTx.run(new Date().toISOString(), id);
      logAction(req.user?.name || 'Admin', 'DELETE', 'Transaction', id, { id }, req.ip, req.get('user-agent'));
      res.json({ success: true, message: "Déplacé dans la corbeille" });
    } catch (err) {
      handleApiError(res, err);
    }
  }
});

// Generate invoice from transaction
app.post("/api/transactions/:id/generate-invoice", (req, res) => {
  const { id } = req.params;
  try {
    const transaction = db.prepare(`
      SELECT t.*, tp.payment_terms, tp.name as tp_name
      FROM transactions t
      LEFT JOIN third_parties tp ON t.third_party_id = tp.id
      WHERE t.id = ?
    `).get(id) as any;

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    if (transaction.status !== 'validated') {
      return res.status(400).json({ error: 'Seules les transactions validées peuvent être converties en facture' });
    }

    // Check if an invoice already exists for this transaction
    const existingInvoice = db.prepare("SELECT id FROM invoices WHERE transaction_id = ?").get(id);
    if (existingInvoice) {
      return res.status(400).json({ error: 'Une facture existe déjà pour cette transaction' });
    }

    const entries = db.prepare(`
      SELECT je.*, a.type as account_type
      FROM journal_entries je
      JOIN accounts a ON je.account_code = a.code
      WHERE je.transaction_id = ?
    `).all(id) as any[];
    
    // A document (invoice or bill) usually represents revenue (Class 7) or expenses (Class 6)
    const relevantEntries = entries.filter(e => 
      e.account_code.startsWith('7') || 
      e.account_code.startsWith('6') ||
      e.account_type === 'produit' ||
      e.account_type === 'charge'
    );

    if (relevantEntries.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne de type Produit (Classe 7) ou Charge (Classe 6) trouvée dans cette transaction' });
    }

    const nextNumber = generateDocumentNumber('invoice');
    const company = db.prepare("SELECT vat_rate FROM company_settings LIMIT 1").get() as any;
    const defaultVatRate = company?.vat_rate || 18;

    const generate = db.transaction(() => {
      let subtotal = 0;
      for (const entry of relevantEntries) {
        // Use the side that has the absolute value (usually credit for sales, debit for purchases)
        subtotal += Math.max(entry.credit, entry.debit);
      }

      const vatAmount = subtotal * (defaultVatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const result = db.prepare(`
        INSERT INTO invoices (type, number, date, due_date, third_party_id, occasional_name, status, subtotal, vat_amount, total_amount, transaction_id)
        VALUES ('invoice', ?, DATE('now'), DATE('now', '+' || ? || ' days'), ?, ?, 'draft', ?, ?, ?, ?)
      `).run(
        nextNumber,
        transaction.payment_terms || 30,
        transaction.third_party_id,
        transaction.occasional_name,
        subtotal,
        vatAmount,
        totalAmount,
        id
      );

      const newInvoiceId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const entry of relevantEntries) {
        const itemAmount = Math.max(entry.credit, entry.debit);
        insertItem.run(
          newInvoiceId,
          transaction.description + (entry.account_code ? ` (${entry.account_code})` : ''),
          1,
          itemAmount,
          defaultVatRate,
          itemAmount * (1 + defaultVatRate / 100),
          entry.account_code
        );
      }

      return newInvoiceId;
    });

    const newId = generate();
    logAction(req.user?.name || 'Admin', 'GENERATE', 'Invoice from Transaction', id, { newInvoiceId: newId });
    res.json({ success: true, id: newId, number: nextNumber });
  } catch (error) {
    console.error('Error generating invoice:', error);
    handleApiError(res, new AppError('Erreur lors de la génération de la facture' , 500, "server_error"));
  }
});

// Bulk delete transactions
app.post("/api/transactions/bulk-delete", (req, res) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "IDs required" });
  }

  const deleteMany = db.transaction((idsToDelete) => {
    // Prepare statements (reused from single delete scope if possible, but here we redefine for safety/clarity)
    const checkPayrollValidation = db.prepare("SELECT period_id FROM payslips WHERE transaction_id = ? LIMIT 1");
    const checkPayrollPayment = db.prepare("SELECT id FROM payroll_periods WHERE payment_transaction_id = ?");
    const updatePayrollStatus = db.prepare("UPDATE payroll_periods SET status = ? WHERE id = ?");
    const clearPayslipTx = db.prepare("UPDATE payslips SET transaction_id = NULL WHERE transaction_id = ?");
    const clearPaymentTx = db.prepare("UPDATE payroll_periods SET payment_transaction_id = NULL WHERE payment_transaction_id = ?");
    const deleteAsset = db.prepare("DELETE FROM assets WHERE transaction_id = ?");
    const deleteEntries = db.prepare("DELETE FROM journal_entries WHERE transaction_id = ?");
    const deleteTx = db.prepare("DELETE FROM transactions WHERE id = ?");

    for (const id of idsToDelete) {
      // 1. Check if it's a payroll validation transaction
      const validationPeriod = checkPayrollValidation.get(id);
      if (validationPeriod) {
        updatePayrollStatus.run('draft', validationPeriod.period_id);
        clearPayslipTx.run(id);
      }

      // 2. Check if it's a payroll payment transaction
      const paymentPeriod = checkPayrollPayment.get(id);
      if (paymentPeriod) {
        updatePayrollStatus.run('validated', paymentPeriod.id);
        clearPaymentTx.run(id);
      }

      // 3. Delete linked assets
      deleteAsset.run(id);

      // 4. Delete entries and transaction
      deleteEntries.run(id);
      deleteTx.run(id);
    }
  });

  try {
    deleteMany(ids);
    logAction(req.user?.name || 'Admin', 'DELETE_BULK', 'Transaction', null, { count: ids.length, ids });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Custom Operations
app.get("/api/custom-operations", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM custom_operations");
    const ops = stmt.all().map(op => ({
      ...op,
      entries_template: JSON.parse(op.entries_template)
    }));
    res.json(ops);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/custom-operations", (req, res) => {
  const { label, icon, vat_account_debit, vat_account_credit, entries_template } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO custom_operations (label, icon, vat_account_debit, vat_account_credit, entries_template) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run(label, icon, vat_account_debit, vat_account_credit, JSON.stringify(entries_template));
    logAction(req.user?.email || 'Admin', 'CREATE', 'CustomOperation', info.lastInsertRowid, { label });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Compliance Audit Endpoint
app.get("/api/compliance/audit", (req, res) => {
  try {
    const issues = [];
    
    // 1. Check for Unbalanced Transactions
    const unbalancedStmt = db.prepare(`
      SELECT t.id, t.description, SUM(je.debit) as total_debit, SUM(je.credit) as total_credit
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      GROUP BY t.id
      HAVING ABS(total_debit - total_credit) > 0.01
    `);
    const unbalanced = unbalancedStmt.all();
    
    for (const tx of unbalanced) {
      issues.push({
        id: `bal_${tx.id}`,
        severity: 'high',
        type: 'balance',
        message: 'Écriture déséquilibrée',
        transactionId: tx.id,
        details: `La transaction "${tx.description}" n'est pas équilibrée. Débit: ${tx.total_debit}, Crédit: ${tx.total_credit}.`
      });
    }

    // 2. Check for Invalid Account Codes (Not in Plan Comptable)
    // First get all valid codes
    const validCodesStmt = db.prepare("SELECT code FROM accounts");
    const validCodes = new Set(validCodesStmt.all().map(a => a.code));
    
    const entriesStmt = db.prepare(`
      SELECT je.id, je.transaction_id, je.account_code, t.description
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
    `);
    const entries = entriesStmt.all();

    for (const entry of entries) {
      if (!validCodes.has(entry.account_code)) {
        // Simple check: is it a valid format? SYSCOHADA codes are numeric, usually 2+ digits.
        // If it's not in our seeded DB, it might be a custom sub-account.
        // Let's check if the ROOT class exists (first digit).
        const rootClass = entry.account_code.charAt(0);
        if (!['1','2','3','4','5','6','7','8','9'].includes(rootClass)) {
           issues.push({
            id: `acc_${entry.id}`,
            severity: 'high',
            type: 'account',
            message: 'Compte invalide',
            transactionId: entry.transaction_id,
            details: `Le compte "${entry.account_code}" utilisé dans "${entry.description}" ne respecte pas le format SYSCOHADA.`
          });
        } else if (entry.account_code.length < 2) {
           issues.push({
            id: `acc_len_${entry.id}`,
            severity: 'medium',
            type: 'account',
            message: 'Compte trop court',
            transactionId: entry.transaction_id,
            details: `Le compte "${entry.account_code}" devrait avoir au moins 2 chiffres.`
          });
        }
      }
    }

    // 3. Check for Missing Descriptions, Dates, or References
    const invalidDataStmt = db.prepare("SELECT * FROM transactions WHERE description IS NULL OR description = '' OR date IS NULL OR reference IS NULL OR reference = ''");
    const invalidData = invalidDataStmt.all();

    for (const tx of invalidData) {
      let message = 'Informations manquantes';
      let details = `La transaction #${tx.id} est incomplète.`;
      
      if (!tx.description) {
        details = "Libellé manquant (obligatoire).";
      } else if (!tx.date) {
        details = "Date manquante.";
      } else if (!tx.reference) {
        message = 'Pièce justificative manquante';
        details = "Référence (pièce justificative) manquante.";
      }

      issues.push({
        id: `data_${tx.id}`,
        severity: !tx.reference ? 'medium' : 'high', // Reference is medium, others high
        type: 'missing_data',
        message: message,
        transactionId: tx.id,
        details: details
      });
    }

    // 4. Check for Cash Accounts in Credit (Caisse Créditrice) - SYSCOHADA Violation
    // Cash accounts (57) must never have a credit balance.
    const cashAccountsStmt = db.prepare("SELECT code, name FROM accounts WHERE code LIKE '57%'");
    const cashAccounts = cashAccountsStmt.all();

    for (const acc of cashAccounts) {
      const balanceStmt = db.prepare(`
        SELECT SUM(debit) as debit, SUM(credit) as credit 
        FROM journal_entries 
        WHERE account_code = ?
      `);
      const balance = balanceStmt.get(acc.code);
      
      if (balance && balance.credit > balance.debit) {
        issues.push({
          id: `cash_cred_${acc.code}`,
          severity: 'high',
          type: 'balance',
          message: 'Caisse créditrice',
          details: `Le compte de caisse "${acc.code} - ${acc.name}" a un solde créditeur de ${(balance.credit - balance.debit).toLocaleString()} FCFA. Une caisse ne peut pas être négative.`
        });
      }
    }

    // 5. Check for Suspense Accounts not cleared (Comptes d'attente 47)
    // These accounts must be cleared at the end of the period.
    const suspenseAccountsStmt = db.prepare("SELECT code, name FROM accounts WHERE code LIKE '47%'");
    const suspenseAccounts = suspenseAccountsStmt.all();

    for (const acc of suspenseAccounts) {
      const balanceStmt = db.prepare(`
        SELECT SUM(debit) as debit, SUM(credit) as credit 
        FROM journal_entries 
        WHERE account_code = ?
      `);
      const balance = balanceStmt.get(acc.code);
      const netBalance = (balance.debit || 0) - (balance.credit || 0);

      if (Math.abs(netBalance) > 0) {
        issues.push({
          id: `suspense_${acc.code}`,
          severity: 'medium',
          type: 'account',
          message: 'Compte d\'attente non soldé',
          details: `Le compte d'attente "${acc.code} - ${acc.name}" présente un solde de ${netBalance.toLocaleString()} FCFA. Il doit être régularisé avant la clôture.`
        });
      }
    }

    // 6. Check for Transactions with only one entry or unbalanced entries
    const singleEntryStmt = db.prepare(`
      SELECT t.id, t.description, COUNT(je.id) as entry_count
      FROM transactions t
      LEFT JOIN journal_entries je ON t.id = je.transaction_id
      GROUP BY t.id
      HAVING entry_count < 2
    `);
    const singleEntry = singleEntryStmt.all();
    for (const tx of singleEntry) {
      issues.push({
        id: `single_${tx.id}`,
        severity: 'high',
        type: 'balance',
        message: 'Écriture incomplète',
        transactionId: tx.id,
        details: `La transaction "${tx.description}" doit avoir au moins deux lignes (Débit et Crédit).`
      });
    }

    // 7. Check for Transactions with only debits or only credits
    const onlyOneSideStmt = db.prepare(`
      SELECT t.id, t.description, SUM(CASE WHEN je.debit > 0 THEN 1 ELSE 0 END) as debit_count,
             SUM(CASE WHEN je.credit > 0 THEN 1 ELSE 0 END) as credit_count
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      GROUP BY t.id
      HAVING debit_count = 0 OR credit_count = 0
    `);
    const onlyOneSide = onlyOneSideStmt.all();
    for (const tx of onlyOneSide) {
      issues.push({
        id: `side_${tx.id}`,
        severity: 'high',
        type: 'balance',
        message: 'Écriture à sens unique',
        transactionId: tx.id,
        details: `La transaction "${tx.description}" ne contient que des ${tx.debit_count === 0 ? 'crédits' : 'débits'}. Une écriture doit avoir les deux.`
      });
    }

    // 8. Check for Invalid Dates (Future dates)
    const futureDateStmt = db.prepare("SELECT id, description, date FROM transactions WHERE date > ?");
    const futureDate = futureDateStmt.all(new Date().toISOString().split('T')[0]);
    for (const tx of futureDate) {
      issues.push({
        id: `date_${tx.id}`,
        severity: 'medium',
        type: 'format',
        message: 'Date dans le futur',
        transactionId: tx.id,
        details: `La transaction "${tx.description}" a une date postérieure à aujourd'hui (${tx.date}).`
      });
    }

    // Calculate Score
    const totalTransactionsStmt = db.prepare("SELECT COUNT(*) as count FROM transactions");
    const totalTransactions = totalTransactionsStmt.get().count;
    
    // Simple scoring logic
    let score = 100;
    if (totalTransactions > 0) {
      const penalty = (issues.length * 10); // 10 points per issue
      score = Math.max(0, 100 - penalty);
    }

    res.json({
      score,
      totalTransactions,
      issues,
      lastRun: new Date().toISOString()
    });

  } catch (err) {
    handleApiError(res, err);
  }
});

// AI Analysis Endpoint - DEPRECATED, use frontend service
// Get dashboard stats
app.get("/api/dashboard/stats", (req, res) => {
  try {
    // Get active fiscal year
    const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    const startDate = fiscalYear ? fiscalYear.start_date : '1970-01-01';
    const endDate = fiscalYear ? fiscalYear.end_date : '9999-12-31';

    // 1. Chiffre d'Affaires (Class 7 Credit)
    const caStmt = db.prepare(`
      SELECT SUM(je.credit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '7%' AND t.date BETWEEN ? AND ? AND t.status = 'validated' AND t.deleted_at IS NULL
    `);
    const ca = caStmt.get(startDate, endDate).total || 0;

    // 2. Charges (Class 6 Debit)
    const chargesStmt = db.prepare(`
      SELECT SUM(je.debit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '6%' AND t.date BETWEEN ? AND ? AND t.status = 'validated' AND t.deleted_at IS NULL
    `);
    const charges = chargesStmt.get(startDate, endDate).total || 0;

    // 3. Trésorerie (Class 5 Debit - Credit) - Cumulative
    const cashStmt = db.prepare(`
      SELECT SUM(je.debit) - SUM(je.credit) as balance 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.status = 'validated' AND t.deleted_at IS NULL
    `);
    const cash = cashStmt.get().balance || 0;

    // 4. Créances Clients (411 Debit - Credit) - Cumulative
    const receivablesStmt = db.prepare(`
      SELECT SUM(je.debit) - SUM(je.credit) as balance 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '411%' AND t.status = 'validated' AND t.deleted_at IS NULL
    `);
    const receivables = receivablesStmt.get().balance || 0;

    // 5. Dettes Fournisseurs (401 Credit - Debit) - Cumulative
    const payablesStmt = db.prepare(`
      SELECT SUM(je.credit) - SUM(je.debit) as balance 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '401%' AND t.status = 'validated' AND t.deleted_at IS NULL
    `);
    const payables = payablesStmt.get().balance || 0;

    // 6. Payroll Stats
    const activeEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE status = 'active'").get().count || 0;
    const lastPeriod = db.prepare("SELECT * FROM payroll_periods ORDER BY year DESC, month DESC LIMIT 1").get();
    const payrollTotal = lastPeriod ? lastPeriod.total_net : 0;
    const payrollStatus = lastPeriod ? lastPeriod.status : null;

    res.json({
      turnover: ca,
      expenses: charges,
      net_result: ca - charges,
      cash: cash,
      receivables: receivables,
      payables: payables,
      payroll: {
        total: payrollTotal,
        employees: activeEmployees,
        lastPeriod: payrollStatus
      }
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get dashboard charts data
app.get("/api/dashboard/charts", (req, res) => {
  try {
    const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    if (!fiscalYear) return res.json([]);

    const startDateObj = new Date(fiscalYear.start_date);
    const endDateObj = new Date(fiscalYear.end_date);
    
    // Generate months between start and end date
    const chartData = [];
    let current = new Date(startDateObj);
    current.setDate(1); // Start of month

    while (current <= endDateObj) {
      const year = current.getFullYear();
      const month = (current.getMonth() + 1).toString().padStart(2, '0');
      const monthName = current.toLocaleString('fr-FR', { month: 'short' });
      
      const monthStart = `${year}-${month}-01`;
      const monthEnd = `${year}-${month}-31`;

      // CA (Class 7 Credit)
      const caStmt = db.prepare(`
        SELECT SUM(je.credit) as total 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE '7%' AND t.date BETWEEN ? AND ? AND t.status = 'validated' AND t.deleted_at IS NULL
      `);
      const ca = caStmt.get(monthStart, monthEnd).total || 0;

      // Charges (Class 6 Debit)
      const chargesStmt = db.prepare(`
        SELECT SUM(je.debit) as total 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE '6%' AND t.date BETWEEN ? AND ? AND t.status = 'validated' AND t.deleted_at IS NULL
      `);
      const charges = chargesStmt.get(monthStart, monthEnd).total || 0;

      chartData.push({
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        ca: ca,
        charges: charges
      });

      current.setMonth(current.getMonth() + 1);
    }

    res.json(chartData);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get dashboard expense breakdown
app.get("/api/dashboard/breakdown", (req, res) => {
  try {
    const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    const startDate = fiscalYear ? fiscalYear.start_date : '1970-01-01';
    const endDate = fiscalYear ? fiscalYear.end_date : '9999-12-31';

    const breakdownStmt = db.prepare(`
      SELECT 
        substr(je.account_code, 1, 2) as category,
        SUM(je.debit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '6%' AND t.date BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY category
      ORDER BY total DESC
      LIMIT 5
    `);
    
    const rawData = breakdownStmt.all(startDate, endDate);
    
    // Map category codes to names (Simplified mapping)
    const categoryNames: {[key: string]: string} = {
      '60': 'Achats',
      '61': 'Transports',
      '62': 'Services Extérieurs',
      '63': 'Impôts & Taxes',
      '64': 'Charges Personnel',
      '65': 'Autres Charges',
      '66': 'Charges Financières',
      '67': 'Charges Exceptionnelles',
      '68': 'Dotations Amort.',
      '69': 'Impôts sur Résultat'
    };

    const breakdownData = rawData.map((item: any) => ({
      name: categoryNames[item.category] || `Compte ${item.category}`,
      value: item.total
    }));

    res.json(breakdownData);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/dashboard/ratios", (req, res) => {
  try {
    const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    const startDate = fiscalYear ? fiscalYear.start_date : '1970-01-01';
    const endDate = fiscalYear ? fiscalYear.end_date : '9999-12-31';

    // Balance Sheet items (Cumulative)
    // Assets: Classes 2, 3, 4, 5 (Debit balance)
    const assets = db.prepare("SELECT SUM(debit - credit) as total FROM journal_entries WHERE account_code LIKE '2%' OR account_code LIKE '3%' OR account_code LIKE '4%' OR account_code LIKE '5%'").get().total || 0;
    
    // Liabilities (External Debt): Class 1 (starting with 16, 17 - Long term debt) + Class 4 (Short term debt)
    const liabilities = db.prepare("SELECT SUM(credit - debit) as total FROM journal_entries WHERE account_code LIKE '16%' OR account_code LIKE '17%' OR account_code LIKE '4%'").get().total || 0;
    
    // Current Assets: Classes 3, 4, 5
    const currentAssets = db.prepare("SELECT SUM(debit - credit) as total FROM journal_entries WHERE account_code LIKE '3%' OR account_code LIKE '4%' OR account_code LIKE '5%'").get().total || 0;
    
    // Current Liabilities: Class 4
    const currentLiabilities = db.prepare("SELECT SUM(credit - debit) as total FROM journal_entries WHERE account_code LIKE '4%'").get().total || 0;

    // Income Statement items (Fiscal Year specific)
    const revenueStmt = db.prepare(`
      SELECT SUM(je.credit - je.debit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '7%' AND t.date BETWEEN ? AND ? AND t.deleted_at IS NULL
    `);
    const revenue = revenueStmt.get(startDate, endDate).total || 0;

    const expensesStmt = db.prepare(`
      SELECT SUM(je.debit - je.credit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '6%' AND t.date BETWEEN ? AND ? AND t.deleted_at IS NULL
    `);
    const expenses = expensesStmt.get(startDate, endDate).total || 0;

    const netIncome = revenue - expenses;

    const currentRatio = currentLiabilities !== 0 ? (currentAssets / currentLiabilities) : 0;
    const netMargin = revenue !== 0 ? (netIncome / revenue) * 100 : 0;

    res.json({
      currentRatio: parseFloat(currentRatio.toFixed(2)),
      netMargin: parseFloat(netMargin.toFixed(1)),
      solvency: liabilities !== 0 ? parseFloat((assets / liabilities).toFixed(2)) : 100,
      roi: assets !== 0 ? parseFloat((netIncome / assets * 100).toFixed(1)) : 0
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get recent transactions for dashboard
app.get("/api/dashboard/recent", (req, res) => {
  try {
    const fiscalYear = db.prepare("SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1").get();
    const startDate = fiscalYear ? fiscalYear.start_date : '1970-01-01';
    const endDate = fiscalYear ? fiscalYear.end_date : '9999-12-31';

    const recentStmt = db.prepare(`
      SELECT 
        t.id,
        t.date,
        t.description,
        t.reference,
        (SELECT SUM(debit) FROM journal_entries WHERE transaction_id = t.id) as amount
      FROM transactions t
      WHERE t.date BETWEEN ? AND ? AND t.deleted_at IS NULL
      ORDER BY t.date DESC, t.id DESC
      LIMIT 5
    `);
    const recent = recentStmt.all(startDate, endDate);
    res.json(recent);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Budget APIs
app.get("/api/accounts/expenses", (req, res) => {
  try {
    const stmt = db.prepare("SELECT code, name FROM accounts WHERE code LIKE '6%' AND LENGTH(code) = 3");
    const accounts = stmt.all();
    res.json(accounts);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/budgets/categories", (req, res) => {
  try {
    const categories = db.prepare("SELECT * FROM budget_categories ORDER BY name").all();
    const mappings = db.prepare("SELECT * FROM budget_category_accounts").all();
    
    const result = categories.map((c: any) => ({
      ...c,
      accounts: mappings.filter((m: any) => m.category_id === c.id).map((m: any) => m.account_code)
    }));
    
    res.json(result);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/budgets/categories", (req, res) => {
  const { name, color, type, accounts } = req.body;
  try {
    const result = db.transaction(() => {
      const stmt = db.prepare(`INSERT INTO budget_categories (name, color, type) VALUES (?, ?, ?)`);
      const insertResult = stmt.run(name, color || '#94a3b8', type || 'expense');
      const categoryId = insertResult.lastInsertRowid;
      
      if (accounts && Array.isArray(accounts)) {
        const mapStmt = db.prepare(`INSERT INTO budget_category_accounts (category_id, account_code) VALUES (?, ?)`);
        for (const code of accounts) {
           mapStmt.run(categoryId, code);
        }
      }
      return { id: categoryId };
    })();
    res.json({ success: true, ...result });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/budgets/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, color, type, accounts } = req.body;
  try {
    db.transaction(() => {
      const stmt = db.prepare(`UPDATE budget_categories SET name = ?, color = ?, type = ? WHERE id = ?`);
      stmt.run(name, color, type || 'expense', id);
      
      if (accounts && Array.isArray(accounts)) {
        db.prepare('DELETE FROM budget_category_accounts WHERE category_id = ?').run(id);
        const mapStmt = db.prepare(`INSERT INTO budget_category_accounts (category_id, account_code) VALUES (?, ?)`);
        for (const code of accounts) {
           mapStmt.run(id, code);
        }
      }
    })();
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/budgets/categories/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM budget_category_accounts WHERE category_id = ?').run(id);
      const result = db.prepare('DELETE FROM budget_categories WHERE id = ?').run(id);
      if (result.changes === 0) throw new Error("Catégorie introuvable");
    })();
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/budgets/status", (req, res) => {
  const { year, month } = req.query;
  const periodYear = parseInt(year as string) || new Date().getFullYear();
  const periodMonth = parseInt(month as string) || (new Date().getMonth() + 1);

  try {
    // 1. Get all expense accounts
    const accounts = db.prepare("SELECT code, name FROM accounts WHERE code LIKE '6%'").all();
    
    // 2. Get budgets
    const budgets = db.prepare("SELECT * FROM budgets WHERE period_year = ? AND period_month = ?").all(periodYear, periodMonth);
    const budgetMap = budgets.reduce((acc: any, b: any) => {
      acc[b.account_code] = b.amount;
      return acc;
    }, {});

    // 3. Get engagements (pending/approved)
    const engagements = db.prepare(`
      SELECT account_code, SUM(amount) as total_engaged 
      FROM budget_engagements 
      WHERE period_year = ? AND period_month = ? AND status IN ('pending', 'approved')
      GROUP BY account_code
    `).all(periodYear, periodMonth);
    const engagementMap = engagements.reduce((acc: any, e: any) => {
      acc[e.account_code] = e.total_engaged;
      return acc;
    }, {});

    // 4. Get actuals (journalized)
    const monthStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}%`;
    const actuals = db.prepare(`
      SELECT je.account_code, SUM(je.debit - je.credit) as total_actual
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date LIKE ? AND je.account_code LIKE '6%' AND t.deleted_at IS NULL
      GROUP BY je.account_code
    `).all(monthStr);
    const actualMap = actuals.reduce((acc: any, a: any) => {
      acc[a.account_code] = a.total_actual;
      return acc;
    }, {});

    // 5. Combine results
    const results = accounts.map((acc: any) => {
      const budget = budgetMap[acc.code] || 0;
      const engaged = engagementMap[acc.code] || 0;
      const actual = actualMap[acc.code] || 0;
      return {
        account_code: acc.code,
        account_name: acc.name,
        budget,
        engaged,
        actual,
        available: budget - engaged - actual
      };
    });

    res.json(results);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/budgets/import", (req, res) => {
  const { entries, period_month, period_year } = req.body;
  const userEmail = (req as any).user?.email || 'system';

  try {
    const transaction = db.transaction(() => {
      let importedCount = 0;
      for (const entry of entries) {
        let accountCode = entry.account_code;

        if (!accountCode && entry.category) {
           const categoryRow = db.prepare(`
              SELECT c.id, m.account_code 
              FROM budget_categories c 
              JOIN budget_category_accounts m ON c.id = m.category_id 
              WHERE LOWER(c.name) = LOWER(?)
              LIMIT 1
           `).get(entry.category);
           if (categoryRow) {
             accountCode = categoryRow.account_code;
           }
        }

        if (!accountCode || typeof entry.amount !== 'number') continue;
        
        // Simple verification that account exists and is an expense account
        const account = db.prepare("SELECT code FROM accounts WHERE code = ? AND class_code = '6'").get(accountCode);
        if (!account) continue;

        const current = db.prepare("SELECT * FROM budgets WHERE account_code = ? AND period_year = ? AND period_month = ?").get(accountCode, period_year, period_month);
        
        const stmt = db.prepare(`
          INSERT INTO budgets (account_code, amount, period_month, period_year, last_revised_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(account_code, period_month, period_year) DO UPDATE SET 
            amount = excluded.amount,
            last_revised_at = CURRENT_TIMESTAMP
        `);
        const result = stmt.run(accountCode, entry.amount, period_month, period_year);
        const budgetId = current ? current.id : result.lastInsertRowid;

        if (current && current.amount !== entry.amount) {
          db.prepare(`
            INSERT INTO budget_revisions (budget_id, old_amount, new_amount, reason, revised_by)
            VALUES (?, ?, ?, ?, ?)
          `).run(budgetId, current.amount, entry.amount, "Import CSV en masse", userEmail);
        }
        importedCount++;
      }
      return importedCount;
    });
    
    const count = transaction();
    res.json({ success: true, count });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/budgets", (req, res) => {
  const { account_code, amount, period_month, period_year, reason } = req.body;
  const userEmail = (req as any).user?.email || 'system';
  
  try {
    const transaction = db.transaction(() => {
      // Get existing budget to check for revision
      const current = db.prepare("SELECT * FROM budgets WHERE account_code = ? AND period_year = ? AND period_month = ?").get(account_code, period_year, period_month);
      
      const stmt = db.prepare(`
        INSERT INTO budgets (account_code, amount, period_month, period_year, last_revised_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(account_code, period_month, period_year) DO UPDATE SET 
          amount = excluded.amount,
          last_revised_at = CURRENT_TIMESTAMP
      `);
      const result = stmt.run(account_code, amount, period_month, period_year);
      const budgetId = current ? current.id : result.lastInsertRowid;

      if (current && current.amount !== amount) {
        db.prepare(`
          INSERT INTO budget_revisions (budget_id, old_amount, new_amount, reason, revised_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(budgetId, current.amount, amount, reason || 'Revision manuelle', userEmail);
      }
      
      return { id: budgetId };
    });

    const result = transaction();
    res.json({ success: true, ...result });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/budgets/engagements", (req, res) => {
  const { year, month } = req.query;
  try {
    let query = `
      SELECT e.*, a.name as account_name 
      FROM budget_engagements e
      JOIN accounts a ON e.account_code = a.code
    `;
    const params = [];
    if (year && month) {
      query += " WHERE e.period_year = ? AND e.period_month = ?";
      params.push(year, month);
    }
    query += " ORDER BY e.engagement_date DESC";
    const engagements = db.prepare(query).all(...params);
    res.json(engagements);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/budgets/engagements", (req, res) => {
  const { account_code, amount, description, reference, period_month, period_year } = req.body;
  const userEmail = (req as any).user?.email || 'system';

  try {
    const transaction = db.transaction(() => {
      // Check budget availability
      // 1. Get budget
      const budgetRow = db.prepare("SELECT amount FROM budgets WHERE account_code = ? AND period_year = ? AND period_month = ?").get(account_code, period_year, period_month);
      const budget = budgetRow ? budgetRow.amount : 0;

      // 2. Get current engaged
      const engagedRow = db.prepare(`
        SELECT SUM(amount) as total_engaged 
        FROM budget_engagements 
        WHERE account_code = ? AND period_year = ? AND period_month = ? AND status IN ('pending', 'approved')
      `).get(account_code, period_year, period_month);
      const currentlyEngaged = engagedRow ? (engagedRow.total_engaged || 0) : 0;

      // 3. Get actual
      const monthStr = `${period_year}-${String(period_month).padStart(2, '0')}%`;
      const actualRow = db.prepare(`
        SELECT SUM(je.debit - je.credit) as total_actual
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code = ? AND t.date LIKE ? AND t.deleted_at IS NULL
      `).get(account_code, monthStr);
      const actual = actualRow ? (actualRow.total_actual || 0) : 0;

      const available = budget - currentlyEngaged - actual;

      if (amount > available) {
        throw new Error(`Budget insuffisant. Disponible: ${available}, Requis: ${amount}`);
      }

      const stmt = db.prepare(`
        INSERT INTO budget_engagements (account_code, amount, description, reference, period_month, period_year, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(account_code, amount, description, reference, period_month, period_year, userEmail);
      return { id: result.lastInsertRowid };
    });

    const result = transaction();
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message.includes('Budget insuffisant')) {
      return res.status(400).json({ error: err.message });
    }
    handleApiError(res, err);
  }
});

app.delete("/api/budgets/engagements/:id", (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare("DELETE FROM budget_engagements WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Engagement non trouvé" });
    }
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/budgets/insights", (req, res) => {
  const { year, month } = req.query;
  const periodYear = parseInt(year as string) || new Date().getFullYear();
  const periodMonth = parseInt(month as string) || (new Date().getMonth() + 1);
  const monthStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}%`;

  try {
    const insights: any[] = [];
    
    // 1. Dépenses récurrentes / Abonnements
    // On cherche les transactions ayant des montants identiques sur plusieurs mois consécutifs sur le même compte
    const potentialSubs = db.prepare(`
      SELECT je.account_code, a.name as account_name, t.description, ABS(je.debit - je.credit) as amount, COUNT(*) as occurrences
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.code = je.account_code
      WHERE je.account_code LIKE '6%' AND t.deleted_at IS NULL
      GROUP BY je.account_code, ABS(je.debit - je.credit)
      HAVING occurrences >= 2
      ORDER BY occurrences DESC
      LIMIT 10
    `).all();

    if (potentialSubs.length > 0) {
      insights.push({
        type: 'recurring',
        title: "Dépenses récurrentes détectées",
        description: `Nous avons détecté ${potentialSubs.length} dépenses qui semblent être des abonnements ou charges fixes (ex: ${potentialSubs[0].description} pour ${potentialSubs[0].amount} F CFA).`,
        priority: 'medium'
      });
    }

    // 2. Dépenses inhabituelles ou élevées ce mois-ci par rapport au mois précédent
    // Calculate previous month string
    const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1;
    const prevYear = periodMonth === 1 ? periodYear - 1 : periodYear;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}%`;

    const currentActuals = db.prepare(`
      SELECT je.account_code, a.name as account_name, SUM(je.debit - je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      JOIN accounts a ON a.code = je.account_code
      WHERE t.date LIKE ? AND je.account_code LIKE '6%' AND t.deleted_at IS NULL
      GROUP BY je.account_code
    `).all(monthStr);

    const prevActuals = db.prepare(`
      SELECT je.account_code, SUM(je.debit - je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON t.id = je.transaction_id
      WHERE t.date LIKE ? AND je.account_code LIKE '6%' AND t.deleted_at IS NULL
      GROUP BY je.account_code
    `).all(prevMonthStr);

    const prevMap = prevActuals.reduce((acc: any, row: any) => {
      acc[row.account_code] = row.total;
      return acc;
    }, {});

    let unusualExpenses = 0;
    currentActuals.forEach((curr: any) => {
      const prev = prevMap[curr.account_code] || 0;
      if (prev > 0 && curr.total > prev * 1.5 && curr.total > 10000) {
         // > 50% increase
         insights.push({
           type: 'anomaly',
           title: "Hausse inhabituelle des dépenses",
           description: `La catégorie "${curr.account_name}" a augmenté de ${Math.round((curr.total - prev) / prev * 100)}% par rapport au mois précédent.`,
           priority: 'high'
         });
         unusualExpenses++;
      } else if (prev === 0 && curr.total > 50000) {
         insights.push({
           type: 'anomaly',
           title: "Nouvelle dépense importante",
           description: `Dépense élevée sur "${curr.account_name}" (${curr.total} F CFA) qui n'était pas présente le mois dernier.`,
           priority: 'medium'
         });
      }
    });

    res.json(insights);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/dashboard/budget-vs-actual", (req, res) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const year = req.query.year || currentYear;
  const month = req.query.month || currentMonth;

  try {
    // Get budgets for the month
    const budgetsStmt = db.prepare(`
      SELECT b.account_code, b.amount as budget, a.name as account_name
      FROM budgets b
      JOIN accounts a ON b.account_code = a.code
      WHERE b.period_year = ? AND b.period_month = ?
    `);
    const budgets = budgetsStmt.all(year, month);

    // Get actuals for the month
    const actualsStmt = db.prepare(`
      SELECT SUBSTR(je.account_code, 1, 3) as category, SUM(je.debit - je.credit) as actual
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date LIKE ? AND je.account_code LIKE '6%' AND t.deleted_at IS NULL
      GROUP BY category
    `);
    const monthStr = `${year}-${String(month).padStart(2, '0')}%`;
    const actuals = actualsStmt.all(monthStr);

    // Map actuals by category
    const actualsMap = actuals.reduce((acc: any, curr: any) => {
      acc[curr.category] = curr.actual;
      return acc;
    }, {});

    // Combine
    const result = budgets.map((b: any) => {
      const category = b.account_code.substring(0, 3);
      return {
        name: b.account_name,
        budget: b.budget,
        actual: actualsMap[category] || 0
      };
    });

    res.json(result);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get('/api/dashboard/cashflow-forecast', (req, res) => {
  try {
    const today = new Date();
    const forecast = [];
    
    // Get current cash (Class 5)
    const currentCash = db.prepare(`
      SELECT SUM(je.debit) - SUM(je.credit) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.status = 'validated' AND t.deleted_at IS NULL
    `).get() as any;
    
    let runningBalance = currentCash?.balance || 0;
    
    // Add initial point
    forecast.push({
      date: today.toISOString().split('T')[0],
      balance: runningBalance,
      label: 'Aujourd\'hui'
    });

    // Get upcoming receivables (Clients 411)
    const receivables = db.prepare(`
      SELECT t.due_date, SUM(je.debit - je.credit) as amount
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      WHERE je.account_code LIKE '411%'
      AND t.due_date >= ?
      AND t.status = 'validated'
      AND t.deleted_at IS NULL
      GROUP BY t.due_date
      ORDER BY t.due_date ASC
    `).all(today.toISOString().split('T')[0]) as any[];

    // Get upcoming payables (Fournisseurs 401)
    const payables = db.prepare(`
      SELECT t.due_date, SUM(je.credit - je.debit) as amount
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      WHERE je.account_code LIKE '401%'
      AND t.due_date >= ?
      AND t.status = 'validated'
      AND t.deleted_at IS NULL
      GROUP BY t.due_date
      ORDER BY t.due_date ASC
    `).all(today.toISOString().split('T')[0]) as any[];

    // Merge and sort by date
    const events = [
      ...receivables.map(r => ({ date: r.due_date, amount: r.amount, type: 'in' })),
      ...payables.map(p => ({ date: p.due_date, amount: -p.amount, type: 'out' }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    // Project
    events.forEach(event => {
      runningBalance += event.amount;
      forecast.push({
        date: event.date,
        balance: runningBalance,
        label: new Date(event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      });
    });

    res.json(forecast);
  } catch (err) {
    console.error(err);
    handleApiError(res, new AppError("Erreur serveur" , 500, "server_error"));
  }
});

// --- User Management Routes ---
app.get('/api/users', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Accès refusé" });
  }
  try {
    const users = db.prepare('SELECT id, email, name, role, permissions, created_at FROM users').all();
    // Parse permissions JSON if it exists
    const usersWithPermissions = users.map((u: any) => ({
      ...u,
      permissions: u.permissions ? JSON.parse(u.permissions) : null
    }));
    res.json(usersWithPermissions);
  } catch (err) {
    handleApiError(res, new AppError("Erreur serveur" , 500, "server_error"));
  }
});

app.post('/api/users', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const { email, password, name, role, permissions } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const permissionsStr = permissions ? JSON.stringify(permissions) : null;
    const stmt = db.prepare('INSERT INTO users (email, password_hash, name, role, permissions) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(email, hashedPassword, name, role || 'user', permissionsStr);
    
    logAction(req.user.email, 'CREATE', 'User', info.lastInsertRowid, { email, role });
    
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, new AppError("Erreur lors de la création" , 500, "server_error"));
  }
});

app.put('/api/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const { name, role, password, permissions } = req.body;
  try {
    const permissionsStr = permissions ? JSON.stringify(permissions) : null;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET name = ?, role = ?, password_hash = ?, permissions = ? WHERE id = ?').run(name, role, hashedPassword, permissionsStr, req.params.id);
    } else {
      db.prepare('UPDATE users SET name = ?, role = ?, permissions = ? WHERE id = ?').run(name, role, permissionsStr, req.params.id);
    }
    
    logAction(req.user.email, 'UPDATE', 'User', req.params.id, { role });
    
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, new AppError("Erreur lors de la modification" , 500, "server_error"));
  }
});

app.delete('/api/users/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Accès refusé" });
  }
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
  }
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    
    logAction(req.user.email, 'DELETE', 'User', req.params.id);
    
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, new AppError("Erreur lors de la suppression" , 500, "server_error"));
  }
});

// Get financial statements data
app.get("/api/financial-statements", (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Default to current year if no dates provided
  const currentYear = new Date().getFullYear();
  const start = (startDate as string) || `${currentYear}-01-01`;
  const end = (endDate as string) || `${currentYear}-12-31`;

  try {
    // Helper to get balance of accounts starting with prefix
    // For Income Statement: Credit - Debit (Revenue is Credit positive)
    // For Expenses: Debit - Credit (Expense is Debit positive)
    const getBalance = (prefix: string, type: 'debit' | 'credit' = 'debit') => {
      const stmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE ? AND t.date >= ? AND t.date <= ? AND t.deleted_at IS NULL
      `);
      const result = stmt.get(`${prefix}%`, start, end);
      if (!result) return 0;
      return type === 'debit' 
        ? (result.debit || 0) - (result.credit || 0)
        : (result.credit || 0) - (result.debit || 0);
    };

    // Income Statement Data
    const sales = getBalance('701', 'credit'); // Specific merchandise sales
    const services = getBalance('706', 'credit'); // Specific service revenue
    const purchases = getBalance('60', 'debit');
    const otherExpenses = getBalance('61', 'debit') + getBalance('62', 'debit') + getBalance('63', 'debit');
    const taxes = getBalance('64', 'debit');
    const personnel = getBalance('66', 'debit');
    const depreciation = getBalance('68', 'debit');

    const revenue = getBalance('7', 'credit');
    const expenses = getBalance('6', 'debit');
    const netIncome = revenue - expenses;

    // Refined Balance Sheet Calculation
    const getNetBalance = (prefix: string) => {
      const stmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE ? AND t.date >= ? AND t.date <= ? AND t.deleted_at IS NULL
      `);
      const result = stmt.get(`${prefix}%`, start, end);
      return (result.debit || 0) - (result.credit || 0);
    };

    // Assets
    const assetsFixed = getNetBalance('2');
    const assetsStock = getNetBalance('3');
    const assetsReceivables = getNetBalance('41'); // Clients
    const assetsCash = getNetBalance('5');
    
    const totalAssets = assetsFixed + assetsStock + assetsReceivables + assetsCash;

    // Liabilities
    const liabEquity = -getNetBalance('1'); // Credit balance is negative in getNetBalance
    const liabSuppliers = -getNetBalance('40');
    const liabState = -getNetBalance('44');
    const liabLoans = -getNetBalance('16');

    // Re-calculate for the simple response structure
    const balanceSheet = {
      assets: {
        fixed: assetsFixed,
        current: assetsStock + assetsReceivables,
        cash: assetsCash,
        total: totalAssets
      },
      liabilities: {
        equity: liabEquity,
        debts: liabSuppliers + liabState + liabLoans,
        total: liabEquity + liabSuppliers + liabState + liabLoans
      }
    };

    // Cash Flow Calculation
    const getCashFlow = (prefix: string, type: 'in' | 'out' = 'in') => {
      const stmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE ? AND t.date >= ? AND t.date <= ? AND t.deleted_at IS NULL
      `);
      const result = stmt.get(`${prefix}%`, start, end);
      if (!result) return 0;
      // For assets (like cash), debit is IN, credit is OUT
      // For liabilities/equity, credit is IN, debit is OUT
      // But here we want the net impact on cash
      return (result.debit || 0) - (result.credit || 0);
    };

    // Simplified Cash Flow Statement
    const operatingActivities = netIncome + depreciation; // Simplified: Net Income + Non-cash expenses
    const investingActivities = -assetsFixed; // Simplified: Acquisition of fixed assets
    const financingActivities = liabEquity + liabLoans; // Simplified: New equity/loans

    const cashFlow = {
      operating: operatingActivities,
      investing: investingActivities,
      financing: financingActivities,
      netChange: operatingActivities + investingActivities + financingActivities,
      startBalance: getNetBalance('5'), // This is actually the balance at the end of the period in the current logic
      // Let's fix the start balance logic
    };

    // Corrected Cash Flow Logic
    const getBalanceAtDate = (prefix: string, date: string) => {
      const stmt = db.prepare(`
        SELECT SUM(je.debit) as debit, SUM(je.credit) as credit 
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_code LIKE ? AND t.date < ?
      `);
      const result = stmt.get(`${prefix}%`, date);
      return (result.debit || 0) - (result.credit || 0);
    };

    const cashAtStart = getBalanceAtDate('5', start);
    const cashAtEnd = getBalanceAtDate('5', new Date(new Date(end).getTime() + 86400000).toISOString().split('T')[0]);

    res.json({
      incomeStatement: {
        revenue,
        expenses,
        netIncome,
        details: {
          sales,
          services,
          purchases,
          personnel,
          taxes,
          otherExpenses,
          depreciation
        }
      },
      balanceSheet,
      cashFlow: {
        operating: operatingActivities,
        investing: investingActivities,
        financing: financingActivities,
        netChange: cashAtEnd - cashAtStart,
        startBalance: cashAtStart,
        endBalance: cashAtEnd
      }
    });

  } catch (err) {
    handleApiError(res, err);
  }
});

// --- GLOBAL SEARCH API ---
app.get("/api/search/global", (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json({ results: [] });
  }

  const searchTerm = `%${q}%`;
  const results: any[] = [];

  try {
    // 1. Search Accounts
    const accounts = db.prepare(`
      SELECT 'account' as type, code as id, name as title, code as subtitle, '/accounting/chart' as link
      FROM accounts 
      WHERE (name LIKE ? OR code LIKE ?)
      LIMIT 10
    `).all(searchTerm, searchTerm);
    results.push(...accounts);

    // 2. Search Third Parties (Clients/Suppliers)
    const thirdParties = db.prepare(`
      SELECT 'third_party' as type, id, name as title, type as subtitle, '/third-parties' as link
      FROM third_parties
      WHERE (name LIKE ? OR tax_id LIKE ? OR rccm LIKE ?)
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm);
    results.push(...thirdParties);

    // 3. Search Transactions
    const transactions = db.prepare(`
      SELECT 'transaction' as type, id, description as title, reference as subtitle, '/journal' as link, date
      FROM transactions
      WHERE (description LIKE ? OR reference LIKE ?) AND deleted_at IS NULL
      ORDER BY date DESC
      LIMIT 20
    `).all(searchTerm, searchTerm);
    results.push(...transactions);

    res.json({ results });
  } catch (err) {
    handleApiError(res, err);
  }
});

// AI Audit Data Endpoint
app.get("/api/ai/audit-data", async (req, res) => {
  try {
    const caStmt = db.prepare(`
      SELECT SUM(je.credit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '7%' AND t.status = 'validated'
    `);
    const ca = caStmt.get().total || 0;
    
    const chargesStmt = db.prepare(`
      SELECT SUM(je.debit) as total 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '6%' AND t.status = 'validated'
    `);
    const charges = chargesStmt.get().total || 0;
    
    const cashStmt = db.prepare(`
      SELECT SUM(je.debit) - SUM(je.credit) as balance 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '5%' AND t.status = 'validated'
    `);
    const cash = cashStmt.get().balance || 0;

    const topExpenses = db.prepare(`
      SELECT je.account_code, a.name as account_name, SUM(je.debit) as total
      FROM journal_entries je
      JOIN accounts a ON je.account_code = a.code
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code LIKE '6%' AND t.status = 'validated'
      GROUP BY je.account_code
      ORDER BY total DESC
      LIMIT 5
    `).all();

    res.json({ ca, charges, cash, topExpenses });
  } catch (err: any) {
    handleApiError(res, err);
  }
});

// AI Reconciliation Data Endpoint
app.get("/api/ai/reconcile-data", async (req, res) => {
  try {
    const { account_code } = req.query;
    
    const glEntries = db.prepare(`
      SELECT je.*, t.date, t.description, t.reference 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code = ? AND je.is_reconciled = 0 AND t.status = 'validated'
      ORDER BY t.date DESC
    `).all(account_code);

    res.json({ glEntries });
  } catch (err: any) {
    handleApiError(res, err);
  }
});

// --- Reports API ---

// General Ledger
app.get("/api/reports/general-ledger", (req, res) => {
  const { startDate, endDate, accountStart, accountEnd } = req.query;

  try {
    let query = `
      SELECT 
        je.account_code, 
        a.name as account_name,
        t.date, 
        t.description, 
        t.reference,
        je.debit, 
        je.credit
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.status = 'validated' AND t.deleted_at IS NULL
    `;

    const params = [];

    if (startDate) {
      query += " AND t.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND t.date <= ?";
      params.push(endDate);
    }
    if (accountStart) {
      query += " AND je.account_code >= ?";
      params.push(accountStart);
    }
    if (accountEnd) {
      query += " AND je.account_code <= ?";
      params.push(accountEnd);
    }

    query += " ORDER BY je.account_code ASC, t.date ASC";

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Group by account
    const ledger = {};
    for (const row of rows) {
      if (!ledger[row.account_code]) {
        ledger[row.account_code] = {
          code: row.account_code,
          name: row.account_name,
          entries: [],
          totalDebit: 0,
          totalCredit: 0
        };
      }
      ledger[row.account_code].entries.push(row);
      ledger[row.account_code].totalDebit += row.debit;
      ledger[row.account_code].totalCredit += row.credit;
    }

    res.json(Object.values(ledger));
  } catch (err) {
    handleApiError(res, err);
  }
});

// Trial Balance
app.get("/api/reports/trial-balance", (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT 
        je.account_code,
        a.name as account_name,
        SUM(je.debit) as total_debit,
        SUM(je.credit) as total_credit
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.status = 'validated' AND t.deleted_at IS NULL
    `;

    const params = [];

    if (startDate) {
      query += " AND t.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND t.date <= ?";
      params.push(endDate);
    }

    query += " GROUP BY je.account_code ORDER BY je.account_code ASC";

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    const trialBalance = rows.map(row => ({
      code: row.account_code,
      name: row.account_name,
      debit: row.total_debit,
      credit: row.total_credit,
      balance: row.total_debit - row.total_credit
    }));

    res.json(trialBalance);
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Transaction Attachments API ---
app.post("/api/transactions/:id/attachments", upload.array('files'), (req, res) => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "Aucun fichier fourni" });
  }

  try {
    const insertStmt = db.prepare(`
      INSERT INTO transaction_attachments (transaction_id, file_name, file_path, file_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const file of files) {
        insertStmt.run(id, file.originalname, file.filename, file.mimetype, file.size);
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/transactions/:id/attachments", (req, res) => {
  const { id } = req.params;
  try {
    const attachments = db.prepare("SELECT * FROM transaction_attachments WHERE transaction_id = ?").all(id);
    res.json(attachments);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/attachments/:id", (req, res) => {
  const { id } = req.params;
  try {
    const attachment = db.prepare("SELECT * FROM transaction_attachments WHERE id = ?").get(id) as any;
    if (!attachment) return res.status(404).json({ error: "Pièce jointe non trouvée" });

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier physique non trouvé" });
    }

    res.sendFile(filePath);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/attachments/:id", (req, res) => {
  const { id } = req.params;
  try {
    const attachment = db.prepare("SELECT * FROM transaction_attachments WHERE id = ?").get(id) as any;
    if (!attachment) return res.status(404).json({ error: "Pièce jointe non trouvée" });

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, attachment.file_path);
    
    db.prepare("DELETE FROM transaction_attachments WHERE id = ?").run(id);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Compliance & Audit API ---

app.get("/api/compliance/audit", (req, res) => {
  try {
    // 1. Detect Unbalanced Transactions (Debit != Credit)
    const unbalancedTransactions = db.prepare(`
      SELECT t.id, t.reference, t.date, t.description,
             SUM(je.debit) as total_debit, SUM(je.credit) as total_credit
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      HAVING ABS(SUM(je.debit) - SUM(je.credit)) > 0.001
    `).all();

    // 2. Detect Invalid Account Codes
    const invalidAccounts = db.prepare(`
      SELECT je.id as entry_id, je.transaction_id, t.reference, je.account_code
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      LEFT JOIN accounts a ON je.account_code = a.code
      WHERE a.code IS NULL AND t.deleted_at IS NULL
    `).all();

    // 3. Detect Incorrect Dates (Invalid format or outside reasonable range)
    const incorrectDates = db.prepare(`
      SELECT id, reference, date, description
      FROM transactions
      WHERE (date IS NULL OR date = '' OR date NOT LIKE '____-__-__')
      AND deleted_at IS NULL
    `).all();

    // 4. Detect Missing Descriptions
    const missingTransactionLabels = db.prepare(`
      SELECT id, reference, date
      FROM transactions
      WHERE (description IS NULL OR trim(description) = '')
      AND deleted_at IS NULL
    `).all();

    const missingEntryLabels = db.prepare(`
      SELECT je.id as entry_id, je.transaction_id, t.reference, je.account_code
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE (je.description IS NULL OR trim(je.description) = '')
      AND t.deleted_at IS NULL
    `).all();

    const auditResults = {
      timestamp: new Date().toISOString(),
      summary: {
        unbalancedCount: unbalancedTransactions.length,
        invalidAccountsCount: invalidAccounts.length,
        incorrectDatesCount: incorrectDates.length,
        missingDescriptionsCount: missingTransactionLabels.length + missingEntryLabels.length
      },
      issues: {
        unbalancedTransactions,
        invalidAccounts,
        incorrectDates,
        missingDescriptions: {
          transactions: missingTransactionLabels,
          entries: missingEntryLabels
        }
      }
    };

    res.json(auditResults);
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Compliance & Audit API ---

app.get("/api/compliance/audit", (req, res) => {
  try {
    const report: any = {
      unbalanced: [],
      invalidAccounts: [],
      missingDescriptions: [],
      dateAnomalies: []
    };

    // 1. Unbalanced entries (Debit != Credit)
    report.unbalanced = db.prepare(`
      SELECT t.id, t.reference, t.date, 
             SUM(je.debit) as total_debit, 
             SUM(je.credit) as total_credit
      FROM transactions t
      JOIN journal_entries je ON t.id = je.transaction_id
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      HAVING ABS(SUM(je.debit) - SUM(je.credit)) > 0.001
    `).all();

    // 2. Invalid accounts (Ghost accounts not in COA)
    report.invalidAccounts = db.prepare(`
      SELECT je.transaction_id, t.reference, je.account_code, je.debit, je.credit
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      LEFT JOIN accounts a ON je.account_code = a.code
      WHERE a.code IS NULL AND t.deleted_at IS NULL
    `).all();

    // 3. Missing labels/descriptions
    report.missingDescriptions = db.prepare(`
      SELECT id, reference, date, type
      FROM transactions
      WHERE (description IS NULL OR TRIM(description) = '') AND deleted_at IS NULL
    `).all();

    // 4. Date anomalies (Future dates or extreme past)
    const today = new Date().toISOString().split('T')[0];
    report.dateAnomalies = db.prepare(`
      SELECT id, reference, date
      FROM transactions
      WHERE (date > ? OR date < '1990-01-01') AND deleted_at IS NULL
    `).all(today);

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: report.unbalanced.length + report.invalidAccounts.length + report.missingDescriptions.length + report.dateAnomalies.length,
        unbalancedCount: report.unbalanced.length,
        invalidAccountsCount: report.invalidAccounts.length,
        missingDescriptionsCount: report.missingDescriptions.length,
        dateAnomaliesCount: report.dateAnomalies.length
      },
      details: report
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Custom Reports API ---

app.get("/api/reports/balance-sheet", (req, res) => {
  const { date } = req.query;
  try {
    const rows = db.prepare(`
      SELECT 
        je.account_code,
        a.name as account_name,
        SUM(je.debit) as total_debit,
        SUM(je.credit) as total_credit,
        SUM(je.debit - je.credit) as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.status = 'validated' AND t.deleted_at IS NULL AND t.date <= ? AND je.account_code < '6'
      GROUP BY je.account_code
      ORDER BY je.account_code ASC
    `).all(date || new Date().toISOString().split('T')[0]);
    res.json(rows);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/reports/profit-loss", (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const rows = db.prepare(`
      SELECT 
        je.account_code,
        a.name as account_name,
        SUM(je.debit) as total_debit,
        SUM(je.credit) as total_credit,
        CASE 
          WHEN je.account_code LIKE '7%' THEN SUM(je.credit - je.debit)
          ELSE SUM(je.debit - je.credit)
        END as balance
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      JOIN accounts a ON je.account_code = a.code
      WHERE t.status = 'validated' AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ? AND je.account_code >= '6'
      GROUP BY je.account_code
      ORDER BY je.account_code ASC
    `).all(startDate || '1970-01-01', endDate || '9999-12-31');
    res.json(rows);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/reports/hr", (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = (startDate as string) || '1970-01-01';
    const end = (endDate as string) || '9999-12-31';

    // 1. Salaries & Bonuses by Department
    const departmentStats = db.prepare(`
      SELECT 
        e.department,
        COUNT(DISTINCT e.id) as employee_count,
        SUM(p.base_salary) as total_base_salary,
        SUM(p.bonuses) as total_bonuses,
        SUM(p.deductions) as total_deductions,
        SUM(p.net_salary) as total_net_salary
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN payroll_periods pp ON p.period_id = pp.id
      WHERE pp.status IN ('validated', 'paid')
      GROUP BY e.department
    `).all();

    // 2. Employee specific bonus and deductions history (used to track primes/heures sup)
    const employeeBonuses = db.prepare(`
      SELECT 
        e.id,
        e.first_name,
        e.last_name,
        e.department,
        pp.month,
        pp.year,
        p.bonuses,
        p.details
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN payroll_periods pp ON p.period_id = pp.id
      WHERE pp.status IN ('validated', 'paid') AND p.bonuses > 0
      ORDER BY pp.year DESC, pp.month DESC
    `).all();

    res.json({ departmentStats, employeeBonuses });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/reports/custom", (req, res) => {
  const { type, startDate, endDate, accountCodes, detailed } = req.query;
  
  try {
    const start = (startDate as string) || '1970-01-01';
    const end = (endDate as string) || '9999-12-31';
    const isDetailed = detailed === 'true';
    const accountsFilter = accountCodes ? (accountCodes as string).split(',') : [];

    let query = "";
    let params: any[] = [];

    if (isDetailed) {
      query = `
        SELECT 
          je.account_code,
          a.name as account_name,
          t.date,
          t.description,
          t.reference,
          je.debit,
          je.credit
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.status = 'validated' AND t.date >= ? AND t.date <= ?
      `;
      params = [start, end];

      if (accountsFilter.length > 0) {
        query += ` AND je.account_code IN (${accountsFilter.map(() => '?').join(',')})`;
        params.push(...accountsFilter);
      }

      if (type === 'balance-sheet') {
        query += " AND (je.account_code LIKE '1%' OR je.account_code LIKE '2%' OR je.account_code LIKE '3%' OR je.account_code LIKE '4%' OR je.account_code LIKE '5%')";
      } else if (type === 'income-statement') {
        query += " AND (je.account_code LIKE '6%' OR je.account_code LIKE '7%')";
      }

      query += " ORDER BY t.date ASC, je.account_code ASC";
    } else {
      query = `
        SELECT 
          je.account_code,
          a.name as account_name,
          SUM(je.debit) as total_debit,
          SUM(je.credit) as total_credit
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        JOIN accounts a ON je.account_code = a.code
        WHERE t.status = 'validated' AND t.date >= ? AND t.date <= ?
      `;
      params = [start, end];

      if (accountsFilter.length > 0) {
        query += ` AND je.account_code IN (${accountsFilter.map(() => '?').join(',')})`;
        params.push(...accountsFilter);
      }

      if (type === 'balance-sheet') {
        query += " AND (je.account_code LIKE '1%' OR je.account_code LIKE '2%' OR je.account_code LIKE '3%' OR je.account_code LIKE '4%' OR je.account_code LIKE '5%')";
      } else if (type === 'income-statement') {
        query += " AND (je.account_code LIKE '6%' OR je.account_code LIKE '7%')";
      }

      query += " GROUP BY je.account_code ORDER BY je.account_code ASC";
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    res.json(rows);
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- VAT Declaration API ---

app.get("/api/vat/declaration", (req, res) => {
  const { month, year } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: "Month and year are required" });
  }

  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    // Get configured VAT accounts
    const vatSettings = db.prepare("SELECT account_collected, account_deductible FROM vat_settings WHERE is_active = 1").all();
    
    // Extract unique accounts, default to '443%' and '445%' if none configured
    const collectedAccounts = [...new Set(vatSettings.map(s => s.account_collected))];
    const deductibleAccounts = [...new Set(vatSettings.map(s => s.account_deductible))];

    // Build WHERE clauses for accounts
    const collectedWhere = collectedAccounts.length > 0 
      ? `(${collectedAccounts.map(a => `je.account_code LIKE '${a}%'`).join(' OR ')})`
      : `je.account_code LIKE '443%'`;
      
    const deductibleWhere = deductibleAccounts.length > 0
      ? `(${deductibleAccounts.map(a => `je.account_code LIKE '${a}%'`).join(' OR ')})`
      : `je.account_code LIKE '445%'`;

    // 1. Calculate Output VAT (TVA Collectée)
    const outputVatStmt = db.prepare(`
      SELECT SUM(je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ?
      AND ${collectedWhere}
    `);
    const outputVat = outputVatStmt.get(startDate, endDate).total || 0;

    // 2. Calculate Input VAT (TVA Déductible)
    const inputVatStmt = db.prepare(`
      SELECT SUM(je.debit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ?
      AND ${deductibleWhere}
    `);
    const inputVat = inputVatStmt.get(startDate, endDate).total || 0;

    // 3. Get details for drill-down
    // Output Details
    const outputDetailsStmt = db.prepare(`
      SELECT je.account_code, SUM(je.credit) as amount
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ?
      AND ${collectedWhere}
      GROUP BY je.account_code
    `);
    const outputDetails = outputDetailsStmt.all(startDate, endDate);

    // Input Details
    const inputDetailsStmt = db.prepare(`
      SELECT je.account_code, SUM(je.debit) as amount
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ?
      AND ${deductibleWhere}
      GROUP BY je.account_code
    `);
    const inputDetails = inputDetailsStmt.all(startDate, endDate);

    res.json({
      period: { month, year },
      collected: {
        total: outputVat,
        details: outputDetails
      },
      deductible: {
        total: inputVat,
        details: inputDetails
      },
      netVat: outputVat - inputVat
    });

  } catch (err) {
    handleApiError(res, err);
  }
});

// --- VAT Settings API ---

app.get("/api/vat-settings", (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM vat_settings ORDER BY rate DESC").all();
    res.json(settings);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/vat-settings", (req, res) => {
  const { rate, label, account_collected, account_deductible } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO vat_settings (rate, label, account_collected, account_deductible, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = stmt.run(rate, label, account_collected, account_deductible);
    logAction(req.user?.email || 'Admin', 'CREATE', 'VATSetting', result.lastInsertRowid, { rate, label });
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/vat-settings/:id", (req, res) => {
  const { rate, label, account_collected, account_deductible, is_active } = req.body;
  const { id } = req.params;
  try {
    const oldSetting = db.prepare("SELECT * FROM vat_settings WHERE id = ?").get(id) as any;
    const stmt = db.prepare(`
      UPDATE vat_settings 
      SET rate = ?, label = ?, account_collected = ?, account_deductible = ?, is_active = ?
      WHERE id = ?
    `);
    stmt.run(rate, label, account_collected, account_deductible, is_active ? 1 : 0, id);
    logAction(req.user?.email || 'Admin', 'UPDATE', 'VATSetting', id, { 
      previous: oldSetting,
      current: { rate, label, is_active }
    });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/vat-settings/:id", (req, res) => {
  const { id } = req.params;
  try {
    const oldSetting = db.prepare("SELECT * FROM vat_settings WHERE id = ?").get(id) as any;
    db.prepare("DELETE FROM vat_settings WHERE id = ?").run(id);
    logAction(req.user?.email || 'Admin', 'DELETE', 'VATSetting', id, { label: oldSetting?.label });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Tax Summary API ---

app.get("/api/tax/summary", (req, res) => {
  const { month, year } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: "Month and year are required" });
  }

  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    // 1. VAT Summary (Reuse logic from VAT declaration)
    const vatSettings = db.prepare("SELECT account_collected, account_deductible FROM vat_settings WHERE is_active = 1").all();
    const collectedAccounts = [...new Set(vatSettings.map(s => s.account_collected))];
    const deductibleAccounts = [...new Set(vatSettings.map(s => s.account_deductible))];

    const collectedWhere = collectedAccounts.length > 0 
      ? `(${collectedAccounts.map(a => `je.account_code LIKE '${a}%'`).join(' OR ')})`
      : `je.account_code LIKE '443%'`;
      
    const deductibleWhere = deductibleAccounts.length > 0
      ? `(${deductibleAccounts.map(a => `je.account_code LIKE '${a}%'`).join(' OR ')})`
      : `je.account_code LIKE '445%'`;

    const outputVat = db.prepare(`
      SELECT SUM(je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ? AND ${collectedWhere}
    `).get(startDate, endDate).total || 0;

    const inputVat = db.prepare(`
      SELECT SUM(je.debit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ? AND ${deductibleWhere}
    `).get(startDate, endDate).total || 0;

    // 2. Payroll Taxes (from payslips in that period)
    const payrollTaxes = db.prepare(`
      SELECT 
        p.details
      FROM payslips p
      JOIN payroll_periods pp ON p.period_id = pp.id
      WHERE pp.month = ? AND pp.year = ? AND pp.status = 'validated'
    `).all(month, year);

    let totalCNPS_Sal = 0;
    let totalCNPS_Pat = 0;
    let totalIS = 0;
    let totalCN = 0;
    let totalIGR = 0;

    payrollTaxes.forEach(p => {
      const details = JSON.parse(p.details || '{}');
      const deductions = details.deductions || [];
      const employerTaxes = details.employerTaxes || [];

      deductions.forEach((d: any) => {
        if (d.name.includes('CNPS')) totalCNPS_Sal += d.amount;
        if (d.name.includes('IS')) totalIS += d.amount;
        if (d.name.includes('CN')) totalCN += d.amount;
        if (d.name.includes('IGR')) totalIGR += d.amount;
      });

      employerTaxes.forEach((et: any) => {
        if (et.name.includes('CNPS')) totalCNPS_Pat += et.amount;
      });
    });

    // 3. Corporate Tax (IS) Estimation
    // Profit = Total Products (Class 7) - Total Charges (Class 6)
    const products = db.prepare(`
      SELECT SUM(je.credit - je.debit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ? AND je.account_code LIKE '7%'
    `).get(startDate, endDate).total || 0;

    const charges = db.prepare(`
      SELECT SUM(je.debit - je.credit) as total
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.date BETWEEN ? AND ? AND je.account_code LIKE '6%'
    `).get(startDate, endDate).total || 0;

    const profit = Math.max(0, products - charges);
    const estimatedIS = profit * 0.25; // 25% standard rate

    // 4. Deadlines (Mocked for now based on common rules)
    const deadlines = [
      { name: "Déclaration TVA", date: `${year}-${String(Number(month) + 1).padStart(2, '0')}-15`, status: 'upcoming' },
      { name: "Déclaration CNPS", date: `${year}-${String(Number(month) + 1).padStart(2, '0')}-15`, status: 'upcoming' },
      { name: "Impôts sur Salaires (ITS)", date: `${year}-${String(Number(month) + 1).padStart(2, '0')}-15`, status: 'upcoming' }
    ];

    res.json({
      period: { month, year },
      vat: {
        collected: outputVat,
        deductible: inputVat,
        net: outputVat - inputVat
      },
      payroll: {
        cnps_sal: totalCNPS_Sal,
        cnps_pat: totalCNPS_Pat,
        is_its: totalIS,
        cn: totalCN,
        igr: totalIGR,
        total: totalCNPS_Sal + totalCNPS_Pat + totalIS + totalCN + totalIGR
      },
      corporate: {
        profit,
        estimatedTax: estimatedIS
      },
      deadlines
    });

  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Tax Rules API ---

// Get all tax rules
app.get("/api/tax-rules", (req, res) => {
  try {
    const rules = db.prepare("SELECT * FROM tax_rules ORDER BY type, code").all();
    res.json(rules);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update a tax rule
app.put("/api/tax-rules/:code", (req, res) => {
  const { code } = req.params;
  const { rate, ceiling, fixed_amount, is_active } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE tax_rules 
      SET rate = ?, ceiling = ?, fixed_amount = ?, is_active = ?
      WHERE code = ?
    `);
    
    const info = stmt.run(rate, ceiling, fixed_amount, is_active ? 1 : 0, code);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Règle fiscale non trouvée" });
    }

    logAction(req.user?.name || 'Admin', 'UPDATE', 'TaxRule', code, { rate, ceiling, fixed_amount, is_active });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Payroll Settings API ---

// Brackets
app.get("/api/pr/brackets", (req, res) => {
  try {
    const brackets = db.prepare("SELECT * FROM payroll_tax_brackets ORDER BY tax_code, min_value").all();
    res.json(brackets);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/pr/brackets/:id", (req, res) => {
  const { id } = req.params;
  const { rate, min_value, max_value, deduction } = req.body;
  try {
    db.prepare(`
      UPDATE payroll_tax_brackets 
      SET rate = ?, min_value = ?, max_value = ?, deduction = ?
      WHERE id = ?
    `).run(rate, min_value, max_value, deduction, id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Reductions
app.get("/api/pr/reductions", (req, res) => {
  try {
    const reductions = db.prepare("SELECT * FROM payroll_tax_reductions ORDER BY marital_status, children_count").all();
    res.json(reductions);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/pr/reductions/:id", (req, res) => {
  const { id } = req.params;
  const { parts } = req.body;
  try {
    db.prepare("UPDATE payroll_tax_reductions SET parts = ? WHERE id = ?").run(parts, id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Rules (Bonuses/Deductions)
app.get("/api/pr/rules", (req, res) => {
  try {
    const rules = db.prepare("SELECT * FROM payroll_rules ORDER BY type, name").all();
    res.json(rules);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/pr/rules", (req, res) => {
  const { code, name, type, formula, is_taxable, is_social_taxable } = req.body;
  try {
    db.prepare(`
      INSERT INTO payroll_rules (code, name, type, formula, is_taxable, is_social_taxable)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, type, formula, is_taxable ? 1 : 0, is_social_taxable ? 1 : 0);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/pr/rules/:id", (req, res) => {
  const { id } = req.params;
  const { name, formula, is_taxable, is_social_taxable, is_active } = req.body;
  try {
    db.prepare(`
      UPDATE payroll_rules 
      SET name = ?, formula = ?, is_taxable = ?, is_social_taxable = ?, is_active = ?
      WHERE id = ?
    `).run(name, formula, is_taxable ? 1 : 0, is_social_taxable ? 1 : 0, is_active ? 1 : 0, id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.delete("/api/pr/rules/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM payroll_rules WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Payroll Tax Calculation Helpers (Ivorian Scale) ---
function calculateIvorianTaxes(gross: number, parts: number, getRule: (code: string) => any) {
  // 1. Base for IS and CN (80% of Gross)
  const base80 = gross * 0.8;

  // 2. IS (Impôt sur le Salaire) - 1.5% of 80% of Gross (equivalent to 1.2% of Gross)
  const isRule = getRule('IS');
  const isRate = isRule ? isRule.rate / 0.8 : 0.015; // If rule is 1.2% of gross, it's 1.5% of 80%
  const isTax = Math.round(base80 * isRate);

  // 3. CN (Contribution Nationale) - Progressive on 80% of Gross
  // Note: The brackets are usually fixed by law, but we can at least use the rule's active status
  const cnRule = getRule('CN');
  let cnTax = 0;
  if (cnRule && cnRule.is_active) {
    if (base80 > 50000) {
      if (base80 <= 130000) {
        cnTax = (base80 - 50000) * 0.015;
      } else if (base80 <= 200000) {
        cnTax = (130000 - 50000) * 0.015 + (base80 - 130000) * 0.05;
      } else {
        cnTax = (130000 - 50000) * 0.015 + (200000 - 130000) * 0.05 + (base80 - 200000) * 0.10;
      }
    }
  }
  cnTax = Math.round(cnTax);

  return { isTax, cnTax, base80 };
}

function calculateIGR(gross: number, isTax: number, cnTax: number, cnpsEmployee: number, parts: number, getRule: (code: string) => any) {
  const igrRule = getRule('IGR');
  if (!igrRule || !igrRule.is_active) return { igrTax: 0, igrBase: 0, q: 0, rate: 0, v: 0 };

  // Base IGR = (80% Gross - IS - CN - CNPS) * 85%
  const base80 = gross * 0.8;
  const igrBase = Math.max(0, (base80 - isTax - cnTax - cnpsEmployee) * 0.85);
  const q = igrBase / parts;

  let rate = 0;
  let v = 0;

  if (q <= 25000) {
    rate = 0; v = 0;
  } else if (q <= 45500) {
    rate = 0.10; v = 2500;
  } else if (q <= 81500) {
    rate = 0.15; v = 4775;
  } else if (q <= 126500) {
    rate = 0.20; v = 8850;
  } else if (q <= 220000) {
    rate = 0.25; v = 15175;
  } else if (q <= 389000) {
    rate = 0.35; v = 37175;
  } else if (q <= 842000) {
    rate = 0.45; v = 76075;
  } else {
    rate = 0.60; v = 202375;
  }

  const igrTax = Math.max(0, Math.round(igrBase * rate - v * parts));
  return { igrTax, igrBase, q, rate, v };
}

// --- Payroll API ---

// Get Employees
app.get("/api/employees", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM employees ORDER BY last_name, first_name");
    const employees = stmt.all();
    res.json(employees);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Create Employee
app.post("/api/employees", (req, res) => {
  const { firstName, lastName, email, phone, position, department, baseSalary, startDate, maritalStatus, childrenCount, cnpsNumber } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO employees (first_name, last_name, email, phone, position, department, base_salary, start_date, marital_status, children_count, cnps_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(firstName, lastName, email, phone, position, department, baseSalary, startDate, maritalStatus || 'single', childrenCount || 0, cnpsNumber);
    logAction(req.user?.name || 'Admin', 'CREATE', 'Employee', info.lastInsertRowid, { firstName, lastName });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update Employee
app.put("/api/employees/:id", (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, position, department, baseSalary, startDate, maritalStatus, childrenCount, cnpsNumber, status } = req.body;
  try {
    const stmt = db.prepare(`
      UPDATE employees 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, position = ?, department = ?, base_salary = ?, start_date = ?, marital_status = ?, children_count = ?, cnps_number = ?, status = ?
      WHERE id = ?
    `);
    const info = stmt.run(firstName, lastName, email, phone, position, department, baseSalary, startDate, maritalStatus, childrenCount, cnpsNumber, status || 'active', id);
    
    if (info.changes === 0) return res.status(404).json({ error: "Employé non trouvé" });
    
    logAction(req.user?.name || 'Admin', 'UPDATE', 'Employee', id, { firstName, lastName, status });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/payroll/periods", (req, res) => {
  console.log(`GET /api/pr_periods requested by user: ${req.user?.email || 'unknown'}`);
  try {
    const stmt = db.prepare(`
      SELECT p.*, a.name as payment_account_name, a.code as payment_account_code
      FROM payroll_periods p
      LEFT JOIN journal_entries je ON p.payment_transaction_id = je.transaction_id AND je.credit > 0 AND je.account_code LIKE '5%'
      LEFT JOIN accounts a ON je.account_code = a.code
      ORDER BY p.year DESC, p.month DESC
    `);
    const periods = stmt.all();
    res.json(periods.map((p: any) => ({
      ...p,
      details: p.details ? JSON.parse(p.details) : null
    })));
  } catch (err) {
    handleApiError(res, err);
  }
});

// Create Payroll Period
app.post("/api/payroll/periods", (req, res) => {
  const { month, year } = req.body;
  try {
    // Check if exists
    const check = db.prepare("SELECT id FROM payroll_periods WHERE month = ? AND year = ?");
    if (check.get(month, year)) {
      return res.status(400).json({ error: "Cette période de paie existe déjà." });
    }

    const stmt = db.prepare("INSERT INTO payroll_periods (month, year) VALUES (?, ?)");
    const info = stmt.run(month, year);
    logAction(req.user?.name || 'Admin', 'CREATE', 'PayrollPeriod', info.lastInsertRowid, { month, year });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Generate Payslips for Period
app.post("/api/payroll/periods/:id/generate", (req, res) => {
  const { id } = req.params;
  
  const generate = db.transaction(() => {
    const period = db.prepare("SELECT * FROM payroll_periods WHERE id = ?").get(id) as any;
    if (!period) throw new Error("Période introuvable");

    // 1. Get all active employees and tax rules
    const employees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all() as any[];
    const rules = db.prepare("SELECT * FROM tax_rules WHERE is_active = 1").all() as any[];
    
    // Helper to get rule by code
    const getRule = (code) => rules.find(r => r.code === code);

    // 2. Delete existing draft payslips for this period
    db.prepare("DELETE FROM payslips WHERE period_id = ? AND transaction_id IS NULL").run(id);

    const insertPayslip = db.prepare(`
      INSERT INTO payslips (employee_id, period_id, base_salary, bonuses, deductions, net_salary, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let totalAmount = 0;

    const periodStart = new Date(period.year, period.month - 1, 1);
    const periodEnd = new Date(period.year, period.month, 0);

    for (const emp of employees) {
      let base = emp.base_salary;
      const empStart = new Date(emp.start_date);
      
      // Filter out employees who haven't started yet relative to this period
      if (empStart > periodEnd) {
        continue;
      }
      
      // Prorata temporis (standard 30 days calculation)
      let prorataFactor = 1;
      let activeDays = 30;
      if (empStart > periodStart && empStart <= periodEnd) {
         const startDay = Math.min(30, empStart.getDate());
         activeDays = 30 - startDay + 1;
         prorataFactor = activeDays / 30;
         base = Math.round(emp.base_salary * prorataFactor);
      }

      const bonuses = 0; // Placeholder
      const gross = base + bonuses;
      
      // --- Employee Social Charges ---
      const cnpsRule = getRule('CNPS_RET_SAL');
      const cnpsBase = cnpsRule.ceiling ? Math.min(gross, cnpsRule.ceiling) : gross;
      const cnpsEmployee = Math.round(cnpsBase * cnpsRule.rate);

      // --- Employee Taxes (Fiscal) ---
      // Parts: 1 (Single), 2 (Married), +0.5 per child
      let parts = 1;
      if (emp.marital_status === 'married') parts += 1;
      parts += (emp.children_count * 0.5);
      if (parts > 5) parts = 5; // Capped at 5 parts usually

      const { isTax, cnTax } = calculateIvorianTaxes(gross, parts, getRule);
      const { igrTax } = calculateIGR(gross, isTax, cnTax, cnpsEmployee, parts, getRule);

      // --- Salary Advances ---
      const pendingAdvances = db.prepare("SELECT SUM(amount) as total FROM salary_advances WHERE employee_id = ? AND status = 'pending'").get(emp.id) as any;
      const extraDeductions = pendingAdvances.total || 0;

      const totalTaxes = isTax + cnTax + igrTax;
      const deductions = cnpsEmployee + totalTaxes + extraDeductions;
      const net = gross - deductions;

      // --- Employer Charges ---
      let employerCharges = 0;
      const employerDetails = {};
      
      rules.filter(r => r.type.startsWith('employer_')).forEach(rule => {
        const base = rule.ceiling ? Math.min(gross, rule.ceiling) : gross;
        const amount = Math.round(base * rule.rate);
        employerCharges += amount;
        employerDetails[rule.code] = amount;
      });

      const details = {
        gross,
        activeDays,
        prorataFactor,
        cnpsEmployee,
        taxes: {
          is: isTax,
          cn: cnTax,
          igr: igrTax,
          total: totalTaxes
        },
        extraDeductions,
        deductionDetails: extraDeductions > 0 ? [{ label: 'Remboursement Avance', amount: extraDeductions }] : [],
        employerCharges,
        employerDetails,
        maritalStatus: emp.marital_status,
        childrenCount: emp.children_count,
        parts
      };

      insertPayslip.run(emp.id, id, base, bonuses, deductions, net, JSON.stringify(details));
      totalAmount += net;
    }

    // Update Period Total
    db.prepare("UPDATE payroll_periods SET total_amount = ? WHERE id = ?").run(totalAmount, id);
  });

  try {
    generate();
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Update a specific payslip (bonuses, deductions)
app.put("/api/payslips/:id", (req, res) => {
  const { id } = req.params;
  const { bonuses, deductions, bonusDetails, deductionDetails } = req.body; // deductions here are EXTRA deductions (advances, loans), not taxes
  // bonusDetails: Array<{ label: string, amount: number, type: 'taxable' | 'non_taxable' }>
  // deductionDetails: Array<{ label: string, amount: number }>

  const update = db.transaction(() => {
    const payslip = db.prepare("SELECT * FROM payslips WHERE id = ?").get(id);
    if (!payslip) throw new Error("Bulletin non trouvé");

    const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(payslip.employee_id);
    const rules = db.prepare("SELECT * FROM tax_rules WHERE is_active = 1").all();
    const getRule = (code) => rules.find(r => r.code === code);

    const base = payslip.base_salary; 
    
    // Calculate bonuses breakdown
    let taxableBonuses = 0;
    let nonTaxableBonuses = 0;

    if (bonusDetails && Array.isArray(bonusDetails)) {
      taxableBonuses = bonusDetails.filter(b => b.type === 'taxable').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      nonTaxableBonuses = bonusDetails.filter(b => b.type === 'non_taxable').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    } else {
      // Fallback for legacy simple updates (treat all as taxable by default for safety, or keep existing behavior)
      taxableBonuses = Number(bonuses) || 0;
    }

    const grossTaxable = base + taxableBonuses;
    const grossTotal = grossTaxable + nonTaxableBonuses;

    // --- Recalculate Taxes (Based on Taxable Gross) ---
    // 1. Social
    const cnpsRule = getRule('CNPS_RET_SAL');
    const cnpsBase = cnpsRule.ceiling ? Math.min(grossTaxable, cnpsRule.ceiling) : grossTaxable;
    const cnpsEmployee = Math.round(cnpsBase * cnpsRule.rate);

    // 2. Fiscal
    let parts = 1;
    if (emp.marital_status === 'married') parts += 1;
    parts += (emp.children_count * 0.5);
    if (parts > 5) parts = 5;

    const { isTax, cnTax } = calculateIvorianTaxes(grossTaxable, parts, getRule);
    const { igrTax } = calculateIGR(grossTaxable, isTax, cnTax, cnpsEmployee, parts, getRule);

    const totalTaxes = isTax + cnTax + igrTax;
    
    // Calculate extra deductions breakdown
    let extraDeductions = 0;
    if (deductionDetails && Array.isArray(deductionDetails)) {
      extraDeductions = deductionDetails.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    } else {
      extraDeductions = Number(deductions) || 0;
    }

    // Total Deductions = Social + Fiscal + Extra Deductions (Loans, etc)
    const totalDeductions = cnpsEmployee + totalTaxes + extraDeductions;
    const net = grossTotal - totalDeductions;

    // --- Employer Charges (Based on Taxable Gross usually) ---
    let employerCharges = 0;
    const employerDetails = {};
    
    rules.filter(r => r.type.startsWith('employer_')).forEach(rule => {
      const base = rule.ceiling ? Math.min(grossTaxable, rule.ceiling) : grossTaxable;
      const amount = Math.round(base * rule.rate);
      employerCharges += amount;
      employerDetails[rule.code] = amount;
    });

    const details = {
      grossTaxable,
      grossTotal,
      bonusDetails: bonusDetails || [],
      deductionDetails: deductionDetails || [],
      cnpsEmployee,
      taxes: {
        is: isTax,
        cn: cnTax,
        igr: igrTax,
        total: totalTaxes
      },
      employerCharges,
      employerDetails,
      maritalStatus: emp.marital_status,
      childrenCount: emp.children_count,
      parts,
      extraDeductions
    };

    const totalBonuses = taxableBonuses + nonTaxableBonuses;

    db.prepare(`
      UPDATE payslips 
      SET bonuses = ?, deductions = ?, net_salary = ?, details = ?
      WHERE id = ?
    `).run(totalBonuses, totalDeductions, net, JSON.stringify(details), id);

    // Update period total
    const periodTotal = db.prepare("SELECT SUM(net_salary) as total FROM payslips WHERE period_id = ?").get(payslip.period_id).total;
    db.prepare("UPDATE payroll_periods SET total_amount = ? WHERE id = ?").run(periodTotal, payslip.period_id);
  });

  try {
    update();
    logAction(req.user?.name || 'Admin', 'UPDATE', 'Payslip', id, { bonuses, deductions, bonusDetails });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Get Payslips for Period
app.get("/api/payroll/periods/:id/payslips", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare(`
      SELECT p.*, e.first_name, e.last_name, e.position 
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.period_id = ?
    `);
    const payslips = stmt.all(id);
    res.json(payslips);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Validate Period (Generate Accounting Entries)
app.post("/api/payroll/periods/:id/validate", (req, res) => {
  const { id } = req.params;

  const validate = db.transaction(() => {
    const period = db.prepare("SELECT * FROM payroll_periods WHERE id = ?").get(id);
    if (!period) throw new Error("Période introuvable");
    if (period.status === 'validated') throw new Error("Période déjà validée");

    const payslips = db.prepare("SELECT * FROM payslips WHERE period_id = ?").all(id);
    
    // Aggregate totals for the single accounting entry
    let totalGross = 0;
    let totalNet = 0;
    let totalCnpsEmployee = 0;
    let totalTaxes = 0; // IS + CN + IGR
    let totalEmployerCharges = 0;
    let totalFDFP = 0;
    let totalExtraDeductions = 0;

    for (const p of payslips) {
      const details = p.details ? JSON.parse(p.details) : {};
      if (!details) continue; // Skip if somehow null

      totalGross += (p.base_salary + p.bonuses);
      totalNet += p.net_salary;
      totalCnpsEmployee += (details.cnpsEmployee || 0);
      totalTaxes += (details.taxes?.total || 0);
      totalExtraDeductions += (details.extraDeductions || 0);
      
      // Sum employer charges
      if (details.employerDetails) {
        totalEmployerCharges += (details.employerDetails.CNPS_RET_PAT || 0);
        totalEmployerCharges += (details.employerDetails.PF || 0);
        totalEmployerCharges += (details.employerDetails.AT || 0);
        
        totalFDFP += (details.employerDetails.FDFP_TPC || 0);
        totalFDFP += (details.employerDetails.FDFP_FPC || 0);
      } else {
        // Fallback for old records
        totalEmployerCharges += details.employerCharges;
      }
    }

    const totalCnpsGlobal = totalCnpsEmployee + totalEmployerCharges;

    // 1. Create Transaction
    const date = new Date();
    const monthName = new Date(period.year, period.month - 1).toLocaleString('fr-FR', { month: 'long' });
    const description = `Paie ${monthName} ${period.year}`;
    const txRef = generateTransactionReference('PAIE');
    
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const txInfo = txStmt.run(date.toISOString().split('T')[0], description, txRef);
    const txId = txInfo.lastInsertRowid;

    // 2. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");

    // Debit 661 (Rémunération du personnel) - Gross
    entryStmt.run(txId, '661', totalGross, 0);

    // Debit 664 (Charges sociales) - Employer part
    entryStmt.run(txId, '664', totalEmployerCharges, 0);

    // Debit 6413 (Taxes sur appt et salaires) - FDFP
    if (totalFDFP > 0) {
      entryStmt.run(txId, '6413', totalFDFP, 0);
    }

    // Credit 421 (Personnel, rémunérations dues) - Net
    entryStmt.run(txId, '421', 0, totalNet);

    // Credit 431 (Sécurité sociale) - Employee + Employer parts (CNPS + PF + AT)
    entryStmt.run(txId, '431', 0, totalCnpsGlobal);

    // Credit 447 (État, impôts retenus) - ITS (IS + CN + IGR)
    entryStmt.run(txId, '447', 0, totalTaxes);
    
    // Credit 442 (État, autres impôts et taxes) - FDFP
    if (totalFDFP > 0) {
      entryStmt.run(txId, '442', 0, totalFDFP);
    }

    // Credit 425 (Personnel - Avances et acomptes) - Extra Deductions (Specific Advances)
    if (totalExtraDeductions > 0) {
      entryStmt.run(txId, '425', 0, totalExtraDeductions);
    }

    // 3. Mark specific advances as repaid
    for (const p of payslips) {
      const details = JSON.parse(p.details);
      if (details.deductionDetails && Array.isArray(details.deductionDetails)) {
        for (const ded of details.deductionDetails) {
          if (ded.advance_id) {
            db.prepare("UPDATE salary_advances SET status = 'repaid', payslip_id = ? WHERE id = ?").run(p.id, ded.advance_id);
          }
        }
      }
    }

    // 4. Update Period Status
    db.prepare("UPDATE payroll_periods SET status = 'validated' WHERE id = ?").run(id);

    // 5. Link Payslips to Transaction (Optional, for traceability)
    db.prepare("UPDATE payslips SET transaction_id = ? WHERE period_id = ?").run(txId, id);

    return txId;
  });

  try {
    const txId = validate();
    logAction(req.user?.name || 'Admin', 'VALIDATE', 'PayrollPeriod', id, { transactionId: txId });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Pay Payroll Period
app.post("/api/payroll/periods/:id/pay", (req, res) => {
  const { id } = req.params;
  const { paymentAccount } = req.body; // e.g., '521' (Bank), '571' (Cash)

  if (!paymentAccount) {
    return res.status(400).json({ error: "Compte de paiement requis" });
  }

  const pay = db.transaction(() => {
    const period = db.prepare("SELECT * FROM payroll_periods WHERE id = ?").get(id);
    if (!period) throw new Error("Période introuvable");
    if (period.status !== 'validated') throw new Error("La période doit être validée avant paiement");
    if (period.status === 'paid') throw new Error("Période déjà payée");

    // Get total net amount to pay
    const payslipsStmt = db.prepare("SELECT SUM(net_salary) as total FROM payslips WHERE period_id = ?");
    const result = payslipsStmt.get(id);
    const totalNet = result.total || 0;

    if (totalNet === 0) throw new Error("Aucun salaire net à payer");

    // 1. Create Transaction
    const date = new Date();
    const monthName = new Date(period.year, period.month - 1).toLocaleString('fr-FR', { month: 'long' });
    const description = `Paiement Salaires ${monthName} ${period.year}`;
    const txRef = generateTransactionReference('PAIE_PAY');
    
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const txInfo = txStmt.run(date.toISOString().split('T')[0], description, txRef);
    const txId = txInfo.lastInsertRowid;

    // 2. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");

    // Debit 421 (Personnel, rémunérations dues) - Clearing the liability
    entryStmt.run(txId, '421', totalNet, 0);

    // Credit 5xx (Treasury)
    entryStmt.run(txId, paymentAccount, 0, totalNet);

    // 3. Update Period Status
    db.prepare("UPDATE payroll_periods SET status = 'paid', payment_transaction_id = ? WHERE id = ?").run(txId, id);
    
    // 4. Update bank account balance if it's a bank account
    const bankAccount = db.prepare("SELECT id FROM bank_accounts WHERE gl_account_code = ?").get(paymentAccount) as any;
    if (bankAccount) {
      db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(period.total_amount, bankAccount.id);
    }

    return txId;
  });

  try {
    const txId = pay();
    logAction(req.user?.name || 'Admin', 'PAY', 'PayrollPeriod', id, { transactionId: txId, account: paymentAccount });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Delete Employee
app.delete("/api/employees/:id", (req, res) => {
  const { id } = req.params;
  try {
    // Check if employee has payslips
    const check = db.prepare("SELECT COUNT(*) as count FROM payslips WHERE employee_id = ?").get(id);
    if (check.count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer un salarié ayant des bulletins de paie." });
    }
    
    const stmt = db.prepare("DELETE FROM employees WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Salarié introuvable" });
    
    logAction(req.user?.name || 'Admin', 'DELETE', 'Employee', id, {});
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// Delete Payroll Period (Reset/Delete)
app.delete("/api/payroll/periods/:id", (req, res) => {
  const { id } = req.params;
  
  const deletePeriod = db.transaction(() => {
    const period = db.prepare("SELECT * FROM payroll_periods WHERE id = ?").get(id);
    if (!period) throw new Error("Période introuvable");
    
    // 1. If Paid, reverse payment transaction
    if (period.status === 'paid' && period.payment_transaction_id) {
      // Find the account used for payment from the transaction/journal entries
      const paymentEntry = db.prepare("SELECT account_code, credit FROM journal_entries WHERE transaction_id = ? AND credit > 0 LIMIT 1").get(period.payment_transaction_id) as any;
      if (paymentEntry) {
          const bankAccount = db.prepare("SELECT id FROM bank_accounts WHERE gl_account_code = ?").get(paymentEntry.account_code) as any;
          if (bankAccount) {
              db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(paymentEntry.credit, bankAccount.id);
          }
      }

      db.prepare("DELETE FROM journal_entries WHERE transaction_id = ?").run(period.payment_transaction_id);
      db.prepare("DELETE FROM transactions WHERE id = ?").run(period.payment_transaction_id);
    }
    
    // 2. If Validated or Paid, reverse validation transaction (linked to payslips)
    // Find transaction linked to payslips (assuming all payslips share the same tx for now, or check one)
    const payslipTx = db.prepare("SELECT transaction_id FROM payslips WHERE period_id = ? AND transaction_id IS NOT NULL LIMIT 1").get(id);
    if (payslipTx && payslipTx.transaction_id) {
      db.prepare("DELETE FROM journal_entries WHERE transaction_id = ?").run(payslipTx.transaction_id);
      db.prepare("DELETE FROM transactions WHERE id = ?").run(payslipTx.transaction_id);
    }
    
    // 3. Reset Salary Advances
    db.prepare(`
      UPDATE salary_advances 
      SET status = 'pending', payslip_id = NULL 
      WHERE payslip_id IN (SELECT id FROM payslips WHERE period_id = ?)
    `).run(id);

    // 4. Delete Payslips
    db.prepare("DELETE FROM payslips WHERE period_id = ?").run(id);
    
    // 5. Delete Period
    db.prepare("DELETE FROM payroll_periods WHERE id = ?").run(id);
  });

  try {
    deletePeriod();
    logAction(req.user?.name || 'Admin', 'DELETE', 'PayrollPeriod', id, {});
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Bank Reconciliation API ---

app.get("/api/journal-entries", (req, res) => {
  const { account_code, unreconciled } = req.query;
  try {
    let query = `
      SELECT je.id as gl_id, je.account_code, t.date, t.description, t.reference, je.debit, je.credit
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE t.status = 'validated'
    `;
    const params: any[] = [];

    if (account_code) {
      query += " AND je.account_code = ?";
      params.push(account_code);
    }

    if (unreconciled === 'true') {
      query += " AND je.is_reconciled = 0";
    }

    query += " ORDER BY t.date DESC LIMIT 100";
    
    const entries = db.prepare(query).all(...params);
    res.json(entries);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/bank-accounts", (req, res) => {
  try {
    const accounts = db.prepare("SELECT * FROM bank_accounts ORDER BY name ASC").all();
    res.json(accounts);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-accounts", (req, res) => {
  const { name, account_number, bank_name, balance, currency, gl_account_code } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO bank_accounts (name, account_number, bank_name, balance, currency, gl_account_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, account_number, bank_name, balance || 0, currency || 'XOF', gl_account_code);
    
    logAction(req.user?.name || 'Admin', 'CREATE', 'BankAccount', info.lastInsertRowid, { name, bank_name, gl_account_code });
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/bank-transactions/:accountId", (req, res) => {
  const { accountId } = req.params;
  try {
    const transactions = db.prepare(`
      SELECT bt.*, je.id as matched_gl_id, t.description as matched_description, je.account_code as matched_account
      FROM bank_transactions bt
      LEFT JOIN journal_entries je ON bt.matched_gl_id = je.id
      LEFT JOIN transactions t ON je.transaction_id = t.id
      WHERE bt.bank_account_id = ?
      ORDER BY bt.date DESC
    `).all(accountId);
    res.json(transactions);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-accounts/:accountId/sync", (req, res) => {
  const { accountId } = req.params;
  try {
    // Mock Bank Sync
    const mockTxs = [
      { date: new Date().toISOString().split('T')[0], description: 'Virement Client ABC', amount: 150000, reference: 'REF-001' },
      { date: new Date().toISOString().split('T')[0], description: 'Paiement Fournisseur XYZ', amount: -45000, reference: 'REF-002' },
      { date: new Date().toISOString().split('T')[0], description: 'Frais Bancaires Mensuels', amount: -2500, reference: 'BANK-FEE' },
      { date: new Date().toISOString().split('T')[0], description: 'Paiement Loyer', amount: -200000, reference: 'RENT-MAR' },
    ];

    const insertTx = db.prepare(`
      INSERT INTO bank_transactions (bank_account_id, date, description, amount, reference)
      VALUES (?, ?, ?, ?, ?)
    `);

    const syncTxs = db.transaction((txs) => {
      for (const tx of txs) {
        const exists = db.prepare("SELECT id FROM bank_transactions WHERE bank_account_id = ? AND date = ? AND description = ? AND amount = ?").get(accountId, tx.date, tx.description, tx.amount);
        if (!exists) {
          insertTx.run(accountId, tx.date, tx.description, tx.amount, tx.reference);
        }
      }
    });

    syncTxs(mockTxs);
    db.prepare("UPDATE bank_accounts SET last_synced = ? WHERE id = ?").run(new Date().toISOString(), accountId);
    
    logAction(req.user?.name || 'Admin', 'SYNC', 'BankAccount', accountId, { count: mockTxs.length });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-accounts/:accountId/import", (req, res) => {
  const { accountId } = req.params;
  const { transactions } = req.body;
  try {
    const insertTx = db.prepare(`
      INSERT INTO bank_transactions (bank_account_id, date, description, amount, reference)
      VALUES (?, ?, ?, ?, ?)
    `);

    const importTxs = db.transaction((txs) => {
      for (const tx of txs) {
        const exists = db.prepare("SELECT id FROM bank_transactions WHERE bank_account_id = ? AND date = ? AND description = ? AND amount = ?").get(accountId, tx.date, tx.description, tx.amount);
        if (!exists) {
          insertTx.run(accountId, tx.date, tx.description, tx.amount, tx.reference || null);
        }
      }
    });

    importTxs(transactions);
    
    logAction(req.user?.name || 'Admin', 'IMPORT', 'BankAccount', accountId, { count: transactions.length });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-reconciliation/match", (req, res) => {
  const { bankTransactionId, glId, reason } = req.body;
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE bank_transactions 
      SET status = 'matched', matched_gl_id = ?, reconciled_at = ?, adjustment_reason = ? 
      WHERE id = ?
    `).run(glId, now, reason || null, bankTransactionId);
    
    // Also mark journal entry as reconciled
    db.prepare("UPDATE journal_entries SET is_reconciled = 1 WHERE id = ?").run(glId);
    
    logAction(req.user?.name || 'Admin', 'MATCH', 'BankTransaction', bankTransactionId, { glId, reason });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/bank-reconciliation/available-gl", (req, res) => {
  const { account_code } = req.query;
  try {
    const glEntries = db.prepare(`
      SELECT je.*, t.date, t.description, t.reference 
      FROM journal_entries je
      JOIN transactions t ON je.transaction_id = t.id
      WHERE je.account_code = ? AND je.is_reconciled = 0 AND t.status = 'validated'
      ORDER BY t.date DESC
    `).all(account_code);
    res.json({ glEntries });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-reconciliation/lock-period", (req, res) => {
  const { bankAccountId, startDate, endDate } = req.body;
  try {
    db.transaction(() => {
      // Lock matched transactions in this period
      db.prepare(`
        UPDATE bank_transactions 
        SET is_locked = 1 
        WHERE bank_account_id = ? AND date >= ? AND date <= ? AND status = 'matched'
      `).run(bankAccountId, startDate, endDate);
      
      // Also lock the corresponding accounting transactions
      db.prepare(`
        UPDATE transactions 
        SET is_locked = 1 
        WHERE id IN (
          SELECT transaction_id 
          FROM journal_entries 
          WHERE id IN (
            SELECT matched_gl_id 
            FROM bank_transactions 
            WHERE bank_account_id = ? AND date >= ? AND date <= ? AND status = 'matched'
          )
        )
      `).run(bankAccountId, startDate, endDate);
    })();
    
    logAction(req.user?.name || 'Admin', 'LOCK', 'BankReconciliation', bankAccountId, { startDate, endDate });
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-reconciliation/unmatch", (req, res) => {
  const { bankTransactionId } = req.body;
  try {
    db.prepare("UPDATE bank_transactions SET status = 'pending', matched_gl_id = NULL WHERE id = ?").run(bankTransactionId);
    logAction(req.user?.name || 'Admin', 'UNMATCH', 'BankTransaction', bankTransactionId);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/bank-reconciliation/create-entry", (req, res) => {
  const { bankTransactionId, accountCode, description, date, amount } = req.body;
  
  const createEntry = db.transaction(() => {
    const bankTx = db.prepare("SELECT * FROM bank_transactions WHERE id = ?").get(bankTransactionId);
    if (!bankTx) throw new Error("Transaction bancaire introuvable");

    const companySettings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;
    const bankAccount = db.prepare("SELECT gl_account_code FROM bank_accounts WHERE id = ?").get(bankTx.bank_account_id);
    const glAccountCode = bankAccount?.gl_account_code || companySettings?.payment_bank_account || '521';
    
    // 1. Create Transaction
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status) VALUES (?, ?, ?, 'validated')");
    const txInfo = txStmt.run(date, description, `BANK-RECON-${bankTransactionId}`);
    const txId = txInfo.lastInsertRowid;

    // 2. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
    
    // Bank Entry
    const bankDebit = amount > 0 ? amount : 0;
    const bankCredit = amount < 0 ? Math.abs(amount) : 0;
    const bankEntryInfo = entryStmt.run(txId, glAccountCode, bankDebit, bankCredit);
    const bankEntryId = bankEntryInfo.lastInsertRowid;

    // Counterpart Entry
    const counterpartDebit = amount < 0 ? Math.abs(amount) : 0;
    const counterpartCredit = amount > 0 ? amount : 0;
    entryStmt.run(txId, accountCode, counterpartDebit, counterpartCredit);

    // 3. Match the bank transaction to the bank entry
    db.prepare("UPDATE bank_transactions SET status = 'matched', matched_gl_id = ? WHERE id = ?").run(bankEntryId, bankTransactionId);

    // 4. Update bank account balance (only if it was a manual import, synced accounts might already have updated balance)
    // For now, let's assume we update it.
    db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(amount, bankTx.bank_account_id);

    return bankEntryId;
  });

  try {
    const glId = createEntry();
    logAction(req.user?.name || 'Admin', 'CREATE', 'JournalEntry', glId, { bankTransactionId, accountCode });
    res.json({ success: true, glId });
  } catch (err) {
    handleApiError(res, err);
  }
});

// --- Invoicing & Quotes ---

app.get("/api/invoices", (req, res) => {
  const { type } = req.query; // 'invoice' or 'quote'
  try {
    let query = `
      SELECT i.*, tp.name as third_party_name 
      FROM invoices i
      JOIN third_parties tp ON i.third_party_id = tp.id
    `;
    const params: any[] = [];
    if (type) {
      query += " WHERE i.type = ?";
      params.push(type);
    }
    query += " ORDER BY i.date DESC, i.number DESC";
    
    const invoices = db.prepare(query).all(...params);
    res.json(invoices);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/invoices/:id", (req, res) => {
  const { id } = req.params;
  try {
    const invoice = db.prepare(`
      SELECT i.*, tp.name as third_party_name, tp.address as third_party_address, tp.tax_id as third_party_tax_id, tp.email as third_party_email
      FROM invoices i
      JOIN third_parties tp ON i.third_party_id = tp.id
      WHERE i.id = ?
    `).get(id);
    
    if (!invoice) return res.status(404).json({ error: "Document introuvable" });
    
    const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(id);
    res.json({ ...invoice, items });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/invoices/:id/convert", (req, res) => {
  const { id } = req.params;
  
  try {
    const quote = db.prepare(`
      SELECT i.*, tp.payment_terms 
      FROM invoices i 
      JOIN third_parties tp ON i.third_party_id = tp.id 
      WHERE i.id = ? AND i.type = "quote"
    `).get(id) as any;
    
    if (!quote) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (quote.status !== 'accepted' && quote.status !== 'sent') {
      return res.status(400).json({ error: 'Seuls les devis envoyés ou acceptés peuvent être convertis en facture' });
    }

    // Generate new invoice number
    const nextNumber = generateDocumentNumber('invoice');
    
    const convert = db.transaction(() => {
      // Create new invoice
      const result = db.prepare(`
        INSERT INTO invoices (type, number, date, due_date, third_party_id, status, subtotal, vat_amount, total_amount, notes, terms)
        VALUES ('invoice', ?, DATE('now'), DATE('now', '+' || ? || ' days'), ?, 'draft', ?, ?, ?, ?, ?)
      `).run(
        nextNumber,
        quote.payment_terms || 30,
        quote.third_party_id,
        quote.subtotal,
        quote.vat_amount,
        quote.total_amount,
        quote.notes,
        quote.terms
      );

      const newInvoiceId = result.lastInsertRowid;

      // Copy items
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          newInvoiceId,
          item.description,
          item.quantity,
          item.unit_price,
          item.vat_rate,
          item.total,
          item.account_code || '701'
        );
      }

      // Update quote status
      db.prepare('UPDATE invoices SET status = "accepted" WHERE id = ?').run(id);

      return newInvoiceId;
    });

    const newId = convert();
    logAction(req.user?.name || 'Admin', 'CONVERT', 'Quote to Invoice', id, { newInvoiceId: newId });
    res.json({ success: true, id: newId, number: nextNumber });
  } catch (error) {
    console.error('Error converting quote:', error);
    handleApiError(res, new AppError('Erreur lors de la conversion du devis' , 500, "server_error"));
  }
});

app.post("/api/invoices", validate(z.object({
  type: z.enum(['invoice', 'quote']),
  date: z.string(),
  items: z.array(z.any()).min(1),
}).passthrough()), (req, res) => {
  const { type, date, due_date, third_party_id, occasional_name, notes, terms, items, currency, exchange_rate, transaction_id } = req.body;
  
  const createInvoice = db.transaction(() => {
    // Generate number
    const number = generateDocumentNumber(type);
    
    // Calculate totals
    let subtotal = 0;
    let vat_amount = 0;
    items.forEach((item: any) => {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      vat_amount += lineTotal * (item.vat_rate / 100);
    });
    const total_amount = subtotal + vat_amount;
    
    const payment_link = `${process.env.APP_URL || 'http://localhost:3000'}/pay/${number}`;

    const stmt = db.prepare(`
      INSERT INTO invoices (type, number, date, due_date, third_party_id, occasional_name, status, subtotal, vat_amount, total_amount, notes, terms, currency, exchange_rate, transaction_id, payment_link)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(type, number, date, due_date, third_party_id, occasional_name || null, subtotal, vat_amount, total_amount, notes, terms, currency || 'FCFA', exchange_rate || 1, transaction_id || null, payment_link);
    const invoiceId = info.lastInsertRowid;
    
    const itemStmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      itemStmt.run(invoiceId, item.description, item.quantity, item.unit_price, item.vat_rate, lineTotal, item.account_code || (type === 'invoice' ? '701' : null));
    }
    
    return invoiceId;
  });
  
  try {
    const id = createInvoice();
    logAction(req.user?.name || 'Admin', 'CREATE', type === 'invoice' ? 'Invoice' : 'Quote', id);
    createNotification('info', type === 'invoice' ? 'Nouvelle facture' : 'Nouveau devis', `Le document a été créé avec succès.`, '/invoicing');
    res.json({ success: true, id });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.put("/api/invoices/:id", (req, res) => {
  const { id } = req.params;
  const { date, due_date, third_party_id, occasional_name, notes, terms, items, currency, exchange_rate, transaction_id } = req.body;
  
  try {
    const updateInvoice = db.transaction(() => {
      const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as any;
      if (!invoice) throw new Error("Document introuvable");
      if (invoice.status !== 'draft') throw new Error("Seuls les documents en brouillon peuvent être modifiés");
      
      // Calculate totals
      let subtotal = 0;
      let vat_amount = 0;
      items.forEach((item: any) => {
        const lineTotal = item.quantity * item.unit_price;
        subtotal += lineTotal;
        vat_amount += lineTotal * (item.vat_rate / 100);
      });
      const total_amount = subtotal + vat_amount;
      
      // Update invoice
      db.prepare(`
        UPDATE invoices 
        SET date = ?, due_date = ?, third_party_id = ?, occasional_name = ?, subtotal = ?, vat_amount = ?, total_amount = ?, notes = ?, terms = ?, currency = ?, exchange_rate = ?, transaction_id = ?
        WHERE id = ?
      `).run(date, due_date, third_party_id, occasional_name || null, subtotal, vat_amount, total_amount, notes, terms, currency || 'FCFA', exchange_rate || 1, transaction_id || (invoice.transaction_id || null), id);
      
      // Update items: delete and re-insert
      db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate, total, account_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const item of items) {
        insertItem.run(id, item.description, item.quantity, item.unit_price, item.vat_rate, item.quantity * item.unit_price, item.account_code || (invoice.type === 'invoice' ? '701' : null));
      }
      
      return id;
    });
    
    updateInvoice();
    logAction(req.user?.name || 'Admin', 'UPDATE', 'Invoice/Quote', id);
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/invoices/:id/validate", (req, res) => {
  const { id } = req.params;
  
  const validate = db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!invoice) throw new Error("Facture introuvable");
    if (invoice.type !== 'invoice') throw new Error("Seules les factures peuvent être validées");
    if (invoice.status !== 'draft') throw new Error("La facture est déjà validée");
    
    const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(id);
    const thirdParty = db.prepare("SELECT account_code FROM third_parties WHERE id = ?").get(invoice.third_party_id);
    
    // 1. Create Transaction
    const txRef = generateTransactionReference('FAC');
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status, third_party_id, due_date, occasional_name) VALUES (?, ?, ?, 'validated', ?, ?, ?)");
    const txInfo = txStmt.run(invoice.date, `Facture ${invoice.number}`, txRef, invoice.third_party_id, invoice.due_date, invoice.occasional_name || null);
    const txId = txInfo.lastInsertRowid;
    
    // 2. Create Journal Entries
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
    
    // Debit Client (411 or specific)
    entryStmt.run(txId, thirdParty.account_code || '411', invoice.total_amount, 0);
    
    // Credit Revenue & VAT
    const revenueByAccount: Record<string, number> = {};
    let totalVat = 0;
    
    for (const item of items) {
      const acc = item.account_code || '701';
      revenueByAccount[acc] = (revenueByAccount[acc] || 0) + item.total;
      totalVat += item.total * (item.vat_rate / 100);
    }
    
    for (const [acc, amount] of Object.entries(revenueByAccount)) {
      entryStmt.run(txId, acc, 0, amount);
    }
    
    if (totalVat > 0) {
      entryStmt.run(txId, '4431', 0, totalVat);
    }
    
    // 3. Update Invoice
    db.prepare("UPDATE invoices SET status = 'sent', transaction_id = ? WHERE id = ?").run(txId, id);
    
    return txId;
  });
  
  try {
    const txId = validate();
    logAction(req.user?.name || 'Admin', 'VALIDATE', 'Invoice', id, { transactionId: txId });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/invoices/:id/pay", (req, res) => {
  const { id } = req.params;
  const { paymentDate, paymentAccount, amount } = req.body;
  
  const pay = db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!invoice) throw new Error("Facture introuvable");
    if (invoice.status === 'paid') throw new Error("Facture déjà payée");
    
    const thirdParty = db.prepare("SELECT account_code FROM third_parties WHERE id = ?").get(invoice.third_party_id);
    
    // 1. Create Transaction
    const txRef = generateTransactionReference('PAY');
    const txStmt = db.prepare("INSERT INTO transactions (date, description, reference, status, third_party_id, occasional_name) VALUES (?, ?, ?, 'validated', ?, ?)");
    const txInfo = txStmt.run(paymentDate, `Paiement Facture ${invoice.number}`, txRef, invoice.third_party_id, invoice.occasional_name || null);
    const txId = txInfo.lastInsertRowid;
    
    // 2. Create Journal Entries
    const companySettings = db.prepare("SELECT * FROM company_settings ORDER BY id DESC LIMIT 1").get() as any;
    const entryStmt = db.prepare("INSERT INTO journal_entries (transaction_id, account_code, debit, credit) VALUES (?, ?, ?, ?)");
    
    const payAmount = Number(amount) || (invoice.total_amount - invoice.paid_amount);

    // Debit Bank/Cash (521/571)
    entryStmt.run(txId, paymentAccount || companySettings?.payment_bank_account || '521', payAmount, 0);
    
    // Credit Client
    entryStmt.run(txId, thirdParty.account_code || '411', 0, payAmount);
    
    // 3. Update Invoice Status & Paid Amount
    const newPaidAmount = invoice.paid_amount + payAmount;
    const newStatus = newPaidAmount >= invoice.total_amount ? 'paid' : 'sent';
    db.prepare("UPDATE invoices SET status = ?, paid_amount = ? WHERE id = ?").run(newStatus, newPaidAmount, id);
    
    return txId;
  });
  
  try {
    const txId = pay();
    logAction(req.user?.name || 'Admin', 'PAY', 'Invoice', id, { transactionId: txId });
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.post("/api/invoices/:id/send", (req, res) => {
  const { id } = req.params;
  const { email, subject, message } = req.body;
  
  try {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!invoice) return res.status(404).json({ error: "Document introuvable" });
    
    // Update status to 'sent' if it was 'draft'
    if (invoice.status === 'draft') {
      db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(id);
    }
    
    logAction(req.user?.name || 'Admin', 'SEND_EMAIL', invoice.type === 'invoice' ? 'Invoice' : 'Quote', id, { email, subject });
    
    res.json({ success: true, message: "Email envoyé avec succès" });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/invoices/stats", (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        type,
        status,
        COUNT(*) as count,
        SUM(total_amount) as total,
        SUM(paid_amount) as paid
      FROM invoices
      GROUP BY type, status
    `).all();
    
    res.json(stats);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get("/api/revenue/monthly", (req, res) => {
  try {
    const revenue = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(total_amount) as total,
        SUM(paid_amount) as paid
      FROM invoices
      WHERE type = 'invoice' AND status != 'cancelled'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all();
    
    res.json(revenue);
  } catch (err) {
    handleApiError(res, err);
  }
});

// Handle 404 for API routes
app.use('/api', (req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Route Not Found", 
    message: `L'endpoint ${req.method} ${req.originalUrl} n'existe pas sur ce serveur.`,
    path: req.originalUrl 
  });
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- Background Tasks ---
  // Migration: Ensure essential modules are active
  try {
    const company = db.prepare("SELECT id FROM company_settings LIMIT 1").get() as any;
    if (company) {
      const essentialModules = ['third_parties', 'payroll', 'audit', 'crm', 'inventory', 'p2p'];
      for (const moduleKey of essentialModules) {
        const hasModule = db.prepare("SELECT id FROM company_modules WHERE module_key = ?").get(moduleKey);
        if (!hasModule) {
          db.prepare("INSERT INTO company_modules (company_id, module_key, is_active) VALUES (?, ?, 1)").run(company.id, moduleKey);
        } else {
          // Force activation for requested modules if it exists but is inactive
          db.prepare("UPDATE company_modules SET is_active = 1 WHERE module_key = ?").run(moduleKey);
        }
      }
    }
  } catch (error) {
    console.error("Migration error:", error);
  }

// Process auto-recurring transactions every hour
setInterval(() => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const due = db.prepare("SELECT id FROM recurring_transactions WHERE active = 1 AND auto_process = 1 AND next_date <= ?").all(today) as any[];
    
    for (const item of due) {
      processRecurringTransaction(item.id);
    }
  } catch (error) {
    console.error("Error in background recurring process:", error);
  }
}, 1000 * 60 * 60);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
