// src/components/GeolocationBlock.tsx
import { useMemo, memo } from 'react';
import { FiMapPin } from 'react-icons/fi';
import type { Message } from '../types';
import '../css/GeolocationBlock.css';
import '../css/SearchBlock.css'; // Re-use common styles

interface GeolocationBlockProps {
  toolMessage: Message;
  outputMessage?: Message;
}

type ParsedLocation = {
  lat: string;
  lon: string;
  title: string;
};

const GeolocationBlock = memo(({ outputMessage }: GeolocationBlockProps) => {
  const output = outputMessage?.content || '';

  const location = useMemo((): ParsedLocation | null => {
    if (!output.includes('[LOCATION]')) return null;
    const match = /\[LOCATION lat="([^"]+)" lon="([^"]+)" title="([^"]+)"\]/g.exec(output);
    if (!match) return null;
    return { lat: match[1], lon: match[2], title: match[3] };
  }, [output]);

  if (!location) {
    return null;
  }
  
  const mapUrl = `https://www.google.com/maps?q=${location.lat},${location.lon}&hl=en&z=14&output=embed`;

  return (
    <div className="tool-block-container geolocation-container">
        <div className="tool-block-header">
            <div className="status">
                <div className="status-icon-wrapper"><FiMapPin /></div>
                <span>Location: {location.title}</span>
            </div>
        </div>
        <div className="geolocation-map-wrapper">
            <iframe
                title={`Map of ${location.title}`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={mapUrl}>
            </iframe>
        </div>
    </div>
  );
});

export default GeolocationBlock;