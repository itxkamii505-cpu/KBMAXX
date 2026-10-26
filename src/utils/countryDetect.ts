/**
 * Universal Country Detection by Phone Prefix & Column Parser
 * Re-uses unified calling codes map from countryLookup.ts
 */
import { COUNTRY_CALLING_CODES, getCountryFromPhone } from './countryLookup';

export { COUNTRY_CALLING_CODES };

/**
 * Detect country from phone number prefix
 */
export function detectCountryFromPhone(phone: string): string {
  if (!phone) return 'Unknown';
  const detected = getCountryFromPhone(phone);
  return detected === 'Worldwide' ? 'Unknown' : detected;
}

/**
 * Normalize and clean phone digits for consistency
 */
export function cleanPhoneNumber(raw: string): string {
  let clean = raw.trim().replace(/[^\d+]/g, '');
  if (!clean.startsWith('+')) {
    clean = '+' + clean.replace(/^0+/, '');
  }
  return clean;
}
