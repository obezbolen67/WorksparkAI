// src/components/GoogleMapsBlock.tsx
import { memo, useMemo, useState, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker, Polyline, TrafficLayer } from '@react-google-maps/api';
import { FiMap, FiNavigation, FiClock, FiMapPin, FiMaximize2, FiMinimize2, FiLayers, FiEye, FiNavigation2, FiAlertTriangle, FiPlay } from 'react-icons/fi';
import type { GoogleMapsData } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import NavigationPanel from './NavigationPanel';
import type { NavigationStep } from '../utils/navigationHelpers';
import '../css/AnalysisBlock.css';
import '../css/GoogleMapsBlock.css';

interface GoogleMapsBlockProps {
  integrationData: GoogleMapsData;
}

// Use a stable superset of libraries to avoid reloading the script with different URLs across routes
const LIBRARIES: ("geometry" | "places" | "drawing" | "visualization" | "marker")[] = ['geometry', 'places', 'marker'];

const mapContainerStyle = {
  height: '100%',
  width: '100%',
};

type MapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

const CIRCLE_MARKER_ICON_START = {
  path: 0, // google.maps.SymbolPath.CIRCLE
  scale: 10,
  fillColor: "#4285F4",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 2,
};

const CIRCLE_MARKER_ICON_END = {
  path: 0, // google.maps.SymbolPath.CIRCLE
  scale: 10,
  fillColor: "#EA4335",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 2,
};

// This function is kept as a fallback in case the Google geometry library isn't loaded yet
const decodePolyline = (encoded: string): google.maps.LatLngLiteral[] => {
  const poly: google.maps.LatLngLiteral[] = [];
  let index = 0, len = encoded.length, lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
};

// User position marker icon
const USER_POSITION_ICON = {
  path: 0, // google.maps.SymbolPath.CIRCLE
  scale: 12,
  fillColor: "#4285F4",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 3,
};

// Inner component that actually loads Maps JS API. We only mount this when a valid key is available
// to prevent duplicate API script loads (root cause of the prod errors seen).
const GoogleMapsInner = memo(({ 
  integrationData,
  mapType,
  showTraffic,
  showStreetView,
  mapsApiKey,
  onMapLoad,
  userPosition,
}: {
  integrationData: GoogleMapsData;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showTraffic: boolean;
  showStreetView: boolean;
  mapsApiKey: string;
  onMapLoad: (map: google.maps.Map) => void;
  userPosition: { lat: number; lng: number } | null;
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: mapsApiKey,
    libraries: LIBRARIES,
    preventGoogleFontsLoading: true,
    id: 'google-maps-script',
  });

  const decodedPath = useMemo(() => {
    if (!isLoaded || !integrationData.polyline || typeof window.google === 'undefined') return [];
    if (window.google?.maps?.geometry?.encoding) {
      try {
        return window.google.maps.geometry.encoding.decodePath(integrationData.polyline);
      } catch (error) {}
    }
    return decodePolyline(integrationData.polyline);
  }, [integrationData.polyline, isLoaded]);

  const mapBounds = useMemo(() => {
    if (!isLoaded || typeof window.google === 'undefined' || !window.google.maps.LatLngBounds) return null;
    return new window.google.maps.LatLngBounds(
      integrationData.bounds.southwest,
      integrationData.bounds.northeast
    );
  }, [integrationData.bounds, isLoaded]);

  const handleMapLoadInner = useCallback((map: google.maps.Map) => {
    if (mapBounds) map.fitBounds(mapBounds);
    else map.setCenter(integrationData.start);
    onMapLoad(map);
  }, [mapBounds, integrationData.start, onMapLoad]);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: mapType,
    gestureHandling: 'greedy',
    styles: mapType === 'roadmap' ? [{
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'on' }]
    }] : undefined,
  }), [mapType]);

  if (loadError) {
    return (
      <div className="maps-error-state">
        <FiAlertTriangle size={24} />
        <p><strong>Map Loading Error</strong></p>
        <p>Failed to load Google Maps. Please check your API key and browser console.</p>
      </div>
    );
  }
  if (!isLoaded || typeof window.google === 'undefined' || !window.google.maps) {
    return <div className="maps-loading-state">Initializing Map...</div>;
  }

  if (showStreetView) {
    return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        options={mapOptions}
        onLoad={(map) => {
          const panorama = new window.google.maps.StreetViewPanorama(
            map.getDiv(),
            {
              position: integrationData.start,
              pov: { heading: 0, pitch: 0 },
              visible: true,
              enableCloseButton: false,
              fullscreenControl: false,
            }
          );
          map.setStreetView(panorama);
        }}
      />
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      options={mapOptions}
      onLoad={handleMapLoadInner}
    >
      {/* TODO: migrate to AdvancedMarkerElement in a follow-up */}
      <Marker
        position={integrationData.start}
        label={{ text: "A", color: "white", fontSize: "14px", fontWeight: "bold" }}
        icon={CIRCLE_MARKER_ICON_START}
      />
      <Marker
        position={integrationData.end}
        label={{ text: "B", color: "white", fontSize: "14px", fontWeight: "bold" }}
        icon={CIRCLE_MARKER_ICON_END}
      />
      {decodedPath.length > 0 && (
        <Polyline
          path={decodedPath}
          options={{
            strokeColor: '#4285F4',
            strokeOpacity: 0.9,
            strokeWeight: 5,
          }}
        />
      )}
      {showTraffic && <TrafficLayer />}
      {/* User position marker when navigating */}
      {userPosition && (
        <Marker
          position={userPosition}
          icon={USER_POSITION_ICON}
          zIndex={1000}
        />
      )}
    </GoogleMap>
  );
});
GoogleMapsInner.displayName = 'GoogleMapsInner';

const GoogleMapsBlock = memo(({ integrationData }: GoogleMapsBlockProps) => {
  const [mapType, setMapType] = useState<MapType>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);

  // Navigation integration
  const { navigation, startNavigation } = useNavigation();

  // Get Maps API key directly from Vite env (baked in at build time)
  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  // Keep a hook for future map interactions (e.g., migrating to Advanced Markers)
  const handleMapLoad = useCallback((_map: google.maps.Map) => {
    // no-op for now
  }, []);

  // Handle start navigation button
  const handleStartNavigation = useCallback(() => {
    const steps: NavigationStep[] = integrationData.steps.map((step: any) => ({
      instructions: step.html_instructions || step.instructions,
      distance: step.distance,
      duration: step.duration,
      start_location: step.start_location,
      end_location: step.end_location,
      maneuver: step.maneuver,
    }));

    startNavigation(steps, integrationData.end);
  }, [integrationData, startNavigation]);
  
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const toggleStreetView = () => setShowStreetView(!showStreetView);

  const cycleMapType = () => {
    const types: MapType[] = ['roadmap', 'satellite', 'hybrid', 'terrain'];
    setMapType(prev => types[(types.indexOf(prev) + 1) % types.length]);
  };
  
  const getMapTypeLabel = () => ({ 
    roadmap: 'Road', 
    satellite: 'Satellite', 
    hybrid: 'Hybrid', 
    terrain: 'Terrain' 
  }[mapType] || 'Map');
  
  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${integrationData.start.lat},${integrationData.start.lng}&destination=${integrationData.end.lat},${integrationData.end.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  // Map options are computed inside the inner component

  const routeInfo = useMemo(() => ({
    distance: integrationData.distance?.text || '...',
    duration: integrationData.duration?.text || '...',
    steps: integrationData.steps || []
  }), [integrationData]);

  // Map rendering is handled by the inner component
  
  return (
    <div className={`tool-block-container maps-container state-completed ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="tool-block-header" style={{ cursor: 'default' }}>
        <div className="status">
          <div className="status-icon-wrapper"><FiMap /></div>
          <span>Directions</span>
        </div>
        <div className="maps-controls">
          <button 
            className="map-control-btn" 
            onClick={cycleMapType} 
            title={`Map Type: ${getMapTypeLabel()}`}
            aria-label={`Map Type: ${getMapTypeLabel()}`}
          >
            <FiLayers />
            <span>{getMapTypeLabel()}</span>
          </button>
          <button 
            className={`map-control-btn ${showTraffic ? 'active' : ''}`} 
            onClick={() => setShowTraffic(!showTraffic)} 
            title="Toggle Traffic"
            aria-label="Toggle Traffic"
          >
            <FiNavigation2 />
            <span>Traffic</span>
          </button>
          <button 
            className={`map-control-btn ${showStreetView ? 'active' : ''}`} 
            onClick={toggleStreetView} 
            title="Toggle Street View"
            aria-label="Toggle Street View"
          >
            <FiEye />
            <span>Street</span>
          </button>
          <button 
            className="map-control-btn" 
            onClick={toggleFullscreen} 
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>
        </div>
      </div>
      
      <div className="tool-block-content expanded">
        <div className="maps-layout">
          <div className={`maps-map-wrapper ${isFullscreen ? 'fullscreen-map' : ''}`}>
            {!mapsApiKey ? (
              <div className="maps-loading-state">Loading Maps API key...</div>
            ) : (
              <GoogleMapsInner
                integrationData={integrationData}
                mapType={mapType}
                showTraffic={showTraffic}
                showStreetView={showStreetView}
                mapsApiKey={mapsApiKey}
                onMapLoad={handleMapLoad}
                userPosition={navigation.currentPosition}
              />
            )}
          </div>
          <div className="maps-info-panel">
            {/* Live Navigation Panel */}
            {navigation.isNavigating ? (
              <NavigationPanel />
            ) : (
              <>
                {/* Start Navigation Button */}
                {routeInfo.steps.length > 0 && (
                  <button 
                    className="start-navigation-btn" 
                    onClick={handleStartNavigation}
                    aria-label="Start live navigation"
                  >
                    <FiPlay />
                    <span>Start Live Navigation</span>
                  </button>
                )}
                
                <div className="maps-route-summary">
                  <div className="route-info-item">
                    <FiNavigation className="route-icon" />
                    <div>
                      <div className="route-label">Distance</div>
                      <div className="route-value">{routeInfo.distance}</div>
                    </div>
                  </div>
                  <div className="route-info-item">
                    <FiClock className="route-icon" />
                    <div>
                      <div className="route-label">Duration</div>
                      <div className="route-value">{routeInfo.duration}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <div className="maps-locations">
              <div className="location-item start">
                <div className="location-marker">A</div>
                <div className="location-details">
                  <div className="location-label">From</div>
                  <div className="location-address">{integrationData.start.address}</div>
                </div>
              </div>
              <div className="location-divider"></div>
              <div className="location-item end">
                <div className="location-marker">B</div>
                <div className="location-details">
                  <div className="location-label">To</div>
                  <div className="location-address">{integrationData.end.address}</div>
                </div>
              </div>
            </div>
            
            {routeInfo.steps.length > 0 && (
              <div className="maps-directions">
                <div className="directions-header">Step-by-step Directions</div>
                <div className="directions-list">
                  {routeInfo.steps.map((step: any, index: number) => (
                    <div key={index} className="direction-step">
                      <div className="step-number">{index + 1}</div>
                      <div className="step-content">
                        <div className="step-instruction" dangerouslySetInnerHTML={{ __html: step.instructions }} />
                        <div className="step-distance">{step.distance?.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button className="open-in-maps-btn" onClick={openInGoogleMaps}>
              <FiMapPin /> Open in Google Maps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

GoogleMapsBlock.displayName = 'GoogleMapsBlock';

export default GoogleMapsBlock;