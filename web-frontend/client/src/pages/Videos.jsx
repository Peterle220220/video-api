import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, endpoints } from '../services/api';

export default function Videos({ socket }) {
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
  const [cpuUsage, setCpuUsage] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const currentVideoIdRef = useRef('');
  const currentJobIdRef = useRef('');
  const userRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  };

  useEffect(() => {
    // Load user info
    userRef.current = (() => { 
      try { 
        return JSON.parse(localStorage.getItem('user') || '{}'); 
      } catch { 
        return {}; 
      } 
    })();

    // Set up WebSocket event listeners
    if (socket) {
      socket.on('upload-url', (data) => {
        console.log('Received upload URL:', data);
        handleFileUpload(data);
      });

      socket.on('transcoding-completed', (data) => {
        console.log('Transcoding completed:', data);
        setTranscodeStatus('completed');
        setTranscodeProgress(100);
        loadVideos();
      });

      socket.on('status-update', (data) => {
        console.log('Status update:', data);
        setTranscodeProgress(data.progress || 0);
        setTranscodeStatus(data.status || 'processing');
      });

      socket.on('system-status', (data) => {
        setSystemStatus(data);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setError(error.message || 'An error occurred');
      });

      // Authenticate with WebSocket
      if (userRef.current?.id) {
        socket.emit('authenticate', {
          userId: userRef.current.id,
          token: localStorage.getItem('token')
        });
      }
    }

    return () => {
      if (socket) {
        socket.off('upload-url');
        socket.off('transcoding-completed');
        socket.off('status-update');
        socket.off('system-status');
        socket.off('error');
      }
    };
  }, [socket]);

  const handleFileUpload = async (data) => {
    if (!uploadFile) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // Upload file to S3
      const response = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' },
        body: uploadFile,
      });

      if (response.ok) {
        setUploadProgress(100);
        
        // Start transcoding
        if (socket) {
          socket.emit('start-transcoding', {
            userId: userRef.current?.id,
            s3Key: data.key,
            title: uploadFile.name,
            description: 'Uploaded via web UI',
            resolutions: ['1920x1080', '1280x720', '854x480']
          });
        }

        setTranscodeStatus('processing');
        setTranscodeProgress(0);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
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
      // Request upload URL via WebSocket
      if (socket) {
        socket.emit('upload-request', {
          userId: userRef.current?.id,
          filename: uploadFile.name,
          contentType: uploadFile.type || 'application/octet-stream'
        });
      } else {
        throw new Error('WebSocket not connected');
      }
    } catch (err) {
      setError(err?.message || 'Upload failed');
      setUploading(false);
      setUploadFile(null);
    }
  };

  const onLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const goToAccount = () => {
    navigate('/account');
  };

  const loadVideos = async () => {
    try {
      const { data } = await api.get(endpoints.transcoding.library);
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Error loading videos:', err);
    }
  };

  const testCPU = async () => {
    if (socket) {
      socket.emit('test-cpu', {
        userId: userRef.current?.id,
        duration: 30
      });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Videos</h2>
        <div className="user-menu">
          <button className="user-trigger">
            {userRef.current?.username || 'User'} ▼
          </button>
          <div className="user-dropdown">
            <button onClick={goToAccount}>Account Settings</button>
            <button onClick={onLogout} className="danger">Log Out</button>
          </div>
        </div>
      </div>

      {systemStatus && (
        <div className="system-status">
          <p>Connected clients: {systemStatus.connectedClients}</p>
          <p>Connected users: {systemStatus.connectedUsers}</p>
        </div>
      )}

      <div className="video-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload and Transcode</h3>
        <form onSubmit={onUpload} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input 
            type="file" 
            accept="video/*" 
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
          />
          <button type="submit" disabled={uploading || !uploadFile}>
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload & Start'}
          </button>
        </form>
      </div>

      {transcodeStatus !== 'idle' && (
        <div className="video-card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: 0 }}>Transcoding Status</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#374151', marginTop: 6 }}>
            {cpuUsage != null && <span>CPU: {cpuUsage}%</span>}
            <span>Status: {transcodeStatus}</span>
            <span>Progress: {transcodeProgress}%</span>
          </div>
          <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: 4, marginTop: 8 }}>
            <div 
              style={{ 
                width: `${transcodeProgress}%`, 
                height: 8, 
                backgroundColor: '#3b82f6', 
                borderRadius: 4,
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
        </div>
      )}

      <div className="video-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>System Controls</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={testCPU} disabled={transcodeStatus === 'processing'}>
            Test CPU (30s)
          </button>
          <button onClick={loadVideos}>
            Refresh Videos
          </button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
