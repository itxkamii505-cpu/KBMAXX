import type { NumberRange } from '../types';

// Comprehensive International Calling Code Mapping (ITU-T E.164 Standard for all 240+ Countries & Territories)
export const COUNTRY_CALLING_CODES: Record<string, string> = {
  // --- 4-Digit NANP Caribbean & Territories ---
  '1242': 'Bahamas',
  '1246': 'Barbados',
  '1264': 'Anguilla',
  '1268': 'Antigua and Barbuda',
  '1284': 'British Virgin Islands',
  '1340': 'US Virgin Islands',
  '1345': 'Cayman Islands',
  '1441': 'Bermuda',
  '1473': 'Grenada',
  '1649': 'Turks and Caicos',
  '1664': 'Montserrat',
  '1670': 'Northern Mariana Islands',
  '1671': 'Guam',
  '1684': 'American Samoa',
  '1721': 'Sint Maarten',
  '1758': 'Saint Lucia',
  '1767': 'Dominica',
  '1784': 'Saint Vincent and the Grenadines',
  '1787': 'Puerto Rico',
  '1809': 'Dominican Republic',
  '1829': 'Dominican Republic',
  '1849': 'Dominican Republic',
  '1868': 'Trinidad and Tobago',
  '1869': 'Saint Kitts and Nevis',
  '1876': 'Jamaica',
  '1939': 'Puerto Rico',

  // --- Canadian Area Codes (NANP +1) ---
  '1204': 'Canada',
  '1226': 'Canada',
  '1236': 'Canada',
  '1249': 'Canada',
  '1250': 'Canada',
  '1289': 'Canada',
  '1306': 'Canada',
  '1343': 'Canada',
  '1365': 'Canada',
  '1403': 'Canada',
  '1416': 'Canada',
  '1418': 'Canada',
  '1438': 'Canada',
  '1450': 'Canada',
  '1506': 'Canada',
  '1514': 'Canada',
  '1519': 'Canada',
  '1548': 'Canada',
  '1579': 'Canada',
  '1581': 'Canada',
  '1587': 'Canada',
  '1604': 'Canada',
  '1613': 'Canada',
  '1639': 'Canada',
  '1647': 'Canada',
  '1672': 'Canada',
  '1705': 'Canada',
  '1709': 'Canada',
  '1778': 'Canada',
  '1780': 'Canada',
  '1782': 'Canada',
  '1807': 'Canada',
  '1819': 'Canada',
  '1825': 'Canada',
  '1867': 'Canada',
  '1873': 'Canada',
  '1902': 'Canada',
  '1905': 'Canada',

  // --- 3-Digit Codes ---
  '211': 'South Sudan',
  '212': 'Morocco',
  '213': 'Algeria',
  '216': 'Tunisia',
  '218': 'Libya',
  '220': 'Gambia',
  '221': 'Senegal',
  '222': 'Mauritania',
  '223': 'Mali',
  '224': 'Guinea',
  '225': 'Ivory Coast',
  '226': 'Burkina Faso',
  '227': 'Niger',
  '228': 'Togo',
  '229': 'Benin',
  '230': 'Mauritius',
  '231': 'Liberia',
  '232': 'Sierra Leone',
  '233': 'Ghana',
  '234': 'Nigeria',
  '235': 'Chad',
  '236': 'Central African Republic',
  '237': 'Cameroon',
  '238': 'Cape Verde',
  '239': 'Sao Tome and Principe',
  '240': 'Equatorial Guinea',
  '241': 'Gabon',
  '242': 'Republic of the Congo',
  '243': 'DR Congo',
  '244': 'Angola',
  '245': 'Guinea-Bissau',
  '246': 'British Indian Ocean Territory',
  '247': 'Ascension Island',
  '248': 'Seychelles',
  '249': 'Sudan',
  '250': 'Rwanda',
  '251': 'Ethiopia',
  '252': 'Somalia',
  '253': 'Djibouti',
  '254': 'Kenya',
  '255': 'Tanzania',
  '256': 'Uganda',
  '257': 'Burundi',
  '258': 'Mozambique',
  '260': 'Zambia',
  '261': 'Madagascar',
  '262': 'Reunion / Mayotte',
  '263': 'Zimbabwe',
  '264': 'Namibia',
  '265': 'Malawi',
  '266': 'Lesotho',
  '267': 'Botswana',
  '268': 'Eswatini',
  '269': 'Comoros',
  '290': 'Saint Helena',
  '291': 'Eritrea',
  '297': 'Aruba',
  '298': 'Faroe Islands',
  '299': 'Greenland',
  '350': 'Gibraltar',
  '351': 'Portugal',
  '352': 'Luxembourg',
  '353': 'Ireland',
  '354': 'Iceland',
  '355': 'Albania',
  '356': 'Malta',
  '357': 'Cyprus',
  '358': 'Finland',
  '359': 'Bulgaria',
  '370': 'Lithuania',
  '371': 'Latvia',
  '372': 'Estonia',
  '373': 'Moldova',
  '374': 'Armenia',
  '375': 'Belarus',
  '376': 'Andorra',
  '377': 'Monaco',
  '378': 'San Marino',
  '379': 'Vatican City',
  '380': 'Ukraine',
  '381': 'Serbia',
  '382': 'Montenegro',
  '383': 'Kosovo',
  '385': 'Croatia',
  '386': 'Slovenia',
  '387': 'Bosnia and Herzegovina',
  '389': 'North Macedonia',
  '420': 'Czech Republic',
  '421': 'Slovakia',
  '423': 'Liechtenstein',
  '500': 'Falkland Islands',
  '501': 'Belize',
  '502': 'Guatemala',
  '503': 'El Salvador',
  '504': 'Honduras',
  '505': 'Nicaragua',
  '506': 'Costa Rica',
  '507': 'Panama',
  '508': 'Saint Pierre and Miquelon',
  '509': 'Haiti',
  '590': 'Guadeloupe',
  '591': 'Bolivia',
  '592': 'Guyana',
  '593': 'Ecuador',
  '594': 'French Guiana',
  '595': 'Paraguay',
  '596': 'Martinique',
  '597': 'Suriname',
  '598': 'Uruguay',
  '599': 'Curacao',
  '670': 'East Timor',
  '672': 'Norfolk Island',
  '673': 'Brunei',
  '674': 'Nauru',
  '675': 'Papua New Guinea',
  '676': 'Tonga',
  '677': 'Solomon Islands',
  '678': 'Vanuatu',
  '679': 'Fiji',
  '680': 'Palau',
  '681': 'Wallis and Futuna',
  '682': 'Cook Islands',
  '683': 'Niue',
  '685': 'Samoa',
  '686': 'Kiribati',
  '687': 'New Caledonia',
  '688': 'Tuvalu',
  '689': 'French Polynesia',
  '690': 'Tokelau',
  '691': 'Micronesia',
  '692': 'Marshall Islands',
  '850': 'North Korea',
  '852': 'Hong Kong',
  '853': 'Macau',
  '855': 'Cambodia',
  '856': 'Laos',
  '880': 'Bangladesh',
  '886': 'Taiwan',
  '960': 'Maldives',
  '961': 'Lebanon',
  '962': 'Jordan',
  '963': 'Syria',
  '964': 'Iraq',
  '965': 'Kuwait',
  '966': 'Saudi Arabia',
  '967': 'Yemen',
  '968': 'Oman',
  '970': 'Palestine',
  '971': 'United Arab Emirates',
  '972': 'Israel',
  '973': 'Bahrain',
  '974': 'Qatar',
  '975': 'Bhutan',
  '976': 'Mongolia',
  '977': 'Nepal',
  '992': 'Tajikistan',
  '993': 'Turkmenistan',
  '994': 'Azerbaijan',
  '995': 'Georgia',
  '996': 'Kyrgyzstan',
  '998': 'Uzbekistan',

  // --- 2-Digit Codes ---
  '20': 'Egypt',
  '27': 'South Africa',
  '30': 'Greece',
  '31': 'Netherlands',
  '32': 'Belgium',
  '33': 'France',
  '34': 'Spain',
  '36': 'Hungary',
  '39': 'Italy',
  '40': 'Romania',
  '41': 'Switzerland',
  '43': 'Austria',
  '44': 'United Kingdom',
  '45': 'Denmark',
  '46': 'Sweden',
  '47': 'Norway',
  '48': 'Poland',
  '49': 'Germany',
  '51': 'Peru',
  '52': 'Mexico',
  '53': 'Cuba',
  '54': 'Argentina',
  '55': 'Brazil',
  '56': 'Chile',
  '57': 'Colombia',
  '58': 'Venezuela',
  '60': 'Malaysia',
  '61': 'Australia',
  '62': 'Indonesia',
  '63': 'Philippines',
  '64': 'New Zealand',
  '65': 'Singapore',
  '66': 'Thailand',
  '76': 'Kazakhstan',
  '77': 'Kazakhstan',
  '81': 'Japan',
  '82': 'South Korea',
  '84': 'Vietnam',
  '86': 'China',
  '90': 'Turkey',
  '91': 'India',
  '92': 'Pakistan',
  '93': 'Afghanistan',
  '94': 'Sri Lanka',
  '95': 'Myanmar',
  '98': 'Iran',

  // --- 1-Digit Fallbacks ---
  '1': 'United States',
  '7': 'Russia',
};

/**
 * Detects the real country name from any phone number prefix.
 * Exhaustively supports all ITU-T country prefixes worldwide.
 */
export function getCountryFromPhone(phone: string): string {
  if (!phone) return 'Worldwide';
  
  // Clean all non-digit characters
  let digits = String(phone).replace(/\D/g, '');
  
  // Strip initial '00' international prefix if present (e.g. 00224... -> 224...)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (!digits) return 'Worldwide';

  // 1. Check 4-digit NANP prefixes (e.g., 1242, 1876, 1204)
  const p4 = digits.slice(0, 4);
  if (COUNTRY_CALLING_CODES[p4]) return COUNTRY_CALLING_CODES[p4];

  // 2. Check 3-digit prefixes (e.g., 224 for Guinea, 233 for Ghana, 261 for Madagascar)
  const p3 = digits.slice(0, 3);
  if (COUNTRY_CALLING_CODES[p3]) return COUNTRY_CALLING_CODES[p3];

  // 3. Check 2-digit prefixes (e.g., 92 for Pakistan, 91 for India, 44 for UK, 76/77 for Kazakhstan)
  const p2 = digits.slice(0, 2);
  if (COUNTRY_CALLING_CODES[p2]) return COUNTRY_CALLING_CODES[p2];

  // 4. Check 1-digit prefixes (e.g., 1 for United States, 7 for Russia)
  const p1 = digits.slice(0, 1);
  if (COUNTRY_CALLING_CODES[p1]) return COUNTRY_CALLING_CODES[p1];

  return 'Worldwide';
}

/**
 * Resolves the accurate country name.
 * If the input country is missing, "Rangs", "Range", "Ranges", "Unknown", or "International",
 * it automatically detects the genuine country name directly from the mobile number prefix.
 */
export function resolveCountryName(country?: string, phone?: string): string {
  const cleanCountry = (country || '').trim();
  const lower = cleanCountry.toLowerCase();

  const isPlaceholder = 
    !cleanCountry || 
    lower === 'rangs' || 
    lower === 'range' || 
    lower === 'ranges' || 
    lower === 'unknown' || 
    lower === 'global' || 
    lower === 'international' || 
    lower === 'n/a' || 
    lower === 'null' || 
    lower === 'undefined';

  if (phone) {
    const detected = getCountryFromPhone(phone);
    if (detected && detected !== 'Worldwide') {
      if (isPlaceholder) {
        return detected;
      }
    }
  }

  if (cleanCountry && !isPlaceholder) {
    return cleanCountry;
  }

  return phone ? getCountryFromPhone(phone) : 'Worldwide';
}

/**
 * Resolves the accurate Range name for Live SMS view.
 * 1. Checks if the incoming message has a mapped Range Name.
 * 2. Checks configured ranges against the phone's full digits (exact MSISDN match).
 * 3. Checks configured ranges against the phone's prefix (e.g. Guinea 224, Tanzania 255).
 * 4. Fallback: returns resolveCountryName(country, phone) so an accurate country is shown if no custom range exists.
 */
export function resolveRangeName(country?: string, phone?: string, ranges?: NumberRange[]): string {
  let cleanPhone = (phone || '').replace(/[^\d]/g, '');
  if (cleanPhone.startsWith('00')) {
    cleanPhone = cleanPhone.slice(2);
  }

  if (ranges && ranges.length > 0 && cleanPhone) {
    // 1. Exact match in range numbers (only ranges that actually have numbers configured)
    const exactMatch = ranges.find(r => r.numbers && r.numbers.length > 0 && (
      r.numbers.includes(cleanPhone) || 
      r.numbers.includes('+' + cleanPhone) ||
      (cleanPhone.startsWith('00') && r.numbers.includes(cleanPhone.slice(2)))
    ));
    if (exactMatch) {
      return exactMatch.name;
    }

    // 2. National to International and vice versa (only against ranges with numbers)
    for (const range of ranges) {
      if (!range.numbers || range.numbers.length === 0) continue;
      const cleanPrefix = (range.prefix || '').replace(/[^\d]/g, '');
      if (cleanPrefix) {
        // e.g. national 0610... -> prefix 224 + 610...
        if (cleanPhone.startsWith('0') && cleanPhone.length >= 8) {
          const intlCandidate = cleanPrefix + cleanPhone.slice(1);
          if (range.numbers.includes(intlCandidate)) return range.name;
        }
        // e.g. local 610... -> prefix 224 + 610...
        const intlCandidate2 = cleanPrefix + cleanPhone;
        if (range.numbers.includes(intlCandidate2)) return range.name;

        // Vice versa: range number saved local, incoming has prefix
        if (cleanPhone.startsWith(cleanPrefix)) {
          const localPart = cleanPhone.slice(cleanPrefix.length);
          if (localPart && (range.numbers.includes(localPart) || range.numbers.includes('0' + localPart))) {
            return range.name;
          }
        }
      }
    }

    // 3. Suffix match (last 8 digits) only against actual range numbers
    if (cleanPhone.length >= 8) {
      const suffix8 = cleanPhone.slice(-8);
      for (const range of ranges) {
        if (range.numbers && range.numbers.length > 0 && range.numbers.some(n => n.endsWith(suffix8))) {
          return range.name;
        }
      }
    }
  }

  // Fallback: If phone is not assigned to any custom range numbers (e.g. range numbers cleared),
  // ALWAYS return genuine geographic country name (e.g. "Guinea", "Tanzania", "Pakistan")!
  const detected = getCountryFromPhone(cleanPhone || phone || '');
  if (detected && detected !== 'Worldwide') {
    return detected;
  }

  // If phone detection is Worldwide, verify country is not a custom range name
  const isKnownRangeName = ranges?.some(r => r.name.toLowerCase() === (country || '').toLowerCase());
  if (country && !isKnownRangeName) {
    return resolveCountryName(country, phone);
  }

  return detected || 'Worldwide';
}

/**
 * Separates and normalizes Phone Number and CLI / Sender ID to ensure
 * Mobile Number column contains ONLY the numeric phone number, and
 * CLI column contains the Service / Brand / Sender header.
 */
export function formatPhoneAndCli(
  phoneInput: string,
  cliInput?: string,
  senderInput?: string,
  serviceInput?: string
): { phone: string; cli: string } {
  let rawPhone = String(phoneInput || '').trim();
  let rawCli = String(cliInput || senderInput || serviceInput || '').trim();

  // If rawPhone has letters (e.g. "Pinduoduo", "TM Italla", "WhatsApp")
  const phoneHasLetters = /[a-zA-Z]/.test(rawPhone);
  const cliHasDigitsOnly = /^\+?[0-9\s\-()]{5,20}$/.test(rawCli.replace(/\s+/g, ''));

  if (phoneHasLetters) {
    if (cliHasDigitsOnly) {
      // Swapped: swap back
      const temp = rawPhone;
      rawPhone = rawCli;
      rawCli = temp;
    } else {
      // Phone is a text brand: move it to CLI
      rawCli = rawPhone;
      rawPhone = '';
    }
  }

  // Extract only clean phone digits (e.g. 224610351009)
  const cleanDigits = rawPhone.replace(/[^\d+]/g, '');
  const finalPhone = cleanDigits.length >= 4 ? cleanDigits : (rawPhone || 'N/A');

  // If CLI is empty or identical to digits, fallback to service/sender or clean default
  let finalCli = rawCli;
  if (!finalCli || finalCli === finalPhone || /^\+?\d+$/.test(finalCli)) {
    if (serviceInput && !/^\+?\d+$/.test(serviceInput)) {
      finalCli = serviceInput;
    } else if (senderInput && !/^\+?\d+$/.test(senderInput)) {
      finalCli = senderInput;
    } else {
      finalCli = 'Direct SMS';
    }
  }

  return {
    phone: finalPhone,
    cli: finalCli,
  };
}

export function formatDateTime(timestamp: number | string | Date): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const secs = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}
