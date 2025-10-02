 // src/components/GoogleMapsBlock.tsx
import { memo, useMemo, useState } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { FiMap } from 'react-icons/fi';
import type { GoogleMapsData } from '../types';
import '../css/AnalysisBlock.css'; // Re-using generic tool block styles
import '../css/GoogleMapsBlock.css'; // Specific map styles

interface GoogleMapsBlockProps {
  integrationData: GoogleMapsData;
}

const mapContainerStyle = {
  height: '100%',
  width: '100%',
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
};

// Polyline decoding function (Google's encoded polyline algorithm)
const decodePolyline = (encoded: string): google.maps.LatLngLiteral[] => {
  const poly: google.maps.LatLngLiteral[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
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

const GoogleMapsBlock = memo(({ integrationData }: GoogleMapsBlockProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const decodedPath = useMemo(() => {
    // Use our custom decoder if Google's geometry library isn't available
    if (window.google?.maps?.geometry?.encoding) {
      try {
        return window.google.maps.geometry.encoding.decodePath(integrationData.polyline);
      } catch (error) {
        console.warn('Failed to decode polyline with Google API, using fallback:', error);
      }
    }
    // Fallback to custom decoder
    return decodePolyline(integrationData.polyline);
  }, [integrationData.polyline, isLoaded]);

  const mapBounds = useMemo(() => {
    if (!window.google?.maps?.LatLngBounds) return null;
    return new window.google.maps.LatLngBounds(
      integrationData.bounds.southwest,
      integrationData.bounds.northeast
    );
  }, [integrationData.bounds, isLoaded]);

  return (
    <div className="tool-block-container maps-container state-completed">
      <div className="tool-block-header" style={{ cursor: 'default' }}>
        <div className="status">
          <div className="status-icon-wrapper"><FiMap /></div>
          <span>Google Maps Directions</span>
        </div>
      </div>
      <div className="tool-block-content expanded" style={{ maxHeight: '1000px', opacity: 1, paddingBottom: '16px' }}>
        <LoadScript
          googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
          libraries={['geometry']}
          onLoad={() => setIsLoaded(true)}
        >
          <div className="maps-map-wrapper">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              options={mapOptions}
              onLoad={(map) => {
                if (mapBounds) {
                  map.fitBounds(mapBounds);
                } else {
                  // Fallback: center on start location
                  map.setCenter(integrationData.start);
                  map.setZoom(13);
                }
              }}
            >
              <Marker position={integrationData.start} label="A" />
              <Marker position={integrationData.end} label="B" />
              {decodedPath.length > 0 && (
                <Polyline
                  path={decodedPath}
                  options={{
                    strokeColor: '#4285F4',
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
                  }}
                />
              )}
            </GoogleMap>
          </div>
        </LoadScript>
        <div className="maps-info">
          <strong>From:</strong> {integrationData.start.address}<br/>
          <strong>To:</strong> {integrationData.end.address}
        </div>
      </div>
    </div>
  );
});

export default GoogleMapsBlock;