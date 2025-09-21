import React, { useEffect, useState } from 'react';
import { api, endpoints } from '../services/api';
import QRCode from 'qrcode';

export default function Account() {
	const [user, setUser] = useState(null);
    const [assoc, setAssoc] = useState(null);
    const [totpCode, setTotpCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [qrSrc, setQrSrc] = useState('');

	useEffect(() => {
		try {
			const u = JSON.parse(localStorage.getItem('user') || '{}');
			setUser(u && Object.keys(u).length > 0 ? u : null);
		} catch (_) {
			setUser(null);
		}
	}, []);

	useEffect(() => {
		let mounted = true;
		async function gen() {
			if (!assoc?.otpauthUri) { if (mounted) setQrSrc(''); return; }
			try {
				const url = await QRCode.toDataURL(assoc.otpauthUri, { width: 200, margin: 1 });
				if (mounted) setQrSrc(url);
			} catch (_) {
				if (mounted) setQrSrc('');
			}
		}
		gen();
		return () => { mounted = false; };
	}, [assoc]);

	return (
		<div className="page-container">
			<div className="page-header">
				<h2>Account Settings</h2>
			</div>
			<div className="video-card">
				<h3 style={{ marginTop: 0 }}>User Information</h3>
				<div style={{ display: 'grid', gap: 8 }}>
					<div><strong>Username:</strong> {user?.username || '-'}</div>
				</div>
			</div>
            <div className="video-card">
                <h3 style={{ marginTop: 0 }}>Multi‑Factor Authentication (TOTP)</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    {!assoc ? (
                        <>
                            <button disabled={busy} onClick={async () => {
                                setErr(''); setMsg(''); setBusy(true);
                                try {
                                    const tokens = JSON.parse(localStorage.getItem('cognitoTokens') || '{}');
                                    const accessToken = tokens?.accessToken;
                                    if (!accessToken) throw new Error('Missing accessToken. Re-login required.');
                                    const res = await api.post(endpoints.auth.totpAssociate, { accessToken, username: user?.username });
                                    setAssoc(res?.data || null);
                                } catch (e) {
                                    setErr(e?.response?.data?.error || e?.message || 'Failed to start TOTP');
                                } finally { setBusy(false); }
                            }}>Start TOTP setup</button>
                            {err && <p className="error-text">{err}</p>}
                            <p style={{ margin: 0, color: '#666' }}>Click to generate a secret and QR URI.</p>
                        </>
                    ) : (
                        <>
                            <div>
                                <div><strong>Secret:</strong> <code>{assoc?.secretCode}</code></div>
                                <div style={{ wordBreak: 'break-all' }}><strong>otpauth URI:</strong> <code>{assoc?.otpauthUri}</code></div>
						<p style={{ margin: '8px 0 0', color: '#666' }}>Copy the otpauth URI into your authenticator app (or scan the QR below).</p>
						{qrSrc && (
							<div style={{ marginTop: 12 }}>
								<img src={qrSrc} alt="TOTP QR" style={{ width: 200, height: 200, imageRendering: 'pixelated' }} />
							</div>
						)}
                            </div>
                            <div>
                                <label>
                                    Enter 6-digit code
                                    <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="123456" />
                                </label>
                                <button disabled={busy} onClick={async () => {
                                    setErr(''); setMsg(''); setBusy(true);
                                    try {
                                        const tokens = JSON.parse(localStorage.getItem('cognitoTokens') || '{}');
                                        const accessToken = tokens?.accessToken;
                                        if (!accessToken) throw new Error('Missing accessToken. Re-login required.');
                                        const res = await api.post(endpoints.auth.totpVerify, { accessToken, code: totpCode });
                                        if (res?.data?.success) {
                                            setMsg('TOTP enabled successfully');
                                        } else {
                                            setErr('Verification failed');
                                        }
                                    } catch (e) {
                                        setErr(e?.response?.data?.error || e?.message || 'Failed to verify TOTP');
                                    } finally { setBusy(false); }
                                }}>Verify & Enable</button>
                            </div>
                            <div>
                                <button disabled={busy} onClick={async () => {
                                    setErr(''); setMsg(''); setBusy(true);
                                    try {
                                        const tokens = JSON.parse(localStorage.getItem('cognitoTokens') || '{}');
                                        const accessToken = tokens?.accessToken;
                                        if (!accessToken) throw new Error('Missing accessToken. Re-login required.');
                                        const res = await api.post(endpoints.auth.mfaDisable, { accessToken });
                                        if (res?.data?.success) {
                                            setMsg('MFA disabled');
                                            setAssoc(null);
                                            setTotpCode('');
                                        } else {
                                            setErr('Disable failed');
                                        }
                                    } catch (e) {
                                        setErr(e?.response?.data?.error || e?.message || 'Failed to disable MFA');
                                    } finally { setBusy(false); }
                                }}>Disable MFA</button>
                            </div>
                            {msg && <p className="success-text">{msg}</p>}
                            {err && <p className="error-text">{err}</p>}
                        </>
                    )}
                </div>
            </div>
		</div>
	);
}


