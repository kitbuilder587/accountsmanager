import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_EXPIRY = '7d';

/**
 * Resolve JWT_SECRET: use env var if set, otherwise persist a generated
 * secret to disk so tokens survive server restarts.
 */
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Try to read/write a persistent secret in the app data directory
  const dataRoot = process.env.ACCOUNTS_MANAGER_APP_DATA_ROOT?.trim() || '.accountsmanager-dev';
  const secretPath = path.join(dataRoot, '.jwt-secret');

  try {
    if (fs.existsSync(secretPath)) {
      const saved = fs.readFileSync(secretPath, 'utf8').trim();
      if (saved.length >= 32) return saved;
    }
  } catch { /* fall through */ }

  const generated = crypto.randomBytes(32).toString('hex');

  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    console.log('[Auth] Generated and persisted JWT secret');
  } catch {
    console.warn('[Auth] WARNING: Could not persist JWT secret — tokens will be lost on restart');
  }

  return generated;
}

const JWT_SECRET = resolveJwtSecret();

if (!ADMIN_PASSWORD) {
  console.warn('[Auth] WARNING: ADMIN_PASSWORD not set! Set it in .env (20+ chars)');
}
if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 20) {
  console.warn(`[Auth] WARNING: ADMIN_PASSWORD is only ${ADMIN_PASSWORD.length} chars. Use 20+ for security.`);
}

// Hash password at startup for comparison
let passwordHash: string | null = null;
if (ADMIN_PASSWORD) {
  passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
}

// Auth routes (not protected)
const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password required' });
    return;
  }

  if (!passwordHash) {
    res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
    return;
  }

  if (!bcrypt.compareSync(password, passwordHash)) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  res.json({ token, expiresIn: TOKEN_EXPIRY });
});

authRouter.get('/check', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    res.json({ authenticated: false });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check query param (for media URLs in img/video src)
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }

  // Check cookie
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
    if (match) {
      return match.split('=').slice(1).join('=').trim();
    }
  }

  return null;
}

// Middleware to protect routes
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no password is configured (dev mode)
  if (!passwordHash) {
    console.warn('[Auth] No ADMIN_PASSWORD set — all routes are unprotected (dev mode)');
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export { authRouter, authMiddleware };
