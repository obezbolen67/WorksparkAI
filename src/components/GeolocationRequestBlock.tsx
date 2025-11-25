// src/components/GeolocationRequestBlock.tsx
import { memo, useState } from 'react';
import { FiMapPin, FiX, FiCheck } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import type { Message } from '../types';
import '../css/GeolocationRequestBlock.css';

interface GeolocationRequestBlockProps {
  toolMessage: Message;
}

const GeolocationRequestBlock = memo(({ toolMessage }: GeolocationRequestBlockProps) => {
  const { sendGeolocationResult, activeChatId } = useChat();
  // State to control visibility - defaults to true, becomes false immediately on interaction
  const [isVisible, setIsVisible] = useState(true);

  const handleAllow = () => {
    // 1. Hide the UI immediately
    setIsVisible(false);
    
    // 2. Perform logic in background
    if (!navigator.geolocation) {
      sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: 'Geolocation not supported by client.' });
      return;
    }
    
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
        sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: errorMessage });
      }
    );
  };

  const handleDeny = () => {
    // 1. Hide the UI immediately
    setIsVisible(false);
    
    // 2. Send denial to backend
    const errorMessage = "User denied geolocation access.";
    sendGeolocationResult(activeChatId!, toolMessage.tool_id!, { error: errorMessage });
  };

  // If the user has clicked a button, render nothing
  if (!isVisible) return null;

  return (
    <div className="geolocation-wrapper">
        {/* The text request bubble */}
        <div className="geo-content-card">
            <div className="geo-icon-circle">
                <FiMapPin size={16} />
            </div>
            <div className="geo-text-content">
                <span className="geo-text">The AI needs your location to provide directions.</span>
            </div>
        </div>

        {/* Buttons Row - Below the card */}
        <div className="geo-actions-row">
            <button className="geo-square-btn deny" onClick={handleDeny} aria-label="Deny">
                <FiX size={20} />
            </button>
            <button className="geo-square-btn allow" onClick={handleAllow} aria-label="Allow">
                <FiCheck size={20} />
            </button>
        </div>
    </div>
  );
});

export default GeolocationRequestBlock;