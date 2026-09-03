/**
 * countryCodes.js
 * Comprehensive Country Calling Codes with GCC prioritized at the top.
 */

export const GCC_COUNTRIES = [
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪', minLen: 9, maxLen: 9, short: 'UAE' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', minLen: 9, maxLen: 9, short: 'KSA' },
  { code: '+968', country: 'Oman', flag: '🇴🇲', minLen: 8, maxLen: 8, short: 'OM' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', minLen: 8, maxLen: 8, short: 'QA' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼', minLen: 8, maxLen: 8, short: 'KW' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭', minLen: 8, maxLen: 8, short: 'BH' },
];

export const OTHER_COUNTRIES = [
  { code: '+91', country: 'India', flag: '🇮🇳', minLen: 10, maxLen: 10, short: 'IN' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰', minLen: 10, maxLen: 10, short: 'PK' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩', minLen: 10, maxLen: 10, short: 'BD' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', minLen: 9, maxLen: 9, short: 'LK' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵', minLen: 10, maxLen: 10, short: 'NP' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭', minLen: 10, maxLen: 10, short: 'PH' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', minLen: 10, maxLen: 10, short: 'EG' },
  { code: '+962', country: 'Jordan', flag: '🇯🇴', minLen: 9, maxLen: 9, short: 'JO' },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧', minLen: 8, maxLen: 8, short: 'LB' },
  { code: '+963', country: 'Syria', flag: '🇸🇾', minLen: 9, maxLen: 9, short: 'SY' },
  { code: '+967', country: 'Yemen', flag: '🇾🇪', minLen: 9, maxLen: 9, short: 'YE' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', minLen: 10, maxLen: 10, short: 'UK' },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸', minLen: 10, maxLen: 10, short: 'US/CA' },
  { code: '+86', country: 'China', flag: '🇨🇳', minLen: 11, maxLen: 11, short: 'CN' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', minLen: 9, maxLen: 10, short: 'MY' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩', minLen: 9, maxLen: 12, short: 'ID' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', minLen: 9, maxLen: 9, short: 'KE' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', minLen: 10, maxLen: 10, short: 'NG' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', minLen: 9, maxLen: 9, short: 'ZA' },
  { code: '+7', country: 'Russia / Kazakhstan', flag: '🇷🇺', minLen: 10, maxLen: 10, short: 'RU' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', minLen: 10, maxLen: 11, short: 'DE' },
  { code: '+33', country: 'France', flag: '🇫🇷', minLen: 9, maxLen: 9, short: 'FR' },
  { code: '+39', country: 'Italy', flag: '🇮🇹', minLen: 9, maxLen: 10, short: 'IT' },
  { code: '+34', country: 'Spain', flag: '🇪🇸', minLen: 9, maxLen: 9, short: 'ES' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', minLen: 9, maxLen: 9, short: 'AU' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', minLen: 10, maxLen: 10, short: 'TR' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦', minLen: 9, maxLen: 9, short: 'MA' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳', minLen: 8, maxLen: 8, short: 'TN' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿', minLen: 9, maxLen: 9, short: 'DZ' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩', minLen: 9, maxLen: 9, short: 'SD' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹', minLen: 9, maxLen: 9, short: 'ET' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿', minLen: 9, maxLen: 9, short: 'TZ' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬', minLen: 9, maxLen: 9, short: 'UG' },
  { code: '+98', country: 'Iran', flag: '🇮🇷', minLen: 10, maxLen: 10, short: 'IR' },
  { code: '+964', country: 'Iraq', flag: '🇮🇶', minLen: 10, maxLen: 10, short: 'IQ' },
  { code: '+970', country: 'Palestine', flag: '🇵🇸', minLen: 9, maxLen: 9, short: 'PS' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', minLen: 10, maxLen: 10, short: 'JP' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', minLen: 9, maxLen: 10, short: 'KR' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', minLen: 8, maxLen: 8, short: 'SG' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭', minLen: 9, maxLen: 9, short: 'TH' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳', minLen: 9, maxLen: 10, short: 'VN' },
];

export const ALL_COUNTRY_CODES = [...GCC_COUNTRIES, ...OTHER_COUNTRIES];

export const getCountryRule = (code) => {
  const found = ALL_COUNTRY_CODES.find(c => c.code === code);
  return found || { code, country: 'International', flag: '🌐', minLen: 7, maxLen: 15, short: 'INT' };
};

/**
 * Strips all common country codes from the start of a mobile input string
 */
export const stripCountryPrefix = (raw) => {
  if (!raw) return '';
  let str = String(raw).trim().replace(/^\+/, '');
  
  // Sort country codes by descending length so 3-digit prefixes match before 2-digit
  const sortedCodes = ALL_COUNTRY_CODES.map(c => c.code.replace('+', '')).sort((a, b) => b.length - a.length);
  for (const c of sortedCodes) {
    if (str.startsWith(c)) {
      return str.slice(c.length).replace(/\D/g, '');
    }
  }
  return str.replace(/\D/g, '');
};
