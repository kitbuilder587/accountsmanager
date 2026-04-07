import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = '7d';

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
