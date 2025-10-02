// src/components/GeolocationRequestBlock.tsx
import { memo, useState } from 'react';
import { FiMapPin, FiLoader } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import type { Message } from '../types';
import '../css/GeolocationRequestBlock.css'; // Import the new styles

interface GeolocationRequestBlockProps {
  toolMessage: Message;
}

const GeolocationRequestBlock = memo(({ toolMessage }: GeolocationRequestBlockProps) => {
  const { sendGeolocationResult, activeChatId } = useChat();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAllow = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
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
        // The block will disappear automatically when the result is sent and state updates
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
        setIsSubmitting(false);
      }
    );
  };

  const handleDeny = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const errorMessage = "User denied geolocation access.";
    setError(errorMessage);
    sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: errorMessage });
  };

  return (
    <div className="geolocation-request-container">
      <div className="geolocation-request-header">
        <FiMapPin className="icon" />
        <span>Location Permission Required</span>
      </div>
      <div className="geolocation-request-body">
        <p>Workspark AI needs your location to provide directions.</p>
        {error && <p className="request-error">{error}</p>}

        {isPending || isSubmitting ? (
          <div className="request-pending">
            <FiLoader className="spinner-icon" />
            <span>Waiting for location...</span>
          </div>
        ) : (
          <div className="request-actions">
            <button className="request-button deny-button" onClick={handleDeny}>Deny</button>
            <button className="request-button allow-button" onClick={handleAllow}>Allow</button>
          </div>
        )}
      </div>
    </div>
  );
});

export default GeolocationRequestBlock;