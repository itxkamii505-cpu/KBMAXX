/**
 * Haptic and Tactile Touch Feedback Utility
 * Provides subtle tactile vibration for mobile touch interactions
 * (e.g. Galaxy phone tactile vibe on clicks, tabs, button taps)
 */
export function triggerHapticFeedback(pattern: number | number[] = 12) {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Haptics not allowed or unsupported in current context
    }
  }
}
