/**
 * Thai Timezone (Asia/Bangkok, UTC+7) Utilities and Date Formatters
 * Ensures that all dates and times across the entire platform are formatted
 * accurately according to Thailand Standard Time (ICT, UTC+7).
 */

const THAI_TIMEZONE = 'Asia/Bangkok';

/**
 * Safely parse any date/ISO string or timestamp into a valid Date object.
 * Robust against Safari / WebKit's strict Date parser which rejects space-separated dates ("YYYY-MM-DD HH:mm:ss").
 */
export function parseDateSafe(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return new Date();

    // 1. If standard ISO or timestamp
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d;
    }

    // 2. Safari compatibility: replace space between date and time with 'T' ("2026-06-18 10:15:00" -> "2026-06-18T10:15:00")
    if (trimmed.includes(' ') && !trimmed.includes('T')) {
      const isoFormat = trimmed.replace(' ', 'T');
      d = new Date(isoFormat);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 3. Try converting slash format or clean non-standard delimiters
    const slashFormat = trimmed.replace(/-/g, '/');
    d = new Date(slashFormat);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  return new Date();
}

/**
 * Formats a date to full Thai representation with Thai month and Buddhist Era year (พ.ศ.) or Christian era
 * e.g. "18 ส.ค. 2569 15:04 น." or "18 สิงหาคม 2569 15:04"
 */
export function formatThaiDateTime(
  input?: string | number | Date | null,
  includeSeconds = false
): string {
  if (!input) return '-';
  try {
    const d = parseDateSafe(input);
    const dateStr = d.toLocaleDateString('th-TH', {
      timeZone: THAI_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const timeStr = d.toLocaleTimeString('th-TH', {
      timeZone: THAI_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    });

    return `${dateStr} ${timeStr} น.`;
  } catch (err) {
    console.error('Error formatting Thai date-time:', err);
    return String(input);
  }
}

/**
 * Formats a date to numeric standard Thai timezone string (YYYY-MM-DD HH:mm or DD/MM/YYYY HH:mm)
 * e.g. "2026-08-18 15:04"
 */
export function formatThaiDateTimeStandard(
  input?: string | number | Date | null
): string {
  if (!input) return '-';
  try {
    const d = parseDateSafe(input);
    
    // Extract parts directly in Asia/Bangkok timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: THAI_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (typeof formatter.formatToParts === 'function') {
      const parts = formatter.formatToParts(d);
      let year = '', month = '', day = '', hour = '', minute = '';
      
      for (const part of parts) {
        if (part.type === 'year') year = part.value;
        if (part.type === 'month') month = part.value;
        if (part.type === 'day') day = part.value;
        if (part.type === 'hour') hour = part.value;
        if (part.type === 'minute') minute = part.value;
      }

      if (year && month && day) {
        return `${year}-${month}-${day} ${hour || '00'}:${minute || '00'}`;
      }
    }

    // Fallback standard ISO/Thai extraction
    const iso = d.toISOString();
    return iso.slice(0, 10) + ' ' + iso.slice(11, 16);
  } catch (err) {
    return String(input);
  }
}

/**
 * Formats a date to Thai date only: e.g. "18 ส.ค. 2569"
 */
export function formatThaiDate(input?: string | number | Date | null): string {
  if (!input) return '-';
  try {
    const d = parseDateSafe(input);
    return d.toLocaleDateString('th-TH', {
      timeZone: THAI_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(input);
  }
}

/**
 * Formats a time in Thai timezone: e.g. "15:04 น."
 */
export function formatThaiTime(
  input?: string | number | Date | null,
  includeSeconds = false
): string {
  if (!input) return '-';
  try {
    const d = parseDateSafe(input);
    const timeStr = d.toLocaleTimeString('th-TH', {
      timeZone: THAI_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    });
    return `${timeStr} น.`;
  } catch {
    return String(input);
  }
}

/**
 * Formats chat message time: e.g. "วันนี้ 15:04" or "18 ส.ค. 15:04"
 */
export function formatThaiChatTime(input?: string | number | Date | null): string {
  if (!input) return '';
  try {
    const d = parseDateSafe(input);
    const now = new Date();

    const isToday =
      d.toLocaleDateString('en-GB', { timeZone: THAI_TIMEZONE }) ===
      now.toLocaleDateString('en-GB', { timeZone: THAI_TIMEZONE });

    const timeStr = d.toLocaleTimeString('th-TH', {
      timeZone: THAI_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (isToday) {
      return `${timeStr} น.`;
    }

    const dateStr = d.toLocaleDateString('th-TH', {
      timeZone: THAI_TIMEZONE,
      month: 'short',
      day: 'numeric',
    });

    return `${dateStr} ${timeStr} น.`;
  } catch {
    return '';
  }
}
