// src/components/Sidebar.tsx
import { useState, useRef, useEffect } from 'react';
import '../css/Sidebar.css';
import { FiEdit, FiSearch, FiSettings, FiLogOut } from 'react-icons/fi';
import { BiLibrary } from 'react-icons/bi';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { TbLayoutSidebarLeftCollapse } from 'react-icons/tb';
import { useSettings } from '../contexts/SettingsContext';

interface SidebarProps {
  onOpenSettings: () => void;
}

const Sidebar = ({ onOpenSettings }: SidebarProps) => {
  const { user, logout } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  const handleSettingsClick = () => {
    onOpenSettings();
    setIsMenuOpen(false);
  };
  
  const handleLogoutClick = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="sidebar-button">
          <TbLayoutSidebarLeftCollapse size={20} />
        </button>
        <button className="sidebar-button new-chat-button">
          <FiEdit size={20} />
          <span>New Chat</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li><button className="sidebar-button"><FiSearch size={20} /><span>Search</span></button></li>
          <li><button className="sidebar-button"><BiLibrary size={20} /><span>Library</span></button></li>
        </ul>
      </nav>

      <div className="sidebar-conversations">
        <div className="convos-header">
          <span>Recent</span>
        </div>
        <ul className="convo-list">
          <li><a href="#">Article: The Future of AI</a></li>
          <li><a href="#">Product Description Ideas</a></li>
          <li><a href="#">Social Media Post Draft</a></li>
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile-wrapper" ref={menuRef}>
          <div className={`user-profile-menu ${isMenuOpen ? 'open' : ''}`}>
             <button className="menu-button" onClick={handleSettingsClick}>
                <FiSettings size={18} />
                <span>Settings</span>
            </button>
            <button className="menu-button" onClick={handleLogoutClick}>
                <FiLogOut size={18} />
                <span>Logout</span>
            </button>
          </div>

          <div className="user-profile" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
            <span className="user-name">{user?.email || 'User'}</span>
            <button className="user-options-button">
                <HiOutlineDotsHorizontal size={20} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;