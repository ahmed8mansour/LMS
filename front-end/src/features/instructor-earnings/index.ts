// Public surface of the instructor earnings feature (spec 013).
//
// Nothing outside this module may import a deep path.

export { instructorEarningsAPI } from './api/instructorEarnings.api';

export type {
    EarningsSnapshot,
    EarningsStats,
    EarningsWindow,
    TrendBucket,
    CourseEarnings,
    PeriodParam as EarningsPeriod,
} from './types/instructorEarnings.types';
export {
    DEFAULT_PERIOD,
    PERIOD_OPTIONS,
    formatBucketLabel,
    formatMoney,
    formatWindow,
    normalizePeriod,
    periodLabel,
    periodPhrase,
} from './types/instructorEarnings.types';

// Hooks
export { useInstructorEarnings } from './hooks/useInstructorEarnings';
export { useEarningsPeriod } from './hooks/useEarningsPeriod';

// Components — the orchestrator is the only entry point a page needs.
export { InstructorEarnings } from './components/InstructorEarnings';
export { EarningsSkeleton } from './components/EarningsStates';
