import { DollarSign, RotateCcw, Wallet } from "lucide-react";
import { StatTile } from "@/components/molecules/StatTile";
import { formatMoney } from "../types/instructorEarnings.types";
import type { EarningsStats } from "../types/instructorEarnings.types";

interface EarningsTilesProps {
    stats: EarningsStats;
    currency: string;
}

function plural(count: number, word: string): string {
    return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Total revenue · Refunds · Net (FR-006), in that order.
 *
 * `StatTile` is the same component the dashboard and analytics tile rows use, and the
 * grid matches theirs at every breakpoint — the three rows are meant to be
 * indistinguishable, so nothing here restyles it.
 *
 * Amounts are shown to the cent with separators and never abbreviated (FR-012): every
 * figure on this page has to reconcile with another one, and "$8.9k" reconciles with
 * nothing.
 */
export function EarningsTiles({ stats, currency }: EarningsTilesProps) {
    const money = (amount: string) => formatMoney(amount, currency);

    return (
        <section aria-label="Earnings summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
                label="Total revenue"
                icon={DollarSign}
                title={money(stats.total_revenue)}
                value={money(stats.total_revenue)}
                // The only place the sale count surfaces; it is what the revenue figure
                // is the value OF, and what the table's Sales column adds up to.
                secondary={plural(stats.sales, "sale")}
            />
            <StatTile
                label="Refunds"
                icon={RotateCcw}
                title={money(stats.refunds)}
                value={money(stats.refunds)}
                secondary="Returned to students"
            />
            <StatTile
                label="Net"
                icon={Wallet}
                title={money(stats.net)}
                value={money(stats.net)}
                secondary="Revenue less refunds"
            />
        </section>
    );
}
