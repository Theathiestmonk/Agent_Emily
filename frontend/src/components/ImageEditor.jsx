import React, { useState, useRef, useEffect } from 'react';
import { 
  ImageIcon, 
  Upload, 
  Wand2, 
  Palette, 
  Edit3, 
  RotateCcw, 
  X, 
  CheckCircle,
  Loader2,
  Sparkles,
  Download,
  Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';

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

const ImageEditor = ({ 
  isOpen, 
  onClose, 
  postContent, 
  inputImageUrl, 
  onImageSaved 
}) => {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('entry');
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [editedImageUrl, setEditedImageUrl] = useState(null);
  
  // Debug: Log when editedImageUrl changes
  useEffect(() => {
    console.log('🔄 editedImageUrl state changed:', editedImageUrl);
  }, [editedImageUrl]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [editingHistory, setEditingHistory] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [templateName, setTemplateName] = useState('');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && postContent && inputImageUrl) {
      startImageEdit();
    }
  }, [isOpen, postContent, inputImageUrl]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const startImageEdit = async () => {
    try {
      setIsLoading(true);
      
      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('🔍 Image Editor - Starting image edit:', {
        apiUrl: API_BASE_URL,
        hasToken: !!authToken,
        userId: user?.id,
        postContent: postContent?.substring(0, 50) + '...',
        inputImageUrl: inputImageUrl
      });
      
      const response = await fetch(`${API_BASE_URL}/image-editor/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          post_content: postContent,
          input_image_url: inputImageUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Image Editor API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Image Editor Response:', data);
      console.log('🖼️ Initial Edited Image URL:', data.edited_image_url);
      
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        setMessages([data.message]);
        setCurrentStep(data.current_step);
        setProgressPercentage(data.progress_percentage);
        
        if (data.edited_image_url) {
          console.log('✅ Setting initial edited image URL:', data.edited_image_url);
          setEditedImageUrl(data.edited_image_url);
        } else {
          console.log('❌ No initial edited image URL');
        }
      }
    } catch (error) {
      console.error('❌ Error starting image edit:', error);
      // Show error message to user
      setMessages([{
        role: 'assistant',
        content: `❌ Error starting image editor: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (input = userInput) => {
    if (!input.trim() || !conversationId) return;

    try {
      setIsLoading(true);
      setUserInput('');

      // Add user message to UI immediately
      const userMessage = {
        role: 'user',
        content: input,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);

      const authToken = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image-editor/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_input: input
        })
      });

      const data = await response.json();
      console.log('📥 Image Editor Response:', data);
      console.log('🖼️ Edited Image URL:', data.edited_image_url);
      
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
          setCurrentStep(data.current_step);
          setProgressPercentage(data.progress_percentage);
          
          if (data.edited_image_url) {
            console.log('✅ Setting edited image URL:', data.edited_image_url);
            setEditedImageUrl(data.edited_image_url);
          } else {
            console.log('❌ No edited image URL in response');
          }
          
          if (data.state) {
            setEditingHistory(data.state.editing_history || []);
          }
          
          // Check if image was saved successfully
          if (data.current_step === 'save_image' && data.edited_image_url && onImageSaved) {
            console.log('✅ Image saved successfully, calling onImageSaved callback');
            onImageSaved(data.edited_image_url);
          }
        }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = (value) => {
    console.log('Button clicked:', value);
    // Send the button value as a message
    sendMessage(value);
  };

  const handleTemplateUpload = async () => {
    if (!templateFile || !templateName.trim()) return;

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('conversation_id', conversationId);
      formData.append('template_name', templateName);
      formData.append('file', templateFile);

      const authToken = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image-editor/upload-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setShowTemplateUpload(false);
        setTemplateFile(null);
        setTemplateName('');
      }
    } catch (error) {
      console.error('Error uploading template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/image-editor/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      setAvailableTemplates(data.templates || []);
      setShowTemplates(true);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const selectTemplate = (templateName) => {
    sendMessage(`Use template: ${templateName}`);
    setShowTemplates(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStepName = (step) => {
    switch (step) {
      case 'entry': return 'Getting Started';
      case 'add_logo': return 'Adding Logo';
      case 'use_template': return 'Applying Template';
      case 'manual_instruction': return 'Manual Editing';
      case 'confirm_result': return 'Review Result';
      case 'save_image': return 'Saving Image';
      case 'continue_editing': return 'Continue Editing';
      case 'error': return 'Error';
      default: return step;
    }
  };

  const renderEditOptions = () => {
    if (currentStep !== 'entry' && currentStep !== 'continue_editing') return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => sendMessage('Add logo')}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
          >
            <Palette className="w-5 h-5" />
            <span>Add Logo</span>
          </button>
          
          <button
            onClick={loadTemplates}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50"
          >
            <Wand2 className="w-5 h-5" />
            <span>Use Template</span>
          </button>
          
          <button
            onClick={() => sendMessage('Manual instruction')}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50"
          >
            <Edit3 className="w-5 h-5" />
            <span>Manual Instructions</span>
          </button>
        </div>
      </div>
    );
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[70vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Image Editor</h2>
              <p className="text-sm text-gray-600">{getStepName(currentStep)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 font-medium">{progressPercentage}%</span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {message.image_url && (
                      <div className="mt-3">
                        <img
                          src={message.image_url}
                          alt="Logo preview"
                          className="w-24 h-24 object-contain rounded-lg shadow-lg border border-gray-200"
                        />
                      </div>
                    )}
                    {message.buttons && message.buttons.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {message.buttons.map((button, btnIndex) => (
                          <button
                            key={btnIndex}
                            onClick={() => handleButtonClick(button.value)}
                            className="text-left p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-colors text-sm font-medium"
                          >
                            {button.text}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs opacity-70 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-4 rounded-2xl">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              {renderEditOptions()}
              
              <div className="mt-4 flex space-x-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What do you want to do?"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !userInput.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar - Image Preview */}
          <div className="w-80 border-l border-gray-200 bg-gray-50 p-6">
            {/* Your Image Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Image</h3>
              {inputImageUrl ? (
                <div className="relative">
                  <img
                    src={inputImageUrl}
                    alt="Original image"
                    className="w-full rounded-lg shadow-lg"
                  />
                  <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    Original
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-200 rounded-lg">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <p>No image available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Edited Image Preview */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edited Preview</h3>
              {console.log('🎨 Rendering edited preview section, editedImageUrl:', editedImageUrl)}
              {editedImageUrl ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={editedImageUrl}
                      alt="Edited image"
                      className="w-full rounded-lg shadow-lg"
                      onLoad={() => console.log('✅ Edited image loaded successfully')}
                      onError={(e) => console.log('❌ Edited image failed to load:', e)}
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Edited
                    </div>
                  </div>
                  
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-200 rounded-lg">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <p>No edited image yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Editing History */}
            {editingHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Editing History</h4>
                <div className="space-y-2">
                  {editingHistory.map((edit, index) => (
                    <div key={index} className="text-xs text-gray-600 bg-white p-2 rounded">
                      <div className="font-medium capitalize">{edit.type.replace('_', ' ')}</div>
                      <div className="text-gray-500">
                        {new Date(edit.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Templates Modal */}
        {showTemplates && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Choose a Template</h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => selectTemplate(template.name)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 cursor-pointer transition-colors"
                  >
                    <div className="aspect-video bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-semibold">{template.name}</h4>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => {
                  setShowTemplates(false);
                  setShowTemplateUpload(true);
                }}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 transition-colors"
              >
                <Upload className="w-5 h-5 mx-auto mb-1" />
                Upload Custom Template
              </button>
            </div>
          </div>
        )}

        {/* Template Upload Modal */}
        {showTemplateUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Upload Template</h3>
                <button
                  onClick={() => setShowTemplateUpload(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter template name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setTemplateFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleTemplateUpload}
                    disabled={!templateFile || !templateName.trim() || isLoading}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Upload Template'}
                  </button>
                  
                  <button
                    onClick={() => setShowTemplateUpload(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageEditor;
