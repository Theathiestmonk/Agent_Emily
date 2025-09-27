import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Upload, Image, Video, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import ContentCard from './ContentCard';
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

const CustomContentChatbot = ({ isOpen, onClose, onContentCreated }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [mediaType, setMediaType] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [state, setState] = useState({});
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

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

  // Cleanup media preview URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  useEffect(() => {
    if (isOpen && !conversationId) {
      startConversation();
    }
  }, [isOpen]);

  const startConversation = async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`${API_BASE_URL}/custom-content/start`, {
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
      setShowMediaUpload(false);
      setMediaType(null);
      setUploadedFile(null);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError(null);
      setMediaPreview(null);
      setGeneratedContent(null);
      setState({});
      
      // Start a new conversation
      await startConversation();
    } catch (error) {
      console.error('Error refreshing conversation:', error);
      addMessage('assistant', 'Sorry, I encountered an error refreshing the conversation. Please try again.');
    }
  };

  const parseGeneratedContent = (messageContent, state) => {
    try {
      // Check if the message contains generated content
      if (messageContent.includes('I\'ve generated your') || 
          messageContent.includes('I\'ve analyzed your image') ||
          messageContent.includes('Here\'s what I created') ||
          messageContent.includes('Perfect! I\'ve analyzed')) {
        
        // Try to extract JSON content first
        const jsonMatch = messageContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        
        if (jsonMatch) {
          try {
            const jsonContent = JSON.parse(jsonMatch[1]);
            
            // Check if content field contains nested JSON
            let actualContent = jsonContent.content || '';
            let actualTitle = jsonContent.title || '';
            let actualHashtags = jsonContent.hashtags || [];
            let actualCallToAction = jsonContent.call_to_action || '';
            let actualEngagementHooks = jsonContent.engagement_hooks || '';
            let actualImageCaption = jsonContent.image_caption || '';
            let actualVisualElements = jsonContent.visual_elements || [];
            
            // If content contains nested JSON, try to parse it
            if (actualContent.includes('```json') && actualContent.includes('{')) {
              try {
                const nestedJsonMatch = actualContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (nestedJsonMatch) {
                  const nestedJson = JSON.parse(nestedJsonMatch[1]);
                  actualContent = nestedJson.content || actualContent;
                  actualTitle = nestedJson.title || actualTitle;
                  actualHashtags = nestedJson.hashtags || actualHashtags;
                  actualCallToAction = nestedJson.call_to_action || actualCallToAction;
                  actualEngagementHooks = nestedJson.engagement_hooks || actualEngagementHooks;
                  actualImageCaption = nestedJson.image_caption || actualImageCaption;
                  actualVisualElements = nestedJson.visual_elements || actualVisualElements;
                }
              } catch (nestedError) {
                console.warn('Failed to parse nested JSON, using outer content:', nestedError);
              }
            }
            
            // Create structured content object from JSON
            const content = {
              content: actualContent,
              title: actualTitle || `${state.selected_content_type || 'Content'} for ${state.selected_platform || 'Platform'}`,
              hashtags: actualHashtags.length > 0 ? actualHashtags : extractHashtags(actualContent),
              media_url: state.uploaded_media_url || state.generated_media_url,
              platform: state.selected_platform,
              content_type: state.selected_content_type,
              call_to_action: actualCallToAction,
              engagement_hooks: actualEngagementHooks,
              image_caption: actualImageCaption,
              visual_elements: actualVisualElements
            };
            
            return content;
          } catch (jsonError) {
            console.error('Error parsing JSON content:', jsonError);
            // Fall back to text parsing
          }
        }
        
        // Fallback: Try multiple patterns to extract plain text content
        let contentText = '';
        
        // Pattern 1: "Here's what I created:\n\n{content}"
        let contentMatch = messageContent.match(/Here's what I created:\n\n(.*?)(?:\n\n|$)/s);
        if (contentMatch) {
          contentText = contentMatch[1];
        } else {
          // Pattern 2: Look for content after "I've generated" or "I've analyzed"
          contentMatch = messageContent.match(/(?:I've generated your|I've analyzed your image and generated your).*?content\.\s*(.*?)(?:\n\n|$)/s);
          if (contentMatch) {
            contentText = contentMatch[1];
          } else {
            // Pattern 3: Look for content after "Perfect! I've analyzed"
            contentMatch = messageContent.match(/Perfect! I've analyzed.*?content\.\s*(.*?)(?:\n\n|$)/s);
            if (contentMatch) {
              contentText = contentMatch[1];
            }
          }
        }
        
        if (contentText) {
          // Clean up the content text
          contentText = contentText.trim();
          
          // Create structured content object
          const content = {
            content: contentText,
            title: `${state.selected_content_type || 'Content'} for ${state.selected_platform || 'Platform'}`,
            hashtags: extractHashtags(contentText),
            media_url: state.uploaded_media_url || state.generated_media_url,
            platform: state.selected_platform,
            content_type: state.selected_content_type
          };
          
          return content;
        }
      }
      return null;
    } catch (error) {
      console.error('Error parsing generated content:', error);
      return null;
    }
  };

  const extractHashtags = (text) => {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return text.match(hashtagRegex) || [];
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
      
      const response = await fetch(`${API_BASE_URL}/custom-content/input`, {
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

      // Parse generated content if available
      console.log('🔍 Full response data:', data);
      console.log('🔍 Message data:', data.message);
      console.log('🔍 Has structured_content:', !!data.message.structured_content);
      console.log('🔍 Current step:', data.current_step);
      console.log('🔍 State data:', data.state);
      
      // Check if message has structured_content (from parse_content step)
      if (data.message.structured_content) {
        console.log('✅ Using structured_content:', data.message.structured_content);
        setGeneratedContent(data.message.structured_content);
      } else if (data.message.content && data.state) {
        console.log('❌ No structured_content, trying text parsing...');
        // Fallback to parsing from text content
        const parsedContent = parseGeneratedContent(data.message.content, data.state);
        if (parsedContent) {
          console.log('✅ Parsed from text:', parsedContent);
          setGeneratedContent(parsedContent);
        } else {
          console.log('❌ No content found, clearing...');
          // Clear generated content if no content is found in this message
          setGeneratedContent(null);
        }
      } else {
        console.log('❌ No structured_content and no content/state, clearing...');
        setGeneratedContent(null);
      }

      // Check if we need to show media upload options
      // Show upload UI if user has chosen to upload media OR if we're in handle_media step
      if ((data.state?.has_media && data.state?.media_type) || data.current_step === 'handle_media') {
        setShowMediaUpload(true);
        setMediaType(data.state?.media_type);
      }

      // Hide media upload UI when content generation starts or other steps
      if (data.current_step === 'generate_content' || 
          data.current_step === 'parse_content' || 
          data.current_step === 'optimize_content' ||
          data.current_step === 'confirm_content' ||
          data.current_step === 'select_schedule' ||
          data.current_step === 'save_content') {
        setShowMediaUpload(false);
      }

      // Check if conversation is complete
      if (data.state?.is_complete) {
        setTimeout(() => {
          onContentCreated?.(data.state.final_post);
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

  const validateFile = (file) => {
    const maxSize = mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for images, 100MB for videos
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm'];
    
    if (file.size > maxSize) {
      return `File size too large. Maximum size is ${mediaType === 'image' ? '10MB' : '100MB'}.`;
    }
    
    if (mediaType === 'image' && !allowedImageTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).';
    }
    
    if (mediaType === 'video' && !allowedVideoTypes.includes(file.type)) {
      return 'Please upload a valid video file (MP4, MOV, AVI, MKV, or WebM).';
    }
    
    return null;
  };

  const createMediaPreview = (file) => {
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const formData = new FormData();
      formData.append('conversation_id', conversationId);
      formData.append('file', file);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      const response = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', `${API_BASE_URL}/custom-content/upload-media`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      
      // Add assistant response
      addMessage('assistant', response.message.content, response.message);
      setCurrentStep(response.current_step);
      setProgress(response.progress_percentage);
      setState(response.state || {});
      
      // Parse generated content from upload response
      console.log('🔍 Upload response data:', response);
      console.log('🔍 Upload message data:', response.message);
      console.log('🔍 Upload has structured_content:', !!response.message.structured_content);
      console.log('🔍 Upload current step:', response.current_step);
      
      // Check if message has structured_content (from parse_content step)
      if (response.message.structured_content) {
        console.log('✅ Using structured_content from upload:', response.message.structured_content);
        setGeneratedContent(response.message.structured_content);
      } else if (response.message.content && response.state) {
        console.log('❌ No structured_content in upload, trying text parsing...');
        // Fallback to parsing from text content
        const parsedContent = parseGeneratedContent(response.message.content, response.state);
        if (parsedContent) {
          console.log('✅ Parsed from upload text:', parsedContent);
          setGeneratedContent(parsedContent);
        } else {
          console.log('❌ No content found in upload, clearing...');
          setGeneratedContent(null);
        }
      } else {
        console.log('❌ No structured_content and no content/state in upload, clearing...');
        setGeneratedContent(null);
      }
      
      setShowMediaUpload(false);
      setUploadedFile(null);
      setMediaPreview(null);
      setUploadProgress(0);

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError('Sorry, I encountered an error uploading your file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setUploadError(null);
      createMediaPreview(file);
      // Don't auto-upload, let user confirm
    }
  };

  const confirmUpload = () => {
    if (uploadedFile) {
      handleFileUpload(uploadedFile);
    }
  };

  const cancelUpload = () => {
    setUploadedFile(null);
    setMediaPreview(null);
    setUploadError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOptionClick = (value, label) => {
    // Handle media choice options specially
    if (value === 'upload_image' || value === 'upload_video') {
      // Show media upload UI and set media type
      setShowMediaUpload(true);
      setMediaType(value === 'upload_image' ? 'image' : 'video');
      setUploadError(null);
      
      // Send the choice to backend
      setInputValue(label);
      sendMessage(label);
    } else {
      // For other options (generate, skip), hide media upload UI and send message
      setShowMediaUpload(false);
      setMediaType(null);
      setUploadedFile(null);
      setMediaPreview(null);
      setUploadError(null);
      
      setInputValue(label);
      sendMessage(label);
    }
  };


  const handleMediaConfirmation = (confirmation) => {
    const label = confirmation === 'yes' ? '✅ Yes, proceed' : '❌ No, upload different';
    
    // Send the confirmation to the backend (sendMessage will add the user message)
    setInputValue(label);
    sendMessage(confirmation);
  };

  const handleContentConfirmation = (confirmation) => {
    const label = confirmation === 'yes' ? '✅ Yes, save this post' : '❌ No, make changes';
    
    // Send the confirmation to the backend (sendMessage will add the user message)
    setInputValue(label);
    sendMessage(confirmation);
  };

  const handleScheduleSelection = (type) => {
    if (type === 'now') {
      const label = '🚀 Post Now';
      setInputValue(label);
      sendMessage('now');
    } else if (type === 'custom') {
      const date = dateInputRef.current?.value;
      const time = timeInputRef.current?.value;
      
      if (!date || !time) {
        alert('Please select both date and time');
        return;
      }
      
      const datetime = `${date}T${time}`;
      const label = `📅 Schedule for ${new Date(datetime).toLocaleString()}`;
      setInputValue(label);
      sendMessage(datetime);
    }
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'greet': return '👋';
      case 'ask_platform': return '📱';
      case 'ask_content_type': return '📝';
      case 'ask_description': return '💭';
      case 'ask_media': return '🎨';
      case 'confirm_media': return '👀';
      case 'generate_content': return '✨';
      case 'confirm_content': return '✅';
      case 'select_schedule': return '📅';
      case 'save_content': return '💾';
      case 'display_result': return '🎉';
      default: return '🤖';
    }
  };

  const getStepName = (step) => {
    switch (step) {
      case 'greet': return 'Getting Started';
      case 'ask_platform': return 'Selecting Platform';
      case 'ask_content_type': return 'Choosing Content Type';
      case 'ask_description': return 'Describing Content';
      case 'ask_media': return 'Adding Media';
      case 'confirm_media': return 'Confirming Media';
      case 'generate_content': return 'Generating Content';
      case 'confirm_content': return 'Confirming Content';
      case 'select_schedule': return 'Selecting Schedule';
      case 'save_content': return 'Saving Content';
      case 'display_result': return 'Complete';
      default: return 'Processing';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl aspect-[4/3] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Emily - Content Creator</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{getStepIcon(currentStep)}</span>
                <span>{getStepName(currentStep)}</span>
                {progress > 0 && (
                  <>
                    <span>•</span>
                    <span>{progress}%</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRefreshConfirm(true)}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              title="Refresh conversation"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="px-4 py-2 bg-gray-50">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Show uploaded media in conversation */}
                {message.media_url && (
                  <div className="mt-3">
                    {message.media_type?.startsWith('image') ? (
                      <img 
                        src={message.media_url} 
                        alt="Uploaded media" 
                        className="max-w-full h-48 object-cover rounded-lg border border-gray-200"
                      />
                    ) : message.media_type?.startsWith('video') ? (
                      <video 
                        src={message.media_url} 
                        controls 
                        className="max-w-full h-48 object-cover rounded-lg border border-gray-200"
                      />
                    ) : null}
                  </div>
                )}
                
                {/* Platform Options */}
                {message.role === 'assistant' && message.options && message.options.length > 0 && !showMediaUpload && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {message.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleOptionClick(option.value, option.label)}
                          className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-pink-300 transition-colors text-sm font-medium"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                
                {/* File Upload Input */}
                {message.role === 'assistant' && message.content && message.content.includes('Please upload your') && showMediaUpload && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        {mediaType === 'image' ? (
                          <Image className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Video className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-sm font-medium text-blue-900">
                          Upload {mediaType === 'image' ? 'Image' : 'Video'}
                        </span>
                      </div>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                        onChange={handleFileSelect}
                        className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      
                      <div className="text-xs text-blue-700">
                        {mediaType === 'image' 
                          ? 'Supported formats: JPEG, PNG, GIF, WebP (max 10MB)'
                          : 'Supported formats: MP4, MOV, AVI, MKV, WebM (max 100MB)'
                        }
                      </div>
                      
                      {uploadError && (
                        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                          <AlertCircle className="w-4 h-4" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                      
                      {mediaPreview && uploadedFile && !isUploading && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-blue-900">Preview:</div>
                          <div className="max-w-xs">
                            {mediaType === 'image' ? (
                              <img
                                src={mediaPreview}
                                alt="Preview"
                                className="w-full h-32 object-cover rounded-md border border-gray-200"
                              />
                            ) : (
                              <video
                                src={mediaPreview}
                                controls
                                className="w-full h-32 object-cover rounded-md border border-gray-200"
                              />
                            )}
                          </div>
                          <div className="text-xs text-blue-700">
                            {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </div>
                          <button
                            onClick={confirmUpload}
                            className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center justify-center space-x-1"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload & Continue</span>
                          </button>
                        </div>
                      )}
                      
                      {isUploading && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-blue-700">
                            <span>Uploading {uploadedFile?.name}...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Media Confirmation Options */}
                {message.role === 'assistant' && message.content && message.content.includes('Is this the correct media') && (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMediaConfirmation('yes')}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        ✅ Yes, proceed
                      </button>
                      <button
                        onClick={() => handleMediaConfirmation('no')}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        ❌ No, upload different
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Content Confirmation Options */}
                {message.role === 'assistant' && message.content && message.content.includes('Please review it above and let me know if you\'d like to save this post') && (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContentConfirmation('yes')}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        ✅ Yes, save this post
                      </button>
                      <button
                        onClick={() => handleContentConfirmation('no')}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        ❌ No, make changes
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Schedule Selection */}
                {message.role === 'assistant' && message.content && message.content.includes('Now let\'s schedule your post') && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-blue-900">Select Post Schedule:</div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => handleScheduleSelection('now')}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          🚀 Post Now
                        </button>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-blue-900">Or schedule for later:</label>
                          <div className="flex gap-2">
                            <input
                              type="date"
                              ref={dateInputRef}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <input
                              type="time"
                              ref={timeInputRef}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <button
                            onClick={() => handleScheduleSelection('custom')}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            📅 Schedule Post
                          </button>
                        </div>
                      </div>
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
          
          {/* Generated Content Card */}
          {generatedContent && (
            <div className="flex justify-start">
              <div className="w-full max-w-md">
                <ContentCard
                  content={generatedContent}
                  platform={generatedContent.platform}
                  contentType={generatedContent.content_type}
                  onEdit={(content) => {
                    console.log('Edit content:', content);
                    // TODO: Implement edit functionality
                  }}
                  onCopy={(content) => {
                    console.log('Copy content:', content);
                    // Copy functionality is handled in ContentCard
                  }}
                  onPreview={(content) => {
                    console.log('Preview content:', content);
                    // TODO: Implement preview functionality
                  }}
                />
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-600">
                  {currentStep === 'generate_content' 
                    ? 'Emily is analyzing your image and generating content...' 
                    : 'Emily is thinking...'
                  }
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>


        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="p-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Refresh Confirmation Dialog */}
      {showRefreshConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Refresh Conversation</h3>
                <p className="text-sm text-gray-500">This will start a new conversation</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to refresh the conversation? This will clear all current progress and start over.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRefreshConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRefreshConfirm(false);
                  refreshConversation();
                }}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
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

export default CustomContentChatbot;
