import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    HardDrive,
    CheckCircle2,
    ExternalLink,
    RefreshCw,
    Loader2,
    AlertCircle,
    FolderOpen,
    Clock,
    Shield,
    Scan,
    ToggleLeft,
    ToggleRight,
    ImageIcon,
    Video,
    FileText,
    X,
    Check,
    Wifi,
    WifiOff
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_DRIVE_ICON = (
    <svg viewBox="0 0 87.3 78" className="w-6 h-6 md:w-7 md:h-7">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85z" fill="#ea4335" />
        <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.85 0H34.44c-1.65 0-3.2.45-4.55 1.2z" fill="#00832d" />
        <path d="M59.85 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.55 1.2h36.75c1.65 0 3.2-.45 4.55-1.2z" fill="#2684fc" />
        <path d="M73.4 26.5 60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.6 25l16.25 28h27.5c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
)

// ─── Helper: Auth Token ──────────────────────────────────────────────────────
const getAuthToken = async () => {
    try {
        const token =
            localStorage.getItem('authToken') ||
            localStorage.getItem('token') ||
            localStorage.getItem('access_token')
        if (token) return token

        const { supabase } = await import('../lib/supabase')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
            console.error('[GoogleDriveCard] session error:', error)
            return null
        }
        return session?.access_token || null
    } catch (e) {
        console.error('[GoogleDriveCard] auth error:', e)
        return null
    }
}

const getBaseUrl = () => {
    const raw = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
    return raw.replace(/\/+$/, '')
}

// ─── Toast Notification ──────────────────────────────────────────────────────
const Toast = ({ type, message, onClose }) => {
    useEffect(() => {
        const t = setTimeout(onClose, 5000)
        return () => clearTimeout(t)
    }, [onClose])

    const bg = type === 'success'
        ? 'from-emerald-500 to-green-600'
        : 'from-red-500 to-rose-600'
    const icon = type === 'success'
        ? <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />

    return (
        <div className={`fixed top-6 right-6 z-[9999] animate-slide-in-up max-w-sm`}>
            <div className={`flex items-center gap-3 bg-gradient-to-r ${bg} text-white px-4 py-3 rounded-xl shadow-2xl`}>
                {icon}
                <p className="text-sm font-medium flex-1">{message}</p>
                <button onClick={onClose} className="p-0.5 hover:bg-white/20 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const DriveCardSkeleton = () => (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 md:p-8 animate-slide-in-up">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl animate-shimmer" />
            <div className="flex-1 space-y-2">
                <div className="h-5 w-40 rounded-lg animate-shimmer" />
                <div className="h-3 w-56 rounded animate-shimmer" />
            </div>
        </div>
        <div className="h-12 rounded-xl animate-shimmer" />
    </div>
)

// ─── Main Component ──────────────────────────────────────────────────────────
const GoogleDriveCard = ({ onStatusChange }) => {
    // === State ===
    const [driveStatus, setDriveStatus] = useState(null)
    const [initialLoading, setInitialLoading] = useState(true)
    const [connecting, setConnecting] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [disconnecting, setDisconnecting] = useState(false)
    const [scanMessage, setScanMessage] = useState('')
    const [toast, setToast] = useState(null)
    const [networkError, setNetworkError] = useState(false)
    const [driveQueue, setDriveQueue] = useState([])
    const popupRef = useRef(null)
    const pollRef = useRef(null)

    // === Fetch status ===
    const fetchDriveStatus = useCallback(async (silent = false) => {
        try {
            if (!silent) setNetworkError(false)
            const authToken = await getAuthToken()
            if (!authToken) {
                setInitialLoading(false)
                return
            }
            const baseUrl = getBaseUrl()
            const res = await fetch(`${baseUrl}/drive/status`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            if (res.ok) {
                const data = await res.json()
                setDriveStatus(data)
                if (data.connected) fetchDriveQueue(authToken, baseUrl)
                if (onStatusChange) onStatusChange(data)
            } else if (res.status === 401) {
                // Token expired — clear status
                setDriveStatus(null)
            }
        } catch (e) {
            console.error('[GoogleDriveCard] status fetch failed:', e)
            if (!silent) setNetworkError(true)
        } finally {
            setInitialLoading(false)
        }
    }, [onStatusChange])

    const fetchDriveQueue = async (authToken, baseUrl) => {
        try {
            const res = await fetch(`${baseUrl}/drive/queue?status=draft`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            if (res.ok) {
                const data = await res.json()
                setDriveQueue(data.items || [])
            }
        } catch { /* ignore */ }
    }

    useEffect(() => {
        fetchDriveStatus()
    }, [fetchDriveStatus])

    // === Google OAuth popup flow ===
    const openOAuthPopup = useCallback(async () => {
        // 1. Open blank popup immediately (avoids popup blocker)
        const popup = window.open(
            'about:blank',
            'google-drive-oauth',
            'width=520,height=680,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        )

        if (!popup || popup.closed) {
            setToast({ type: 'error', message: 'Popup blocked! Please allow popups for this site and try again.' })
            return
        }

        popupRef.current = popup
        setConnecting(true)

        try {
            const authToken = await getAuthToken()
            const baseUrl = getBaseUrl()
            const headers = {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }

            const response = await fetch(`${baseUrl}/connections/google/reconnect`, {
                method: 'POST',
                headers
            })
            const data = await response.json()

            if (!response.ok || !data.success || !data.auth_url) {
                popup.close()
                setToast({ type: 'error', message: data.error || 'Failed to start Google authentication. Please try again.' })
                setConnecting(false)
                return
            }

            // 2. Navigate popup to auth URL
            popup.location.href = data.auth_url

            // 3. Listen for OAuth messages from the popup
            const messageHandler = (event) => {
                const allowedOrigins = [
                    window.location.origin,
                    'https://emily.atsnai.com',
                    'https://agent-emily.onrender.com'
                ]
                if (!allowedOrigins.includes(event.origin)) return

                if (event.data?.type === 'OAUTH_SUCCESS') {
                    popup.close()
                    window.removeEventListener('message', messageHandler)
                    setToast({ type: 'success', message: 'Google Drive connected successfully!' })
                    setConnecting(false)
                    // Slight delay so backend can persist the token
                    setTimeout(() => fetchDriveStatus(), 1500)
                } else if (event.data?.type === 'OAUTH_ERROR') {
                    popup.close()
                    window.removeEventListener('message', messageHandler)
                    setToast({ type: 'error', message: event.data.error || 'Google authentication failed. Please try again.' })
                    setConnecting(false)
                }
            }
            window.addEventListener('message', messageHandler)

            // 4. Fallback: poll popup closed (user may close manually)
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollRef.current)
                    window.removeEventListener('message', messageHandler)
                    setConnecting(false)
                    // Re-fetch status regardless (OAuth may have completed before close)
                    setTimeout(() => fetchDriveStatus(), 1500)
                }
            }, 800)

        } catch (e) {
            if (popup && !popup.closed) popup.close()
            setToast({ type: 'error', message: `Connection failed: ${e.message}` })
            setConnecting(false)
        }
    }, [fetchDriveStatus])

    // === Disconnect Drive ===
    const handleDisconnect = async () => {
        try {
            setDisconnecting(true)
            const authToken = await getAuthToken()
            const baseUrl = getBaseUrl()
            await fetch(`${baseUrl}/drive/disconnect`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            setDriveStatus(null)
            setDriveQueue([])
            setToast({ type: 'success', message: 'Google Drive disconnected.' })
            if (onStatusChange) onStatusChange(null)
        } catch (e) {
            setToast({ type: 'error', message: `Failed to disconnect: ${e.message}` })
        } finally {
            setDisconnecting(false)
        }
    }

    // === Manual scan ===
    const handleScan = async () => {
        try {
            setScanning(true)
            setScanMessage('')
            const authToken = await getAuthToken()
            const baseUrl = getBaseUrl()
            const res = await fetch(`${baseUrl}/drive/scan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || 'Scan failed')
            const msg = data.queued > 0
                ? `Found ${data.found_files} file(s), queued ${data.queued} post(s)`
                : data.found_files === 0
                    ? 'No new files found in your Emily folder'
                    : `Processed ${data.found_files} file(s)`

            setScanMessage(msg)
            setToast({ type: 'success', message: msg })
            fetchDriveStatus(true)
        } catch (e) {
            setScanMessage('')
            setToast({ type: 'error', message: e.message })
        } finally {
            setScanning(false)
        }
    }

    // === Auto-post toggle ===
    const handleAutoPostToggle = async (newValue) => {
        try {
            const authToken = await getAuthToken()
            const baseUrl = getBaseUrl()
            await fetch(`${baseUrl}/drive/settings`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ auto_post: newValue })
            })
            setDriveStatus(prev => ({ ...prev, auto_post: newValue }))
        } catch (e) {
            setToast({ type: 'error', message: `Failed to update settings: ${e.message}` })
        }
    }

    // === Queue actions ===
    const handleQueueAction = async (itemId, action) => {
        try {
            const authToken = await getAuthToken()
            const baseUrl = getBaseUrl()
            const endpoint = action === 'approve' ? 'approve' : 'reject'
            await fetch(`${baseUrl}/drive/queue/${itemId}/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            setDriveQueue(prev => prev.filter(item => item.id !== itemId))
            setToast({ type: 'success', message: action === 'approve' ? 'Post approved!' : 'Post dismissed.' })
        } catch (e) {
            setToast({ type: 'error', message: `Failed to ${action} post: ${e.message}` })
        }
    }

    // === Cleanup ===
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [])

    // ─── Render ─────────────────────────────────────────────────────────────────

    // Toast overlay
    const toastEl = toast && (
        <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
        />
    )

    // Loading skeleton
    if (initialLoading) return (
        <>
            {toastEl}
            <DriveCardSkeleton />
        </>
    )

    // Network error state
    if (networkError && !driveStatus) return (
        <>
            {toastEl}
            <div className="bg-white rounded-xl border border-black/[0.06] p-8 text-center">
                <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center border border-rose-100 mx-auto mb-4">
                    <WifiOff className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 mb-1">Connection Error</h3>
                <p className="text-[13px] text-slate-500 mb-6">Unable to check Google Drive status. Please verify your network.</p>
                <button
                    onClick={() => { setNetworkError(false); setInitialLoading(true); fetchDriveStatus() }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[13px] font-medium rounded-md hover:bg-slate-800 transition-all"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Connection
                </button>
            </div>
        </>
    )

    const isConnected = driveStatus?.connected === true

    // ─── DISCONNECTED STATE ────────────────────────────────────────────────────
    if (!isConnected) {
        return (
            <>
                {toastEl}
                <div className="group relative bg-white rounded-xl border border-black/[0.06] hover:border-black/[0.12] transition-all duration-200 p-8">
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center border border-black/[0.04] transition-transform group-hover:scale-105">
                            {GOOGLE_DRIVE_ICON}
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Google Drive</h3>
                                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 rounded border border-black/[0.05]">Disconnected</span>
                            </div>
                            <p className="text-[14px] text-slate-500 leading-relaxed mb-6">
                                Bring your content workflow to life. Connect your Drive to automatically detect and schedule posts from your Emily folder.
                            </p>

                            <button
                                onClick={openOAuthPopup}
                                disabled={connecting}
                                className="inline-flex items-center gap-2.5 px-6 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-md hover:bg-slate-800 transition-all shadow-sm"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                {connecting ? 'Waiting for authorization...' : 'Connect Google Account'}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // ─── CONNECTED STATE ───────────────────────────────────────────────────────
    return (
        <>
            {toastEl}
            <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
                <div className="p-8 pb-6 border-b border-black/[0.04]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-black/[0.05]">
                                {GOOGLE_DRIVE_ICON}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Google Drive</h3>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        Connected
                                    </span>
                                </div>
                                <p className="text-[13px] text-slate-500 mt-0.5">Automated monitoring and scheduling enabled</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <a
                                href="https://drive.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white border border-black/[0.08] rounded-md hover:bg-slate-50"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                View Folder
                            </a>
                            <button
                                onClick={openOAuthPopup}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white border border-black/[0.08] rounded-md hover:bg-slate-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${connecting ? 'animate-spin' : ''}`} />
                                Sync
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-rose-600 bg-white border border-rose-100 rounded-md hover:bg-rose-50 transition-all"
                            >
                                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                Disconnect
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                        {/* Status Grid */}
                        <div className="bg-slate-50 border border-black/[0.02] rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <FolderOpen className={`w-4 h-4 ${driveStatus?.emily_folder_found ? 'text-emerald-500' : 'text-amber-500'}`} />
                                <span className="text-[12px] font-medium text-slate-500">Target Folder</span>
                            </div>
                            <p className={`text-[14px] font-bold mt-1 ${driveStatus?.emily_folder_found ? 'text-slate-900' : 'text-amber-700'}`}>
                                {driveStatus?.emily_folder_found ? 'Emily' : 'Unreachable'}
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-black/[0.02] rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                <span className="text-[12px] font-medium text-slate-500">Account</span>
                            </div>
                            <p className="text-[14px] font-bold text-slate-900 mt-1 truncate">{driveStatus?.account_email || 'Linked'}</p>
                        </div>
                        <div className="bg-slate-50 border border-black/[0.02] rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span className="text-[12px] font-medium text-slate-500">Last Scan</span>
                            </div>
                            <p className="text-[14px] font-bold text-slate-900 mt-1">
                                {driveStatus?.last_scan_at ? new Date(driveStatus.last_scan_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-6 space-y-6 bg-slate-50/30">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1 flex items-center gap-4 bg-white border border-black/[0.06] rounded-xl px-5 py-3 shadow-sm">
                            <div className="flex-1">
                                <p className="text-[14px] font-bold text-slate-900">Auto-Post Authorization</p>
                                <p className="text-[12px] text-slate-500">Automatically publish detected files</p>
                            </div>
                            <button
                                onClick={() => handleAutoPostToggle(!driveStatus?.auto_post)}
                                className="transition-all"
                            >
                                {driveStatus?.auto_post
                                    ? <ToggleRight className="w-8 h-8 text-slate-900" />
                                    : <ToggleLeft className="w-8 h-8 text-slate-200" />
                                }
                            </button>
                        </div>

                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-[13px] font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm"
                        >
                            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                            Run Manual Scan
                        </button>
                    </div>

                    {driveQueue.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-black/[0.04] pb-2">
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pending Approval ({driveQueue.length})</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {driveQueue.map(item => (
                                    <div key={item.id} className="bg-white rounded-xl border border-black/[0.06] p-4 flex gap-4 transition-all hover:border-black/[0.12]">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            {item.mime_type?.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-slate-400" /> : <Video className="w-5 h-5 text-slate-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-800 truncate mb-1">{item.file_name}</p>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.caption}</p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handleQueueAction(item.id, 'approve')} className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors" title="Approve">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleQueueAction(item.id, 'reject')} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded transition-colors" title="Reject">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default GoogleDriveCard
