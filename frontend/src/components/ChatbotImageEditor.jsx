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
  Send,
  Layout
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import TemplateSelector from './TemplateSelector';

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
})();

const ChatbotImageEditor = ({ 
  isOpen, 
  onClose, 
  postContent, 
  inputImageUrl, 
  onImageSaved 
}) => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState(null);
  const [currentStep, setCurrentStep] = useState('initial');
  const [fullImageModal, setFullImageModal] = useState({ isOpen: false, imageUrl: '', title: '' });
  const [currentWorkingImageUrl, setCurrentWorkingImageUrl] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      initializeChat();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update working image when edited image changes
  useEffect(() => {
    if (editedImageUrl && currentStep === 'preview') {
      setCurrentWorkingImageUrl(editedImageUrl);
    }
  }, [editedImageUrl, currentStep]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const initializeChat = () => {
    const initialMessage = {
      role: 'assistant',
      content: `Hey there! 👋 I'm excited to help you edit your image! What would you like to do with your image today?`,
      timestamp: new Date().toISOString(),
      buttons: [
        { text: 'Add My Logo', value: 'add logo', type: 'action', icon: 'Palette' },
        { text: 'Use a Template', value: 'use template', type: 'action', icon: 'Layout' },
        { text: 'Give Instructions', value: 'manual instructions', type: 'action', icon: 'Edit3' }
      ]
    };
    
    setMessages([initialMessage]);
    setCurrentStep('initial');
    setEditedImageUrl(null);
    setCurrentWorkingImageUrl(inputImageUrl);
  };

  const addMessage = (role, content, imageUrl = null, buttons = null) => {
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageUrl && { image_url: imageUrl }),
      ...(buttons && { buttons })
    };
    
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const input = userInput.trim();
    setUserInput('');
    
    // Add user message
    addMessage('user', input);
    
    setIsLoading(true);

    try {
      if (currentStep === 'initial') {
        await handleInitialInput(input);
      } else if (currentStep === 'logo_placement') {
        await handleLogoPlacement(input);
      } else if (currentStep === 'manual_input') {
        await handleManualInstructions(input);
      } else if (currentStep === 'preview') {
        await handlePreviewAction(input);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('assistant', `❌ **Error**: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialInput = async (input) => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('logo') || lowerInput.includes('add logo')) {
      await startAddLogo();
    } else if (lowerInput.includes('template') || lowerInput.includes('use template')) {
      await startTemplateSelection();
    } else if (lowerInput.includes('manual') || lowerInput.includes('instruction')) {
      await startManualInstructions();
    } else {
      addMessage('assistant', 'I\'m not quite sure what you\'d like to do! Could you pick one of these options?\n\n🎨 **Add Logo**\n📋 **Use Template**\n✏️ **Give Instructions**');
    }
  };

  const startTemplateSelection = async () => {
    addMessage('assistant', 'Great choice! Let me show you our beautiful template collection. You can choose from pre-made templates or upload your own custom design.');
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template) => {
    addMessage('assistant', `Perfect! I've selected the "${template.name}" template. Let me apply it to your content and create a beautiful design for you.`);
    setShowTemplateSelector(false);
    
    // Start the template application process
    applyTemplate(template);
  };

  const handleCustomUpload = (template) => {
    addMessage('assistant', `Excellent! I've uploaded your custom template "${template.name}". Let me apply it to your content now.`);
    setShowTemplateSelector(false);
    
    // Start the template application process
    applyTemplate(template);
  };

  const applyTemplate = async (template) => {
    try {
      setIsLoading(true);
      setCurrentStep('template_application');
      
      addMessage('assistant', '🎨 **Applying Template...**\n\nI\'m now analyzing your content and applying the template design. This will create a beautiful, professional-looking image that matches your content perfectly.');
      
      // Here you would integrate with the template editor API
      // For now, we'll simulate the process
      const authToken = await getAuthToken();
      
      // Create form data
      const formData = new FormData();
      formData.append('template_id', template.id);
      formData.append('content', postContent);
      if (inputImageUrl) {
        formData.append('image_url', inputImageUrl);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/template-editor/apply-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEditedImageUrl(data.edited_image_url);
          setCurrentStep('preview');
          addMessage('assistant', '✨ **Template Applied Successfully!**\n\nYour content has been beautifully formatted using the template. Take a look at the result!', data.edited_image_url, [
            { text: 'Save Image', value: 'save', type: 'action', icon: 'Download' },
            { text: 'Try Another Template', value: 'use template', type: 'action', icon: 'Layout' },
            { text: 'Make Adjustments', value: 'continue_editing', type: 'action', icon: 'Edit3' }
          ]);
        } else {
          throw new Error(data.message || 'Failed to apply template');
        }
      } else {
        throw new Error('Failed to apply template');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      addMessage('assistant', `❌ **Error applying template**: ${error.message}\n\nLet me know if you'd like to try a different template or give me manual instructions instead.`);
      setCurrentStep('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const startAddLogo = async () => {
    try {
      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user profile for logo
      const response = await fetch(`${API_BASE_URL}/simple-image-editor/profiles/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const profile = await response.json();
        const logoUrl = profile.logo_url;
        
        if (logoUrl) {
          addMessage('assistant', 
            `Perfect! I found your logo and I'm ready to add it to your image. Here's what your logo looks like:`,
            logoUrl
          );
          
          // Add a follow-up message with the placement question and buttons
          setTimeout(() => {
            addMessage('assistant', 
              'Where would you like me to place it?',
              null,
              [
                { text: 'Top Left', value: 'top_left', type: 'position' },
                { text: 'Top Right', value: 'top_right', type: 'position' },
                { text: 'Bottom Left', value: 'bottom_left', type: 'position' },
                { text: 'Bottom Right', value: 'bottom_right', type: 'position' },
                { text: 'Center', value: 'center', type: 'position' }
              ]
            );
          }, 100);
          setCurrentStep('logo_placement');
        } else {
          addMessage('assistant', 'Oops! I couldn\'t find a logo in your profile. You\'ll need to upload one in your profile settings first, then come back and I\'ll help you add it to your image! 😊');
        }
      } else {
        addMessage('assistant', 'Hmm, I\'m having trouble accessing your profile right now. Could you try again in a moment?');
      }
    } catch (error) {
      addMessage('assistant', `Sorry, something went wrong: ${error.message}`);
    }
  };

  const handleLogoPlacement = async (input) => {
    const lowerInput = input.toLowerCase();
    let position = 'bottom_right';
    
    if (lowerInput.includes('top left') || lowerInput.includes('top_left')) {
      position = 'top_left';
    } else if (lowerInput.includes('top right') || lowerInput.includes('top_right')) {
      position = 'top_right';
    } else if (lowerInput.includes('bottom left') || lowerInput.includes('bottom_left')) {
      position = 'bottom_left';
    } else if (lowerInput.includes('bottom right') || lowerInput.includes('bottom_right')) {
      position = 'bottom_right';
    } else if (lowerInput.includes('center')) {
      position = 'center';
    }

    await addLogoToImage(position);
  };

  const addLogoToImage = async (position) => {
    try {
      addMessage('assistant', `Great choice! I'm adding your logo to the ${position.replace('_', ' ')} of the image. This will just take a moment...`);
      
      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/add-logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          input_image_url: inputImageUrl,
          content: postContent,
          position: position
        })
      });

      const data = await response.json();

      if (data.success) {
        setEditedImageUrl(data.edited_image_url);
        addMessage('assistant', 
          `Perfect! I've added your logo to the ${position.replace('_', ' ')} of the image. It looks great and maintains the original design while adding your branding.

What would you like to do next?`,
          data.edited_image_url,
          [
            { text: 'Save This Image', value: 'save', type: 'action', icon: 'CheckCircle' },
            { text: 'Try Something Else', value: 'continue', type: 'action', icon: 'RotateCcw' }
          ]
        );
        setCurrentStep('preview');
      } else {
        throw new Error(data.error || 'Failed to add logo');
      }
    } catch (error) {
      addMessage('assistant', `Oops! I ran into trouble adding your logo: ${error.message}`);
    }
  };

  const startManualInstructions = () => {
    addMessage('assistant', 
      `Awesome! What would you like me to do with your image? Here are some ideas: "Make it more colorful", "Add a sunset background", "Crop to square", "Add text overlay", "Convert to black and white", "Add vintage effect", "Create dramatic lighting", or "Add background blur".`
    );
    setCurrentStep('manual_input');
  };

  const handleManualInstructions = async (instructions) => {
    try {
      addMessage('assistant', `Got it! I'm working on: "${instructions}" - this might take a moment while I get creative!`);
      
      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      // Use current working image (either original or previously edited)
      const imageToEdit = currentWorkingImageUrl || inputImageUrl;
      
      console.log('Image editing debug:', {
        currentWorkingImageUrl,
        inputImageUrl,
        imageToEdit,
        instructions
      });

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/manual-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user?.id,
          input_image_url: imageToEdit,
          content: postContent,
          instructions: instructions
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Manual edit response:', data);

      if (data.success) {
        setEditedImageUrl(data.edited_image_url);
        setCurrentWorkingImageUrl(data.edited_image_url); // Update working image
        addMessage('assistant', 
          `Fantastic! I've applied your creative vision to the image. Take a look at what I came up with!

What would you like to do next?`,
          data.edited_image_url,
          [
            { text: 'Save This Image', value: 'save', type: 'action', icon: 'CheckCircle' },
            { text: 'Make More Changes', value: 'continue_editing', type: 'action', icon: 'Edit3' },
            { text: 'Start Over', value: 'restart', type: 'action', icon: 'RotateCcw' }
          ]
        );
        setCurrentStep('preview');
      } else {
        throw new Error(data.error || 'Failed to apply instructions');
      }
    } catch (error) {
      console.error('Manual instructions error:', error);
      addMessage('assistant', `Hmm, I had trouble with that request: ${error.message}`);
    }
  };

  const handlePreviewAction = async (input) => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('save') || lowerInput.includes('yes') || lowerInput.includes('accept')) {
      await saveImage();
    } else if (lowerInput.includes('continue_editing') || lowerInput.includes('make more changes')) {
      continueEditing();
    } else if (lowerInput.includes('restart') || lowerInput.includes('start over')) {
      restartEditing();
    } else {
      addMessage('assistant', 'I need a bit more clarity! Would you like to:\n\n✅ **Save this image** - Keep this version\n✏️ **Make More Changes** - Continue editing\n🔄 **Start Over** - Begin fresh');
    }
  };

  const continueEditing = () => {
    console.log('Continue editing - before update:', {
      currentWorkingImageUrl,
      editedImageUrl
    });
    
    // Update the working image to the latest edited version
    if (editedImageUrl) {
      setCurrentWorkingImageUrl(editedImageUrl);
      console.log('Updated currentWorkingImageUrl to:', editedImageUrl);
    }
    
    addMessage('assistant', 
      `Perfect! What would you like me to do next? Here are some ideas: "Make it more colorful", "Add a sunset background", "Crop to square", "Add text overlay", "Convert to black and white", "Add vintage effect", "Create dramatic lighting", or "Add background blur".`
    );
    setCurrentStep('manual_input');
  };

  const restartEditing = () => {
    setCurrentWorkingImageUrl(inputImageUrl);
    setEditedImageUrl(null);
    addMessage('assistant', 
      `No problem! Let's start fresh. What would you like me to do? Here are some ideas: "Make it more colorful", "Add a sunset background", "Crop to square", "Add text overlay", "Convert to black and white", "Add vintage effect", "Create dramatic lighting", or "Add background blur".`
    );
    setCurrentStep('manual_input');
  };

  const saveImage = async () => {
    try {
      addMessage('assistant', `Perfect! I'm saving your edited image right now...`);
      
      const authToken = await getAuthToken();
      const { data: { user } } = await supabase.auth.getUser();

      // Determine which save endpoint to use based on current step
      let response;
      if (currentStep === 'template_application' || currentStep === 'preview') {
        // Use template editor save endpoint
        const formData = new FormData();
        formData.append('original_image_url', inputImageUrl);
        formData.append('edited_image_url', editedImageUrl);

        response = await fetch(`${API_BASE_URL}/api/template-editor/save-template`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });
      } else {
        // Use simple image editor save endpoint
        response = await fetch(`${API_BASE_URL}/simple-image-editor/save-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            user_id: user?.id,
            original_image_url: inputImageUrl,
            edited_image_url: editedImageUrl
          })
        });
      }

      const data = await response.json();

      if (data.success) {
        addMessage('assistant', `🎉 Awesome! Your edited image has been saved and has completely replaced the original image. The same URL now shows your edited version!`);
        
        if (onImageSaved) {
          // Pass the original URL since that's what now contains the edited image
          onImageSaved(inputImageUrl);
        }
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to save image');
      }
    } catch (error) {
      addMessage('assistant', `Oops! I had trouble saving your image: ${error.message}`);
    }
  };

  const handleButtonClick = async (button) => {
    const input = button.value;
    
    // Add user message immediately
    addMessage('user', input);
    
    setIsLoading(true);

    try {
      if (currentStep === 'initial') {
        await handleInitialInput(input);
      } else if (currentStep === 'logo_placement') {
        await handleLogoPlacement(input);
      } else if (currentStep === 'manual_input') {
        await handleManualInstructions(input);
      } else if (currentStep === 'preview') {
        await handlePreviewAction(input);
      }
    } catch (error) {
      console.error('Error processing button click:', error);
      addMessage('assistant', `Sorry, something went wrong: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageClick = (imageUrl, title) => {
    setFullImageModal({
      isOpen: true,
      imageUrl,
      title
    });
  };

  const closeFullImageModal = () => {
    setFullImageModal({
      isOpen: false,
      imageUrl: '',
      title: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[70vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Image Editor</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Images */}
          <div className="w-1/4 p-6 border-r border-gray-200 bg-gray-50">
            <div className="relative mb-6 p-2 bg-white rounded-lg shadow-lg">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Original Image</h3>
              <img
                src={inputImageUrl}
                alt="Original image"
                className="w-full h-48 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handleImageClick(inputImageUrl, 'Original Image')}
              />
              <div className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                Original
              </div>
            </div>
            
            <div className="p-2 bg-white rounded-lg shadow-lg">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Updated Image</h3>
              <div className="relative">
                {currentWorkingImageUrl && currentWorkingImageUrl !== inputImageUrl ? (
                  <>
                    <img
                      src={currentWorkingImageUrl}
                      alt="Current working image"
                      className="w-full h-48 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(currentWorkingImageUrl, 'Current Working Image')}
                    />
                    <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Working
                    </div>
                  </>
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 text-center">
                      No edits yet
                    </p>
                    <p className="text-xs text-gray-400 text-center mt-1">
                      Start editing to see changes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Chat Interface */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gradient-to-r from-purple-50 to-pink-50 text-gray-800 border border-purple-200'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    
                    {message.image_url && (
                      <div className="mt-3">
                        <img
                          src={message.image_url}
                          alt="Message image"
                          className="w-24 h-24 object-contain rounded-lg"
                        />
                      </div>
                    )}
                    
                    {message.buttons && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {message.buttons.map((button, btnIndex) => {
                          const IconComponent = button.icon ? 
                            (button.icon === 'Palette' ? Palette : 
                             button.icon === 'Layout' ? Layout : 
                             button.icon === 'Edit3' ? Edit3 : 
                             button.icon === 'CheckCircle' ? CheckCircle : 
                             button.icon === 'RotateCcw' ? RotateCcw : null) : null;
                          
                          return (
                            <button
                              key={btnIndex}
                              onClick={() => handleButtonClick(button)}
                              className="px-3 py-3 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-pink-500 hover:to-purple-500 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                            >
                              {IconComponent && <IconComponent className="w-4 h-4" />}
                              <span>{button.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 text-gray-800 rounded-2xl px-4 py-3 border border-purple-200">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      <span>Processing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What do you want to do?"
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isLoading}
                  className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-pink-500 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Image Modal */}
      {fullImageModal.isOpen && (
        <div className="fixed bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{fullImageModal.title}</h3>
              <button
                onClick={closeFullImageModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Image */}
            <div className="p-4">
              <img
                src={fullImageModal.imageUrl}
                alt={fullImageModal.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Template Selector */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onTemplateSelect={handleTemplateSelect}
        onCustomUpload={handleCustomUpload}
      />
    </div>
  );
};

export default ChatbotImageEditor;
