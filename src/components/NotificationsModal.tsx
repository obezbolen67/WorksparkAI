// FexoApp/src/components/NotificationsModal.tsx
import { useState, useEffect } from 'react';
import { FiBell, FiClock, FiCheckCircle, FiTrash2, FiX, FiCalendar } from 'react-icons/fi';
import Portal from './Portal';
import { getTasks, deleteTask, type ScheduledTask } from '../utils/scheduler';
import '../css/NotificationsModal.css';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal = ({ isOpen, onClose }: NotificationsModalProps) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'completed'>('scheduled');
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);

  const refreshTasks = () => {
    const allTasks = getTasks();
    // Auto-move past scheduled tasks to completed if time has passed
    const now = Date.now();
    let updated = false;
    
    const processedTasks = allTasks.map(t => {
      if (t.status === 'scheduled' && t.scheduledTime < now) {
        updated = true;
        return { ...t, status: 'completed' as const };
      }
      return t;
    });

    if (updated) {
      // We don't save back to localStorage here to avoid side-effects during render,
      // but ideally, the system should update status on trigger.
      setTasks(processedTasks);
    } else {
      setTasks(allTasks);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshTasks();
    }
    
    // Listen for updates from other parts of the app
    const handleUpdate = () => refreshTasks();
    window.addEventListener('fexo-tasks-updated', handleUpdate);
    
    // Refresh interval to update "time remaining" or move to completed
    const interval = setInterval(refreshTasks, 30000);
    
    return () => {
      window.removeEventListener('fexo-tasks-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTasks = tasks
    .filter(t => activeTab === 'scheduled' ? t.status === 'scheduled' : t.status === 'completed')
    .sort((a, b) => b.scheduledTime - a.scheduledTime); // Newest first

  const handleDelete = (id: string) => {
    deleteTask(id);
    refreshTasks();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Portal>
      <div className="notifications-modal-overlay" onClick={onClose}>
        <div className="notifications-modal-content" onClick={e => e.stopPropagation()}>
          
          {/* Sidebar */}
          <aside className="notif-sidebar">
            <div className="notif-header">
              <h2><FiBell /> <span>Notifications</span></h2>
            </div>
            <nav className="notif-tabs">
              <button 
                className={`notif-tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
                onClick={() => setActiveTab('scheduled')}
              >
                <FiClock /> Scheduled
                <span className="notif-count-badge">
                  {tasks.filter(t => t.status === 'scheduled').length}
                </span>
              </button>
              <button 
                className={`notif-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                <FiCheckCircle /> Completed
                <span className="notif-count-badge">
                  {tasks.filter(t => t.status === 'completed').length}
                </span>
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="notif-main">
            <header className="notif-main-header">
              <h3>{activeTab === 'scheduled' ? 'Upcoming Tasks' : 'Task History'}</h3>
              <button className="close-modal-btn" onClick={onClose}>
                <FiX size={20} />
              </button>
            </header>

            <div className="notif-list">
              {filteredTasks.length === 0 ? (
                <div className="notif-empty">
                  {activeTab === 'scheduled' ? <FiClock /> : <FiCheckCircle />}
                  <p>No {activeTab} tasks found.</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div key={task.id} className="task-card">
                    <div className="task-info">
                      <h4>{task.title}</h4>
                      <p className="task-desc">{task.description}</p>
                      <div className="task-meta">
                        <span className="task-time">
                          <FiCalendar size={12} /> 
                          {formatTime(task.scheduledTime)}
                        </span>
                        {task.status === 'completed' && (
                          <span className="status-completed">Completed</span>
                        )}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button 
                        className="task-action-btn delete" 
                        onClick={() => handleDelete(task.id)}
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>

        </div>
      </div>
    </Portal>
  );
};

export default NotificationsModal;