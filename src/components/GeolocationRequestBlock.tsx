// src/components/GeolocationRequestBlock.tsx
import { memo, useState } from 'react';
import { FiMapPin, FiLoader } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import type { Message } from '../types';
import '../css/AnalysisBlock.css'; // Re-using generic tool block styles
import '../css/GeolocationRequestBlock.css';

interface GeolocationRequestBlockProps {
  toolMessage: Message;
}

const GeolocationRequestBlock = memo(({ toolMessage }: GeolocationRequestBlockProps) => {
  const { sendGeolocationResult, activeChatId } = useChat();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: 'Geolocation not supported by client.' });
      return;
    }
    
    setIsPending(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendGeolocationResult(activeChatId!, toolMessage.tool_id!, {
          coordinates: { latitude, longitude }
        });
      },
      (geoError) => {
        let errorMessage = 'An unknown error occurred.';
        switch(geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorMessage = "You denied the request for Geolocation.";
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case geoError.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        }
        setError(errorMessage);
        sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: errorMessage });
        setIsPending(false);
      }
    );
  };

  const handleDeny = () => {
    const errorMessage = "User denied geolocation access.";
    setError(errorMessage);
    sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: errorMessage });
  };

  return (
    <div className="tool-block-container request-container state-pending">
      <div className="tool-block-header">
        <div className="status">
          <div className="status-icon-wrapper"><FiMapPin /></div>
          <span>Location Permission Required</span>
        </div>
      </div>
      <div className="tool-block-content expanded" style={{ maxHeight: '1000px', opacity: 1, paddingBottom: '16px' }}>
        <div className="request-content">
          <p>Workspark AI needs your location to provide directions.</p>
          {error && <p className="request-error">{error}</p>}

          {isPending ? (
            <div className="request-pending">
              <FiLoader className="spinner-icon" />
              <span>Waiting for location...</span>
            </div>
          ) : (
            !error && (
              <div className="request-actions">
                <button className="request-button deny-button" onClick={handleDeny}>Deny</button>
                <button className="request-button allow-button" onClick={handleAllow}>Allow</button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

export default GeolocationRequestBlock;