import React, { useState, useEffect } from 'react'
import { Mail, FileText, Table, Folder, Calendar, Send, RefreshCw, Loader2 } from 'lucide-react'

const GoogleDashboard = () => {
  const [gmailMessages, setGmailMessages] = useState([])
  const [driveFiles, setDriveFiles] = useState([])
  const [sheets, setSheets] = useState([])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sendEmail, setSendEmail] = useState({
    to: '',
    subject: '',
    body: ''
  })

  useEffect(() => {
    fetchGoogleData()
  }, [])

  const fetchGoogleData = async () => {
    try {
      setLoading(true)
      setError(null)

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'

      // Fetch Gmail messages
      const gmailResponse = await fetch(`${API_BASE_URL}/connections/google/gmail/messages?limit=5`)
      const gmailData = await gmailResponse.json()
      if (gmailData.messages) {
        setGmailMessages(gmailData.messages)
      }

      // Fetch Drive files
      const driveResponse = await fetch(`${API_BASE_URL}/connections/google/drive/files?limit=5`)
      const driveData = await driveResponse.json()
      if (driveData.files) {
        setDriveFiles(driveData.files)
      }

      // Fetch Sheets
      const sheetsResponse = await fetch(`${API_BASE_URL}/connections/google/sheets/spreadsheets?limit=5`)
      const sheetsData = await sheetsResponse.json()
      if (sheetsData.spreadsheets) {
        setSheets(sheetsData.spreadsheets)
      }

      // Fetch Docs
      const docsResponse = await fetch(`${API_BASE_URL}/connections/google/docs/documents?limit=5`)
      const docsData = await docsResponse.json()
      if (docsData.documents) {
        setDocs(docsData.documents)
      }

    } catch (error) {
      console.error('Error fetching Google data:', error)
      setError('Failed to fetch Google data')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      
      const response = await fetch(`${API_BASE_URL}/connections/google/gmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendEmail)
      })

      const result = await response.json()
      
      if (result.success) {
        alert('Email sent successfully!')
        setSendEmail({ to: '', subject: '', body: '' })
      } else {
        alert('Failed to send email: ' + result.detail)
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    return new Date(dateString).toLocaleDateString()
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading && gmailMessages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-gray-600">Loading Google data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-blue-500 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Google Workspace</h1>
                <p className="text-gray-600">Manage your Gmail, Drive, Sheets, and Docs</p>
              </div>
            </div>
            <button
              onClick={fetchGoogleData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Send Email Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Send className="w-5 h-5 mr-2 text-green-600" />
              Send Email
            </h2>
            
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To
                </label>
                <input
                  type="email"
                  value={sendEmail.to}
                  onChange={(e) => setSendEmail({...sendEmail, to: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={sendEmail.subject}
                  onChange={(e) => setSendEmail({...sendEmail, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Email subject"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={sendEmail.body}
                  onChange={(e) => setSendEmail({...sendEmail, body: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Your message here..."
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Email'}
              </button>
            </form>
          </div>

          {/* Gmail Messages Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-red-500" />
              Recent Gmail Messages
            </h2>
            
            {gmailMessages.length > 0 ? (
              <div className="space-y-4">
                {gmailMessages.map((message, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{message.subject}</h3>
                      <span className="text-sm text-gray-500">{formatDate(message.date)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">From: {message.sender}</p>
                    <p className="text-sm text-gray-700">{message.snippet}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No messages found</p>
            )}
          </div>

          {/* Google Drive Files Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Folder className="w-5 h-5 mr-2 text-blue-500" />
              Google Drive Files
            </h2>
            
            {driveFiles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {driveFiles.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <h3 className="font-medium text-gray-900 mb-2 truncate">{file.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">{file.mimeType}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    <p className="text-sm text-gray-500">Modified: {formatDate(file.modifiedTime)}</p>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open in Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No files found</p>
            )}
          </div>

          {/* Google Sheets Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Table className="w-5 h-5 mr-2 text-green-500" />
              Google Sheets
            </h2>
            
            {sheets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sheets.map((sheet, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <h3 className="font-medium text-gray-900 mb-2 truncate">{sheet.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">{sheet.mimeType}</p>
                    <p className="text-sm text-gray-500">Modified: {formatDate(sheet.modifiedTime)}</p>
                    {sheet.webViewLink && (
                      <a
                        href={sheet.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open in Sheets
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No spreadsheets found</p>
            )}
          </div>

          {/* Google Docs Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Google Docs
            </h2>
            
            {docs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((doc, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <h3 className="font-medium text-gray-900 mb-2 truncate">{doc.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">{doc.mimeType}</p>
                    <p className="text-sm text-gray-500">Modified: {formatDate(doc.modifiedTime)}</p>
                    {doc.webViewLink && (
                      <a
                        href={doc.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open in Docs
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No documents found</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoogleDashboard
