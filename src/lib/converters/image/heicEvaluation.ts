/** Evaluation only; no qualified decoder has been selected. */
export interface HeicCapabilityReport {
  nativeSupported: null;
  recommendedEngine: 'undecided';
  status: 'planned';
  notes: string;
}
export async function getHeicCapabilityReport(): Promise<HeicCapabilityReport> {
  return {
    nativeSupported: null,
    recommendedEngine: 'undecided',
    status: 'planned',
    notes: 'No valid HEIC fixture or production decoder has been qualified. A container header cannot establish decoding support. No runtime capability claim is made.',
  };
}
