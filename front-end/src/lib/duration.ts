// Lecture duration is entered/displayed as mm:ss but stored as decimal MINUTES
// (the existing convention — the student side sums `parseFloat(duration)` as
// minutes). These helpers convert between the two without a backend change.

/** `^\d{1,3}:[0-5]?\d$` (mm:ss) or a bare minutes integer. */
export const MMSS_PATTERN = /^(\d{1,3}):([0-5]?\d)$|^(\d{1,4})$/;

/** Parse "mm:ss" (or bare minutes) → decimal-minutes string (2 dp) for the API. */
export function parseMmSs(value: string): string | null {
    const m = value.trim().match(MMSS_PATTERN);
    if (!m) return null;
    let minutes: number;
    if (m[3] !== undefined) {
        minutes = Number(m[3]); // bare minutes
    } else {
        minutes = Number(m[1]) + Number(m[2]) / 60;
    }
    if (!(minutes > 0) || minutes >= 10000) return null; // fits max_digits=6, decimal_places=2
    return minutes.toFixed(2);
}

/** Format decimal-minutes (string|number) → "m:ss" for display. */
export function formatMinutes(value: string | number): string {
    const v = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(v) || v < 0) return '0:00';
    let m = Math.floor(v);
    let s = Math.round((v - m) * 60);
    if (s === 60) {
        m += 1;
        s = 0;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** True when a string is a valid mm:ss (or bare-minutes) duration > 0. */
export function isValidDuration(value: string): boolean {
    return parseMmSs(value) !== null;
}
