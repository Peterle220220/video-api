import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, endpoints } from '../services/api';

export default function Login() {
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaSession, setMfaSession] = useState('');
    const [mfaChallenge, setMfaChallenge] = useState('');
    const [mfaCode, setMfaCode] = useState('');

	const onSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await api.post(endpoints.auth.login, { username, password });
			if (res?.data?.mfaRequired) {
                setMfaRequired(true);
                setMfaSession(res.data.session || '');
                setMfaChallenge(res.data.challengeName || '');
                return;
            }
			const tokens = res?.data?.tokens;
			if (!tokens || !tokens.idToken) throw new Error('Invalid tokens');
			localStorage.setItem('token', tokens.idToken);
			localStorage.setItem('cognitoTokens', JSON.stringify(tokens));
			localStorage.setItem('user', JSON.stringify({ username }));
			navigate('/videos');
		} catch (err) {
			setError(err?.response?.data?.error || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

    const onSubmitMfa = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post(endpoints.auth.challenge, {
                username,
                session: mfaSession,
                challengeName: mfaChallenge,
                code: mfaCode
            });
            const tokens = res?.data?.tokens;
            if (!tokens || !tokens.idToken) throw new Error('Invalid tokens');
            localStorage.setItem('token', tokens.idToken);
            localStorage.setItem('cognitoTokens', JSON.stringify(tokens));
            localStorage.setItem('user', JSON.stringify({ username }));
            navigate('/videos');
        } catch (err) {
            setError(err?.response?.data?.error || 'MFA verification failed');
        } finally {
            setLoading(false);
        }
    };

	return (
		<div className="auth-container">
			<h2>Login</h2>
			{!mfaRequired ? (
				<form onSubmit={onSubmit} className="auth-form">
					<label>
						Username
						<input value={username} onChange={(e) => setUsername(e.target.value)} required />
					</label>
					<label>
						Password
						<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
					</label>
					<button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
				</form>
			) : (
				<form onSubmit={onSubmitMfa} className="auth-form">
					<label>
						Enter MFA code
						<input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required placeholder="123456" />
					</label>
					<button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
				</form>
			)}
			{error && <p className="error-text">{error}</p>}
			<div className="auth-links">
				<Link to="/forgot-password">Forgot password?</Link>
				<span style={{ margin: '0 8px' }}>|</span>
				<Link to="/register">Create account</Link>
			</div>
		</div>
	);
}


