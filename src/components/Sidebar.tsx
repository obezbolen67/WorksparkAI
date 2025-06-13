// 📁 src/components/Sidebar.tsx
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../css/Sidebar.css';
// --- UPDATED: Added FiTrash2 for the "Clear all" button ---
import { FiEdit, FiSettings, FiLogOut, FiEdit2, FiTrash, FiX, FiTrash2 } from 'react-icons/fi';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { TbLayoutSidebarLeftCollapse } from 'react-icons/tb';
import { useSettings } from '../contexts/SettingsContext';
import { useChat } from '../contexts/ChatContext';
import ConfirmationModal from './ConfirmationModal';
import RenameModal from './RenameModal';
import Tooltip from './Tooltip'; // <-- ADDED

// Add new component imports and their CSS
import '../css/ConfirmationModal.css';
import '../css/RenameModal.css';

interface SidebarProps {
  onOpenSettings: () => void;
  // --- NEW PROPS FOR MOBILE ---
  isMobileOpen: boolean;
  onClose: () => void;
  // --- NEW PROPS FOR COLLAPSE ---
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar = ({ onOpenSettings, isMobileOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) => {
  const { user, logout } = useSettings();
  const { chatList, renameChat, deleteChat, clearAllChats, activeChatId, isLoadingChatList } = useChat();
  const navigate = useNavigate();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // --- NEW: State for chat item context menu ---
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // State for modals
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [isRenameModalOpen, setRenameModalOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close user menu
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      // --- NEW: Close chat item menu ---
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    // Add listener only when a menu is open
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
    onClose(); // Close sidebar on mobile
  };
  
  const handleLogoutClick = () => {
    logout();
    setIsUserMenuOpen(false);
    onClose(); // Close sidebar on mobile
  };
  
  // --- NEW: Close sidebar when navigating on mobile ---
  const handleNewChat = () => {
    navigate('/');
    onClose();
  }
  
  const handleNavLinkClick = () => {
    onClose();
  }

  const openRenameModal = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat({ id: chatId, title: currentTitle });
    setRenameModalOpen(true);
    setOpenMenuId(null); // Close context menu
  };

  const openDeleteModal = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat({ id: chatId, title: '' }); // title not needed for delete
    setDeleteModalOpen(true);
    setOpenMenuId(null); // Close context menu
  };

  const handleConfirmDelete = async () => {
    if (activeChat) {
      await deleteChat(activeChat.id);
      // If we deleted the current chat on mobile, navigate to home and close sidebar
      if (activeChatId === activeChat.id) {
        navigate('/');
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
    onClose(); // Close sidebar on mobile
    navigate('/');
  };

  return (
    <>
      {/* --- NEW: Overlay for mobile --- */}
      {isMobileOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      {/* Conditionally add 'mobile-open' and 'is-collapsed' classes */}
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-top">
          {/* --- NEW: Close button for mobile --- */}
          <button className="sidebar-button mobile-close-button" onClick={onClose} aria-label="Close menu">
            <FiX size={24} />
          </button>
          {/* --- UPDATED: Collapse button is now functional --- */}
          <button className="sidebar-button collapse-button" onClick={onToggleCollapse}>
            <TbLayoutSidebarLeftCollapse size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              {/* Use the new handler */}
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
                  {/* Use the new handler */}
                  <NavLink to={`/c/${chat._id}`} onClick={handleNavLinkClick}>
                    {chat.title || 'Untitled Chat'}
                  </NavLink>
                  {/* --- UPDATED: Dots menu trigger with Tooltip (className removed) --- */}
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
                  {/* --- UPDATED: Context Menu --- */}
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

      {/* Render Modals */}
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