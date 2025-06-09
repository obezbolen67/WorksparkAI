import type { Message } from '../types';
import './ChatMessage.css';
import { RiRobot2Fill } from "react-icons/ri";

const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-message-container">
        <div className="avatar">
          {isUser ? 'PL' : <RiRobot2Fill size={24} />}
        </div>
        <div className="message-content">
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;