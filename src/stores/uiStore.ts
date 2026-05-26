import { create } from 'zustand'

interface FilterState {
  sortBy: string
  caloriesRange: [number, number]
  favoritesOnly: boolean
}

interface UIState {
  sidebarOpen: boolean
  lastVisitedPath: string
  filterState: FilterState
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setLastVisitedPath: (path: string) => void
  setFilterState: (state: Partial<FilterState>) => void
  resetFilters: () => void
}

const defaultFilterState: FilterState = {
  sortBy: 'default',
  caloriesRange: [0, 3000],
  favoritesOnly: false,
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  lastVisitedPath: '/dashboard',
  filterState: { ...defaultFilterState },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setLastVisitedPath: (path) => set({ lastVisitedPath: path }),
  setFilterState: (partial) =>
    set((s) => ({ filterState: { ...s.filterState, ...partial } })),
  resetFilters: () => set({ filterState: { ...defaultFilterState } }),
}))
