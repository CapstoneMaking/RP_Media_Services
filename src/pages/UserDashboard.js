// UserDashboard.js - UPDATED WITH VIDEO SUPPORT AND ID VERIFICATION IN HEADER
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePayment } from '../context/PaymentContext';
import { useIDVerification } from '../context/IDVerificationContext';
import CollectionsPanel from '../components/user/UserCollectionsPanel';
import BookingsPanel from '../components/user/UserBookingPanel';
import PaymentModal from '../components/user/UserPaymentPanel';
import IDVerification from '../components/user/UserIDVerificationPanel';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useNavigate, Link } from 'react-router-dom';
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
const UserDashboard = () => {
  const { collections, getCollectionFiles } = useApp();
  const { user } = useAuth();
  const { requestPayment } = usePayment();
  const { userVerification } = useIDVerification();
  
  const [userCollections, setUserCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionFiles, setCollectionFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('collections');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [showVerificationForm, setShowVerificationForm] = useState(false);

  const navigate = useNavigate();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login-register');
    } catch (error) {
      showMessage('Failed to logout. Please try again.');
    }
  };

  const viewCollection = async (collection) => {
    if (!collection.hasAccess && collection.isPremium) {
      requestPayment(collection);
      return;
    }

    setLoading(true);
    setSelectedCollection(collection);
    
    try {
      const files = await getCollectionFiles(collection.id);
      setCollectionFiles(files);
    } catch (error) {
      setCollectionFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const getFileType = (file) => {
    const fileType = file.fileType || file.cloudinaryData?.format || '';
    if (fileType.startsWith('video/') || 
        ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'].includes(fileType.toLowerCase())) {
      return 'video';
    }
    return 'image';
  };

  const getFilteredFiles = () => {
    if (fileTypeFilter === 'all') {
      return collectionFiles;
    }
    return collectionFiles.filter(file => {
      const fileType = getFileType(file);
      return fileType === fileTypeFilter;
    });
  };

  const downloadFile = async (file) => {
    const fileType = getFileType(file);
    
    if (!file.cloudinaryData?.secure_url) {
      showMessage(`No ${fileType} available for download`);
      return;
    }

    try {
      const response = await fetch(file.cloudinaryData.secure_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileExtension = file.cloudinaryData.format || (fileType === 'video' ? 'mp4' : 'jpg');
      const fileName = `${file.title || fileType}.${fileExtension}`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showMessage(`Failed to download ${fileType}`);
    }
  };

  const downloadAllFiles = async () => {
    if (collectionFiles.length === 0) {
      showMessage('No files to download');
      return;
    }

    setDownloadingAll(true);

    try {
      for (let i = 0; i < collectionFiles.length; i++) {
        const file = collectionFiles[i];
        const fileType = getFileType(file);
        
        if (file.cloudinaryData?.secure_url) {
          try {
            const response = await fetch(file.cloudinaryData.secure_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const fileExtension = file.cloudinaryData.format || (fileType === 'video' ? 'mp4' : 'jpg');
            const fileName = `${file.title || `${fileType}_${i + 1}`}.${fileExtension}`;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Failed to download file ${i + 1}:`, error);
          }
        }
      }
    } catch (error) {
      showMessage('Failed to download some files. Please try downloading individually.');
    } finally {
      setDownloadingAll(false);
    }
  };

  const MediaDisplay = ({ file, index }) => {
    const [mediaError, setMediaError] = useState(false);
    const fileType = getFileType(file);
    const secureUrl = file.cloudinaryData?.secure_url;

    if (!secureUrl || mediaError) {
      return (
        <div className="media-placeholder">
          <div className="placeholder-text">
            {fileType === 'video' ? 'No Video' : 'No Image'}
          </div>
        </div>
      );
    }

    if (fileType === 'video') {
      return (
        <div className="video-container">
          <video 
            controls
            className="collection-video"
            preload="metadata"
          >
            <source src={secureUrl} type={file.fileType || 'video/mp4'} />
            Your browser does not support the video tag.
          </video>
          <div className="video-overlay">
            <div className="play-button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <img 
          src={secureUrl} 
          className="collection-image"
          alt={file.title || `Image ${index + 1}`}
          onError={() => setMediaError(true)}
        />
      );
    }
  };

  if (loading && !selectedCollection) {
    return (
      <>
        <nav>
          <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
            <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
            <li><Link to="/home">Home</Link></li>
            <li><Link to="/rent-schedule">Schedule</Link></li>
            <li><Link to="/packages">Packages</Link></li>
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/photobooth">Photobooth</Link></li>
            <li><Link to="/about">About us</Link></li>
            <li><a href="/userDashboard">User Dashboard</a></li>
          </ul>
          <ul>
            <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
            <li className="hideOnMobile"><Link to="/home">Home</Link></li>
            <li className="hideOnMobile"><Link to="/rent-schedule">Schedule</Link></li>
            <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
            <li className="hideOnMobile"><Link to="/services">Services</Link></li>
            <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
            <li className="hideOnMobile"><Link to="/about">About Us</Link></li>
            <li className="hideOnMobile"><a href="/userDashboard">Dashboard</a></li>
            <li className="menu-button" onClick={showSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg></a></li>
          </ul>
        </nav>

        <div className="app-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>

        <footer className="footer">
          <div className="copyright">
            <div className="column ss-copyright">
              <span>&copy; 2025 RP Media Services. All rights reserved</span> 
              <a className="smoothscroll" title="Back to Top" href="#top">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0l8 9h-6v15h-4v-15h-6z"/></svg>
              </a>
            </div>
          </div>
        </footer>
      </>
    );
  }

  if (selectedCollection) {
    const filteredFiles = getFilteredFiles();
    const imageCount = collectionFiles.filter(f => getFileType(f) === 'image').length;
    const videoCount = collectionFiles.filter(f => getFileType(f) === 'video').length;
    return (
      <>
        <div className="dashboard">
          <div className="dashboard-header">
            <button 
              className="back-button"
              onClick={() => {
                setSelectedCollection(null);
                setCollectionFiles([]);
                setFileTypeFilter('all');
              }}
            >
              ← Back to Collections
            </button>
            <div className="header-content">
              <h1>{selectedCollection.name}</h1>
              <p>{selectedCollection.description}</p>
              {selectedCollection.isPremium && (
                <div className="premium-badge">
                  Premium Collection
                </div>
              )}
            </div>
            <div className="stats-container">
              <span className="stat-badge">{collectionFiles.length} files</span>
              <span className="stat-badge">{imageCount} images</span>
              <span className="stat-badge">{videoCount} videos</span>
              {selectedCollection.isPremium && (
                <span className="stat-badge price-badge">
                  ₱{selectedCollection.price}
                </span>
              )}
              {collectionFiles.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={downloadAllFiles}
                  disabled={downloadingAll}
                >
                  {downloadingAll ? (
                    <>
                      <div className="spinner"></div>
                      Downloading...
                    </>
                  ) : (
                    'Download All'
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="slide-up">
            <div className="file-type-filter">
              <button 
                className={`filter-btn ${fileTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setFileTypeFilter('all')}
              >
                All Files ({collectionFiles.length})
              </button>
              <button 
                className={`filter-btn ${fileTypeFilter === 'image' ? 'active' : ''}`}
                onClick={() => setFileTypeFilter('image')}
              >
                Images ({imageCount})
              </button>
              <button 
                className={`filter-btn ${fileTypeFilter === 'video' ? 'active' : ''}`}
                onClick={() => setFileTypeFilter('video')}
              >
                Videos ({videoCount})
              </button>
            </div>

            {filteredFiles.length === 0 ? (
              <div className="empty-state">
                <h3>No Files Found</h3>
                <p>No {fileTypeFilter === 'all' ? '' : fileTypeFilter} files in this collection.</p>
              </div>
            ) : (
              <div className="files-grid">
                {filteredFiles.map((file, index) => {
                  const fileType = getFileType(file);
                  return (
                    <div key={file.id || index} className={`file-card ${fileType === 'video' ? 'video-card' : 'image-card'}`}>
                      <div className="file-type-badge">
                        {fileType === 'video' ? 'VIDEO' : 'IMAGE'}
                      </div>
                      <div className="file-media">
                        <MediaDisplay file={file} index={index} />
                      </div>
                      <div className="file-info">
                        <h4>{file.title || `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} ${index + 1}`}</h4>
                        {file.description && (
                          <p className="file-description">{file.description}</p>
                        )}
                        <div className="file-meta">
                          {file.fileSize && <span>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>}
                          {file.cloudinaryData?.format && <span>{file.cloudinaryData.format.toUpperCase()}</span>}
                          <span>{fileType.toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="file-actions">
                        <button
                          className="btn btn-primary btn-full"
                          onClick={() => downloadFile(file)}
                        >
                          Download {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="footer">
          <div className="copyright">
            <div className="column ss-copyright">
              <span>&copy; 2025 RP Media Services. All rights reserved</span> 
              <a className="smoothscroll" title="Back to Top" href="#top">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0l8 9h-6v15h-4v-15h-6z"/></svg>
              </a>
            </div>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
          <li><Link to="/home">Home</Link></li>
          <li><Link to="/rent-items">Rent</Link></li>
          <li><Link to="/packages">Packages</Link></li>
          <li><Link to="/services">Services</Link></li>
          <li><Link to="/photobooth">Photobooth</Link></li>
          <li><Link to="/about">About us</Link></li>
          <li><a href="/userDashboard">User Dashboard</a></li>
        </ul>
        <ul>
          <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
          <li className="hideOnMobile"><Link to="/home">Home</Link></li>
          <li className="hideOnMobile"><Link to="/rent-items">Rent</Link></li>
          <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
          <li className="hideOnMobile"><Link to="/services">Services</Link></li>
          <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
          <li className="hideOnMobile"><Link to="/about">About Us</Link></li>
          <li className="hideOnMobile"><a href="/userDashboard">User Dashboard</a></li>
          <li className="menu-button" onClick={showSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg></a></li>
        </ul>
      </nav>

      <div className="dashboard">
        <div className="dashboard-header">
          <div className="header-content">
            <h1>Welcome, {user?.displayName || user?.email || "Your Dashboard"}</h1>
            <p>Manage your collections and rental bookings</p>
          </div>
          
          <div className="stats-container">
            <span className="stat-badge">{userCollections.length} collections</span>
            <button 
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ 
                marginLeft: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* ID Verification Section - MOVED FROM COLLECTIONS PANEL TO DASHBOARD */}
        {(!userVerification || userVerification.status === 'rejected') && (
          <div style={{ marginBottom: '2rem' }}>
            <div className="card">
              <div className="card-header">
                <h3>
                  {userVerification?.status === 'rejected' 
                    ? 'ID Verification Required - Resubmission Needed' 
                    : 'ID Verification Required'
                  }
                </h3>
                <p>
                  {userVerification?.status === 'rejected'
                    ? 'Your previous verification was rejected. Please update your details and resubmit.'
                    : 'Complete your identity verification to access all features'
                  }
                </p>
              </div>
              <div className="card-body">
                {!showVerificationForm ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h4>
                      {userVerification?.status === 'rejected' 
                        ? 'Resubmit Your Verification' 
                        : 'Verify Your Identity'
                      }
                    </h4>
                    <p style={{ marginBottom: '2rem', color: '#666'}}>
                      {userVerification?.status === 'rejected'
                        ? 'You need to resubmit your identity verification with corrected information.'
                        : 'You need to verify your identity using a ePhil ID or National ID to access all features.'
                      }
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowVerificationForm(true)}
                      style={{ minWidth: '200px', justifyContent: 'center'}}
                    >
                      {userVerification?.status === 'rejected' 
                        ? 'Resubmit Verification' 
                        : 'Start Verification'
                      }
                    </button>
                  </div>
                ) : (
                  <IDVerification onCancel={() => setShowVerificationForm(false)} />
                )}
              </div>
            </div>
          </div>
        )}

        {userVerification && userVerification.status !== 'rejected' && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <h3>ID Verification Status</h3>
            </div>
            <div className="card-body">
              <div style={{ 
                padding: '1rem', 
                border: `2px solid ${
                  userVerification.status === 'verified' ? 'green' : 
                  userVerification.status === 'rejected' ? 'red' : 'orange'
                }`,
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h4 style={{ 
                  color: userVerification.status === 'verified' ? 'green' : 
                         userVerification.status === 'rejected' ? 'red' : 'orange',
                  margin: '0 0 0.5rem 0' 
                }}>
                  Status: {userVerification.status.toUpperCase()}
                </h4>
                <p style={{ margin: '0' }}>
                  Submitted: {new Date(userVerification.submittedAt).toLocaleDateString()}
                </p>
                {userVerification.resubmissionCount > 0 && (
                  <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                    Resubmissions: {userVerification.resubmissionCount}
                  </p>
                )}
                {userVerification.verifiedAt && (
                  <p style={{ margin: '0' }}>
                    Reviewed: {new Date(userVerification.verifiedAt).toLocaleDateString()}
                  </p>
                )}
                {userVerification.adminNotes && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>Admin Notes:</strong>
                    <p style={{ margin: '0.25rem 0 0 0' }}>{userVerification.adminNotes}</p>
                  </div>
                )}
              </div>
              
              {userVerification.status === 'pending' && (
                <p>Your ID verification is under review. Please check back later.</p>
              )}
            </div>
          </div>
        )}

        <div className="dashboard-tabs">
          <button 
            className={`tab ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            My Collections ({userCollections.length})
          </button>
          <button 
            className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            My Bookings
          </button>
        </div>

        {/* Collections Panel - Now only shows collections without ID verification */}
        {activeTab === 'collections' && (
          <CollectionsPanel 
            userCollections={userCollections}
            setUserCollections={setUserCollections}
            viewCollection={viewCollection}
            loading={loading}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsPanel />
        )}
      </div>
      <PaymentModal />

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

export default UserDashboard;