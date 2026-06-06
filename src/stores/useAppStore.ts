/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { UserProfile, GlucoseReading, MedicationLog, WaterLog, FoodLog, ChatMessage, Medication } from '../types';

// Custom IndexedDB storage connector using idb-keyval
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name);
    return value ? (value as string) : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface AppState {
  userProfile: UserProfile | null;
  glucoseReadings: GlucoseReading[];
  medicationLogs: MedicationLog[];
  waterLogs: Record<string, number>; // date "YYYY-MM-DD" -> cup count
  foodLogs: FoodLog[];
  chatHistory: ChatMessage[];
  geminiApiKey: string;
  isInitialized: boolean;

  // Actions
  initializeStore: () => void;
  setUserProfile: (profile: UserProfile) => void;
  addMedication: (medication: Medication) => void;
  addGlucoseReading: (reading: { value: number; mealRelation: 'fasting' | 'post-meal' | 'before-meal' | 'bedtime' | 'random'; notes?: string }) => void;
  deleteGlucoseReading: (id: string) => void;
  toggleMedicationLog: (medicationId: string, medicationName: string, dosage: string, timeSlot: string, targetDate?: string) => void;
  incrementWater: (date: string) => void;
  decrementWater: (date: string) => void;
  addFoodLog: (mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack', description: string) => void;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => void;
  clearChatHistory: () => void;
  setChatHistory: (history: ChatMessage[]) => void;
  updateChatMessage: (id: string, content: string) => void;
  setGeminiApiKey: (key: string) => void;
  clearAllData: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userProfile: null,
      glucoseReadings: [],
      medicationLogs: [],
      waterLogs: {},
      foodLogs: [],
      chatHistory: [],
      geminiApiKey: '',
      isInitialized: false,

      initializeStore: () => {
        set({ isInitialized: true });
      },

      setUserProfile: (profile) => {
        set({ userProfile: profile });
      },

      addMedication: (medication) => {
        set((state) => {
          if (!state.userProfile) return state;
          const currentMedications = state.userProfile.medications || [];
          return {
            userProfile: {
              ...state.userProfile,
              medications: [...currentMedications, medication],
            },
          };
        });
      },

      addGlucoseReading: (reading) => {
        const loggedAt = new Date().toISOString();
        let status: 'low' | 'normal' | 'high' = 'normal';

        if (reading.value < 70) {
          status = 'low';
        } else if (reading.mealRelation === 'fasting' || reading.mealRelation === 'before-meal') {
          status = reading.value > 130 ? 'high' : 'normal';
        } else if (reading.mealRelation === 'post-meal') {
          status = reading.value > 180 ? 'high' : 'normal';
        } else {
          status = reading.value > 140 ? 'high' : 'normal';
        }

        const newReading: GlucoseReading = {
          id: `glucose-${Date.now()}`,
          ...reading,
          status,
          loggedAt,
        };

        set((state) => ({
          glucoseReadings: [newReading, ...state.glucoseReadings],
        }));
      },

      deleteGlucoseReading: (id) => {
        set((state) => ({
          glucoseReadings: state.glucoseReadings.filter((r) => r.id !== id),
        }));
      },

      toggleMedicationLog: (medicationId, medicationName, dosage, timeSlot, targetDate) => {
        const today = targetDate || new Date().toISOString().split('T')[0];
        const state = get();
        
        // Check if already logged today for this timeslot
        const existingLogIndex = state.medicationLogs.findIndex(
          (log) =>
            log.medicationId === medicationId &&
            log.timeSlot === timeSlot &&
            log.loggedAt.startsWith(today)
        );

        if (existingLogIndex >= 0) {
          // Remove log
          set((state) => ({
            medicationLogs: state.medicationLogs.filter((_, i) => i !== existingLogIndex),
          }));
        } else {
          // Add log
          const loggedAt = targetDate 
            ? `${targetDate}T${new Date().toISOString().split('T')[1] || '12:00:00.000Z'}`
            : new Date().toISOString();

          const newLog: MedicationLog = {
            id: `medlog-${Date.now()}`,
            medicationId,
            medicationName,
            dosage,
            timeSlot,
            loggedAt,
          };
          set((state) => ({
            medicationLogs: [newLog, ...state.medicationLogs],
          }));
        }
      },

      incrementWater: (date) => {
        set((state) => {
          const currentCount = state.waterLogs[date] || 0;
          return {
            waterLogs: {
              ...state.waterLogs,
              [date]: Math.min(currentCount + 1, 20), // Cap at 20 cups
            },
          };
        });
      },

      decrementWater: (date) => {
        set((state) => {
          const currentCount = state.waterLogs[date] || 0;
          if (currentCount <= 0) return state;
          return {
            waterLogs: {
              ...state.waterLogs,
              [date]: currentCount - 1,
            },
          };
        });
      },

      addFoodLog: (mealType, description) => {
        const newLog: FoodLog = {
          id: `food-${Date.now()}`,
          mealType,
          description,
          loggedAt: new Date().toISOString(),
        };
        set((state) => ({
          foodLogs: [newLog, ...state.foodLogs],
        }));
      },

      addChatMessage: (msg) => {
        const timestamp = new Date().toISOString();
        const newMessage: ChatMessage = {
          id: msg.id || `chat-${Date.now()}`,
          role: msg.role,
          content: msg.content,
          timestamp,
          attachment: msg.attachment,
        };
        set((state) => ({
          chatHistory: [...state.chatHistory, newMessage],
        }));
      },

      clearChatHistory: () => {
        set({ chatHistory: [] });
      },

      setChatHistory: (history) => {
        set({ chatHistory: history });
      },

      updateChatMessage: (id, content) => {
        set((state) => ({
          chatHistory: state.chatHistory.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        }));
      },

      setGeminiApiKey: (key) => {
        set({ geminiApiKey: key });
      },

      clearAllData: async () => {
        // Clear Zustand memory state first to avoid further automatic storage syncs with old contents
        set({
          userProfile: null,
          glucoseReadings: [],
          medicationLogs: [],
          waterLogs: {},
          foodLogs: [],
          chatHistory: [],
          geminiApiKey: '',
          isInitialized: false,
        });
        
        // Direct IndexedDB persistent store deletion
        try {
          await del('sokkarak-mazboot-storage');
        } catch (error) {
          console.error('Failed to clear IndexedDB store:', error);
        }

        // Clean up standard Web/Local storage devices just in case
        localStorage.clear();
        sessionStorage.clear();
      },
    }),
    {
      name: 'sokkarak-mazboot-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
