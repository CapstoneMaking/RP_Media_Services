import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloudinaryService } from '../services/cloudinaryService';
import { useAuth } from '../context/AuthContext';

const showMessage = (message, type = 'info') => {
  // Create a simple div for the message
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    max-width: 400px;
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 4.7s;
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);
  
  // Also allow click to dismiss
  messageDiv.onclick = () => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  };
};

const Photobooth = () => {
  // Camera state and refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const overlayRef = useRef(null);

  const [isCameraOn, setCameraOn] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState("None");
  const [isCapturing, setIsCapturing] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState(null); // For full-screen view
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };

  // Constants
  const MAX_PHOTOS = 3;

  // Frame options - Fixed paths
  const FRAMES = [
    { name: "None", src: null },
    { name: "Birthday", src: "/frames/birthdayyy.png" },
    { name: "Christmas", src: "/frames/christmasss.png" },
    { name: "Flowers", src: "/frames/flowersss.png" },
    { name: "Instagram", src: "/frames/instagrammm.png" },
    { name: "Spotify", src: "/frames/spotifyyy.png" },
    { name: "Wanted", src: "/frames/wanteddd.png" }
  ];

  // Close full-screen viewer with Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && viewingImage) {
        setViewingImage(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [viewingImage]);

  // Camera functions
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Handle frame changes
  useEffect(() => {
    if (selectedFrame === "None") {
      setFrameLoaded(false);
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
      return;
    }

    const frame = FRAMES.find(f => f.name === selectedFrame);
    if (frame && frame.src) {
      setFrameLoaded(false);
      const img = new Image();
      img.onload = () => {
        setFrameLoaded(true);
        console.log(`Frame loaded: ${selectedFrame}`);
        // Update overlay source
        if (overlayRef.current) {
          overlayRef.current.src = frame.src;
          overlayRef.current.style.display = 'block';
        }
      };
      img.onerror = () => {
        console.error(`Failed to load frame: ${frame.src}`);
        setSelectedFrame("None");
        showMessage(`Failed to load frame: ${frame.name}. Please check if the file exists at ${frame.src}`);
      };
      img.src = frame.src;
    }
  }, [selectedFrame]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      videoRef.current.onloadedmetadata = () => {
        setCameraOn(true);
      };
    } catch (err) {
      showMessage("Camera access denied or not available.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  // FIXED: Use existing cloudinaryService for upload
  const uploadToCloudinary = async (blob, frameName) => {
    try {
      // Convert blob to file for cloudinaryService
      const file = new File([blob], `photobooth_${Date.now()}.jpg`, { 
        type: 'image/jpeg' 
      });
      
      console.log(' Uploading to Cloudinary using cloudinaryService...');
      
      // Use the existing service that's already working in your app
      const cloudinaryResult = await cloudinaryService.uploadImage(file);
      
      console.log(' Cloudinary upload successful:', cloudinaryResult);
      
      return {
        secure_url: cloudinaryResult.secure_url,
        public_id: cloudinaryResult.public_id,
        created_at: cloudinaryResult.created_at,
        bytes: cloudinaryResult.bytes,
        format: cloudinaryResult.format
      };
    } catch (error) {
      console.error(' Cloudinary upload error:', error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  };

  // Load existing photos on component mount
  useEffect(() => {
    const savedPhotos = localStorage.getItem('photobooth_photos');
    if (savedPhotos) {
      const photos = JSON.parse(savedPhotos);
      setUploadedImages(photos.slice(0, MAX_PHOTOS));
    }
  }, []);

  // Save photos to localStorage whenever uploadedImages changes
  useEffect(() => {
    if (uploadedImages.length > 0) {
      localStorage.setItem('photobooth_photos', JSON.stringify(uploadedImages));
    }
  }, [uploadedImages]);

  // Handle frame selection
  const handleFrameSelect = (frameName) => {
    setSelectedFrame(frameName);
  };

  // Check if user can take more photos
  const canTakeMorePhotos = uploadedImages.length < MAX_PHOTOS;

  // Main capture function with perfect frame alignment
  const captureAndUpload = async () => {
    if (!isCameraOn) {
      showMessage("Please start camera first!");
      return;
    }

    // Check photo limit
    if (!canTakeMorePhotos) {
      showMessage(` Maximum limit reached! You can only take ${MAX_PHOTOS} photos. Please delete some photos to take new ones.`);
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState !== 4) {
      showMessage("Camera not ready yet! Please wait a moment.");
      return;
    }

    setIsCapturing(true);
    setIsUploading(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Set canvas to match video dimensions exactly
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Clear and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add frame overlay if selected and loaded - perfectly aligned
      if (selectedFrame !== "None" && frameLoaded && overlayRef.current) {
        // Draw frame overlay at the same dimensions as video
        ctx.drawImage(overlayRef.current, 0, 0, canvas.width, canvas.height);
      }

      // Convert to blob
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });
      
      if (blob) {
        // Upload to Cloudinary using the fixed function
        const uploadResult = await uploadToCloudinary(blob, selectedFrame);
        
        // Add the new photo to the gallery (limit to MAX_PHOTOS)
        setUploadedImages(prev => {
          const newPhotos = [uploadResult.secure_url, ...prev];
          return newPhotos.slice(0, MAX_PHOTOS);
        });
        
        console.log("Photo uploaded successfully:", uploadResult);
        showMessage(` Photo captured and uploaded to Cloudinary successfully! (${uploadedImages.length + 1}/${MAX_PHOTOS})`);
      } else {
        throw new Error("Failed to capture image");
      }
    } catch (err) {
      console.error("Capture/Upload error:", err);
      showMessage(` Error: ${err.message}`);
    } finally {
      setIsCapturing(false);
      setIsUploading(false);
    }
  };

  // Delete a single photo
  const deletePhoto = (index) => {
    if (window.confirm("Are you sure you want to delete this photo?")) {
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleResetAll = () => {
    if (window.confirm("Are you sure you want to reset everything? This will clear all photos.")) {
      stopCamera();
      setSelectedFrame("None");
      setUploadedImages([]);
      localStorage.removeItem('photobooth_photos');
      setFrameLoaded(false);
    }
  };

  const downloadImage = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename || `photobooth-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Download failed:", error);
      showMessage("Download failed. Please try again.");
    }
  };

  // Open image in full-screen view
  const viewImage = (url) => {
    setViewingImage(url);
  };

  // Close full-screen view
  const closeImageViewer = () => {
    setViewingImage(null);
  };

  return (
    <>
      {/* Full-screen Image Viewer */}
      {viewingImage && (
        <div className="fullscreen-viewer" onClick={closeImageViewer}>
          <button className="close-viewer-btn" onClick={closeImageViewer}>
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff">
              <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
            </svg>
          </button>
          <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={viewingImage} 
              alt="Full screen view" 
              className="fullscreen-image"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="viewer-actions">
              <button 
                onClick={() => downloadImage(viewingImage, `photobooth-fullscreen-${Date.now()}.jpg`)}
                className="download-btn"
              >
                Download
              </button>
              <button onClick={closeImageViewer} className="close-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar and sidebar */}
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></a></li>
          <li><Link to="/home" onClick={hideSidebar}>Home</Link></li>
          <li><Link to="/rent-schedule" onClick={hideSidebar}>Schedule</Link></li>
          <li><Link to="/packages" onClick={hideSidebar}>Packages</Link></li>
          <li><Link to="/services" onClick={hideSidebar}>Services</Link></li>
          <li><Link to="/photobooth" onClick={hideSidebar}>Photobooth</Link></li>
          <li><Link to="/about" onClick={hideSidebar}>About us</Link></li>

          {/* Conditional Dashboard Links */}
          {user ? (
            isAdmin ? (
              <li><Link to="/AdminDashboard" onClick={hideSidebar}>Admin Dashboard</Link></li>
            ) : (
              <li><Link to="/UserDashboard" onClick={hideSidebar}>My Dashboard</Link></li>
            )
          ) : (
            <li><Link to="/login-register" onClick={hideSidebar}>Login</Link></li>
          )}
        </ul>
        <ul>
          <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
          <li className="hideOnMobile"><Link to="/home">Home</Link></li>
          <li className="hideOnMobile"><Link to="/rent-schedule">Schedule</Link></li>
          <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
          <li className="hideOnMobile"><Link to="/services">Services</Link></li>
          <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
          <li className="hideOnMobile"><Link to="/about">About Us</Link></li>

          {/* Conditional Main Nav Icons */}
          {user ? (
            isAdmin ? (
              <li className="hideOnMobile">
                <Link to="/AdminDashboard" title="Admin Dashboard">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                    <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                  </svg>
                </Link>
              </li>
            ) : (
              <li className="hideOnMobile">
                <Link to="/UserDashboard" title="User Dashboard">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                    <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                  </svg>
                </Link>
              </li>
            )
          ) : (
            <li className="hideOnMobile">
              <Link to="/login-register" title="Login / Register">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                  <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                </svg>
              </Link>
            </li>
          )}

          <li className="menu-button" onClick={showSidebar}>
            <a href="#">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
              </svg>
            </a>
          </li>
        </ul>
      </nav>

      {/* Photobooth Content */}
      <div className="photobooth-container">
        <div className="photobooth-header">
          <h1 className="title">Virtual Photobooth</h1>
          <div className="photo-counter">
             {uploadedImages.length}/{MAX_PHOTOS} Photos
            {!canTakeMorePhotos && <span className="limit-reached"> - Limit Reached!</span>}
          </div>
          <div className="cloudinary-status">
            {isUploading && <span className="uploading-indicator"> Uploading to Cloudinary...</span>}
            {selectedFrame !== "None" && !frameLoaded && <span className="frame-loading"> Loading frame...</span>}
          </div>
        </div>

        <div className="camera-container">
          <div className="video-area">
            <div className="video-wrapper">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`camera-video ${isCameraOn ? 'active' : ''}`}
              />
              
              {/* Frame Overlay - Perfectly aligned with video */}
              <img
                ref={overlayRef}
                className="frame-overlay"
                style={{ 
                  display: selectedFrame !== "None" && frameLoaded ? 'block' : 'none'
                }}
                alt="Frame overlay"
              />
              
              {!isCameraOn && (
                <div className="camera-placeholder">
                  <div className="placeholder-text">Camera Off</div>
                  <div className="placeholder-subtext">Click "Start Capture" to begin</div>
                </div>
              )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas 
              ref={canvasRef} 
              style={{ display: "none" }} 
            />
          </div>

          <div className="controls-section">
            <div className="capture-buttons">
              <button 
                className={`capture-btn ${!isCameraOn ? 'primary' : 'secondary'}`}
                onClick={!isCameraOn ? startCamera : stopCamera}
                disabled={isCapturing}
              >
                {!isCameraOn ? " Start Capture" : " Stop Capture"}
              </button>
              
              {isCameraOn && (
                <button 
                  className="capture-btn primary" 
                  onClick={captureAndUpload}
                  disabled={isCapturing || isUploading || (selectedFrame !== "None" && !frameLoaded) || !canTakeMorePhotos}
                >
                  {isCapturing ? " Capturing..." : 
                   isUploading ? " Uploading..." : 
                   !canTakeMorePhotos ? ` Limit ${MAX_PHOTOS} Photos` : 
                   " Capture & Upload"}
                </button>
              )}
            </div>

            <div className="frames-section">
              <h3>FRAMES</h3>
              <div className="frames-grid">
                {FRAMES.map((frame) => (
                  <button
                    key={frame.name}
                    className={`frame-option ${selectedFrame === frame.name ? 'active' : ''}`}
                    onClick={() => handleFrameSelect(frame.name)}
                    disabled={!isCameraOn && frame.name !== "None"}
                  >
                    {frame.name}
                    {selectedFrame === frame.name && frame.name !== "None" && !frameLoaded && " (Loading...)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              Note: Using a desktop is recommended for better performance.
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {uploadedImages.length > 0 && (
          <div className="gallery">
            <div className="gallery-header">
              <h2>Your Photos ({uploadedImages.length}/{MAX_PHOTOS})</h2>
            </div>
            
            <div className="grid">
              {uploadedImages.map((url, index) => (
                <div key={index} className="photo-card">
                  <img 
                    src={url} 
                    alt={`Captured photo ${index + 1}`} 
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Failed to load image: ${url}`);
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div class="image-error">❌ Image not found</div>';
                    }}
                  />
                  <div className="photo-actions">
                    <button 
                      onClick={() => viewImage(url)}
                      className="view-btn"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => downloadImage(url, `photobooth-${index + 1}.jpg`)}
                      className="download-btn"
                    >
                      Download
                    </button>
                    <button 
                      onClick={() => deletePhoto(index)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="gallery-actions">
              <button 
                onClick={() => {
                  if (window.confirm("Clear all photos from gallery?")) {
                    setUploadedImages([]);
                  }
                }}
                className="clear-btn"
              >
                Clear All Photos
              </button>
            </div>
          </div>
        )}

        {uploadedImages.length === 0 && (
          <div className="empty-gallery">
            <p>No photos yet. Capture some photos to see them here!</p>
            <p><strong>Photo Limit:</strong> You can take up to {MAX_PHOTOS} photos.</p>
            <p>All photos are automatically saved to Cloudinary and can be accessed anytime.</p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="footer">
        <div className="copyright">
          <div className="column ss-copyright">
            <span>&copy; 2025 RP Media Services. All rights reserved</span> 
          </div>
        </div>
      </footer>
    </>
  );
};

export default Photobooth;