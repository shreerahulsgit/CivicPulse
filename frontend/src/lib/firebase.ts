/**
 * lib/firebase.ts — Firebase SDK + Google Sign-In
 *
 * Uses signInWithPopup for Google Sign-In.
 * The Cross-Origin-Opener-Policy (COOP) warning in the console is harmless —
 * it's a Chrome security log, not an error.
 */

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'

// ── Firebase Config from env vars ──────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)

// ── Google Sign-In ─────────────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')
// Force account selection every time so user can pick their Gmail
googleProvider.setCustomParameters({ prompt: 'select_account' })

/**
 * Open Google Sign-In popup and return a fresh Firebase ID token.
 * Falls back to redirect if popup is blocked.
 */
export async function signInWithGoogle(): Promise<{
  idToken: string
  user: FirebaseUser
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    // Always force-refresh the token to avoid stale/cached tokens
    const idToken = await result.user.getIdToken(/* forceRefresh */ true)
    return { idToken, user: result.user }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    // If popup was blocked by browser, try redirect flow
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, googleProvider)
      throw new Error('REDIRECT_INITIATED')
    }
    throw err
  }
}

/**
 * Call on app startup to handle redirect result after signInWithRedirect().
 * Returns null if no redirect was in progress.
 */
export async function handleGoogleRedirectResult(): Promise<{
  idToken: string
  user: FirebaseUser
} | null> {
  try {
    const result = await getRedirectResult(auth)
    if (!result) return null
    const idToken = await result.user.getIdToken(true)
    return { idToken, user: result.user }
  } catch {
    return null
  }
}

/**
 * Sign out from Firebase (clears browser Firebase session).
 */
export async function firebaseLogout(): Promise<void> {
  await firebaseSignOut(auth)
}

export { auth }
