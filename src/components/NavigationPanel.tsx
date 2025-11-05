// src/components/NavigationPanel.tsx
import { memo } from 'react';
import { FiNavigation, FiClock, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useNavigation } from '../contexts/NavigationContext';
import {
  formatDistance,
  formatSpeed,
  formatETA,
  getTurnDirection,
  cleanInstruction,
} from '../utils/navigationHelpers';
import '../css/NavigationPanel.css';

const NavigationPanel = memo(() => {
  const { navigation, stopNavigation, acknowledgeOffRoute } = useNavigation();

  if (!navigation.isNavigating) return null;

  const currentStep = navigation.steps[navigation.currentStepIndex];
  const isLastStep = navigation.currentStepIndex >= navigation.steps.length - 1;
  
  if (!currentStep) return null;

  const turnInfo = getTurnDirection(currentStep.maneuver);
  const instruction = cleanInstruction(currentStep.instructions);

  return (
    <div className="navigation-panel">
      {/* Off-route warning */}
      {navigation.offRoute && (
        <div className="off-route-warning">
          <FiAlertTriangle />
          <span>You appear to be off route</span>
          <button
            className="off-route-dismiss"
            onClick={acknowledgeOffRoute}
            aria-label="Dismiss warning"
          >
            <FiX />
          </button>
        </div>
      )}

      {/* Current instruction */}
      <div className="nav-instruction-container">
        <div className="nav-turn-icon" aria-label={turnInfo.text}>
          {turnInfo.icon}
        </div>
        <div className="nav-instruction-details">
          <div className="nav-instruction-text">{instruction}</div>
          <div className="nav-distance-to-turn">
            {isLastStep
              ? 'Arriving at destination'
              : `in ${formatDistance(navigation.distanceToNextTurn)}`}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="nav-stats-bar">
        <div className="nav-stat">
          <FiNavigation className="nav-stat-icon" />
          <div className="nav-stat-content">
            <div className="nav-stat-label">Speed</div>
            <div className="nav-stat-value">
              {formatSpeed(navigation.currentSpeed)}
            </div>
          </div>
        </div>

        <div className="nav-stat">
          <FiClock className="nav-stat-icon" />
          <div className="nav-stat-content">
            <div className="nav-stat-label">ETA</div>
            <div className="nav-stat-value">
              {navigation.eta ? formatETA(navigation.eta) : '--:--'}
            </div>
          </div>
        </div>

        <div className="nav-stat">
          <div className="nav-stat-content">
            <div className="nav-stat-label">Remaining</div>
            <div className="nav-stat-value">
              {formatDistance(navigation.totalRemainingDistance)}
            </div>
          </div>
        </div>
      </div>

      {/* Stop navigation button */}
      <button
        className="nav-stop-button"
        onClick={stopNavigation}
        aria-label="Stop navigation"
      >
        <div className="nav-stop-icon">
          <div className="nav-stop-square"></div>
        </div>
        <span>Stop Navigation</span>
      </button>

      {/* Progress indicator */}
      <div className="nav-progress-container">
        <div className="nav-progress-info">
          <span>Step {navigation.currentStepIndex + 1} of {navigation.steps.length}</span>
        </div>
        <div className="nav-progress-bar">
          <div
            className="nav-progress-fill"
            style={{
              width: `${((navigation.currentStepIndex + 1) / navigation.steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Error display */}
      {navigation.error && (
        <div className="nav-error">
          <FiAlertTriangle />
          <span>{navigation.error}</span>
        </div>
      )}
    </div>
  );
});

NavigationPanel.displayName = 'NavigationPanel';

export default NavigationPanel;
