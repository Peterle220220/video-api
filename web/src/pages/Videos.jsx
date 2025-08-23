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
	const [transcode1080Progress, setTranscode1080Progress] = useState(0);
	const [transcode720Progress, setTranscode720Progress] = useState(0);
	const [transcode480Progress, setTranscode480Progress] = useState(0);
	const [transcodeStatus, setTranscodeStatus] = useState('idle');
	const currentVideoIdRef = useRef('');
	const currentJobIdRef = useRef('');
	const pollingRef = useRef(null);
	const defaultResolutions = ['1920x1080', '1280x720', '854x480'];
	const [expectedResolutions, setExpectedResolutions] = useState(defaultResolutions);
	const [resolutionStatuses, setResolutionStatuses] = useState({});
	const [cpuUsage, setCpuUsage] = useState(null);
	const [transcodeElapsedSec, setTranscodeElapsedSec] = useState(0);
	const transcodeStartTsRef = useRef(null);
	const [metaByUrl, setMetaByUrl] = useState({}); // {url: {sizeBytes, resolution, fps, duration, bitrate}}
	const [aaiMetaByVideoId, setAaiMetaByVideoId] = useState({}); // {videoId: {status, summary, chapters, highlights, text}}
	const aaiPollingRef = useRef(null);
	const aaiPollingVideoIdRef = useRef('');

	const formatBytes = (bytes) => {
		if (!bytes && bytes !== 0) return '-';
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		if (bytes === 0) return '0 B';
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
	};

	const formatSeconds = (s) => {
		if (!Number.isFinite(s)) return '-';
		const sec = Math.floor(s % 60);
		const min = Math.floor((s / 60) % 60);
		const hr = Math.floor(s / 3600);
		return hr > 0 ? `${hr}h ${min}m ${sec}s` : `${min}m ${sec}s`;
	};

	const formatResolutionLabel = (res) => {
		const match = String(res).match(/x(\d+)$/);
		if (match && match[1]) return `${match[1]}p`;
		return String(res);
	};

	useEffect(() => {
		// Probe auth quickly and load library
		api.get(endpoints.auth.test).catch(() => {});
		loadLibrary(1, libraryLimit);
	}, []);

	const [library, setLibrary] = useState([]);
	const [libraryPage, setLibraryPage] = useState(1);
	const [libraryLimit, setLibraryLimit] = useState(10);
	const [libraryPagination, setLibraryPagination] = useState({ currentPage: 1, totalPages: 1, totalVideos: 0, hasNext: false, hasPrev: false });
	const [selectedPreview, setSelectedPreview] = useState({ videoId: '', url: '' });
	const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

	const loadLibrary = async (page = libraryPage, limit = libraryLimit) => {
		try {
			const { data } = await api.get(endpoints.transcoding.library, { params: { page, limit } });
			const list = Array.isArray(data?.videos) ? data.videos : [];
			setLibrary(list);
			const p = data?.pagination || {};
			setLibraryPagination({
				currentPage: p.currentPage || page,
				totalPages: p.totalPages || 1,
				totalVideos: (p.totalVideos ?? (data?.count ?? list.length ?? 0)),
				hasNext: !!p.hasNext,
				hasPrev: !!p.hasPrev,
			});
			setLibraryPage(p.currentPage || page);
			setLibraryLimit(limit);
		} catch (err) {
			// ignore
		}
	};

	const goToPrevPage = () => {
		if (!libraryPagination.hasPrev) return;
		loadLibrary((libraryPagination.currentPage || 1) - 1, libraryLimit);
	};

	const goToNextPage = () => {
		if (!libraryPagination.hasNext) return;
		loadLibrary((libraryPagination.currentPage || 1) + 1, libraryLimit);
	};

	useEffect(() => {
		return () => {
			if (pollingRef.current) {
				clearInterval(pollingRef.current);
				pollingRef.current = null;
			}
			if (aaiPollingRef.current) {
				clearInterval(aaiPollingRef.current);
				aaiPollingRef.current = null;
				aaiPollingVideoIdRef.current = '';
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
				const relPath = `${item.video_id}/${item.resolution}.mp4`;
				return {
					id: `${item.video_id}-${item.resolution}`,
					title: `${item.resolution}`,
					streamUrl: endpoints.staticPaths.processed(relPath),
					fileSize: item.file_size,
					resolution: item.resolution,
					videoId: item.video_id,
				};
			});
			setVideos(items);
			// prefetch metadata in background
			items.forEach(async (it) => {
				try {
					const res = await api.get(endpoints.transcoding.metadata(it.videoId, it.resolution));
					const m = res?.data || {};
					setMetaByUrl((prev) => ({ ...prev, [it.streamUrl]: { sizeBytes: m.size, resolution: `${m.width}x${m.height}` || it.resolution, fps: m.fps, duration: m.duration, bitrate: m.bitrate } }));
				} catch (_) {}
			});
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
				const relPath = `${item.video_id}/${item.resolution}.mp4`;
				statusObj[res] = { status: 'completed', url: endpoints.staticPaths.processed(relPath), progress: 100 };
			} else {
				const prev = (resolutionStatuses || {})[res] || {};
				statusObj[res] = { status: transcodeStatus === 'completed' ? 'pending' : 'processing', url: null, progress: typeof prev.progress === 'number' ? prev.progress : undefined };
			}
		});
		setResolutionStatuses(statusObj);
	};

	const startPollingTranscode = () => {
		if (pollingRef.current) clearInterval(pollingRef.current);
		setTranscodeStatus('processing');
		setTranscodeProgress(0);
		setCpuUsage(null);
		transcodeStartTsRef.current = Date.now();
		setTranscodeElapsedSec(0);
		pollingRef.current = setInterval(async () => {
			try {
				// Ensure we have a jobId; if not, fetch from /jobs using current videoId
				if (!currentJobIdRef.current) {
					try {
						const { data } = await api.get(endpoints.transcoding.jobs);
						const jobs = Array.isArray(data?.activeJobs) ? data.activeJobs : [];
						const job = jobs.find(j => j.video_id === currentVideoIdRef.current);
						if (job && job.job_id) {
							currentJobIdRef.current = job.job_id;
						}
					} catch (_) {}
				}

				const targetJobId = currentJobIdRef.current;
				if (!targetJobId) {
					return; // wait for job discovery next tick
				}

				const { data: statusData } = await api.get(endpoints.transcoding.status(targetJobId));
				const job = statusData?.job || {};
				setTranscode1080Progress(Math.max(0, Math.min(100, Number(job.resolution_progress?.['1920x1080']?.progress) || 0)));
				setTranscode720Progress(Math.max(0, Math.min(100, Number(job.resolution_progress?.['1280x720']?.progress) || 0)));
				setTranscode480Progress(Math.max(0, Math.min(100, Number(job.resolution_progress?.['854x480']?.progress) || 0)));
				// setTranscodeProgress(Math.max(0, Math.min(100, Number(job.progress) || 0)));
				setTranscodeStatus(job.status || 'processing');
				// Update CPU metrics and elapsed time
				try {
					const { data: metrics } = await api.get(endpoints.transcoding.metrics);
					const cpu = Number(metrics?.cpu?.current);
					if (!Number.isNaN(cpu)) setCpuUsage(Math.max(0, Math.min(100, cpu)));
				} catch (_) {}
				if (transcodeStartTsRef.current) {
					setTranscodeElapsedSec(Math.max(0, Math.floor((Date.now() - transcodeStartTsRef.current) / 1000)));
				}
				if ((job.status || '').toLowerCase() === 'completed') {
					clearInterval(pollingRef.current);
					pollingRef.current = null;
					setTranscodeProgress(100);
					setTranscodeStatus('completed');
					api.get(endpoints.auth.test).catch(() => {});
					loadLibrary();
					fetchTranscodedList();
					return;
				}

				const jobResolutions = Array.isArray(job?.resolutions) ? job.resolutions : [];
				const resolutionProgress = job?.resolution_progress || {};
				if (jobResolutions.length > 0) {
					// Sync expected resolutions order with backend
					setExpectedResolutions(jobResolutions.map(r => String(r)));
					setResolutionStatuses((prev) => {
						const next = { ...prev };
						jobResolutions.forEach((res) => {
							const key = String(res);
							const info = resolutionProgress[key] || {};
							const progress = Math.max(0, Math.min(100, Number(info.progress) || 0));
							const status = progress >= 100 ? 'completed' : (info.status || 'processing');
							const url = next[key]?.url || null;
							next[key] = { status, progress, url };
						});
						return next;
					});
				}

				try {
					const tl = await api.get(endpoints.transcoding.transcodedList(currentVideoIdRef.current));
					updateResolutionStatuses(Array.isArray(tl?.data?.transcodedVideos) ? tl.data.transcodedVideos : []);
				} catch (_) {}
			} catch (err) {
				const status = err?.response?.status;
				if (status === 404) {
					clearInterval(pollingRef.current);
					pollingRef.current = null;
					setTranscodeProgress(100);
					setTranscodeStatus('completed');
					fetchTranscodedList();
					return;
				}
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
			const initialUrls = Array.isArray(res?.data?.urls) ? res.data.urls : [];
			if (videoId) {
				currentVideoIdRef.current = videoId;
				currentJobIdRef.current = '';
				setInputVideoId(videoId);
				// reset statuses to processing for all expected resolutions with progress
				const byRes = new Map(initialUrls.map(u => [String(u.resolution), u.url]));
				setResolutionStatuses(Object.fromEntries(expectedResolutions.map(r => [r, { status: 'processing', url: byRes.get(r) || null, progress: 0 }])));
				startPollingTranscode();
				startPollingMeta(videoId);
			}
		} catch (err) {
			setError(err?.response?.data?.error || 'Upload failed');
		} finally {
			setUploading(false);
			setUploadFile(null);
		}
	};

	const parseResolutionFromUrl = (url) => {
		const m = String(url).match(/\/(\d+x\d+)\.mp4(\?.*)?$/);
		return m ? m[1] : '';
	};

	const ensureMetaForUrl = async (url) => {
		if (!url || metaByUrl[url]) return;
		try {
			// Try server-side ffprobe endpoint using url pattern to extract videoId/resolution
			const m = String(url).match(/\/processed\/([^/]+)\/(\d+x\d+)\.mp4/);
			if (m) {
				const videoId = m[1];
				const resolution = m[2];
				try {
					const res = await api.get(endpoints.transcoding.metadata(videoId, resolution));
					const md = res?.data || {};
					setMetaByUrl((prev) => ({ ...prev, [url]: { sizeBytes: md.size, resolution: `${md.width}x${md.height}` || resolution, fps: md.fps, duration: md.duration, bitrate: md.bitrate } }));
					return;
				} catch (_) {}
			}
			// Fallback: HEAD for size only
			const res = await fetch(url, { method: 'HEAD' });
			const len = Number(res.headers.get('content-length'));
			setMetaByUrl((prev) => ({ ...prev, [url]: { sizeBytes: Number.isFinite(len) ? len : undefined, resolution: parseResolutionFromUrl(url), fps: undefined } }));
		} catch (_) {
			setMetaByUrl((prev) => ({ ...prev, [url]: { sizeBytes: undefined, resolution: parseResolutionFromUrl(url), fps: undefined } }));
		}
	};

	const onPreviewClick = async (videoId, url) => {
		setSelectedPreview({ videoId, url });
		await ensureMetaForUrl(url);
		// fetch AssemblyAI meta and start polling if needed
		try {
			const res = await api.get(endpoints.transcoding.meta(videoId));
			const m = res?.data?.meta || null;
			if (m) setAaiMetaByVideoId((prev) => ({ ...prev, [videoId]: m }));
			if (!m || (m.status && String(m.status).toLowerCase() !== 'completed' && String(m.status).toLowerCase() !== 'error')) {
				startPollingMeta(videoId);
			}
		} catch (_) {
			startPollingMeta(videoId);
		}
	};

	const startPollingMeta = (videoId) => {
		if (!videoId) return;
		if (aaiPollingRef.current) {
			clearInterval(aaiPollingRef.current);
			aaiPollingRef.current = null;
		}
		aaiPollingVideoIdRef.current = videoId;
		aaiPollingRef.current = setInterval(async () => {
			try {
				const res = await api.get(endpoints.transcoding.meta(aaiPollingVideoIdRef.current));
				const m = res?.data?.meta || null;
				if (m) setAaiMetaByVideoId((prev) => ({ ...prev, [aaiPollingVideoIdRef.current]: m }));
				const status = String(m?.status || '').toLowerCase();
				if (status === 'completed' || status === 'error') {
					clearInterval(aaiPollingRef.current);
					aaiPollingRef.current = null;
				}
			} catch (_) {
				// keep polling; endpoint may not exist yet
			}
		}, 3000);
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
			</div>

			<div className="video-card" style={{ marginBottom: 16 }}>
				<h3 style={{ marginTop: 0 }}>Library</h3>
				{library.length === 0 ? (
					<p>No transcoded videos in library.</p>
				) : (
					<div style={{ display: 'grid', gap: 12 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
							<div style={{ fontSize: 12, color: '#374151' }}>
								<span>Page {libraryPagination.currentPage} of {libraryPagination.totalPages}</span>
								<span style={{ marginLeft: 8 }}>Total: {libraryPagination.totalVideos}</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<label style={{ fontSize: 12, color: '#374151' }}>Page size:</label>
								<select
									value={libraryLimit}
									onChange={(e) => {
										const next = parseInt(e.target.value, 5) || 5;
										setLibraryLimit(next);
										loadLibrary(1, next);
									}}
								>
									<option value={1}>1</option>
									<option value={5}>5</option>
									<option value={10}>10</option>
									<option value={20}>20</option>
								</select>
								<button onClick={goToPrevPage} disabled={!libraryPagination.hasPrev}>Prev</button>
								<button onClick={goToNextPage} disabled={!libraryPagination.hasNext}>Next</button>
							</div>
						</div>
						{library.map(item => (
							<div key={item.videoId} style={{ display: 'grid', gap: 6 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
									<strong>{item.videoId}</strong>
									{item.urls.map(u => (
										<button key={u.url} onClick={() => onPreviewClick(item.videoId, u.url)}>
											Preview {u.resolution}
										</button>
									))}
									{user?.username === 'admin' && (
										<button
											style={{ marginLeft: 'auto', background: '#ef4444', color: 'white' }}
											onClick={async () => {
												if (!window.confirm('Delete this video and all transcoded files?')) return;
												try {
													await api.delete(endpoints.transcoding.deleteVideo(item.videoId));
													await loadLibrary();
													if (currentVideoIdRef.current === item.videoId) {
														setVideos([]);
													}
												} catch (err) {
													alert(err?.response?.data?.error || 'Failed to delete video');
												}
											}}
										>
											Delete
										</button>
									)}
								</div>
								{aaiMetaByVideoId[item.videoId] && (
									<div style={{ fontSize: 12, color: '#374151', background: '#f8fafc', padding: 8, borderRadius: 6 }}>
										{(() => { const m = aaiMetaByVideoId[item.videoId] || {}; const st = String(m.status || '').toLowerCase(); return (
											<div style={{ display: 'grid', gap: 6 }}>
												<div>
													<strong>Summary status:</strong> {st || 'unknown'}{st && st !== 'completed' && st !== 'error' ? ' (processing...)' : ''}
												</div>
												{m.summary && (
													<div><strong>Summary:</strong> {m.summary}</div>
												)}
												{Array.isArray(m.chapters) && m.chapters.length > 0 && (
													<div>
														<strong>Chapters:</strong>
														<ul style={{ margin: '4px 0 0 16px' }}>
															{m.chapters.slice(0, 6).map((c, idx) => (
																<li key={idx}>{c?.headline || c?.gist || `Chapter ${idx+1}`} {Number.isFinite(c?.start) && Number.isFinite(c?.end) ? `(${formatSeconds(c.start)} - ${formatSeconds(c.end)})` : ''}</li>
															))}
														</ul>
													</div>
												)}
												{m.highlights && Array.isArray(m.highlights.results) && m.highlights.results.length > 0 && (
													<div>
														<strong>Highlights:</strong>
														<ul style={{ margin: '4px 0 0 16px' }}>
															{m.highlights.results.slice(0, 5).map((h, idx) => (
																<li key={idx}>{h.text} {h.rank ? `(rank ${h.rank})` : ''}</li>
															))}
														</ul>
													</div>
												)}
												{m.text && (
													<details>
														<summary>Transcript</summary>
														<div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.text}</div>
													</details>
												)}
											</div>
										); })()}
									</div>
								)}
								{selectedPreview.videoId === item.videoId && selectedPreview.url && (
									<>
										<video key={selectedPreview.url} controls crossOrigin="anonymous" width="100%">
											<source src={selectedPreview.url} type="video/mp4" />
											Your browser does not support the video tag.
										</video>
										<div style={{ fontSize: 12, color: '#374151' }}>
											{(() => { const meta = metaByUrl[selectedPreview.url] || {}; return (
												<span>Size: {formatBytes(meta.sizeBytes)} — Resolution: {meta.resolution || parseResolutionFromUrl(selectedPreview.url)} {meta.fps ? `— FPS: ${meta.fps}` : meta.duration ? `— Duration: ${formatSeconds(meta.duration)}` : ''} {meta.bitrate ? `— Bitrate: ${(meta.bitrate/1000).toFixed(0)} kbps` : ''}</span>
											); })()}
										</div>
									</>
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
					<div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#374151', marginTop: 6 }}>
						{cpuUsage != null && <span>CPU: {cpuUsage}%</span>}
						<span>Elapsed: {Math.floor(transcodeElapsedSec / 60)}m {transcodeElapsedSec % 60}s</span>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
						{expectedResolutions.map((res) => {
							const info = resolutionStatuses[res] || { status: 'processing', url: null };
							const label = formatResolutionLabel(res);
							const percent = res === '1920x1080' ? transcode1080Progress : res === '1280x720' ? transcode720Progress : res === '854x480' ? transcode480Progress : 0;
							const computedStatus = percent >= 100 ? 'completed' : 'processing';
							return (
								<div key={res} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ width: 10, height: 10, borderRadius: '50%', background: computedStatus === 'completed' ? '#16a34a' : '#f59e0b' }} />
									<span>{label}: {computedStatus === 'completed' ? 'completed' : `${Math.max(0, Math.min(100, percent))}%`}</span>
									{/* {info.url && <a href={info.url} target="_blank" rel="noreferrer">Open</a>} */}
								</div>
							);
						})}
					</div>
				</div>
			)}
			
		</div>
	);
}


