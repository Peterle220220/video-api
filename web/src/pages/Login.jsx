import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, endpoints } from '../services/api';

export default function Login() {
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const onSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await api.post(endpoints.auth.login, { username, password });
			localStorage.setItem('token', res.data.token);
			localStorage.setItem('user', JSON.stringify(res.data.user));
			navigate('/videos');
		} catch (err) {
			setError(err?.response?.data?.error || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-container">
			<h2>Login</h2>
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
			{error && <p className="error-text">{error}</p>}
			<div className="auth-links">
				<Link to="/forgot-password">Forgot password?</Link>
			</div>
		</div>
	);
}


