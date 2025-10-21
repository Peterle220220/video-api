import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, endpoints } from '../services/api';

export default function Register() {
    const navigate = useNavigate();
    const [step, setStep] = useState('register'); // 'register' | 'confirm'
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    const onRegister = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);
        try {
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                setLoading(false);
                return;
            }
            const { data } = await authApi.post(endpoints.auth.register, { username, password, email });
            if (data?.success) {
                setInfo('Sign up successful. Please check your email for the confirmation code.');
                setStep('confirm');
            } else {
                throw new Error(data?.error || 'Register failed');
            }
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Register failed');
        } finally {
            setLoading(false);
        }
    };

    const onConfirm = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const { data } = await authApi.post(endpoints.auth.confirm, { username, code });
            if (data?.success) {
                setInfo('Account confirmed. You can now log in.');
                setTimeout(() => navigate('/login'), 800);
            } else {
                throw new Error(data?.error || 'Confirmation failed');
            }
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Confirmation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h2>{step === 'register' ? 'Register' : 'Confirm Account'}</h2>
            {step === 'register' ? (
                <form onSubmit={onRegister} className="auth-form">
                    <label>
                        Username
                        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    <label>
                        Email
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </label>
                    <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Create account'}</button>
                </form>
            ) : (
                <form onSubmit={onConfirm} className="auth-form">
                    <label>
                        Username
                        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    <label>
                        Confirmation code
                        <input value={code} onChange={(e) => setCode(e.target.value)} required />
                    </label>
                    <button type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Confirm'}</button>
                </form>
            )}
            {error && <p className="error-text">{error}</p>}
            {info && <p className="info-text">{info}</p>}
            <div className="auth-links">
                <Link to="/login">Back to Login</Link>
            </div>
        </div>
    );
}



