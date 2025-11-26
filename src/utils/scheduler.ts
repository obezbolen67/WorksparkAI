// FexoApp/src/utils/scheduler.ts
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import api from './api'; // Import your API wrapper

export interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  scheduledTime: number;
  createdAt: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notificationId: number;
}

const STORAGE_KEY = 'fexo_scheduled_tasks';

// --- Helper to converting URLSafe Base64 to Uint8Array for VAPID ---
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- Persistence ---
export const getTasks = (): ScheduledTask[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const saveTasks = (tasks: ScheduledTask[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event('fexo-tasks-updated'));
};

export const addTask = (task: ScheduledTask) => {
  const tasks = getTasks();
  tasks.push(task);
  saveTasks(tasks);
};

export const deleteTask = async (id: string) => {
  const tasks = getTasks();
  const taskToDelete = tasks.find(t => t.id === id);
  if (taskToDelete && taskToDelete.status === 'scheduled') {
    try {
        if (Capacitor.isNativePlatform()) {
            await LocalNotifications.cancel({ notifications: [{ id: taskToDelete.notificationId }] });
        }
        // For Web Push, we can't easily "cancel" the server timer from here without a cancel endpoint
        // But ignoring it is acceptable for MVP; the notification will arrive and user can ignore.
        // Ideally: api('/push/cancel', { taskId: id })
    } catch (e) {}
  }
  const newTasks = tasks.filter(t => t.id !== id);
  saveTasks(newTasks);
};

// --- Main Scheduling Logic ---

export const scheduleClientNotification = async (
  title: string,
  description: string | undefined,
  scheduleDate: Date
): Promise<{ success: boolean; error?: string }> => {
  try {
    const now = new Date();
    if (scheduleDate.getTime() <= now.getTime()) {
      return { success: false, error: 'Scheduled time must be in the future' };
    }

    const bodyContent = description || `Your task "${title}" starts now.`;
    const notificationId = Math.floor(Math.random() * 1000000);
    const taskId = crypto.randomUUID();

    // --- PATH 1: Native App (Android/iOS) ---
    if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') return { success: false, error: 'Permission denied' };

        await LocalNotifications.schedule({
            notifications: [{
                title,
                body: bodyContent,
                id: notificationId,
                schedule: { at: scheduleDate },
                sound: undefined,
                smallIcon: 'ic_stat_icon_config_sample',
            }],
        });
    } 
    // --- PATH 2: Web / PWA (Use Server Push) ---
    else {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return { success: false, error: 'Push notifications not supported on this browser.' };
        }

        const registration = await navigator.serviceWorker.ready;
        
        // 1. Ensure permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return { success: false, error: 'Notification permission denied' };

        // 2. Get VAPID Key
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        console.log("[KEY]", vapidKey)
        if (!vapidKey) return { success: false, error: 'Server configuration error (Missing Public Key)' };

        // 3. Subscribe to Push Manager
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });
        }

        // 4. Send Subscription to Server (Ensure User record has it)
        await api('/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription)
        });

        // 5. Tell Server to Schedule the Push
        const response = await api('/push/schedule', {
            method: 'POST',
            body: JSON.stringify({
                title,
                body: bodyContent,
                timestamp: scheduleDate.toISOString(),
                taskId
            })
        });

        if (!response.ok) {
            throw new Error('Server failed to schedule notification');
        }
    }

    // Save to local persistence for UI list
    addTask({
      id: taskId,
      title,
      description: bodyContent,
      scheduledTime: scheduleDate.getTime(),
      createdAt: Date.now(),
      status: 'scheduled',
      notificationId
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown scheduling error' };
  }
};