import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})()

const CustomBlogChatbot = ({ isOpen, onClose, onBlogCreated }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState({});
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [keywords, setKeywords] = useState(['', '', '']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  
  const messagesEndRef = useRef(null);
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !conversationId) {
      startConversation();
    }
  }, [isOpen]);

  // Cleanup image preview URL
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const startConversation = async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`${API_BASE_URL}/custom-blog/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      setConversationId(data.conversation_id);
      setCurrentStep(data.current_step);
      setProgress(data.progress_percentage);
      setState(data.state || {});
      
      // Add the greeting message
      setMessages([data.message]);
    } catch (error) {
      console.error('Error starting conversation:', error);
      addMessage('assistant', 'Sorry, I encountered an error starting our conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConversation = async () => {
    try {
      // Reset all state
      setMessages([]);
      setInputValue('');
      setConversationId(null);
      setCurrentStep(null);
      setProgress(0);
      setState({});
      setKeywords(['', '', '']);
      setScheduleDate('');
      setScheduleTime('');
      setUploadingImage(false);
      setGeneratingImage(false);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      setSelectedImageFile(null);
      
      // Start a new conversation
      await startConversation();
    } catch (error) {
      console.error('Error refreshing conversation:', error);
      addMessage('assistant', 'Sorry, I encountered an error refreshing the conversation. Please try again.');
    }
  };

  const addMessage = (role, content, metadata = {}) => {
    const message = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = async (message = inputValue) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    addMessage('user', message);
    setInputValue('');

    try {
      setIsLoading(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`${API_BASE_URL}/custom-blog/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_input: message,
          input_type: 'text'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Add assistant response
      addMessage('assistant', data.message.content, data.message);
      
      setCurrentStep(data.current_step);
      setProgress(data.progress_percentage);
      setState(data.state || {});

      // Check if conversation is complete
      if (data.state?.is_complete) {
        setTimeout(() => {
          onBlogCreated?.(data.state.final_blog);
          onClose();
        }, 2000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('assistant', 'Sorry, I encountered an error processing your message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOptionClick = (value, label) => {
    setInputValue(label);
    
    // Handle image generation option
    if (value === 'generate' && currentStep === 'handle_image') {
      handleGenerateImage();
    } else if (value === 'upload' && currentStep === 'handle_image') {
      // Send "upload" to backend, which will show upload UI
      sendMessage(value);
    } else if (value === 'skip' && currentStep === 'handle_image') {
      // Send "skip" to backend
      sendMessage(value);
    } else {
      sendMessage(value);
    }
  };

  const handleKeywordsSubmit = () => {
    const keywordsArray = keywords.filter(k => k.trim());
    if (keywordsArray.length === 0) {
      // Send empty to trigger AI suggestions
      sendMessage('');
    } else {
      // Send as JSON array
      sendMessage(JSON.stringify({ keywords: keywordsArray }));
    }
    // Clear keywords after submission to prevent showing again
    setKeywords(['', '', '']);
  };

  const handleScheduleSubmit = (scheduleType) => {
    if (scheduleType === 'now') {
      sendMessage('now');
    } else if (scheduleType === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        alert('Please select both date and time');
        return;
      }
      const datetime = `${scheduleDate}T${scheduleTime}`;
      sendMessage(datetime);
    }
  };

  const handleImageFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size too large. Maximum size is 10MB.');
        return;
      }
      
      setSelectedImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImageFile) {
      alert('Please select an image file first');
      return;
    }

    try {
      setUploadingImage(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const formData = new FormData();
      formData.append('conversation_id', conversationId);
      formData.append('file', selectedImageFile);

      const response = await fetch(`${API_BASE_URL}/custom-blog/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      
      // Add assistant response
      addMessage('assistant', data.message.content, data.message);
      
      setCurrentStep(data.current_step);
      setProgress(data.progress_percentage);
      setState(data.state || {});

      // Clear image selection
      setSelectedImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error uploading image:', error);
      addMessage('assistant', 'Sorry, I encountered an error uploading your image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGenerateImage = async () => {
    try {
      setGeneratingImage(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_BASE_URL}/custom-blog/generate-image?conversation_id=${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      
      // Add assistant response
      addMessage('assistant', data.message.content, data.message);
      
      setCurrentStep(data.current_step);
      setProgress(data.progress_percentage);
      setState(data.state || {});

    } catch (error) {
      console.error('Error generating image:', error);
      addMessage('assistant', 'Sorry, I encountered an error generating your image. Please try again.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'greet': return '👋';
      case 'ask_blog_type': return '📝';
      case 'ask_blog_topic': return '💭';
      case 'ask_keywords': return '🔑';
      case 'ask_blog_length': return '📏';
      case 'ask_images': return '🖼️';
      case 'confirm_outline': return '📋';
      case 'generate_blog': return '✨';
      case 'save_blog': return '💾';
      case 'display_result': return '🎉';
      default: return '🤖';
    }
  };

  const getStepName = (step) => {
    switch (step) {
      case 'greet': return 'Getting started';
      case 'ask_blog_type': return 'Select blog type';
      case 'ask_blog_topic': return 'Choose topic';
      case 'ask_keywords': return 'Add keywords';
      case 'ask_blog_length': return 'Select length';
      case 'ask_images': return 'Image options';
      case 'handle_image': return 'Image handling';
      case 'confirm_outline': return 'Review outline';
      case 'generate_blog': return 'Writing blog';
      case 'ask_schedule': return 'Schedule';
      case 'ask_publish_option': return 'Publish option';
      case 'save_blog': return 'Saving blog';
      case 'display_result': return 'Blog created';
      default: return 'Processing';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bg-black bg-opacity-50 flex items-end justify-center z-50 p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col border border-purple-100 mx-auto mb-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-200 bg-gradient-to-r from-pink-50 to-purple-50 rounded-t-2xl">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Emily - Blog Creator</h3>
              <div className="text-sm text-purple-600 font-medium">
                {progress > 0 ? (
                  <span>{getStepName(currentStep)} : {progress}%</span>
                ) : (
                  <span>{getStepName(currentStep)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRefreshConfirm(true)}
              disabled={isLoading}
              className="p-2 hover:bg-purple-100 rounded-full transition-colors disabled:opacity-50"
              title="Refresh conversation"
            >
              <RefreshCw className={`w-5 h-5 text-purple-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-pink-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-pink-500" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-pink-50 to-purple-50">
            <div className="w-full bg-purple-200 rounded-full h-3 shadow-inner">
              <div
                className="bg-gradient-to-r from-pink-400 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-white to-purple-25">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white'
                    : 'bg-gradient-to-br from-blue-50 to-purple-50 text-gray-800 border border-purple-200'
                }`}
              >
                {/* Show featured image if available in blog preview */}
                {message.image_url && currentStep === 'confirm_outline' && (
                  <div className="mt-3 mb-3">
                    <img
                      src={message.image_url}
                      alt="Blog featured image"
                      className="w-full max-w-md h-64 object-cover rounded-lg border border-purple-200 shadow-lg mx-auto"
                    />
                  </div>
                )}
                
                {/* Render content - check if it contains HTML tags */}
                {message.content && (message.content.includes('<p>') || message.content.includes('<div>') || message.content.includes('<h1>') || message.content.includes('<h2>') || message.content.includes('<ul>') || message.content.includes('<ol>')) ? (
                  // Render HTML content
                  <div 
                    className={`text-sm prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}
                    dangerouslySetInnerHTML={{ __html: message.content }}
                    style={{
                      color: message.role === 'user' ? 'white' : '#374151'
                    }}
                  />
                ) : (
                  // Render markdown content
                  <div className={`text-sm prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className={`text-lg font-bold mb-3 ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>{children}</h1>,
                        h2: ({children}) => <h2 className={`text-base font-bold mb-2 ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>{children}</h2>,
                        h3: ({children}) => <h3 className={`text-sm font-bold mb-2 ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>{children}</h3>,
                        p: ({children}) => <p className={`mb-3 leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>{children}</p>,
                        strong: ({children}) => <strong className={`font-semibold ${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>{children}</strong>,
                        em: ({children}) => <em className={`italic ${message.role === 'user' ? 'text-white' : 'text-gray-600'}`}>{children}</em>,
                        ul: ({children}) => <ul className={`list-disc list-inside mb-3 space-y-1 ${message.role === 'user' ? 'text-white' : ''}`}>{children}</ul>,
                        li: ({children}) => <li className={message.role === 'user' ? 'text-white' : 'text-gray-700'}>{children}</li>,
                        hr: () => <hr className={`my-4 ${message.role === 'user' ? 'border-white/30' : 'border-gray-300'}`} />,
                        code: ({children}) => <code className={`px-1 py-0.5 rounded text-xs font-mono ${message.role === 'user' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800'}`}>{children}</code>,
                        img: ({src, alt}) => (
                          <img 
                            src={src} 
                            alt={alt || 'Image'} 
                            className="w-full max-w-md h-64 object-cover rounded-lg border border-purple-200 shadow-lg my-4 mx-auto"
                          />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* Keywords Input (3 fields) - Only show for the message that asks for keywords */}
                {message.role === 'assistant' && 
                 currentStep === 'ask_keywords' && 
                 message.content && 
                 message.content.includes('keywords for SEO') && 
                 messages.indexOf(message) === messages.length - 1 && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-3">
                      <div className="text-sm font-bold text-purple-800 mb-3">Enter up to 3 SEO keywords (optional):</div>
                      <div className="text-xs text-purple-600 mb-2">These keywords will be naturally integrated into your blog content for SEO purposes.</div>
                      {[0, 1, 2].map((index) => (
                        <input
                          key={index}
                          type="text"
                          value={keywords[index] || ''}
                          onChange={(e) => {
                            const newKeywords = [...keywords];
                            newKeywords[index] = e.target.value;
                            setKeywords(newKeywords);
                          }}
                          placeholder={`SEO Keyword ${index + 1} (optional)`}
                          className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                        />
                      ))}
                      <button
                        onClick={handleKeywordsSubmit}
                        className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl mt-2"
                      >
                        {keywords.filter(k => k.trim()).length > 0 ? 'Submit Keywords' : 'Skip (Use AI Suggestions)'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Image Upload/Generate UI - Show when step is handle_image */}
                {message.role === 'assistant' && currentStep === 'handle_image' && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-4">
                      {/* Show options if message has image options (generate/upload/skip/approve/regenerate) */}
                      {message.options && message.options.some(opt => ['generate', 'upload', 'skip', 'approve', 'regenerate'].includes(opt.value)) && !message.image_url ? (
                        // Show image option buttons
                        <div className="space-y-3">
                          <div className="text-sm font-bold text-purple-800 mb-3">How would you like to add images?</div>
                          <div className="grid grid-cols-1 gap-3">
                            {message.options.map((option, index) => (
                              <button
                                key={index}
                                onClick={() => handleOptionClick(option.value, option.label)}
                                className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl text-left"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : message.content && message.content.includes('upload your image') ? (
                        // Upload UI
                        <>
                          <div className="text-sm font-bold text-purple-800 mb-3">Upload your image:</div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleImageFileSelect}
                            className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-pink-400 file:to-purple-500 file:text-white hover:file:from-pink-500 hover:file:to-purple-600"
                            disabled={uploadingImage}
                          />
                          {imagePreview && (
                            <div className="mt-3">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-full max-w-sm h-48 object-cover rounded-lg border border-purple-200 shadow-md"
                              />
                            </div>
                          )}
                          <button
                            onClick={handleImageUpload}
                            disabled={!selectedImageFile || uploadingImage}
                            className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                          >
                            {uploadingImage ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                <span>Upload Image</span>
                              </>
                            )}
                          </button>
                        </>
                      ) : message.content && message.content.includes('generating an image') ? (
                        // Generating image UI
                        <div className="flex items-center justify-center space-x-3 py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                          <span className="text-sm text-purple-700 font-medium">Generating image...</span>
                        </div>
                      ) : message.image_url && message.options && message.options.some(opt => ['approve', 'regenerate', 'skip'].includes(opt.value)) ? (
                        // Image approval UI
                        <div className="space-y-4">
                          <div className="text-sm font-bold text-purple-800 mb-3">Generated Image Preview:</div>
                          <div className="flex justify-center">
                            <img
                              src={message.image_url}
                              alt="Generated blog image"
                              className="w-full max-w-md h-64 object-cover rounded-lg border border-purple-200 shadow-lg"
                            />
                          </div>
                          <div className="text-sm text-purple-700 mb-3">Are you satisfied with this image?</div>
                          <div className="grid grid-cols-1 gap-3">
                            {message.options.map((option, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  if (option.value === 'regenerate') {
                                    handleGenerateImage();
                                  } else {
                                    handleOptionClick(option.value, option.label);
                                  }
                                }}
                                disabled={option.value === 'regenerate' && generatingImage}
                                className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                              >
                                {option.value === 'regenerate' && generatingImage ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Regenerating...</span>
                                  </>
                                ) : (
                                  <span>{option.label}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Schedule Input - Show ONLY for the message that asks for schedule */}
                {message.role === 'assistant' && 
                 currentStep === 'ask_schedule' && 
                 message.content && 
                 (message.content.includes('When would you like to publish') || message.content.includes('select a date and time')) && 
                 messages.indexOf(message) === messages.length - 1 && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-4">
                      {/* Show date/time inputs if message asks for them, otherwise show options */}
                      {message.content && message.content.includes('select a date and time') ? (
                        <>
                          <div className="text-sm font-bold text-purple-800">Please select a date and time:</div>
                          <div className="flex gap-3">
                            <input
                              type="date"
                              ref={dateInputRef}
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                            />
                            <input
                              type="time"
                              ref={timeInputRef}
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                            />
                          </div>
                          <button
                            onClick={() => handleScheduleSubmit('schedule')}
                            disabled={!scheduleDate || !scheduleTime}
                            className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            📅 Schedule Post
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-bold text-purple-800">When would you like to publish?</div>
                          <button
                            onClick={() => handleScheduleSubmit('now')}
                            className="w-full px-6 py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                          >
                            🚀 Publish Now
                          </button>
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-purple-800">Or schedule for later:</label>
                            <div className="flex gap-3">
                              <input
                                type="date"
                                ref={dateInputRef}
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                              />
                              <input
                                type="time"
                                ref={timeInputRef}
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                              />
                            </div>
                            <button
                              onClick={() => handleScheduleSubmit('schedule')}
                              disabled={!scheduleDate || !scheduleTime}
                              className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              📅 Schedule Post
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Options - Exclude steps that have custom UI */}
                {message.role === 'assistant' && message.options && message.options.length > 0 && currentStep !== 'ask_keywords' && currentStep !== 'ask_schedule' && currentStep !== 'handle_image' && (
                  <div className="mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {message.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleOptionClick(option.value, option.label)}
                          className="text-left p-4 bg-gradient-to-r from-white to-blue-50 border border-purple-200 rounded-xl hover:from-pink-50 hover:to-purple-50 hover:border-pink-300 hover:shadow-md transition-all duration-200 text-sm font-medium text-gray-700"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {message.timestamp && (
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl px-6 py-4 flex items-center space-x-3 border border-purple-200 shadow-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
                <span className="text-sm text-purple-700 font-medium">
                  {currentStep === 'generate_blog' 
                    ? 'Emily is writing your blog...' 
                    : 'Emily is thinking...'
                  }
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-purple-200 bg-gradient-to-r from-pink-50 to-purple-50 rounded-b-2xl">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 disabled:opacity-50 bg-white shadow-sm text-gray-700 placeholder-purple-400"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="p-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Refresh Confirmation Dialog */}
      {showRefreshConfirm && (
        <div className="fixed bg-black bg-opacity-50 flex items-center justify-center z-60 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-purple-200">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Refresh Conversation</h3>
                <p className="text-sm text-purple-600 font-medium">This will start a new conversation</p>
              </div>
            </div>
            <p className="text-gray-700 mb-8 leading-relaxed">
              Are you sure you want to refresh the conversation? This will clear all current progress and start over.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowRefreshConfirm(false)}
                className="flex-1 px-6 py-3 text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRefreshConfirm(false);
                  refreshConversation();
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomBlogChatbot;

