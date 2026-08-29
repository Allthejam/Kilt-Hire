/**
 * Formats current or given date to UK Local Time (Europe/London) taking BST/GMT daylight savings into account.
 * Output format: YYYY-MM-DD HH:MM
 */
export const getUkTimestamp = (date: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 16);
  }
};
