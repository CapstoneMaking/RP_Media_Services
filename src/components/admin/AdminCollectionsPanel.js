import React, { useState, useEffect, useRef } from 'react';

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

const AdminCollectionsPanel = ({ 
  collections, 
  users, 
  loading, 
  uploading,
  createCollection, 
  uploadMultipleFilesToCollection, 
  deleteCollection, 
  deleteFile, 
  getCollectionFiles 
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionPrice, setCollectionPrice] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentCollectionFiles, setCurrentCollectionFiles] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('view'); // 'view' or 'create'
  const [fileTypeFilter, setFileTypeFilter] = useState('all'); // 'all', 'image', 'video'
  
  // MODIFIED: Store upload progress by collection ID
  const [uploadProgress, setUploadProgress] = useState({
    inProgress: false,
    collectionId: null,
    collectionName: '',
    total: 0,
    completed: 0,
    currentFile: '',
    failedFiles: []
  });
  
  const fileInputRef = useRef(null);

  // Load collection files when a collection is selected
  useEffect(() => {
    if (selectedCollection) {
      loadCollectionFiles(selectedCollection);
    }
  }, [selectedCollection]);

  // NEW: Check if selected collection is currently uploading
  useEffect(() => {
    if (selectedCollection && uploadProgress.collectionId === selectedCollection.id) {
      // Collection is being uploaded to, we can show progress
      console.log('Collection is uploading:', selectedCollection.name);
    }
  }, [selectedCollection, uploadProgress]);

  const loadCollectionFiles = async (collection) => {
    try {
      const files = await getCollectionFiles(collection.id);
      setCurrentCollectionFiles(files);
    } catch (error) {
      setCurrentCollectionFiles([]);
    }
  };

  // Filter files by type
  const getFilteredFiles = () => {
    if (fileTypeFilter === 'all') {
      return currentCollectionFiles;
    }
    return currentCollectionFiles.filter(file => {
      const fileType = file.fileType || file.cloudinaryData?.format || '';
      if (fileTypeFilter === 'image') {
        return fileType.startsWith('image/') || 
               ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileType.toLowerCase());
      } else if (fileTypeFilter === 'video') {
        return fileType.startsWith('video/') || 
               ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'].includes(fileType.toLowerCase());
      }
      return true;
    });
  };

  // File selection and management - MODIFIED to accumulate files
  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    
    if (newFiles.length > 0) {
      // Validate file sizes before adding
      const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
      const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
      
      const oversizedFiles = [];
      const validFiles = newFiles.filter(file => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        if (isImage && file.size > MAX_IMAGE_SIZE) {
          oversizedFiles.push(`${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
          return false;
        }
        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          oversizedFiles.push(`${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
          return false;
        }
        return true;
      });
      
      // Show warning for oversized files
      if (oversizedFiles.length > 0) {
        showMessage(`Some files were skipped due to size limits:\n${oversizedFiles.join('\n')}\n\nLimits: Images ≤10MB, Videos ≤100MB`);
      }
      
      // Check for duplicate files
      const uniqueNewFiles = validFiles.filter(newFile => 
        !selectedFiles.some(existingFile => 
          existingFile.name === newFile.name && 
          existingFile.size === newFile.size &&
          existingFile.lastModified === newFile.lastModified
        )
      );
      
      setSelectedFiles(prev => [...prev, ...uniqueNewFiles]);
      
      // Set collection name from first file if not already set
      if (!collectionName && selectedFiles.length === 0 && uniqueNewFiles.length > 0) {
        const firstFile = uniqueNewFiles[0];
        setCollectionName(firstFile.name.split('.')[0] + ' Collection');
      }
      
      // Reset the file input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeSelectedFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  // User management
  const handleUserToggle = (userEmail) => {
    setSelectedUsers(prev => 
      prev.includes(userEmail)
        ? prev.filter(email => email !== userEmail)
        : [...prev, userEmail]
    );
  };

  const handleSelectAllUsers = () => {
    const regularUsers = users.filter(user => user.role === 'user');
    if (selectedUsers.length === regularUsers.length) {
      setSelectedUsers([]);
    } else {
      const allUserEmails = regularUsers.map(user => user.email);
      setSelectedUsers(allUserEmails);
    }
  };

  // Collection creation
  const handleCreateCollection = async (e) => {
    e.preventDefault();
    
    if (!collectionName || selectedFiles.length === 0) {
      showMessage('Please enter collection name and select at least one file');
      return;
    }

    if (selectedUsers.length === 0) {
      showMessage('Please select at least one user to assign this collection to');
      return;
    }

    // Final file size validation
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    
    const oversizedFiles = selectedFiles.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (isImage && file.size > MAX_IMAGE_SIZE) return true;
      if (isVideo && file.size > MAX_VIDEO_SIZE) return true;
      return false;
    });
    
    if (oversizedFiles.length > 0) {
      showMessage(`Some files exceed size limits:\n${oversizedFiles.map(f => 
        `${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`
      ).join('\n')}\n\nLimits: Images ≤10MB, Videos ≤100MB`);
      return;
    }

    try {
      const collectionData = {
        name: collectionName,
        description: collectionDescription,
        price: parseFloat(collectionPrice) || 0,
        imageCount: selectedFiles.length,
        assignedUsers: selectedUsers,
        status: 'active',
        isPremium: parseFloat(collectionPrice) > 0
      };

      const collectionResult = await createCollection(collectionData);
      
      if (!collectionResult.success) {
        showMessage('Failed to create collection');
        return;
      }

      const collectionId = collectionResult.id;
      const newCollection = collectionResult.collection || { id: collectionId, name: collectionName };

      // Set upload progress state with collection ID
      setUploadProgress({
        inProgress: true,
        collectionId: collectionId,
        collectionName: collectionName,
        total: selectedFiles.length,
        completed: 0,
        currentFile: 'Starting upload...',
        failedFiles: []
      });

      // Automatically switch to view tab and select this collection
      setActiveSubTab('view');
      setSelectedCollection(newCollection);

      const uploadResults = await uploadMultipleFilesToCollection(
        selectedFiles, 
        collectionId, 
        collectionName, 
        collectionDescription,
        // Progress callback
        (progress, fileName, error) => {
          setUploadProgress(prev => ({
            ...prev,
            completed: progress,
            currentFile: fileName || `Uploading file ${progress + 1} of ${prev.total}`,
            failedFiles: error ? [...prev.failedFiles, { fileName, error }] : prev.failedFiles
          }));
        }
      );

      // Analyze upload results
      const successfulUploads = uploadResults.filter(r => r && r.success).length;
      const failedUploads = uploadResults.filter(r => r && !r.success);

      // Update progress to show completion
      setUploadProgress(prev => ({
        ...prev,
        inProgress: false,
        completed: prev.total,
        currentFile: failedUploads.length > 0 ? 
          `Upload completed with ${failedUploads.length} errors` : 
          'Upload completed successfully!'
      }));

      // Reload files after upload
      await loadCollectionFiles(newCollection);

      if (failedUploads.length > 0) {
        const errorMessages = failedUploads.map(f => 
          `• ${f.fileName || f.name || 'Unknown file'}: ${f.error || 'Unknown error'}`
        ).join('\n');
        
        showMessage(`Collection "${collectionName}" created with ${successfulUploads}/${selectedFiles.length} files.\n\nFailed uploads:\n${errorMessages}\n\nNote: The collection was created but some files failed to upload. You can add more files later.`);
      }

      if (successfulUploads > 0) {
        showMessage(`Collection "${collectionName}" created successfully with ${successfulUploads} files!`);
        resetForm();
      } else {
        showMessage('Collection created but no files were uploaded successfully. You can add files to this collection later.');
      }
    } catch (error) {
      setUploadProgress(prev => ({
        ...prev,
        inProgress: false,
        currentFile: `Error: ${error.message || 'Upload failed'}`
      }));
      console.error('Error creating collection:', error);
      showMessage(`Error creating collection: ${error.message || 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setCollectionName('');
    setCollectionDescription('');
    setCollectionPrice(0);
    setSelectedUsers([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Collection management
  const handleDeleteCollection = async (collectionId, collectionName) => {
    if (window.confirm(`Are you sure you want to delete "${collectionName}"? This will also delete all files in this collection.`)) {
      const result = await deleteCollection(collectionId);
      if (result.success) {
        if (selectedCollection?.id === collectionId) {
          setSelectedCollection(null);
          setCurrentCollectionFiles([]);
        }
        // Clear upload progress if it was for this collection
        if (uploadProgress.collectionId === collectionId) {
          setUploadProgress({
            inProgress: false,
            collectionId: null,
            collectionName: '',
            total: 0,
            completed: 0,
            currentFile: '',
            failedFiles: []
          });
        }
      } else {
        showMessage('Failed to delete collection');
      }
    }
  };

  // File management within collections
  const handleDeleteFile = async (fileId, publicId, fileName) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      setDeletingFileId(fileId);
      try {
        const result = await deleteFile(fileId, publicId);
        if (result.success) {
          setCurrentCollectionFiles(prev => prev.filter(file => file.id !== fileId));
          
          if (selectedCollection) {
            const updatedFiles = await getCollectionFiles(selectedCollection.id);
            setCurrentCollectionFiles(updatedFiles);
          }
        } else {
          showMessage('Failed to delete file');
        }
      } catch (error) {
        showMessage('Error deleting file');
      } finally {
        setDeletingFileId(null);
      }
    }
  };

  // Determine file type
  const getFileType = (file) => {
    const fileType = file.fileType || file.cloudinaryData?.format || '';
    if (fileType.startsWith('video/') || 
        ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv'].includes(fileType.toLowerCase())) {
      return 'video';
    }
    return 'image';
  };

  // Media display component
  const MediaDisplay = ({ file }) => {
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
          alt={file.title}
          onError={() => setMediaError(true)}
        />
      );
    }
  };

  const regularUsers = users.filter(user => user.role === 'user');

  // Collection Detail View
  if (selectedCollection) {
    const filteredFiles = getFilteredFiles();
    const imageCount = currentCollectionFiles.filter(f => getFileType(f) === 'image').length;
    const videoCount = currentCollectionFiles.filter(f => getFileType(f) === 'video').length;
    
    // Check if this collection is currently uploading
    const isUploadingToThisCollection = uploadProgress.inProgress && 
                                      uploadProgress.collectionId === selectedCollection.id;

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <button 
            className="back-button"
            onClick={() => {
              setSelectedCollection(null);
              setCurrentCollectionFiles([]);
            }}
          >
            ← Back to Collections
          </button>
          <div className="header-content">
            <h1>{selectedCollection.name}</h1>
            <p>{selectedCollection.description}</p>
            {selectedCollection.price > 0 && (
              <div className="premium-badge">
                Premium Collection - ₱{selectedCollection.price}
              </div>
            )}
          </div>
          <div className="stats-container">
            <span className="stat-badge">{currentCollectionFiles.length} files</span>
            <span className="stat-badge">{imageCount} images</span>
            <span className="stat-badge">{videoCount} videos</span>
            <span className="stat-badge">{selectedCollection.assignedUsers?.length || 0} users</span>
          </div>
        </div>

        {/* NEW: Upload Progress Banner for this collection */}
        {isUploadingToThisCollection && (
          <div className="upload-progress-banner slide-in">
            <div className="progress-header">
              <h4>
                <div className="spinner spinner-small"></div>
                Uploading to "{uploadProgress.collectionName}"...
              </h4>
              <span>{uploadProgress.completed} of {uploadProgress.total} files</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="current-file">
              {uploadProgress.currentFile}
              {uploadProgress.failedFiles.length > 0 && (
                <span className="error-count">
                  ({uploadProgress.failedFiles.length} errors)
                </span>
              )}
            </p>
            
            {uploadProgress.failedFiles.length > 0 && (
              <div className="failed-files">
                <p className="error-message">
                  Some files failed to upload. You can try adding them again later.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="slide-up">
          {/* File Type Filter */}
          <div className="file-type-filter">
            <button 
              className={`filter-btn ${fileTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setFileTypeFilter('all')}
            >
              All Files ({currentCollectionFiles.length})
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

          {filteredFiles.length === 0 && !isUploadingToThisCollection ? (
            <div className="empty-state">
              <h3>No Files Found</h3>
              <p>No {fileTypeFilter === 'all' ? '' : fileTypeFilter} files in this collection.</p>
              {isUploadingToThisCollection && (
                <p className="uploading-message">
                  Files are currently being uploaded...
                </p>
              )}
            </div>
          ) : (
            <div className="files-grid">
              {filteredFiles.map((file) => {
                const fileType = getFileType(file);
                return (
                  <div key={file.id} className={`file-card ${fileType === 'video' ? 'video-card' : 'image-card'}`}>
                    <div className="file-type-badge">
                      {fileType === 'video' ? 'VIDEO' : 'IMAGE'}
                    </div>
                    <div className="file-media">
                      <MediaDisplay file={file} />
                    </div>
                    <div className="file-info">
                      <h4>{file.title}</h4>
                      {file.description && (
                        <p className="file-description">{file.description}</p>
                      )}
                      <div className="file-meta">
                        <span>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        <span>{file.cloudinaryData?.format?.toUpperCase() || file.fileType}</span>
                        <span>{fileType.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      <button
                        className="btn btn-danger btn-full"
                        onClick={() => handleDeleteFile(
                          file.id, 
                          file.cloudinaryData?.public_id, 
                          file.title
                        )}
                        disabled={deletingFileId === file.id || loading}
                      >
                        {deletingFileId === file.id ? (
                          <>
                            <div className="spinner"></div>
                            Deleting...
                          </>
                        ) : (
                          'Delete File'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Collections Panel View
  return (
    <div className="collections-panel">
      <div className="panel-header">
        <h2>Collections Management</h2>
        <p>Create, view, and manage media collections (images & videos)</p>
      </div>

      {/* NEW: Global Upload Progress Indicator */}
      {uploadProgress.inProgress && (
        <div className="global-upload-progress">
          <div className="progress-card">
            <div className="progress-header">
              <h4>
                <div className="spinner spinner-small"></div>
                Uploading to "{uploadProgress.collectionName}"...
              </h4>
              <button 
                className="btn btn-link"
                onClick={() => {
                  // Find and select the collection being uploaded to
                  const uploadingCollection = collections.find(
                    c => c.id === uploadProgress.collectionId
                  );
                  if (uploadingCollection) {
                    setSelectedCollection(uploadingCollection);
                  }
                }}
              >
                View Collection →
              </button>
            </div>
            <div className="progress-stats">
              <span>{uploadProgress.completed} of {uploadProgress.total} files</span>
              <span>{Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="current-file">{uploadProgress.currentFile}</p>
          </div>
        </div>
      )}

      {/* Sub-tabs for Collections */}
      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeSubTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('view')}
        >
          View Collections ({collections.length})
        </button>
        <button 
          className={`tab ${activeSubTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('create')}
        >
          Create New Collection
        </button>
      </div>

      {/* View Collections Tab */}
      {activeSubTab === 'view' && (
        <div className="fade-in">
          {collections.length === 0 ? (
            <div className="empty-state">
              <h3>No Collections Yet</h3>
              <p>Create your first collection to get started</p>
              <button 
                className="btn btn-primary"
                onClick={() => setActiveSubTab('create')}
              >
                Create Collection
              </button>
            </div>
          ) : (
            <div className="collections-grid">
              {collections.map(collection => {
                const imageCount = 0; // You might want to calculate this from actual files
                const videoCount = 0; // You might want to calculate this from actual files
                
                return (
                  <div key={collection.id} className={`collection-card ${collection.price > 0 ? 'premium-collection' : ''}`}>
                    <div className="collection-header">
                      <h3>{collection.name}</h3>
                      <div className="badges-container">
                        <span className="badge">{collection.imageCount} files</span>
                        <span className="badge">{collection.assignedUsers?.length || 0} users</span>
                        <span className="badge badge-info">Images & Videos</span>
                        {collection.price > 0 ? (
                          <span className="badge badge-premium">₱{collection.price}</span>
                        ) : (
                          <span className="badge badge-success">Free</span>
                        )}
                      </div>
                    </div>
                    
                    <p className="collection-description">{collection.description}</p>
                    
                    <div className="collection-meta">
                      <span>Created: {new Date(collection.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="collection-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => setSelectedCollection(collection)}
                      >
                        View Collection
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteCollection(collection.id, collection.name)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Collection Tab */}
      {activeSubTab === 'create' && (
        <div className="fade-in">
          <div className="card">
            <div className="card-header">
              <h2>Create New Collection</h2>
              <p>Upload images and videos and assign them to users</p>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateCollection}>
                <div className="grid grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Collection Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      required
                      placeholder="Enter collection name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      placeholder="Describe this collection..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Price (₱)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={collectionPrice}
                      onChange={(e) => setCollectionPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00 for free collections"
                    />
                  </div>

                  <div className="form-group grid-cols-2">
                    <label className="form-label">
                      Assign to Users ({regularUsers.length} available)
                    </label>
                    <div className="users-selection">
                      {regularUsers.length > 0 && (
                        <div className="select-all">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={selectedUsers.length === regularUsers.length && regularUsers.length > 0}
                              onChange={handleSelectAllUsers}
                            />
                            <span>Select All Users</span>
                          </label>
                        </div>
                      )}
                      <div className="users-list">
                        {regularUsers.length === 0 ? (
                          <div className="no-users">
                            <p>No users available. Users need to register first.</p>
                          </div>
                        ) : (
                          regularUsers.map(user => (
                            <label key={user.id} className="checkbox-label user-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.email)}
                                onChange={() => handleUserToggle(user.email)}
                              />
                              <span className="user-info">
                                <strong>{user.name}</strong>
                                <span className="user-email">{user.email}</span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="form-group grid-cols-2">
                    <label className="form-label">Select Files (Images & Videos)</label>
                    <div className="file-upload-area">
                      <input
                        type="file"
                        id="file-input"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*"
                        multiple
                        className="file-input"
                      />
                      <label htmlFor="file-input" className="file-upload-label">
                        <div className="upload-text">
                          <strong>Click to select files</strong>
                          <span>Accepted: Images & Videos</span>
                          <span>Drag and drop files here</span>
                        </div>
                      </label>
                    </div>
                    <small className="form-help">
                      You can upload both images and videos. Videos up to 100MB, images up to 10MB.
                    </small>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="form-group grid-cols-2">
                      <label className="form-label">Selected Files ({selectedFiles.length})</label>
                      <div className="selected-files">
                        {selectedFiles.map((file, index) => {
                          const isVideo = file.type.startsWith('video/');
                          const isImage = file.type.startsWith('image/');
                          
                          return (
                            <div key={index} className={`selected-file ${isVideo ? 'video-file' : 'image-file'}`}>
                              <div className="file-preview">
                                {isVideo ? (
                                  <div className="video-thumbnail">
                                    <div className="video-icon">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                    </div>
                                    <span>Video</span>
                                  </div>
                                ) : (
                                  <img 
                                    src={URL.createObjectURL(file)} 
                                    alt={file.name}
                                    className="file-thumbnail"
                                  />
                                )}
                                <div className="file-details">
                                  <div className="file-name">{file.name}</div>
                                  <div className="file-meta-info">
                                    <span className="file-type">{isVideo ? 'Video' : 'Image'}</span>
                                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="remove-file"
                                onClick={() => removeSelectedFile(file.name)}
                                disabled={uploadProgress.inProgress}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Progress Display in Create Form */}
                {uploadProgress.inProgress && uploadProgress.collectionId === null && (
                  <div className="upload-progress-container">
                    <div className="progress-header">
                      <h4>Uploading Files...</h4>
                      <span>{uploadProgress.completed} of {uploadProgress.total}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="current-file">{uploadProgress.currentFile}</p>
                  </div>
                )}

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={uploadProgress.inProgress || selectedFiles.length === 0 || selectedUsers.length === 0}
                  >
                    {uploadProgress.inProgress ? (
                      <>
                        <div className="spinner"></div>
                        Uploading... ({uploadProgress.completed}/{uploadProgress.total})
                      </>
                    ) : (
                      `Create Collection with ${selectedFiles.length} Files`
                    )}
                  </button>
                  
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={resetForm}
                    disabled={uploadProgress.inProgress}
                  >
                    Clear All
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCollectionsPanel;