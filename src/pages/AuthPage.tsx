// src/pages/AuthPage.tsx
import { useState, type FormEvent, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import '../css/AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, isAuthenticated } = useSettings();
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      // Redirect handled by router
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    }
  };

  const handleToggleForm = () => {
    setError(''); // Clear errors on toggle
    setIsFading(true);
    setTimeout(() => {
      setIsLogin(prev => !prev);
      setIsFading(false);
    }, 300); // This duration should match the CSS transition
  };

  return (
    <div className="auth-container">
      {/* --- Animated Background Elements --- */}
      <div className="auth-background">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>
      
      <div className={`auth-form-wrapper ${isFading ? 'fading' : ''}`}>
        <h1 className="auth-title">FexoAI</h1>
        <h2 className="auth-subtitle">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <div className="auth-form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-button">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="auth-toggle">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button onClick={handleToggleForm}>
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;