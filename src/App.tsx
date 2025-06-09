// src/App.tsx
import './App.css';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <ChatView />
    </div>
  );
}

export default App;