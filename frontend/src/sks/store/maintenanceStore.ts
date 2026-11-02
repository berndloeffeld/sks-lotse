import { create } from 'zustand'

import { setMaintenanceHandler } from '../api/client'

interface MaintenanceState {
  maintenanceMode: boolean
}

// Separate from authStore: maintenance mode is a global, auth-independent
// state (App.tsx gates the whole route tree on it, for anonymous visitors
// too), unlike authStore's sessionError, which is about this session's own
// reachability.
export const useMaintenanceStore = create<MaintenanceState>((set) => {
  setMaintenanceHandler((isMaintenance) => set({ maintenanceMode: isMaintenance }))

  return {
    maintenanceMode: false,
  }
})
