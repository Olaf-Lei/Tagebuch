const KEY_REMEMBER = 'tagebuch_remember_me'

export function isRememberMe(): boolean {
  // Default true — bestehende Sessions bleiben unverändert
  return localStorage.getItem(KEY_REMEMBER) !== '0'
}

export function setRememberMe(value: boolean): void {
  localStorage.setItem(KEY_REMEMBER, value ? '1' : '0')
}

function _store(): Storage {
  return isRememberMe() ? localStorage : sessionStorage
}

// Lesen: sessionStorage hat Vorrang (neuere Anmeldung), dann localStorage (ältere)
export function credGet(key: string): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key)
}

// Schreiben: in den aktiven Store, aus dem anderen entfernen
export function credSet(key: string, value: string): void {
  const active = _store()
  const other = active === localStorage ? sessionStorage : localStorage
  active.setItem(key, value)
  other.removeItem(key)
}

// Aus beiden Stores löschen
export function credRemove(key: string): void {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}
