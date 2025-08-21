import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, endpoints } from '../services/api';

export default function Videos() {
	const navigate = useNavigate();
	const [videos, setVideos] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [inputVideoId, setInputVideoId] = useState('');
	const [uploadFile, setUploadFile] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [transcodeProgress, setTranscodeProgress] = useState(0);
	const [transcodeStatus, setTranscodeStatus] = useState('idle');
	const currentVideoIdRef = useRef('');
	const pollingRef = useRef(null);
	const defaultResolutions = ['1920x1080', '1280x720', '854x480'];
	const [expectedResolutions, setExpectedResolutions] = useState(defaultResolutions);
	const [resolutionStatuses, setResolutionStatuses] = useState({});

	useEffect(() => {
		// Probe auth quickly and load library
		api.get(endpoints.auth.test).catch(() => {});
		loadLibrary();
	}, []);

	const [library, setLibrary] = useState([]);
	const [selectedPreview, setSelectedPreview] = useState({ videoId: '', url: '' });

	const loadLibrary = async () => {
		try {
			const { data } = await api.get(endpoints.transcoding.library);
			const list = Array.isArray(data?.videos) ? data.videos : [];
			setLibrary(list);
		} catch (err) {
			// ignore
		}
	};

	useEffect(() => {
		return () => {
			if (pollingRef.current) {
				clearInterval(pollingRef.current);
				pollingRef.current = null;
			}
		};
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

	const updateResolutionStatuses = (transcodedList = []) => {
		const byRes = new Map();
		transcodedList.forEach((item) => {
			byRes.set(String(item.resolution), item);
		});
		const statusObj = {};
		expectedResolutions.forEach((res) => {
			const item = byRes.get(res);
			if (item) {
				const normalized = String(item.file_path || '').replace(/\\/g, '/');
				const fileName = normalized.split('/').pop();
				statusObj[res] = { status: 'completed', url: endpoints.staticPaths.processed(fileName) };
			} else {
				statusObj[res] = { status: transcodeStatus === 'completed' ? 'pending' : 'processing', url: null };
			}
		});
		setResolutionStatuses(statusObj);
	};

	const startPollingTranscode = () => {
		if (pollingRef.current) clearInterval(pollingRef.current);
		setTranscodeStatus('processing');
		setTranscodeProgress(0);
		pollingRef.current = setInterval(async () => {
			try {
				const { data } = await api.get(endpoints.transcoding.jobs);
				const jobs = Array.isArray(data?.activeJobs) ? data.activeJobs : [];
				const job = jobs.find(j => j.video_id === currentVideoIdRef.current);
				// Update per-resolution statuses during processing by checking transcoded list
				try {
					const tl = await api.get(endpoints.transcoding.transcodedList(currentVideoIdRef.current));
					updateResolutionStatuses(Array.isArray(tl?.data?.transcodedVideos) ? tl.data.transcodedVideos : []);
				} catch (_) {}

				if (!job) {
					clearInterval(pollingRef.current);
					pollingRef.current = null;
					setTranscodeProgress(100);
					setTranscodeStatus('completed');
					// Load transcoded list when done
					fetchTranscodedList();
					return;
				}
				setTranscodeProgress(Math.max(0, Math.min(100, Number(job.progress) || 0)));
				setTranscodeStatus(job.status || 'processing');
			} catch (err) {
				// Ignore transient errors while polling
			}
		}, 1000);
	};

	const onUpload = async (e) => {
		e.preventDefault();
		if (!uploadFile) return;
		setError('');
		setUploading(true);
		setUploadProgress(0);
		setTranscodeProgress(0);
		setTranscodeStatus('idle');
		try {
			const form = new FormData();
			form.append('video', uploadFile);
			form.append('title', uploadFile.name);
			form.append('description', 'Uploaded via web UI');
			// Optional: specify resolutions
			form.append('resolutions', JSON.stringify(expectedResolutions));

			const res = await api.post(endpoints.transcoding.start, form, {
				onUploadProgress: (evt) => {
					if (!evt.total) return;
					const percent = Math.round((evt.loaded * 100) / evt.total);
					setUploadProgress(percent);
				},
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			const videoId = res?.data?.videoId;
			if (videoId) {
				currentVideoIdRef.current = videoId;
				setInputVideoId(videoId);
				// reset statuses to processing for all expected resolutions
				setResolutionStatuses(Object.fromEntries(expectedResolutions.map(res => [res, { status: 'processing', url: null }])));
				startPollingTranscode();
			}
		} catch (err) {
			setError(err?.response?.data?.error || 'Upload failed');
		} finally {
			setUploading(false);
			setUploadFile(null);
		}
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
			<div className="video-card" style={{ marginBottom: 16 }}>
				<h3 style={{ marginTop: 0 }}>Upload and Transcode</h3>
				<form onSubmit={onUpload} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<input type="file" accept="video/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
					<button type="submit" disabled={uploading || !uploadFile}>{uploading ? `Uploading ${uploadProgress}%` : 'Upload & Start'}</button>
				</form>
				{transcodeStatus !== 'idle' && (
					<p style={{ marginTop: 8 }}>Transcoding: {transcodeProgress}% {transcodeStatus === 'completed' ? '(Done)' : ''}</p>
				)}
			</div>

			<div className="video-card" style={{ marginBottom: 16 }}>
				<h3 style={{ marginTop: 0 }}>Library</h3>
				{library.length === 0 ? (
					<p>No transcoded videos in library.</p>
				) : (
					<div style={{ display: 'grid', gap: 12 }}>
						{library.map(item => (
							<div key={item.videoId} style={{ display: 'grid', gap: 6 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
									<strong>{item.videoId}</strong>
									{item.urls.map(u => (
										<button key={u.url} onClick={() => setSelectedPreview({ videoId: item.videoId, url: u.url })}>
											Preview {u.resolution}
										</button>
									))}
								</div>
								{selectedPreview.videoId === item.videoId && selectedPreview.url && (
									<video controls width="100%" src={selectedPreview.url} />
								)}
							</div>
						))}
					</div>
				)}
			</div>
			{loading && <p>Loading...</p>}
			{error && <p className="error-text">{error}</p>}
			{Object.keys(resolutionStatuses).length > 0 && (
				<div className="video-card" style={{ marginBottom: 16 }}>
					<h4 style={{ margin: 0 }}>Resolution Status</h4>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
						{expectedResolutions.map((res) => {
							const info = resolutionStatuses[res] || { status: 'processing', url: null };
							const label = res === '1920x1080' ? '1080p' : res === '1280x720' ? '720p' : '480p';
							return (
								<div key={res} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ width: 10, height: 10, borderRadius: '50%', background: info.status === 'completed' ? '#16a34a' : info.status === 'processing' ? '#f59e0b' : '#9ca3af' }} />
									<span>{label}: {info.status}</span>
									{info.url && <a href={info.url} target="_blank" rel="noreferrer">Open</a>}
								</div>
							);
						})}
					</div>
				</div>
			)}
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


