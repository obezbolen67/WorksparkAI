// src/components/SuspensionBanner.tsx
import '../css/SuspensionBanner.css';
import { FiAlertTriangle } from 'react-icons/fi';

interface SuspensionBannerProps {
  onSeeMoreClick: () => void;
}

const SuspensionBanner = ({ onSeeMoreClick }: SuspensionBannerProps) => {
  return (
    <div className="suspension-banner">
      <div className="banner-content">
        <FiAlertTriangle className="banner-icon" />
        <span>My Freelancer.com account was suspended.</span>
      </div>
      <button className="banner-button" onClick={onSeeMoreClick}>
        See more
      </button>
    </div>
  );
};

export default SuspensionBanner;