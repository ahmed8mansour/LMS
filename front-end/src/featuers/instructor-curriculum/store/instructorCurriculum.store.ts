import { create } from 'zustand';

// View-local builder UI state only (which sections are expanded). Server state
// lives in TanStack Query; this holds nothing that must persist or sync.
interface CurriculumUiState {
    expanded: Record<number, boolean>;
    toggleSection: (id: number) => void;
    setExpanded: (id: number, open: boolean) => void;
    isExpanded: (id: number, fallback?: boolean) => boolean;
}

export const useCurriculumUi = create<CurriculumUiState>((set, get) => ({
    expanded: {},
    toggleSection: (id) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: !(s.expanded[id] ?? true) } })),
    setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
    isExpanded: (id, fallback = true) => get().expanded[id] ?? fallback,
}));
