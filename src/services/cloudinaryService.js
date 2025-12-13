const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryService = {
  // Upload single image or video to Cloudinary and get the generated ID
  uploadImage: async (file) => {
    // Validate inputs
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      console.error('❌ Cloudinary configuration missing:', {
        CLOUD_NAME,
        UPLOAD_PRESET
      });
      throw new Error('Cloudinary configuration missing. Check environment variables.');
    }

    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file is not empty
    if (file.size === 0) {
      throw new Error('File is empty');
    }

    console.log('📤 Starting Cloudinary upload:', {
      fileName: file.name,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      fileType: file.type,
      cloudName: CLOUD_NAME
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    
    // Use 'auto' resource_type for automatic detection
    formData.append('resource_type', 'auto');

    try {
      console.log('🌐 Sending request to Cloudinary...');
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      console.log('📥 Cloudinary response status:', response.status);

      // Try to parse the response even if status is not OK
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('❌ Failed to parse Cloudinary response:', parseError);
        const errorText = await response.text();
        console.error('Raw error response:', errorText);
        throw new Error(`Failed to parse Cloudinary response: ${errorText.substring(0, 100)}`);
      }

      if (!response.ok) {
        console.error('❌ Cloudinary upload failed with data:', data);
        throw new Error(data.error?.message || `Upload failed: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Cloudinary upload SUCCESS:', {
        public_id: data.public_id,
        secure_url: data.secure_url ? 'Available' : 'Missing',
        format: data.format,
        resource_type: data.resource_type,
        bytes: data.bytes,
        width: data.width,
        height: data.height
      });
      
      // Validate required fields in response
      if (!data.public_id) {
        console.error('❌ Cloudinary response missing public_id:', data);
        throw new Error('Cloudinary response missing public_id');
      }

      if (!data.secure_url) {
        console.error('❌ Cloudinary response missing secure_url:', data);
        throw new Error('Cloudinary response missing secure_url');
      }

      // Build result object
      const result = {
        public_id: data.public_id,
        secure_url: data.secure_url,
        format: data.format,
        bytes: data.bytes,
        created_at: data.created_at,
        resource_type: data.resource_type || 'auto',
        width: data.width,
        height: data.height
      };

      // Add video-specific properties if available
      if (data.resource_type === 'video') {
        result.duration = data.duration;
        result.video_codec = data.video_codec;
        result.audio_codec = data.audio_codec;
        result.nb_frames = data.nb_frames;
        console.log('🎥 Video-specific data:', {
          duration: data.duration,
          video_codec: data.video_codec,
          audio_codec: data.audio_codec
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.message.includes('413')) {
        throw new Error('File too large. Maximum size: 100MB for videos, 10MB for images.');
      } else if (error.message.includes('Unauthorized')) {
        throw new Error('Cloudinary authorization failed. Check your upload preset configuration.');
      } else if (error.message.includes('Invalid upload preset')) {
        throw new Error('Invalid Cloudinary upload preset. Please check your configuration.');
      } else if (error.message.includes('format')) {
        throw new Error('Unsupported file format. Please use common image or video formats.');
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  },

  // Upload multiple images/videos to Cloudinary
  uploadMultipleImages: async (files) => {
    console.log(`📦 Starting batch upload of ${files.length} files...`);
    
    const uploadPromises = files.map(file => 
      cloudinaryService.uploadImage(file).catch(error => ({
        file,
        error: error.message
      }))
    );
    
    try {
      const results = await Promise.all(uploadPromises);
      
      const successfulUploads = [];
      const failedUploads = [];

      results.forEach((result, index) => {
        const file = files[index];
        
        if (result.error) {
          console.error(`❌ Failed to upload ${file.name}:`, result.error);
          failedUploads.push({
            file,
            error: result.error
          });
        } else {
          console.log(`✅ Successfully uploaded ${file.name}`);
          successfulUploads.push({
            file,
            cloudinaryData: result
          });
        }
      });

      console.log(`📊 Batch upload completed: ${successfulUploads.length} successful, ${failedUploads.length} failed`);
      
      return {
        successful: successfulUploads,
        failed: failedUploads
      };
    } catch (error) {
      console.error('❌ Batch upload error:', error);
      throw error;
    }
  },

  // Delete image/video from Cloudinary using the public_id
  deleteImage: async (publicId, resourceType = 'image') => {
    try {
      console.log('🗑️ Deleting from Cloudinary:', { publicId, resourceType });
      
      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('upload_preset', UPLOAD_PRESET);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Cloudinary delete failed:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error?.message || 'Delete failed');
        } catch {
          throw new Error(`Delete failed: ${response.status}`);
        }
      }

      const result = await response.json();
      console.log('✅ Cloudinary delete success:', result);
      return result;
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      throw error;
    }
  },

  // Get Cloudinary image/video URL with transformations
  getImageUrl: (publicId, transformations = '') => {
    if (!publicId) return '';
    
    const transformationString = transformations ? `${transformations}/` : '';
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformationString}${publicId}`;
  },
  
  // Get video thumbnail URL
  getVideoThumbnail: (publicId, time = '00:00:01') => {
    if (!publicId) return '';
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_${time}/${publicId}.jpg`;
  },

  // Get optimized video URL
  getOptimizedVideoUrl: (publicId, quality = 'auto', format = 'mp4') => {
    if (!publicId) return '';
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/q_${quality},f_${format}/${publicId}`;
  },

  // Get responsive image URL
  getResponsiveImageUrl: (publicId, width = 'auto', height = 'auto', crop = 'fill') => {
    if (!publicId) return '';
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},h_${height},c_${crop}/${publicId}`;
  },

  // Validate Cloudinary configuration
  validateConfig: () => {
    const isValid = CLOUD_NAME && UPLOAD_PRESET;
    console.log('🔧 Cloudinary config validation:', {
      isValid,
      CLOUD_NAME: CLOUD_NAME ? 'Set' : 'Missing',
      UPLOAD_PRESET: UPLOAD_PRESET ? 'Set' : 'Missing'
    });
    return isValid;
  },

  // Get file type from Cloudinary response
  getFileTypeFromResponse: (cloudinaryData) => {
    if (!cloudinaryData) return 'unknown';
    
    if (cloudinaryData.resource_type === 'video') {
      return 'video';
    } else if (cloudinaryData.resource_type === 'image') {
      return 'image';
    } else if (cloudinaryData.format) {
      // Try to determine from format
      const videoFormats = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'];
      const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      
      const format = cloudinaryData.format.toLowerCase();
      if (videoFormats.includes(format)) return 'video';
      if (imageFormats.includes(format)) return 'image';
    }
    
    return 'unknown';
  },

  // Check if file is a video
  isVideoFile: (file) => {
    if (!file) return false;
    
    const videoMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/x-flv',
      'video/webm',
      'video/x-matroska'
    ];
    
    const videoExtensions = [
      '.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv',
      '.m4v', '.mpg', '.mpeg', '.3gp', '.ogg'
    ];
    
    // Check by MIME type
    if (file.type && videoMimeTypes.some(type => file.type.toLowerCase().includes(type))) {
      return true;
    }
    
    // Check by file extension
    if (file.name) {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return videoExtensions.includes(extension);
    }
    
    return false;
  },

  // Check if file is an image
  isImageFile: (file) => {
    if (!file) return false;
    
    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml'
    ];
    
    const imageExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
      '.tiff', '.tif', '.ico', '.heic', '.heif'
    ];
    
    // Check by MIME type
    if (file.type && imageMimeTypes.some(type => file.type.toLowerCase().includes(type))) {
      return true;
    }
    
    // Check by file extension
    if (file.name) {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return imageExtensions.includes(extension);
    }
    
    return false;
  }
};