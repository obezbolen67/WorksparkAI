// src/contexts/NavigationContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  Position,
  NavigationStep,
  calculateDistance,
  findCurrentStep,
  isOffRoute,
  getNotificationDistance,
  calculateSpeed,
  calculateETA,
} from '../utils/navigationHelpers';

export interface NavigationState {
  isNavigating: boolean;
  currentPosition: Position | null;
  currentStepIndex: number;
  distanceToNextTurn: number;
  totalRemainingDistance: number;
  currentSpeed: number; // meters per second
  averageSpeed: number;
  eta: Date | null;
  heading: number | null; // User's heading in degrees
  offRoute: boolean;
  steps: NavigationStep[];
  destination: Position | null;
  error: string | null;
}

interface NavigationContextType {
  navigation: NavigationState;
  startNavigation: (steps: NavigationStep[], destination: Position) => void;
  stopNavigation: () => void;
  acknowledgeOffRoute: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [navigation, setNavigation] = useState<NavigationState>({
    isNavigating: false,
    currentPosition: null,
    currentStepIndex: 0,
    distanceToNextTurn: 0,
    totalRemainingDistance: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    eta: null,
    heading: null,
    offRoute: false,
    steps: [],
    destination: null,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ pos: Position; time: number } | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const lastNotificationStepRef = useRef<number>(-1);

  // Speech synthesis for voice guidance
  const speakInstruction = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Send notification (Capacitor or browser)
  const sendNotification = useCallback(async (title: string, body: string) => {
    // Try Capacitor LocalNotifications first (for mobile)
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Check and request permission if needed
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title,
              body,
              smallIcon: 'ic_stat_icon_config_sample',
              sound: undefined,
              attachments: undefined,
              actionTypeId: '',
              extra: null,
            },
          ],
        });
        return;
      } else if (permission.display === 'prompt') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Date.now(),
                title,
                body,
                smallIcon: 'ic_stat_icon_config_sample',
                sound: undefined,
                attachments: undefined,
                actionTypeId: '',
                extra: null,
              },
            ],
          });
          return;
        }
      }
    } catch (error) {
      // Capacitor not available, fall back to browser notifications
      console.log('Using browser notifications:', error);
    }

    // Fallback to browser notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'navigation',
          requireInteraction: false,
        });
      } catch (error) {
        console.error('Notification error:', error);
      }
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Process location update
  const processLocationUpdate = useCallback(
    (position: GeolocationPosition) => {
      const newPos: Position = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setNavigation((prev) => {
        if (!prev.isNavigating || prev.steps.length === 0) return prev;

        const now = Date.now();
        let currentSpeed = 0;
        let averageSpeed = prev.averageSpeed;

        // Calculate speed
        if (lastPositionRef.current) {
          const timeDelta = now - lastPositionRef.current.time;
          if (timeDelta > 0) {
            currentSpeed = calculateSpeed(
              lastPositionRef.current.pos,
              newPos,
              timeDelta
            );

            // Update speed history (keep last 10 readings)
            speedHistoryRef.current.push(currentSpeed);
            if (speedHistoryRef.current.length > 10) {
              speedHistoryRef.current.shift();
            }

            // Calculate average speed
            if (speedHistoryRef.current.length > 0) {
              averageSpeed =
                speedHistoryRef.current.reduce((a, b) => a + b, 0) /
                speedHistoryRef.current.length;
            }
          }
        }

        lastPositionRef.current = { pos: newPos, time: now };

        // Find current step
        const newStepIndex = findCurrentStep(newPos, prev.steps, prev.currentStepIndex);
        const currentStep = prev.steps[newStepIndex];
        const nextStep = prev.steps[newStepIndex + 1];

        // Calculate distance to next turn (end of current step)
        const distanceToNextTurn = calculateDistance(newPos, currentStep.end_location);

        // Calculate total remaining distance
        let totalRemainingDistance = distanceToNextTurn;
        for (let i = newStepIndex + 1; i < prev.steps.length; i++) {
          totalRemainingDistance += prev.steps[i].distance.value;
        }

        // Check if off route
        const offRoute = isOffRoute(newPos, currentStep, nextStep);

        // Calculate ETA
        const eta = averageSpeed > 0 
          ? calculateETA(totalRemainingDistance, averageSpeed)
          : null;

        // Voice guidance: announce turns
        const notificationDist = getNotificationDistance(currentSpeed);
        const shouldNotify =
          distanceToNextTurn <= notificationDist &&
          lastNotificationStepRef.current !== newStepIndex;

        if (shouldNotify && newStepIndex < prev.steps.length - 1) {
          lastNotificationStepRef.current = newStepIndex;
          const instruction = currentStep.instructions
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .substring(0, 100); // Limit length

          speakInstruction(`In ${Math.round(distanceToNextTurn)} meters, ${instruction}`);
          sendNotification('Turn ahead', instruction);
        }

        // Announce step change
        if (newStepIndex !== prev.currentStepIndex && newStepIndex < prev.steps.length) {
          const instruction = currentStep.instructions.replace(/<[^>]*>/g, '');
          speakInstruction(instruction);
        }

        return {
          ...prev,
          currentPosition: newPos,
          currentStepIndex: newStepIndex,
          distanceToNextTurn,
          totalRemainingDistance,
          currentSpeed,
          averageSpeed,
          eta,
          heading: position.coords.heading,
          offRoute,
        };
      });
    },
    [speakInstruction, sendNotification]
  );

  // Handle geolocation errors
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location error';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }
    
    setNavigation((prev) => ({ ...prev, error: errorMessage }));
    console.error('Navigation location error:', error);
  }, []);

  // Start navigation
  const startNavigation = useCallback(
    (steps: NavigationStep[], destination: Position) => {
      if (!navigator.geolocation) {
        setNavigation((prev) => ({
          ...prev,
          error: 'Geolocation not supported',
        }));
        return;
      }

      // Request notification permission
      requestNotificationPermission();

      // Reset state
      lastPositionRef.current = null;
      speedHistoryRef.current = [];
      lastNotificationStepRef.current = -1;

      setNavigation({
        isNavigating: true,
        currentPosition: null,
        currentStepIndex: 0,
        distanceToNextTurn: 0,
        totalRemainingDistance: steps.reduce((sum, step) => sum + step.distance.value, 0),
        currentSpeed: 0,
        averageSpeed: 0,
        eta: null,
        heading: null,
        offRoute: false,
        steps,
        destination,
        error: null,
      });

      // Start watching position with high accuracy
      watchIdRef.current = navigator.geolocation.watchPosition(
        processLocationUpdate,
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      // Initial announcement
      if (steps.length > 0) {
        const firstInstruction = steps[0].instructions.replace(/<[^>]*>/g, '');
        speakInstruction(`Navigation started. ${firstInstruction}`);
        sendNotification('Navigation started', firstInstruction);
      }
    },
    [processLocationUpdate, handleLocationError, speakInstruction, sendNotification, requestNotificationPermission]
  );

  // Stop navigation
  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Cancel any speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    lastPositionRef.current = null;
    speedHistoryRef.current = [];
    lastNotificationStepRef.current = -1;

    setNavigation({
      isNavigating: false,
      currentPosition: null,
      currentStepIndex: 0,
      distanceToNextTurn: 0,
      totalRemainingDistance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      eta: null,
      heading: null,
      offRoute: false,
      steps: [],
      destination: null,
      error: null,
    });

    sendNotification('Navigation stopped', 'You have ended navigation');
  }, [sendNotification]);

  // Acknowledge off-route warning
  const acknowledgeOffRoute = useCallback(() => {
    setNavigation((prev) => ({ ...prev, offRoute: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        navigation,
        startNavigation,
        stopNavigation,
        acknowledgeOffRoute,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
