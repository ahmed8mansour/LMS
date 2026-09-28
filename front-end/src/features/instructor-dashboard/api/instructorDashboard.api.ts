import axiosInstance from '@/lib/axios';
import { DashboardSnapshotSchema } from '../schemas/instructorDashboard.schma';
import type { DashboardSnapshot } from '../types/instructorDashboard.types';

// The whole dashboard is one snapshot (spec 008 Q1). The body is parsed, not cast: a
// payload that doesn't match the contract throws here on purpose, so the page shows its
// error state instead of rendering missing values as zeros (FR-027).
async function getSnapshot(): Promise<DashboardSnapshot> {
    const { data } = await axiosInstance.get('/courses/instructor/dashboard/');
    return DashboardSnapshotSchema.parse(data);
}

export const instructorDashboardAPI = {
    getSnapshot,
};
