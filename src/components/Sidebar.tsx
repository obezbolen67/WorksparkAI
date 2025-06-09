import '../css/Sidebar.css';
import { FiEdit, FiSearch } from 'react-icons/fi';
import { BiLibrary } from 'react-icons/bi';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { TbLayoutSidebarLeftCollapse } from 'react-icons/tb';

const Sidebar = () => {
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
          {/* Updated placeholder conversations */}
          <li><a href="#">Article: The Future of AI</a></li>
          <li><a href="#">Product Description Ideas</a></li>
          <li><a href="#">Social Media Post Draft</a></li>
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
            <div className="user-avatar">PL</div>
            <span className="user-name">Your Team</span>
            <button className="user-options-button">
                <HiOutlineDotsHorizontal size={20} />
            </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;