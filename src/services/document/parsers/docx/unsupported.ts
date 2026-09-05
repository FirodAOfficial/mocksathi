/**
 * Records OOXML constructs the parser recognised but chose not to represent.
 *
 * The requirement is that formatting is never *silently* dropped. Anything
 * added here surfaces in the UI's document-notice strip, so a user can see
 * exactly what the editor left behind.
 */
export class UnsupportedFeatureLog {
  private readonly features = new Set<string>();

  add(feature: string): void {
    this.features.add(feature);
  }

  list(): string[] {
    return [...this.features].sort();
  }
}
