import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, endpoints } from '../services/api';

export default function Videos() {
	const navigate = useNavigate();
	const [videos, setVideos] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [inputVideoId, setInputVideoId] = useState('');

	useEffect(() => {
		// Probe auth quickly
		api.get(endpoints.auth.test).catch(() => {});
	}, []);

	const fetchTranscodedList = async () => {
		if (!inputVideoId) return;
		setLoading(true);
		setError('');
		try {
			const { data } = await api.get(endpoints.transcoding.transcodedList(inputVideoId));
			const items = (data?.transcodedVideos || []).map((item) => {
				const filePath = String(item.file_path || '');
				const normalized = filePath.replace(/\\/g, '/');
				const fileName = normalized.split('/').pop();
				return {
					id: `${item.video_id}-${item.resolution}`,
					title: `${item.resolution}`,
					streamUrl: endpoints.staticPaths.processed(fileName),
				};
			});
			setVideos(items);
		} catch (err) {
			if (err?.response?.status === 401 || err?.response?.status === 403) {
				localStorage.removeItem('token');
				localStorage.removeItem('user');
				navigate('/login');
			}
			setError(err?.response?.data?.error || 'Failed to load transcoded list');
		} finally {
			setLoading(false);
		}
	};

	const onLogout = () => {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		navigate('/login');
	};

	return (
		<div className="page-container">
			<div className="page-header">
				<h2>Videos</h2>
				<button onClick={onLogout}>Logout</button>
			</div>
			<div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
				<input
					placeholder="Enter videoId to load transcoded files"
					value={inputVideoId}
					onChange={(e) => setInputVideoId(e.target.value)}
					style={{ flex: 1, padding: 8 }}
				/>
				<button onClick={fetchTranscodedList}>Load</button>
			</div>
			{loading && <p>Loading...</p>}
			{error && <p className="error-text">{error}</p>}
			{!loading && !error && (
				<div className="video-grid">
					{videos.length === 0 ? (
						<p>No videos to display. Enter a videoId to load transcoded files.</p>
					) : (
						videos.map((v) => (
							<div key={v.id} className="video-card">
								<h4>{v.title || 'Untitled'}</h4>
								<video controls width="100%" src={v.streamUrl} />
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}


