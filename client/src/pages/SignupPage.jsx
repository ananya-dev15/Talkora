
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import coffeeSplash from '../assets/coffee_splash.png';

const SignupPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const res = await signup(username, password);
        if (res.success) {
            navigate('/login');
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
                
                <h1 className="auth-title" style={{ fontSize: '2.1rem', margin: '4px 0' }}>Join CupfulCanvas</h1>
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
                            placeholder="Choose a username"
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
                            placeholder="Create a password"
                            required
                        />
                    </div>
                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer" style={{ marginTop: '20px' }}>
                    Already have an account?
                    <Link to="/login" className="auth-link">Log in</Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
