/**
 * globals.d.ts — Ambient type declarations for browser APIs
 * not yet fully typed in the default TypeScript lib.
 */

// Credential Management API — PasswordCredential
// https://developer.mozilla.org/en-US/docs/Web/API/PasswordCredential
interface PasswordCredentialData {
  id:       string
  password: string
  name?:    string
  iconURL?: string
}

declare class PasswordCredential {
  constructor(data: PasswordCredentialData)
  readonly id:       string
  readonly password: string
  readonly name:     string
  readonly iconURL:  string
  readonly type:     'password'
}

interface Window {
  PasswordCredential?: typeof PasswordCredential
}
