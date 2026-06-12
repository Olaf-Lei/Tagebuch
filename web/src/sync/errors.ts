export class ConflictError extends Error {
  constructor() {
    super('Datei auf Server geändert. Bitte erst synchronisieren, dann erneut speichern.')
    this.name = 'ConflictError'
  }
}
