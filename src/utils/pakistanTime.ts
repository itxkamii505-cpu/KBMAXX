// Utility functions for Pakistan Standard Time (PKT = UTC+5)

/**
 * Returns current Pakistan time (UTC+5) as a Date object where UTC getters reflect PKT.
 */
export function getPakistanNow(): Date {
  const utcNow = Date.now();
  // Add 5 hours to UTC for Pakistan Standard Time
  return new Date(utcNow + 5 * 60 * 60 * 1000);
}

/**
 * Formats a PKT Date to "YYYY-MM-DD HH:mm:ss"
 */
export function formatPktDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Returns exact timestamps and string representations for Today and Yesterday
 * based strictly on the Pakistan Standard Time (PKT = UTC+5) 5:00 AM cycle.
 * Day flips strictly at 05:00:00 AM PKT every morning.
 */
export function getPakistan5AmCycleBounds(nowMs = Date.now()): {
  todayStartMs: number;
  todayEndMs: number;
  yesterdayStartMs: number;
  yesterdayEndMs: number;
  todayFromStr: string;
  todayToStr: string;
  yesterdayFromStr: string;
  yesterdayToStr: string;
} {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const pktDate = new Date(nowMs + PKT_OFFSET_MS);
  const pktYear = pktDate.getUTCFullYear();
  const pktMonth = pktDate.getUTCMonth();
  const pktDay = pktDate.getUTCDate();
  const pktHour = pktDate.getUTCHours();

  let cycleBaseDate = Date.UTC(pktYear, pktMonth, pktDay, 0, 0, 0, 0);
  if (pktHour < 5) {
    cycleBaseDate -= 24 * 60 * 60 * 1000;
  }

  const todayStartMs = cycleBaseDate;
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000 - 1;
  const yesterdayStartMs = todayStartMs - 24 * 60 * 60 * 1000;
  const yesterdayEndMs = todayStartMs - 1;

  const formatPkt = (ms: number) => {
    const d = new Date(ms + PKT_OFFSET_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  };

  return {
    todayStartMs,
    todayEndMs,
    yesterdayStartMs,
    yesterdayEndMs,
    todayFromStr: formatPkt(todayStartMs),
    todayToStr: formatPkt(todayEndMs),
    yesterdayFromStr: formatPkt(yesterdayStartMs),
    yesterdayToStr: formatPkt(yesterdayEndMs),
  };
}

/**
 * Returns the default From & To dates aligned with the API 5:00 AM PKT cycle.
 * The API resets its daily counter/batch at 5:00 AM Pakistan Time every day.
 * - If current PKT time is >= 05:00 AM:
 *     From: Today at 05:00:00 PKT
 *     To:   Today at 23:59:59 PKT
 * - If current PKT time is < 05:00 AM:
 *     From: Yesterday at 05:00:00 PKT
 *     To:   Today at 23:59:59 PKT
 */
export function getPakistanApiDateRange(): { from: string; to: string } {
  const pktNow = getPakistanNow();
  const pktYear = pktNow.getUTCFullYear();
  const pktMonth = pktNow.getUTCMonth();
  const pktDay = pktNow.getUTCDate();
  const pktHour = pktNow.getUTCHours();

  let fromDate: Date;
  let toDate: Date;

  if (pktHour >= 5) {
    // Current cycle started today at 05:00:00 AM PKT
    fromDate = new Date(Date.UTC(pktYear, pktMonth, pktDay, 5, 0, 0));
    toDate = new Date(Date.UTC(pktYear, pktMonth, pktDay, 23, 59, 59));
  } else {
    // Current cycle started yesterday at 05:00:00 AM PKT
    const yesterdayMs = pktNow.getTime() - 24 * 60 * 60 * 1000;
    const yesterdayDate = new Date(yesterdayMs);
    fromDate = new Date(Date.UTC(yesterdayDate.getUTCFullYear(), yesterdayDate.getUTCMonth(), yesterdayDate.getUTCDate(), 5, 0, 0));
    toDate = new Date(Date.UTC(pktYear, pktMonth, pktDay, 23, 59, 59));
  }

  return {
    from: formatPktDateString(fromDate),
    to: formatPktDateString(toDate),
  };
}

/**
 * Determines whether theme should be 'light' or 'dark' based on Pakistan Time.
 * - 06:00 to 18:59 PKT (6:00 AM to 7:00 PM) => 'light' (Day vibe)
 * - 19:00 to 05:59 PKT (7:00 PM to 6:00 AM) => 'dark'  (Night black theme)
 */
export function getPakistanAutoTheme(): 'light' | 'dark' {
  const pktNow = getPakistanNow();
  const pktHour = pktNow.getUTCHours();
  if (pktHour >= 6 && pktHour < 19) {
    return 'light';
  }
  return 'dark';
}
