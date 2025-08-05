// 📁 src/components/Sidebar.tsx
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../css/Sidebar.css';
import { FiEdit, FiSettings, FiLogOut, FiEdit2, FiTrash, FiX, FiTrash2 } from 'react-icons/fi';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { TbLayoutSidebarLeftCollapse } from 'react-icons/tb';
import { useSettings } from '../contexts/SettingsContext';
import { useChat } from '../contexts/ChatContext';
import ConfirmationModal from './ConfirmationModal';
import RenameModal from './RenameModal';
import Tooltip from './Tooltip';

import '../css/ConfirmationModal.css';
import '../css/RenameModal.css';

interface SidebarProps {
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar = ({ onOpenSettings, isMobileOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) => {
  const { user, logout } = useSettings();
  const { chatList, renameChat, deleteChat, clearAllChats, activeChatId, isLoadingChatList } = useChat();
  const navigate = useNavigate();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (isUserMenuOpen || openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, openMenuId]);
  
  const handleSettingsClick = () => {
    onOpenSettings();
    setIsUserMenuOpen(false);
    onClose();
  };
  
  const handleLogoutClick = () => {
    logout();
    setIsUserMenuOpen(false);
    onClose();
  };
  
  const handleNewChat = () => {
    navigate('/app');
    onClose();
  }
  
  const handleNavLinkClick = () => {
    onClose();
  }

  // --- START OF THE FIX ---
  const handleLogoLinkClick = (e: React.MouseEvent) => {
    // If the sidebar is collapsed, prevent the link from navigating.
    // The hover effect will reveal the expand button, which is the intended action.
    if (isCollapsed) {
      e.preventDefault();
      return;
    }
    // If not collapsed, perform the standard new chat/navigate action.
    handleNewChat();
  };
  // --- END OF THE FIX ---

  const openRenameModal = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat({ id: chatId, title: currentTitle });
    setRenameModalOpen(true);
    setOpenMenuId(null);
  };

  const openDeleteModal = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat({ id: chatId, title: '' });
    setDeleteModalOpen(true);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (activeChat) {
      await deleteChat(activeChat.id);
      if (activeChatId === activeChat.id) {
        navigate('/app');
      }
    }
    setDeleteModalOpen(false);
    setActiveChat(null);
    onClose();
  };

  const handleConfirmRename = async (newTitle: string) => {
    if (activeChat) {
      await renameChat(activeChat.id, newTitle);
    }
    setRenameModalOpen(false);
    setActiveChat(null);
  };

  const handleConfirmClearAll = async () => {
    await clearAllChats();
    setClearAllModalOpen(false);
    onClose();
    navigate('/app');
  };

  return (
    <>
      {isMobileOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-top">
          {/* --- START OF THE FIX --- */}
          {/* The NavLink now uses the conditional click handler */}
          <NavLink to="/app" className="sidebar-logo-link" onClick={handleLogoLinkClick}>
            <img src="/worksparkai.svg" alt="Workspark AI Logo" className="sidebar-logo" />
            <span className="sidebar-logo-text">Workspark AI</span>
          </NavLink>
          {/* --- END OF THE FIX --- */}
          
          <button className="sidebar-button collapse-button" onClick={onToggleCollapse}>
            <TbLayoutSidebarLeftCollapse size={20} />
          </button>
          
          <button className="sidebar-button mobile-close-button" onClick={onClose} aria-label="Close menu">
            <FiX size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <button className="sidebar-button new-chat-button" onClick={handleNewChat}>
                <FiEdit size={20} />
                <span>New Chat</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-conversations">
          <div className="convos-header">
            <span>Chats</span>
          </div>
          {isLoadingChatList ? (
            <div className="convo-list-loading">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="convo-list-item-skeleton" />
              ))}
            </div>
          ) : (
            <ul className="convo-list">
              {chatList.map((chat) => (
                <li key={chat._id}>
                  <NavLink to={`c/${chat._id}`} onClick={handleNavLinkClick}>
                    {chat.title || 'Untitled Chat'}
                  </NavLink>
                  <Tooltip text="More options">
                    <button
                      className={`chat-item-menu-trigger ${openMenuId === chat._id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === chat._id ? null : chat._id);
                      }}
                    >
                      <HiOutlineDotsHorizontal size={16} />
                    </button>
                  </Tooltip>
                  {openMenuId === chat._id && (
                    <div className="chat-item-actions-menu" ref={menuRef}>
                      <button className="menu-action-button" onClick={(e) => openRenameModal(e, chat._id, chat.title)}>
                        <FiEdit2 size={14} />
                        <span>Rename</span>
                      </button>
                      <button className="menu-action-button destructive" onClick={(e) => openDeleteModal(e, chat._id)}>
                        <FiTrash size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile-wrapper" ref={userMenuRef}>
            <div className={`user-profile-menu ${isUserMenuOpen ? 'open' : ''}`}>
               <button className="menu-button" onClick={handleSettingsClick}>
                  <FiSettings size={16} />
                  <span>Settings</span>
              </button>
              <button 
                className="menu-button destructive" 
                onClick={() => { setClearAllModalOpen(true); setIsUserMenuOpen(false); onClose(); }}
              >
                  <FiTrash2 size={16} />
                  <span>Clear conversations</span>
              </button>
              <div className="user-profile-menu-divider" />
              <button className="menu-button" onClick={handleLogoutClick} >
                  <FiLogOut size={18} />
                  <span>Logout</span>
              </button>
            </div>

            <div className="user-profile" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
              <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
              <span className="user-name">{user?.email || 'User'}</span>
              <button className="user-options-button">
                  <HiOutlineDotsHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Chat?"
        message="Are you sure you want to delete this chat? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
      />

      <ConfirmationModal
        isOpen={isClearAllModalOpen}
        onClose={() => setClearAllModalOpen(false)}
        onConfirm={handleConfirmClearAll}
        title="Clear All Conversations?"
        message="Are you sure you want to delete all of your chats? This action is permanent and cannot be undone."
        confirmText="Delete All"
        isDestructive={true}
      />

      {activeChat && (
        <RenameModal
          isOpen={isRenameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          onRename={handleConfirmRename}
          currentTitle={activeChat.title}
        />
      )}
    </>
  );
};

export default Sidebar;