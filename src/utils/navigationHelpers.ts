// src/utils/navigationHelpers.ts

/**
 * Navigation utility functions for live turn-by-turn guidance
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface NavigationStep {
  instructions: string;
  distance: { text: string; value: number };
  duration?: { text: string; value: number };
  start_location: Position;
  end_location: Position;
  maneuver?: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (pos1.lat * Math.PI) / 180;
  const φ2 = (pos2.lat * Math.PI) / 180;
  const Δφ = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const Δλ = ((pos2.lng - pos1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate bearing from pos1 to pos2 in degrees (0-360)
 */
export function calculateBearing(pos1: Position, pos2: Position): number {
  const φ1 = (pos1.lat * Math.PI) / 180;
  const φ2 = (pos2.lat * Math.PI) / 180;
  const Δλ = ((pos2.lng - pos1.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  return bearing;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Determine turn direction from maneuver string
 */
export function getTurnDirection(maneuver?: string): {
  icon: string;
  text: string;
} {
  if (!maneuver) {
    return { icon: '⬆️', text: 'Continue' };
  }

  const lower = maneuver.toLowerCase();
  
  if (lower.includes('left')) {
    if (lower.includes('slight')) return { icon: '↖️', text: 'Slight left' };
    if (lower.includes('sharp')) return { icon: '↰', text: 'Sharp left' };
    return { icon: '⬅️', text: 'Turn left' };
  }
  
  if (lower.includes('right')) {
    if (lower.includes('slight')) return { icon: '↗️', text: 'Slight right' };
    if (lower.includes('sharp')) return { icon: '↱', text: 'Sharp right' };
    return { icon: '➡️', text: 'Turn right' };
  }
  
  if (lower.includes('u-turn') || lower.includes('uturn')) {
    return { icon: '↩️', text: 'U-turn' };
  }
  
  if (lower.includes('merge')) {
    return { icon: '🔀', text: 'Merge' };
  }
  
  if (lower.includes('roundabout') || lower.includes('rotary')) {
    return { icon: '🔄', text: 'Roundabout' };
  }
  
  if (lower.includes('ramp')) {
    return { icon: '↗️', text: 'Take ramp' };
  }
  
  if (lower.includes('fork')) {
    return { icon: '↕️', text: 'Fork' };
  }

  return { icon: '⬆️', text: 'Continue' };
}

/**
 * Extract clean instruction text from HTML
 */
export function cleanInstruction(htmlInstruction: string): string {
  const div = document.createElement('div');
  div.innerHTML = htmlInstruction;
  return div.textContent || div.innerText || '';
}

/**
 * Find current step based on user's position
 */
export function findCurrentStep(
  userPos: Position,
  steps: NavigationStep[],
  currentStepIndex: number
): number {
  // If we're at the last step, stay there
  if (currentStepIndex >= steps.length - 1) {
    return currentStepIndex;
  }

  // Check if we've passed the current step's end location
  const currentStep = steps[currentStepIndex];
  const distanceToStepEnd = calculateDistance(userPos, currentStep.end_location);
  
  // If within 30 meters of step end, move to next step
  if (distanceToStepEnd < 30) {
    return Math.min(currentStepIndex + 1, steps.length - 1);
  }

  return currentStepIndex;
}

/**
 * Check if user is off route
 * Returns true if user is more than 50 meters from the route
 */
export function isOffRoute(
  userPos: Position,
  currentStep: NavigationStep,
  nextStep?: NavigationStep
): boolean {
  const distanceToStepStart = calculateDistance(userPos, currentStep.start_location);
  const distanceToStepEnd = calculateDistance(userPos, currentStep.end_location);
  
  // Check if we're reasonably close to either the start or end of current step
  if (distanceToStepStart < 50 || distanceToStepEnd < 50) {
    return false;
  }

  // Check next step if available
  if (nextStep) {
    const distanceToNextStart = calculateDistance(userPos, nextStep.start_location);
    if (distanceToNextStart < 50) {
      return false;
    }
  }

  // Calculate perpendicular distance to the line between start and end
  // If user is more than 50m perpendicular to the route, they're off route
  const distanceAlongRoute = distanceToStepEnd;
  return distanceAlongRoute > 50;
}

/**
 * Determine notification trigger distance based on speed
 * Returns distance in meters at which to trigger turn notification
 */
export function getNotificationDistance(speedMps: number): number {
  // At low speeds (walking/slow traffic), notify 50m before
  if (speedMps < 5) return 50;
  
  // At moderate speeds (city driving), notify 100m before
  if (speedMps < 15) return 100;
  
  // At high speeds (highway), notify 300m before
  return 300;
}

/**
 * Calculate estimated time of arrival
 */
export function calculateETA(
  remainingDistance: number,
  averageSpeedMps: number
): Date {
  const remainingSeconds = remainingDistance / (averageSpeedMps || 1);
  return new Date(Date.now() + remainingSeconds * 1000);
}

/**
 * Format ETA for display
 */
export function formatETA(eta: Date): string {
  const hours = eta.getHours();
  const minutes = eta.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Calculate speed from position updates
 */
export function calculateSpeed(
  prevPos: Position,
  currentPos: Position,
  timeDeltaMs: number
): number {
  const distance = calculateDistance(prevPos, currentPos);
  const timeDeltaSec = timeDeltaMs / 1000;
  return timeDeltaSec > 0 ? distance / timeDeltaSec : 0;
}

/**
 * Format speed for display
 */
export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return `${Math.round(kmh)} km/h`;
}
