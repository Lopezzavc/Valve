const SCIENTIFIC_SEPARATOR = 'e';

const SUPERSCRIPT_MAP: Record<string, string> = {
  '-': '\u207b',
  '0': '\u2070',
  '1': '\u00b9',
  '2': '\u00b2',
  '3': '\u00b3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079',
};

const hasScientificNotation = (value: string) => value.includes(SCIENTIFIC_SEPARATOR);

const isIncompleteMantissa = (value: string) =>
  value === '' || value === '-' || value === '.' || value === '-.' || value.endsWith('.');

export const formatKeyboardDisplayValue = (value: string): string => {
  if (!hasScientificNotation(value)) {
    return value;
  }

  const [mantissa, exponent = ''] = value.split(SCIENTIFIC_SEPARATOR);
  const superscriptExponent = exponent
    .split('')
    .map(char => SUPERSCRIPT_MAP[char] ?? char)
    .join('');

  return `${mantissa}x10${superscriptExponent}`;
};

export const appendKeyboardKey = (current: string, key: string): string | null => {
  if (/^\d$/.test(key)) {
    return `${current}${key}`;
  }

  if (key !== '.') {
    return `${current}${key}`;
  }

  if (hasScientificNotation(current)) {
    return null;
  }

  const mantissa = current.startsWith('-') ? current.slice(1) : current;
  if (mantissa.includes('.')) {
    return null;
  }

  if (current === '') {
    return '0.';
  }

  if (current === '-') {
    return '-0.';
  }

  return `${current}.`;
};

export const deleteKeyboardKey = (current: string): string => current.slice(0, -1);

export const clearKeyboardValue = (): string => '';

export const insertScientificNotation = (current: string): string | null => {
  if (hasScientificNotation(current) || isIncompleteMantissa(current)) {
    return null;
  }

  return `${current}${SCIENTIFIC_SEPARATOR}`;
};

export const insertKeyboardMinus = (current: string): string | null => {
  if (current === '') {
    return '-';
  }

  if (current.endsWith(SCIENTIFIC_SEPARATOR)) {
    return `${current}-`;
  }

  return null;
};
