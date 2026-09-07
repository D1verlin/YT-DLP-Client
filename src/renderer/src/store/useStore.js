import { create } from 'zustand'

const useStore = create((set) => ({
  language: 'en',
  setLanguage: (language) => set({ language }),

  isSetupActive: false,
  setIsSetupActive: (isSetupActive) => set({ isSetupActive }),

  tasks: [],

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks]
    })),

  updateTask: (updated) =>
    set((state) => {
      const exists = state.tasks.some((t) => t.id === updated.id)
      if (exists) {
        return {
          tasks: state.tasks.map((t) =>
            t.id === updated.id ? { ...t, ...updated } : t
          )
        }
      }
      return { tasks: [updated, ...state.tasks] }
    }),

  updateTaskProgress: (data) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === data.id
          ? {
              ...t,
              progress: data.progress,
              speed: data.speed,
              eta: data.eta,
              totalSize: data.totalSize,
              filePath: data.filePath || t.filePath,
              streamLabel: data.streamLabel ?? t.streamLabel,
              playlistCurrent: data.playlistCurrent ?? t.playlistCurrent,
              playlistTotal: data.playlistTotal ?? t.playlistTotal,
              playlistTitle: data.playlistTitle ?? t.playlistTitle
            }
          : t
      )
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id)
    })),

  clearCompletedTasks: () =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
    }))
}))

export default useStore
