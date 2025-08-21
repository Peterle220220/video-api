import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
	const [email, setEmail] = useState('');
	const [sent, setSent] = useState(false);

	const onSubmit = (e) => {
		e.preventDefault();
		// Mock: send reset link to predefined email
		setTimeout(() => setSent(true), 600);
	};

	return (
		<div className="auth-container">
			<h2>Forgot Password</h2>
			{sent ? (
				<p>We have sent a reset link to {email || 'your email'} (mock).</p>
			) : (
				<form onSubmit={onSubmit} className="auth-form">
					<label>
						Email
						<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
					</label>
					<button type="submit">Send reset link</button>
				</form>
			)}
			<div className="auth-links">
				<Link to="/login">Back to Login</Link>
			</div>
		</div>
	);
}


