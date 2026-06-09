
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import coffeeSplash from '../assets/coffee_splash.png';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const res = await login(username, password);
        if (res.success) {
            navigate('/');
        } else {
            setError(res.message);
        }
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <img 
                        src={coffeeSplash} 
                        alt="CupfulCanvas Logo" 
                        style={{ 
                            width: '140px', 
                            height: '140px', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 8px 16px rgba(92, 61, 46, 0.12))',
                            borderRadius: '50%'
                        }} 
                    />
                </div>
                
                <h1 className="auth-title" style={{ fontSize: '2.1rem', margin: '4px 0' }}>CupfulCanvas</h1>
                <p className="auth-subtitle" style={{ fontSize: '0.85rem', margin: '0 0 24px 0', fontStyle: 'italic' }}>
                    Sip. Smile. Create.
                </p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-tan)' }}></div>
                    <span style={{ padding: '0 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OR SIGN IN WITH</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-tan)' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '8px' }}>
                    <button 
                        type="button" 
                        style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            border: '1.5px solid var(--border-tan)',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'var(--border-tan)'; }}
                        title="Google"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#EA4335" d="M12 5.04c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 1 12 1 7.3 1 3.3 3.7 1.4 7.6l3.9 3C6.2 7.7 8.9 5.04 12 5.04z" />
                            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.5H12v4.8h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                            <path fill="#FBBC05" d="M5.3 10.6c-.3-.9-.4-1.8-.4-2.7s.1-1.8.4-2.7L1.4 2.2C.5 4 .0 6 .0 8.1s.5 4.1 1.4 5.9l3.9-3.4z" />
                            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.6-6.7-5.5l-3.9 3C3.3 20.3 7.3 23 12 23z" />
                        </svg>
                    </button>
                    <button 
                        type="button" 
                        style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            border: '1.5px solid var(--border-tan)',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s',
                            color: '#3c2a21'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'var(--border-tan)'; }}
                        title="Apple"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.1.09 2.23-.58 2.95-1.39" />
                        </svg>
                    </button>
                </div>

                <div className="auth-footer" style={{ marginTop: '20px' }}>
                    Don't have an account?
                    <Link to="/signup" className="auth-link">Sign up</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
