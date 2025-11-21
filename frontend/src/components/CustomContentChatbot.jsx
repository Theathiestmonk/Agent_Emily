import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Upload, Image, Video, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
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
  
  // Carousel-specific state
  const [carouselImages, setCarouselImages] = useState([]);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [isGeneratingCarouselImage, setIsGeneratingCarouselImage] = useState(false);
  const [uploadedCarouselImages, setUploadedCarouselImages] = useState([]);
  const [showCarouselUpload, setShowCarouselUpload] = useState(false);
  const [carouselMaxImages, setCarouselMaxImages] = useState(10);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const carouselFileInputRef = useRef(null);
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

  // Watch for step changes and update carousel images from state
  useEffect(() => {
    console.log('🔍 useEffect triggered - currentStep:', currentStep, 'carouselImages.length:', carouselImages.length);
    console.log('🔍 Full state object:', JSON.stringify(state, null, 2));
    
    if (currentStep === 'approve_carousel_images') {
      console.log('🔍 In approve_carousel_images step');
      console.log('🔍 state.carousel_images:', state?.carousel_images);
      console.log('🔍 Is array?', Array.isArray(state?.carousel_images));
      
      if (state && state.carousel_images && Array.isArray(state.carousel_images) && state.carousel_images.length > 0) {
        const stateImages = state.carousel_images.map((img, idx) => {
          // Handle different formats: string URL, object with url property, or object with url nested
          let imageUrl = '';
          if (typeof img === 'string') {
            imageUrl = img;
          } else if (img && typeof img === 'object') {
            imageUrl = img.url || img.image_url || img.src || '';
          }
          
          const imagePrompt = typeof img === 'object' ? (img.prompt || '') : '';
          
          console.log(`🔍 Image ${idx}:`, { url: imageUrl, prompt: imagePrompt, original: img });
          
          return {
            url: imageUrl,
            index: idx,
            prompt: imagePrompt,
            approved: false
          };
        }).filter(img => img.url); // Filter out any images without URLs
        
        console.log('🔍 Processed stateImages:', stateImages);
        console.log('🔍 Filtered images count:', stateImages.length);
        
        if (stateImages.length >= 4) {
          console.log('✅ Setting carousel images:', stateImages);
          console.log('✅ Image URLs:', stateImages.map(img => img.url));
          // Set exactly 4 images
          const imagesToSet = stateImages.slice(0, 4);
          setCarouselImages(imagesToSet);
          setIsGeneratingCarouselImage(false);
          console.log('✅ Carousel images state updated, length:', imagesToSet.length);
        } else if (stateImages.length > 0) {
          console.warn('⚠️ Expected 4 images but got:', stateImages.length, 'images:', stateImages);
          // Still set them if we have some images
          setCarouselImages(stateImages);
          setIsGeneratingCarouselImage(false);
        } else {
          console.error('❌ No valid image URLs found in carousel_images');
          setIsGeneratingCarouselImage(false);
        }
      } else {
        console.warn('⚠️ No carousel_images in state or not an array. State keys:', state ? Object.keys(state) : 'state is null');
      }
    }
  }, [currentStep, state]);

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
      // Reset carousel state
      setCarouselImages([]);
      setCurrentCarouselIndex(0);
      setIsGeneratingCarouselImage(false);
      setUploadedCarouselImages([]);
      setShowCarouselUpload(false);
      setCarouselMaxImages(10);
      
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
      
      // Content is now displayed directly in chatbot messages - no more content cards
      // Clear any existing generated content to prevent card display
      setGeneratedContent(null);

      // Check if we need to show media upload options
      // Show upload UI if user has chosen to upload media OR if we're in handle_media step
      if ((data.state?.has_media && data.state?.media_type) || data.current_step === 'handle_media') {
        setShowMediaUpload(true);
        setMediaType(data.state?.media_type);
      }

      // Handle carousel steps
      if (data.current_step === 'generate_carousel_image') {
        // Generate all 4 images at once
        setIsGeneratingCarouselImage(true);
        if (data.message.generating_all) {
          // Auto-trigger generation of all 4 images
          generateAllCarouselImages();
        }
      } else if (data.current_step === 'approve_carousel_images') {
        // All images generated, show for approval
        setIsGeneratingCarouselImage(false);
        
        // Try to get images from multiple sources
        let imagesToSet = [];
        
        // First, try from message.carousel_images
        if (data.message && data.message.carousel_images && Array.isArray(data.message.carousel_images)) {
          imagesToSet = data.message.carousel_images.map((img, idx) => {
            const imageUrl = typeof img === 'string' ? img : (img.url || img);
            return {
              url: imageUrl,
              index: idx,
              approved: false
            };
          });
        }
        // Second, try from state.carousel_images
        else if (data.state && data.state.carousel_images && Array.isArray(data.state.carousel_images)) {
          imagesToSet = data.state.carousel_images.map((img, idx) => {
            const imageUrl = typeof img === 'string' ? img : (img.url || img);
            const imagePrompt = typeof img === 'object' ? (img.prompt || '') : '';
            return {
              url: imageUrl,
              index: idx,
              prompt: imagePrompt,
              approved: false
            };
          });
        }
        
        if (imagesToSet.length > 0) {
          console.log('🔍 Setting carousel images from approve step:', imagesToSet);
          setCarouselImages(imagesToSet);
        }
      } else if (data.current_step === 'handle_carousel_upload') {
        setShowCarouselUpload(true);
        setIsGeneratingCarouselImage(false);
        setCarouselMaxImages(data.message.max_images || 10);
        // Clear approval UI when switching to manual upload
        setCarouselImages([]);
        
        // CRITICAL: Sync uploaded images from state to preserve count
        if (data.state?.uploaded_carousel_images && Array.isArray(data.state.uploaded_carousel_images)) {
          setUploadedCarouselImages(data.state.uploaded_carousel_images);
          console.log('✅ Synced uploaded images from state:', data.state.uploaded_carousel_images.length);
        } else if (data.message.uploaded_count !== undefined) {
          // Fallback: use count from message if state not available
          // Note: This won't restore image URLs, but will show correct count
          console.log('⚠️ State not available, using message count:', data.message.uploaded_count);
        } else {
          // If state not in response, fetch latest state to restore images (e.g., after clicking "no")
          const token2 = await getAuthToken();
          if (token2 && conversationId) {
            try {
              const convResponse = await fetch(`${API_BASE_URL}/custom-content/conversation/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${token2}` }
              });
              
              if (convResponse.ok) {
                const convData = await convResponse.json();
                if (convData.state?.uploaded_carousel_images && Array.isArray(convData.state.uploaded_carousel_images)) {
                  setUploadedCarouselImages(convData.state.uploaded_carousel_images);
                  console.log('✅ Restored uploaded images after "no":', convData.state.uploaded_carousel_images.length);
                }
              }
            } catch (fetchError) {
              console.error('Error fetching conversation state:', fetchError);
            }
          }
        }
      } else if (data.current_step === 'confirm_carousel_upload_done') {
        // Keep upload UI visible so user can see uploaded images and add more if needed
        setShowCarouselUpload(true);
        // CRITICAL: Sync uploaded images from state in confirmation step
        // This ensures images are preserved when user clicks "no, add more"
        if (data.state?.uploaded_carousel_images && Array.isArray(data.state.uploaded_carousel_images)) {
          setUploadedCarouselImages(data.state.uploaded_carousel_images);
          console.log('✅ Synced uploaded images in confirm step:', data.state.uploaded_carousel_images.length);
        }
      } else if (data.current_step === 'generate_content') {
        // Clear carousel-related UI when moving to content generation
        setShowCarouselUpload(false);
        setIsGeneratingCarouselImage(false);
        // Clear approval UI
        setCarouselImages([]);
      } else {
        // Clear carousel UI for all other steps
        setShowCarouselUpload(false);
        setShowCarouselUpload(false);
      }

      // Hide media upload UI when content generation starts or other steps
      if (data.current_step === 'generate_content' || 
          data.current_step === 'parse_content' || 
          data.current_step === 'optimize_content' ||
          data.current_step === 'confirm_content' ||
          data.current_step === 'select_schedule' ||
          data.current_step === 'save_content') {
        setShowMediaUpload(false);
        setShowCarouselUpload(false);
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
    const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm', 'video/wmv', 'video/quicktime'];
    
    if (file.size > maxSize) {
      return `File size too large. Maximum size is ${mediaType === 'image' ? '10MB' : '100MB'}.`;
    }
    
    if (mediaType === 'image' && !allowedImageTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).';
    }
    
    if (mediaType === 'video' && !allowedVideoTypes.includes(file.type)) {
      // Also check file extension as fallback (some browsers may not set MIME type correctly)
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'];
      if (!allowedExtensions.includes(fileExtension)) {
        return 'Please upload a valid video file (MP4, MOV, AVI, MKV, WebM, or WMV).';
      }
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
            try {
              const responseText = xhr.responseText;
              if (!responseText) {
                reject(new Error('Empty response from server'));
                return;
              }
              resolve(JSON.parse(responseText));
            } catch (parseError) {
              console.error('Failed to parse response:', parseError);
              reject(new Error('Invalid response from server'));
            }
          } else {
            // Try to parse error response
            let errorMessage = `Upload failed with status: ${xhr.status}`;
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
              errorMessage = xhr.responseText || errorMessage;
            }
            reject(new Error(errorMessage));
          }
        };
        xhr.onerror = () => {
          reject(new Error('Network error: Failed to connect to server. Please check your internet connection.'));
        };
        xhr.ontimeout = () => {
          reject(new Error('Upload timeout: The file is too large or the connection is too slow. Please try a smaller file.'));
        };
        xhr.open('POST', `${API_BASE_URL}/custom-content/upload-media`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        // Set timeout to 5 minutes for large video files
        xhr.timeout = 300000; // 5 minutes
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
      
      // Content is now displayed directly in chatbot messages - no more content cards
      // Clear any existing generated content to prevent card display
      setGeneratedContent(null);
      
      setShowMediaUpload(false);
      setUploadedFile(null);
      setMediaPreview(null);
      setUploadProgress(0);

    } catch (error) {
      console.error('Error uploading file:', error);
      // Show the actual error message from the server if available
      const errorMessage = error.message || 'Sorry, I encountered an error uploading your file. Please try again.';
      setUploadError(errorMessage);
      
      // Log additional details for debugging
      if (error.message) {
        console.error('Upload error details:', error.message);
      }
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

  // Generate all 4 carousel images at once
  const generateAllCarouselImages = async () => {
    try {
      setIsGeneratingCarouselImage(true);
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const formData = new FormData();
      formData.append('conversation_id', conversationId);

      const response = await fetch(`${API_BASE_URL}/custom-content/generate-all-carousel-images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Generate carousel images error:', response.status, errorText);
        let errorMessage = 'Failed to generate carousel images';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        if (response.status === 404) {
          errorMessage = 'Endpoint not found. Please ensure the backend is deployed with the latest code.';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('🔍 Generated carousel images response:', data);
      
      // Set all generated images - handle both formats
      if (data.images && Array.isArray(data.images) && data.images.length === 4) {
        const formattedImages = data.images.map((img, idx) => {
          // Handle both object format {url, prompt} and string format
          const imageUrl = typeof img === 'string' ? img : (img.url || img);
          const imagePrompt = typeof img === 'object' ? (img.prompt || '') : '';
          return {
            url: imageUrl,
            index: idx,
            prompt: imagePrompt,
            approved: false
          };
        });
        console.log('🔍 Setting carousel images:', formattedImages);
        setCarouselImages(formattedImages);
      } else {
        console.warn('⚠️ Unexpected response format:', data);
      }

      // Refresh conversation to get approval step and images from state
      const token2 = await getAuthToken();
      const convResponse = await fetch(`${API_BASE_URL}/custom-content/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token2}`
        }
      });
      
      if (convResponse.ok) {
        const convData = await convResponse.json();
        console.log('🔍 Conversation state after generation:', convData);
        console.log('🔍 Current step:', convData.current_step);
        console.log('🔍 Carousel images in state:', convData.state?.carousel_images);
        
        // Update step first
        if (convData.current_step) {
          setCurrentStep(convData.current_step);
        }
        
        // Update state
        if (convData.state) {
          setState(convData.state);
        }
        
        // Get carousel images from state - this is the primary source
        if (convData.state && convData.state.carousel_images && Array.isArray(convData.state.carousel_images)) {
          const stateImages = convData.state.carousel_images.map((img, idx) => {
            const imageUrl = typeof img === 'string' ? img : (img.url || img);
            const imagePrompt = typeof img === 'object' ? (img.prompt || '') : '';
            return {
              url: imageUrl,
              index: idx,
              prompt: imagePrompt,
              approved: false
            };
          });
          console.log('🔍 Setting carousel images from state:', stateImages);
          if (stateImages.length === 4) {
            setCarouselImages(stateImages);
            setIsGeneratingCarouselImage(false); // Only set to false after images are loaded
          }
        } else if (data.images && Array.isArray(data.images) && data.images.length === 4) {
          // Fallback: use images from API response if state doesn't have them
          console.log('🔍 Using images from API response as fallback');
          setIsGeneratingCarouselImage(false);
        } else {
          console.warn('⚠️ No carousel images found in state or response');
          setIsGeneratingCarouselImage(false);
        }
        
        // The backend should have transitioned to approve_carousel_images step
        if (convData.messages && convData.messages.length > 0) {
          const lastMessage = convData.messages[convData.messages.length - 1];
          // Only add if not already in messages
          const existingMessages = messages.map(m => m.content);
          if (!existingMessages.includes(lastMessage.content)) {
            addMessage('assistant', lastMessage.content, lastMessage);
          }
        }
      } else {
        setIsGeneratingCarouselImage(false);
      }

    } catch (error) {
      console.error('Error generating carousel images:', error);
      setIsGeneratingCarouselImage(false);
      addMessage('assistant', `Sorry, I encountered an error generating the carousel images: ${error.message}. Please try again.`);
    }
  };

  // Carousel images approval handler
  const handleCarouselImagesApproval = async (action) => {
    try {
      console.log('🔍 handleCarouselImagesApproval called with action:', action);
      console.log('🔍 Current carouselImages:', carouselImages);
      
      // Don't clear images immediately - keep them visible until backend confirms
      setIsGeneratingCarouselImage(false);
      
      // Add user message to show what they selected
      const actionText = action === 'approve' ? 'approve' : action === 'regenerate' ? 'regenerate all images' : 'switch to manual upload';
      addMessage('user', actionText);
      
      setIsLoading(true);
      
      // Send the action to backend - use simple keywords
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Map actions to simple backend-understandable inputs
      let backendInput = 'approve';
      if (action === 'regenerate') {
        backendInput = 'regenerate';
      } else if (action === 'manual_upload') {
        backendInput = 'manual_upload';
      }
      
      console.log('🔍 Sending to backend:', backendInput);
      
      const response = await fetch(`${API_BASE_URL}/custom-content/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_input: backendInput,
          input_type: 'text'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to process approval');
      }

      const data = await response.json();
      
      // Update state immediately - this will hide the approval UI
      if (data.current_step) {
        setCurrentStep(data.current_step);
      }
      if (data.state) {
        setState(data.state);
        // Clear carousel images if switching to manual upload
        if (data.state.carousel_image_source === 'manual_upload') {
          setCarouselImages([]);
          setIsGeneratingCarouselImage(false);
        }
      }
      if (data.progress_percentage !== undefined) {
        setProgress(data.progress_percentage);
      }
      
      // Add assistant response if present
      if (data.message) {
        const messageContent = typeof data.message === 'string' ? data.message : (data.message.content || '');
        if (messageContent) {
          addMessage('assistant', messageContent, typeof data.message === 'object' ? data.message : {});
        }
      }
      
      setIsLoading(false);
      
      // Clear carousel images and UI after approval
      if (action === 'approve') {
        console.log('✅ Approval successful, clearing carousel images');
        setCarouselImages([]);
        setShowCarouselUpload(false);
        
        // If step is already generate_content, we're good
        // Otherwise, refresh to get the latest state
        if (data.current_step !== 'generate_content') {
          setTimeout(async () => {
            try {
              const token2 = await getAuthToken();
              if (token2) {
                const convResponse = await fetch(`${API_BASE_URL}/custom-content/conversation/${conversationId}`, {
                  headers: {
                    'Authorization': `Bearer ${token2}`
                  }
                });
                
                if (convResponse.ok) {
                  const convData = await convResponse.json();
                  console.log('🔍 Refreshed conversation state:', convData.current_step);
                  setCurrentStep(convData.current_step);
                  setState(convData.state || {});
                  
                  // Only add new messages that aren't already in the list
                  if (convData.messages && convData.messages.length > 0) {
                    const lastConvMessage = convData.messages[convData.messages.length - 1];
                    const existingMessages = messages.map(m => m.content);
                    if (!existingMessages.includes(lastConvMessage.content)) {
                      addMessage(lastConvMessage.role, lastConvMessage.content, lastConvMessage);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error refreshing conversation state:', error);
            }
          }, 300);
        }
      } else if (action === 'regenerate') {
        // Clear images for regeneration
        setCarouselImages([]);
        setShowCarouselUpload(false);
      } else if (action === 'manual_upload') {
        // Clear images and approval UI for manual upload
        setCarouselImages([]);
        setIsGeneratingCarouselImage(false);
        // showCarouselUpload will be set by the backend response
      }
      
    } catch (error) {
      console.error('Error handling carousel approval:', error);
      setIsLoading(false);
      addMessage('assistant', `Sorry, I encountered an error: ${error.message}. Please try again.`);
    }
  };

  // Carousel bulk upload handler
  const handleCarouselBulkUpload = async (files) => {
    try {
      if (!files || files.length === 0) return;

      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Validate file count
      const currentCount = uploadedCarouselImages.length;
      if (currentCount + files.length > carouselMaxImages) {
        setUploadError(`You can only upload up to ${carouselMaxImages} images total. You currently have ${currentCount} images.`);
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('conversation_id', conversationId);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch(`${API_BASE_URL}/custom-content/upload-carousel-images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload carousel images error:', response.status, errorText);
        let errorMessage = 'Failed to upload carousel images';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        if (response.status === 404) {
          errorMessage = 'Endpoint not found. Please ensure the backend is deployed with the latest code.';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Update uploaded images immediately from response
      if (data.image_urls && Array.isArray(data.image_urls)) {
        setUploadedCarouselImages(prev => {
          const newImages = [...prev, ...data.image_urls];
          console.log('✅ Updated uploadedCarouselImages:', newImages.length, 'images');
          return newImages;
        });
      }
      
      // Clear file input
      if (carouselFileInputRef.current) {
        carouselFileInputRef.current.value = '';
      }

      // Fetch updated conversation state to get the current step
      const token2 = await getAuthToken();
      if (token2) {
        const convResponse = await fetch(`${API_BASE_URL}/custom-content/conversation/${conversationId}`, {
          headers: {
            'Authorization': `Bearer ${token2}`
          }
        });
        
        if (convResponse.ok) {
          const convData = await convResponse.json();
          // Update state and step from conversation
          let stateImages = [];
          if (convData.state) {
            setState(convData.state);
            // Always use backend state as source of truth for uploaded images
            stateImages = convData.state.uploaded_carousel_images || [];
            const expectedTotal = data.total_images || 0;
            console.log('🔍 Syncing uploaded images - State:', stateImages.length, 'Expected:', expectedTotal, 'images');
            
            // Always use state if it has images (backend is source of truth)
            if (Array.isArray(stateImages) && stateImages.length > 0) {
              setUploadedCarouselImages(stateImages);
              console.log('✅ Using state images:', stateImages.length);
            } else if (expectedTotal > 0) {
              // State is empty but response says we have images - might be a race condition
              // Keep what we set from response
              console.log('⚠️ State empty but response has total, keeping response images');
            }
          }
          if (convData.current_step) {
            setCurrentStep(convData.current_step);
          }
          
          // Update or add the latest message with uploaded images
          if (convData.messages && convData.messages.length > 0) {
            const lastMessage = convData.messages[convData.messages.length - 1];
            const existingMessages = messages.map(m => m.content);
            
            // Check if this is an upload-related message that needs updating
            const isUploadMessage = lastMessage.content && (
              lastMessage.content.includes('upload your carousel images') ||
              lastMessage.content.includes('Currently uploaded')
            );
            
            if (isUploadMessage && stateImages.length > 0) {
              // Update the existing message with uploaded images
              setMessages(prev => prev.map(msg => {
                if (msg.content === lastMessage.content && msg.role === 'assistant') {
                  return {
                    ...msg,
                    uploaded_carousel_images: stateImages
                  };
                }
                return msg;
              }));
            } else if (!existingMessages.includes(lastMessage.content)) {
              addMessage(lastMessage.role, lastMessage.content, lastMessage);
            }
          }
        }
      }

      // The backend sets step to confirm_carousel_upload_done after upload
      // The UI will automatically show confirmation buttons when the step is set
      // No need to send a message - the buttons will handle user interaction

    } catch (error) {
      console.error('Error uploading carousel images:', error);
      setUploadError(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCarouselFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleCarouselBulkUpload(files);
    }
  };

  const handleCarouselUploadDone = async (done) => {
    if (done) {
      await sendMessage('yes');
    } else {
      await sendMessage('no');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOptionClick = (value, label) => {
    // Handle carousel image source selection
    if (value === 'ai_generate' || value === 'manual_upload') {
      if (value === 'manual_upload') {
        setShowCarouselUpload(true);
      }
      setInputValue(label);
      sendMessage(value);
      return;
    }
    
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
      
      // Always send the label (user-friendly text) instead of value
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

  const handleAnotherContentChoice = (choice) => {
    if (choice === 'yes') {
      // Refresh the chatbot to start new content generation
      refreshConversation();
    } else {
      // Exit the chatbot
      onClose();
    }
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
      case 'greet': return 'Getting started';
      case 'ask_platform': return 'Select platform';
      case 'ask_content_type': return 'Choose content type';
      case 'ask_description': return 'Describe content';
      case 'ask_media': return 'Add media';
      case 'confirm_media': return 'Confirm media';
      case 'generate_content': return 'Generating content';
      case 'confirm_content': return 'Confirm content';
      case 'select_schedule': return 'Select schedule';
      case 'save_content': return 'Saving content';
      case 'display_result': return 'Content creation complete';
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
              <h3 className="font-bold text-gray-800 text-lg">Emily - Content Creator</h3>
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
          {/* Carousel Image Generation UI - Show only when generating */}
          {currentStep === 'generate_carousel_image' && isGeneratingCarouselImage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-6 py-4 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 text-gray-800 border border-purple-200">
                <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      <span className="text-sm font-bold text-purple-800">
                        Generating all 4 carousel images... This may take a moment.
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-pink-400 to-purple-500 h-3 rounded-full transition-all duration-300 animate-pulse"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="text-xs text-purple-600 text-center">
                      Creating a cohesive sequential story across all 4 images...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Carousel Images Approval UI - Show only when in approval step and not in manual upload */}
          {currentStep === 'approve_carousel_images' && 
           carouselImages.length >= 4 && 
           !isGeneratingCarouselImage &&
           state?.carousel_image_source !== 'manual_upload' && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-6 py-4 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 text-gray-800 border border-purple-200">
                <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                  <div className="space-y-4">
                    <div className="text-sm font-bold text-purple-800 text-center">
                      Review all 4 carousel images
                    </div>
                    
                    {/* Image Grid */}
                    {carouselImages.length >= 4 ? (
                      <div className="grid grid-cols-2 gap-3 w-full mb-4" style={{ minHeight: '320px' }}>
                        {carouselImages.slice(0, 4).map((img, idx) => {
                          console.log(`🔍 Rendering image ${idx + 1}:`, img.url);
                          return (
                            <div 
                              key={`carousel-img-${idx}-${img.url}`} 
                              className="relative w-full overflow-hidden rounded-lg border-2 border-purple-200 shadow-md bg-gray-100"
                              style={{ 
                                minHeight: '160px',
                                maxHeight: '160px',
                                height: '160px',
                                width: '100%',
                                position: 'relative'
                              }}
                            >
                              <img
                                src={img.url}
                                alt={`Carousel image ${idx + 1}`}
                                className="w-full h-full object-cover"
                                style={{ 
                                  display: 'block',
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  opacity: 1,
                                  visibility: 'visible',
                                  position: 'relative',
                                  zIndex: 1
                                }}
                                onError={(e) => {
                                  console.error('❌ Image load error for:', img.url);
                                  const parent = e.target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Failed to load image</div>';
                                  }
                                }}
                                onLoad={(e) => {
                                  console.log('✅ Image loaded successfully:', img.url);
                                  e.target.style.opacity = '1';
                                  e.target.style.visibility = 'visible';
                                  e.target.style.display = 'block';
                                }}
                              />
                              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">
                                {idx + 1}/4
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-purple-600">
                        <p>Loading images... ({carouselImages.length}/4)</p>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleCarouselImagesApproval('approve')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                      >
                        ✅ Approve and Continue
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCarouselImagesApproval('regenerate')}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-xl hover:from-orange-500 hover:to-red-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                        >
                          🔄 Regenerate All
                        </button>
                        <button
                          onClick={() => handleCarouselImagesApproval('manual_upload')}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-xl hover:from-purple-500 hover:to-pink-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                        >
                          📤 Manual Upload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                {/* Show carousel images if available - display before content text */}
                {message.carousel_images && Array.isArray(message.carousel_images) && message.carousel_images.length > 0 && (
                  <div className="mb-6">
                    <div className="text-sm font-bold text-purple-800 mb-3">
                      Carousel Images ({message.carousel_images.length}):
                    </div>
                    <div className={`grid gap-3 ${message.carousel_images.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {message.carousel_images.map((imgUrl, idx) => {
                        const imageUrl = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || imgUrl);
                        return (
                          <div key={idx} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Carousel image ${idx + 1}`}
                              className="w-full h-40 object-cover rounded-lg border-2 border-purple-200 shadow-md hover:border-purple-400 transition-all"
                              onError={(e) => {
                                console.error('❌ Failed to load carousel image:', imageUrl);
                                e.target.style.display = 'none';
                                const parent = e.target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="flex items-center justify-center h-40 bg-gray-100 rounded-lg border border-purple-200 text-gray-400 text-xs">Failed to load</div>';
                                }
                              }}
                            />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                              {idx + 1}/{message.carousel_images.length}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Show uploaded carousel images if available - only in current step and for most recent message */}
                {/* Check both message object and state for uploaded images (like approve step does) */}
                {((message.uploaded_carousel_images && Array.isArray(message.uploaded_carousel_images) && message.uploaded_carousel_images.length > 0) ||
                  (uploadedCarouselImages.length > 0 && (currentStep === 'handle_carousel_upload' || currentStep === 'confirm_carousel_upload_done'))) &&
                  (currentStep === 'handle_carousel_upload' || currentStep === 'confirm_carousel_upload_done') &&
                  message.id === messages.filter(m => m.role === 'assistant').slice(-1)[0]?.id && (
                  <div className="mb-6">
                    <div className="text-sm font-bold text-purple-800 mb-3">
                      Uploaded Carousel Images ({message.uploaded_carousel_images?.length || uploadedCarouselImages.length}):
                    </div>
                    <div className={`grid gap-3 ${(message.uploaded_carousel_images?.length || uploadedCarouselImages.length) <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {(message.uploaded_carousel_images || uploadedCarouselImages).map((imgUrl, idx) => {
                        const imageUrl = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || imgUrl);
                        const totalImages = message.uploaded_carousel_images?.length || uploadedCarouselImages.length;
                        return (
                          <div key={idx} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Uploaded carousel image ${idx + 1}`}
                              className="w-full h-40 object-cover rounded-lg border-2 border-purple-200 shadow-md hover:border-purple-400 transition-all"
                              onError={(e) => {
                                console.error('❌ Failed to load uploaded carousel image:', imageUrl);
                                e.target.style.display = 'none';
                                const parent = e.target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="flex items-center justify-center h-40 bg-gray-100 rounded-lg border border-purple-200 text-gray-400 text-xs">Failed to load</div>';
                                }
                              }}
                            />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                              {idx + 1}/{totalImages}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Show uploaded media at the top for content review messages */}
                {message.media_url && message.content && message.content.includes('Content Review') && (
                  <div className="mb-6">
                    {message.media_type?.startsWith('image') ? (
                      <img 
                        src={message.media_url} 
                        alt="Content media" 
                        className="max-w-full h-80 object-cover rounded-xl border border-purple-200 shadow-lg"
                      />
                    ) : message.media_type?.startsWith('video') ? (
                      <video 
                        src={message.media_url} 
                        controls 
                        className="max-w-full h-80 object-cover rounded-xl border border-purple-200 shadow-lg"
                      />
                    ) : null}
                  </div>
                )}
                
                {/* Render content with markdown support */}
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
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                
                {/* Show uploaded media for other messages (not content review) */}
                {message.media_url && (!message.content || !message.content.includes('Content Review')) && (
                  <div className="mt-4">
                    {message.media_type?.startsWith('image') ? (
                      <img 
                        src={message.media_url} 
                        alt="Uploaded media" 
                        className="max-w-full h-80 object-cover rounded-xl border border-purple-200 shadow-lg"
                      />
                    ) : message.media_type?.startsWith('video') ? (
                      <video 
                        src={message.media_url} 
                        controls 
                        className="max-w-full h-80 object-cover rounded-xl border border-purple-200 shadow-lg"
                      />
                    ) : null}
                  </div>
                )}
                
                {/* Platform Options */}
                {message.role === 'assistant' && message.options && message.options.length > 0 && !showMediaUpload && (
                  <div className="mt-4">
                    <div className="grid grid-cols-2 gap-3">
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
                
                
                {/* File Upload Input */}
                {message.role === 'assistant' && message.content && message.content.includes('Please upload your') && showMediaUpload && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        {mediaType === 'image' ? (
                          <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                            <Image className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                            <Video className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <span className="text-sm font-bold text-purple-800">
                          Upload {mediaType === 'image' ? 'Image' : 'Video'}
                        </span>
                      </div>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={mediaType === 'image' 
                          ? 'image/jpeg,image/jpg,image/png,image/gif,image/webp' 
                          : 'video/mp4,video/mov,video/avi,video/mkv,video/webm,video/wmv'}
                        onChange={handleFileSelect}
                        className="w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-pink-400 file:to-purple-500 file:text-white hover:file:from-pink-500 hover:file:to-purple-600 transition-all duration-200"
                      />
                      
                      <div className="text-xs text-purple-600 font-medium">
                        {mediaType === 'image' 
                          ? 'Supported formats: JPEG, PNG, GIF, WebP (max 10MB)'
                          : 'Supported formats: MP4, MOV, AVI, MKV, WebM, WMV (max 100MB)'
                        }
                      </div>
                      
                      {uploadError && (
                        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                          <AlertCircle className="w-4 h-4" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                      
                      {mediaPreview && uploadedFile && !isUploading && (
                        <div className="space-y-3">
                          <div className="text-sm font-bold text-purple-800">Preview:</div>
                          <div className="max-w-sm">
                            {mediaType === 'image' ? (
                              <img
                                src={mediaPreview}
                                alt="Preview"
                                className="w-full h-48 object-cover rounded-xl border border-purple-200 shadow-md"
                              />
                            ) : (
                              <video
                                src={mediaPreview}
                                controls
                                className="w-full h-48 object-cover rounded-xl border border-purple-200 shadow-md"
                              />
                            )}
                          </div>
                          <div className="text-xs text-blue-700">
                            {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </div>
                          <button
                            onClick={confirmUpload}
                            className="w-full px-4 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm rounded-xl hover:from-pink-500 hover:to-purple-600 flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload & Continue</span>
                          </button>
                        </div>
                      )}
                      
                      {isUploading && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-purple-700 font-medium">
                            <span>Uploading {uploadedFile?.name}...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-purple-200 rounded-full h-3 shadow-inner">
                            <div
                              className="bg-gradient-to-r from-pink-400 to-purple-500 h-3 rounded-full transition-all duration-300 shadow-lg"
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
                  <div className="mt-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleMediaConfirmation('yes')}
                        className="px-6 py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                      >
                        Yes, proceed
                      </button>
                      <button
                        onClick={() => handleMediaConfirmation('no')}
                        className="px-6 py-3 bg-gradient-to-r from-red-400 to-pink-500 text-white rounded-xl hover:from-red-500 hover:to-pink-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                      >
                        No, upload different
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Content Confirmation Options */}
                {message.role === 'assistant' && message.content && (message.content.includes('Please review the content above and let me know') || message.content.includes('Please review it above and let me know if you\'d like to save this post')) && (
                  <div className="mt-6">
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => handleContentConfirmation('yes')}
                        className="px-8 py-4 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-base font-semibold shadow-lg hover:shadow-xl"
                      >
                        Yes, save this post
                      </button>
                      <button
                        onClick={() => handleContentConfirmation('no')}
                        className="px-8 py-4 bg-gradient-to-r from-red-400 to-pink-500 text-white rounded-xl hover:from-red-500 hover:to-pink-600 transition-all duration-200 text-base font-semibold shadow-lg hover:shadow-xl"
                      >
                        No, make changes
                      </button>
                    </div>
                  </div>
                )}


                {/* Carousel Bulk Upload UI - Only show for current step and most recent message */}
                {message.role === 'assistant' && 
                 showCarouselUpload && 
                 currentStep === 'handle_carousel_upload' &&
                 message.id === messages.filter(m => m.role === 'assistant').slice(-1)[0]?.id && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Image className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-bold text-purple-800">
                            Upload Carousel Images
                          </span>
                        </div>
                        <span className="text-xs text-purple-600 font-medium">
                          {`${uploadedCarouselImages.length} / ${carouselMaxImages}`} images
                        </span>
                      </div>
                      
                      <input
                        ref={carouselFileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        multiple
                        onChange={handleCarouselFileSelect}
                        className="w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-pink-400 file:to-purple-500 file:text-white hover:file:from-pink-500 hover:file:to-purple-600 transition-all duration-200"
                      />
                      
                      <div className="text-xs text-purple-600 font-medium">
                        Supported formats: JPEG, PNG, GIF, WebP (max 10MB per image)
                        <br />
                        You can upload up to {carouselMaxImages} images total
                      </div>
                      
                      {uploadedCarouselImages.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-bold text-purple-800">Uploaded Images:</div>
                          <div className="grid grid-cols-3 gap-2">
                            {uploadedCarouselImages.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Carousel ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-purple-200"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {uploadError && (
                        <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                          <AlertCircle className="w-4 h-4" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                      
                      {isUploading && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-purple-700 font-medium">
                            <span>Uploading images...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-purple-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-pink-400 to-purple-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Carousel Upload Done Confirmation - Only show for most recent message */}
                {message.role === 'assistant' && 
                 currentStep === 'confirm_carousel_upload_done' &&
                 message.id === messages.filter(m => m.role === 'assistant').slice(-1)[0]?.id && (
                  <div className="mt-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleCarouselUploadDone(true)}
                        className="px-6 py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                      >
                        ✅ Yes, I'm done
                      </button>
                      <button
                        onClick={() => handleCarouselUploadDone(false)}
                        className="px-6 py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-xl hover:from-purple-500 hover:to-pink-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                      >
                        📤 No, add more images
                      </button>
                    </div>
                  </div>
                )}

                {/* Another Content Generation Options */}
                {message.role === 'assistant' && message.content && message.content.includes('create another piece of content') && (
                  <div className="mt-6">
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => handleAnotherContentChoice('yes')}
                        className="px-8 py-4 bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-xl hover:from-purple-500 hover:to-pink-600 transition-all duration-200 text-base font-semibold shadow-lg hover:shadow-xl"
                      >
                        Yes, create another
                      </button>
                      <button
                        onClick={() => handleAnotherContentChoice('no')}
                        className="px-8 py-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl hover:from-gray-500 hover:to-gray-600 transition-all duration-200 text-base font-semibold shadow-lg hover:shadow-xl"
                      >
                        No, I'm done
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Schedule Selection */}
                {message.role === 'assistant' && message.content && message.content.includes('schedule your post') && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm">
                    <div className="space-y-5">
                      <div className="text-sm font-bold text-purple-800">Select Post Schedule:</div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <button
                          onClick={() => handleScheduleSelection('now')}
                          className="px-6 py-3 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl hover:from-green-500 hover:to-blue-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
                        >
                          🚀 Post Now
                        </button>
                        
                        <div className="space-y-3">
                          <label className="text-sm font-bold text-purple-800">Or schedule for later:</label>
                          <div className="flex gap-3">
                            <input
                              type="date"
                              ref={dateInputRef}
                              className="flex-1 px-4 py-3 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                            />
                            <input
                              type="time"
                              ref={timeInputRef}
                              className="flex-1 px-4 py-3 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm bg-white shadow-sm"
                            />
                          </div>
                          <button
                            onClick={() => handleScheduleSelection('custom')}
                            className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl"
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
          
          {/* Content cards removed - content is now displayed directly in chatbot messages */}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl px-6 py-4 flex items-center space-x-3 border border-purple-200 shadow-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
                <span className="text-sm text-purple-700 font-medium">
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

export default CustomContentChatbot;
