
// src/lib/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error('SESSION_SECRET environment variable is not set.');
}
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE_NAME = 'session_token_ubm';
const SESSION_MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '3600', 10); // 1 hora por defecto
const SESSION_EXPIRATION_TIME = process.env.SESSION_EXPIRATION_TIME || '1h'; // 1 hora por defecto

export interface SessionPayload {
  userId: string;
  username: string;
  name: string;
  roleId: number | null; // Permitir null si el rol no está asignado
  expires?: Date;
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION_TIME) // ej. '1h', '7d'
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = ''): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    console.error('Failed to verify session:', error);
    return null;
  }
}

export async function createSession(payload: Omit<SessionPayload, 'expires'>) {
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const sessionToken = await encrypt({ ...payload, expires });

  cookies().set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expires,
    sameSite: 'lax',
    path: '/',
  });
  console.log('Session cookie created');
}

export async function deleteSession() {
  cookies().set(SESSION_COOKIE_NAME, '', {
    expires: new Date(0),
    path: '/',
  });
  console.log('Session cookie deleted');
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  return await decrypt(cookie);
}

export async function updateSession(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(sessionToken);

  if (!sessionToken || !payload) {
    return null;
  }

  // Refresh the session so it doesn't expire
  const refreshedExpires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: refreshedExpires,
    sameSite: 'lax',
    path: '/',
  });
  return res;
}
