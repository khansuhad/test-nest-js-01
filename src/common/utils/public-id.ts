/**
 * Generate a 6-digit random numeric public identifier as a string.
 * Used for human-readable store/customer/service/invoice IDs.
 * Collision odds at 1M rows: ~0.5; we retry on insert conflicts at the service layer.
 */
export function generatePublicId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
