import axiosInstance from "@/lib/axios";
import { EarningsSnapshotSchema } from "../schemas/instructorEarnings.schma";
import { DEFAULT_PERIOD } from "../types/instructorEarnings.types";
import type { EarningsSnapshot, PeriodParam } from "../types/instructorEarnings.types";

/**
 * One endpoint, one scope: every course the signed-in instructor owns (contracts §1).
 *
 * There is deliberately no `course` parameter, unlike the reviews feed and the roster —
 * the per-course breakdown is a column in this payload, not a scope. That is also why
 * this request carries no id at all.
 *
 * The period is sent only when it is not the default, so the server applies its own.
 */
async function getEarnings(period: PeriodParam): Promise<EarningsSnapshot> {
    const params: Record<string, string> = {};
    if (period !== DEFAULT_PERIOD) params.period = period;

    const { data } = await axiosInstance.get("/enrollment/instructor/earnings/", { params });
    return EarningsSnapshotSchema.parse(data);
}

export const instructorEarningsAPI = {
    getEarnings,
};
