// components/user/BookingsPanel.js - COMPLETE VERSION WITH PAYMENT STATUS AND IMAGE UPLOAD
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { cloudinaryService } from '../../services/cloudinaryService';

const UserBookingPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [userBookings, setUserBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState('');
  const [expandedBookings, setExpandedBookings] = useState({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [uploadingImages, setUploadingImages] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});

  const loadUserBookings = async () => {
    if (!user) {
      setBookingsError('No user logged in');
      return;
    }
    
    setLoadingBookings(true);
    setBookingsError('');
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../utils/firebase');
      
      // Query without orderBy to avoid index error
      const q = query(
        collection(db, "bookings"), 
        where("userId", "==", user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const bookingsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        bookingsData.push({
          id: doc.id,
          ...data,
          // Ensure paymentStatus has a default value
          paymentStatus: data.paymentStatus || 'no_payment_recorded',
          // Ensure paymentDetails exists
          paymentDetails: data.paymentDetails || { amountPaid: 0 },
          // Ensure uploadedImages exists
          uploadedImages: data.uploadedImages || []
        });
      });
      
      // Manual sorting
      bookingsData.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0);
        const timeB = new Date(b.timestamp || 0);
        return timeB - timeA; // Descending order
      });
      
      setUserBookings(bookingsData);
      setHasLoaded(true);
      
    } catch (error) {
      setBookingsError(`Error loading bookings: ${error.message}`);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Only load bookings when the panel becomes active and hasn't loaded yet
  useEffect(() => {
    if (!hasLoaded) {
      loadUserBookings();
    }
  }, [hasLoaded]);

  // Calculate duration in days
  const calculateDuration = (booking) => {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Calculate total amount including days
  const calculateTotalAmount = (booking) => {
    const duration = calculateDuration(booking);
    
    // For packages: package price * duration
    if (booking.package && booking.package.price) {
      return booking.package.price * duration;
    }
    
    // For individual items: (item price * quantity * days)
    if (booking.items && booking.items.length > 0) {
      return booking.items.reduce((total, item) => {
        const unitPrice = item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
        const quantity = item.quantity || 1;
        return total + (unitPrice * quantity * duration);
      }, 0);
    }
    
    return booking.total || 0;
  };

  // Calculate amount paid (if any)
  const calculateAmountPaid = (booking) => {
    if (booking.paymentDetails && booking.paymentDetails.amountPaid) {
      return booking.paymentDetails.amountPaid;
    }
    return 0;
  };

  // Calculate balance
  const calculateBalance = (booking) => {
    const total = calculateTotalAmount(booking);
    const paid = calculateAmountPaid(booking);
    return total - paid;
  };

  // Calculate item total for display
  const calculateItemTotal = (item, duration) => {
    const unitPrice = item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
    const quantity = item.quantity || 1;
    return unitPrice * quantity * duration;
  };

  // Get unit price for an item
  const getUnitPrice = (item) => {
    return item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
  };

  const toggleBookingFolder = (bookingId) => {
    setExpandedBookings(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  const getBookingStatus = (booking) => {
    if (booking.status) {
      return booking.status;
    }
    
    const today = new Date();
    const endDate = new Date(booking.endDate);
    const startDate = new Date(booking.startDate);
    
    // Reset times to compare dates only
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    if (today < startDate) return 'pending';
    if (today > endDate) return 'completed';
    return 'active';
  };

  // Get payment status with default
  const getPaymentStatus = (booking) => {
    return booking.paymentStatus || 'no_payment_recorded';
  };

  const getStatusColor = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'active': return '#28a745';
      case 'completed': return '#6c757d';
      case 'pending': return '#ffc107';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  // Payment status color function
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'payment_completed': return '#28a745'; // Green
      case 'payment_partially_completed': return '#ffc107'; // Yellow
      case 'no_payment_recorded': return '#dc3545'; // Red
      case 'refunded': return '#17a2b8'; // Teal
      case 'payment_pending': return '#fd7e14'; // Orange
      default: return '#6c757d'; // Gray
    }
  };

  const getPaymentStatusText = (status) => {
    switch (status) {
      case 'payment_completed': return 'Payment Completed';
      case 'payment_partially_completed': return 'Payment Partially Completed';
      case 'no_payment_recorded': return 'No Payment Recorded';
      case 'refunded': return 'Refunded';
      case 'payment_pending': return 'Payment Pending';
      default: return status ? status.replace(/_/g, ' ').toUpperCase() : 'Payment Status Unknown';
    }
  };

  // Handle file selection
  const handleFileSelect = (bookingId, event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prev => ({
      ...prev,
      [bookingId]: files
    }));
  };

  // Upload images to Cloudinary and save to Firebase
  const handleImageUpload = async (bookingId) => {
    const files = selectedFiles[bookingId];
    if (!files || files.length === 0) {
      alert('Please select images to upload');
      return;
    }

    setUploadingImages(prev => ({ ...prev, [bookingId]: true }));
    
    try {
      const uploadedImages = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [bookingId]: {
            current: i + 1,
            total: files.length,
            fileName: file.name
          }
        }));
        
        try {
          // Upload to Cloudinary
          const cloudinaryResult = await cloudinaryService.uploadImage(file);
          
          // Create image object
          const imageData = {
            public_id: cloudinaryResult.public_id,
            secure_url: cloudinaryResult.secure_url,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.email,
            thumbnailUrl: cloudinaryService.getResponsiveImageUrl(cloudinaryResult.public_id, '300', '200', 'fill'),
            originalUrl: cloudinaryResult.secure_url
          };
          
          uploadedImages.push(imageData);
          
        } catch (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          alert(`Failed to upload ${file.name}. Please try again.`);
        }
      }
      
      if (uploadedImages.length > 0) {
        // Save to Firebase
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
          uploadedImages: arrayUnion(...uploadedImages),
          updatedAt: new Date().toISOString()
        });
        
        // Update local state
        setUserBookings(prev => prev.map(booking => {
          if (booking.id === bookingId) {
            return {
              ...booking,
              uploadedImages: [...(booking.uploadedImages || []), ...uploadedImages],
              updatedAt: new Date().toISOString()
            };
          }
          return booking;
        }));
        
        alert(`Successfully uploaded ${uploadedImages.length} image(s)`);
        setSelectedFiles(prev => ({ ...prev, [bookingId]: [] }));
      }
      
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploadingImages(prev => ({ ...prev, [bookingId]: false }));
      setUploadProgress(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  // Delete image from booking
  const deleteBookingImage = async (bookingId, imageIndex) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }
    
    try {
      const booking = userBookings.find(b => b.id === bookingId);
      if (!booking) return;
      
      const updatedImages = [...booking.uploadedImages];
      const deletedImage = updatedImages.splice(imageIndex, 1)[0];
      
      // Update Firebase
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        uploadedImages: updatedImages,
        updatedAt: new Date().toISOString()
      });
      
      // Update local state
      setUserBookings(prev => prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            uploadedImages: updatedImages,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      }));
      
      // Optionally delete from Cloudinary (uncomment if you want to delete from Cloudinary too)
      // try {
      //   await cloudinaryService.deleteImage(deletedImage.public_id);
      // } catch (cloudinaryError) {
      //   console.error('Failed to delete from Cloudinary:', cloudinaryError);
      // }
      
      alert('Image deleted successfully');
      
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const BookingStatusBadge = ({ status }) => {
    const statusText = status ? status.toUpperCase() : 'UNKNOWN';
    const statusLower = status ? status.toLowerCase() : '';
    
    return (
      <span 
        className="status-badge"
        style={{
          backgroundColor: getStatusColor(statusLower) + '20',
          color: getStatusColor(statusLower),
          border: `1px solid ${getStatusColor(statusLower)}40`,
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          marginRight: '0.5rem'
        }}
      >
        {statusText}
      </span>
    );
  };

  // Add PaymentStatusBadge component
  const PaymentStatusBadge = ({ status }) => {
    const statusText = getPaymentStatusText(status);
    
    return (
      <span 
        className="payment-status-badge"
        style={{
          backgroundColor: getPaymentStatusColor(status) + '20',
          color: getPaymentStatusColor(status),
          border: `1px solid ${getPaymentStatusColor(status)}40`,
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600'
        }}
      >
        {statusText}
      </span>
    );
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h3>My Rental Bookings</h3>
          <p>View and manage your equipment rental bookings</p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={loadUserBookings} className="btn btn-primary">
              Refresh Bookings
            </button>
            <button 
              onClick={() => navigate('/rent-items')}
              className="btn btn-primary"
            >
              Make New Booking
            </button>
          </div>
        </div>
        <div className="card-body">
          {loadingBookings ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading your bookings...</p>
            </div>
          ) : bookingsError ? (
            <div className="empty-state">
              <h3>Error Loading Bookings</h3>
              <p>{bookingsError}</p>
              <button onClick={loadUserBookings} className="btn btn-primary">
                Try Again
              </button>
            </div>
          ) : userBookings.length === 0 ? (
            <div className="empty-state">
              <h3>No Bookings Found</h3>
              <p>You haven't made any bookings yet.</p>
              <button 
                onClick={() => navigate('/rent-items')}
                className="btn btn-primary"
              >
                Browse Rental Items
              </button>
            </div>
          ) : (
            <div className="bookings-folder-view">
              {userBookings.map((booking) => {
                const status = getBookingStatus(booking);
                const paymentStatus = getPaymentStatus(booking);
                const duration = calculateDuration(booking);
                const totalAmount = calculateTotalAmount(booking);
                const amountPaid = calculateAmountPaid(booking);
                const balance = calculateBalance(booking);
                
                return (
                  <div key={booking.id} className="booking-folder">
                    <div 
                      className="booking-folder-header"
                      onClick={() => toggleBookingFolder(booking.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="folder-info">
                        <div className="folder-details">
                          <h4>{booking.name} - {booking.venue}</h4>
                          <div className="folder-meta">
                            <span>{booking.startDate} to {booking.endDate} ({duration} days)</span>
                            <span>Total: ₱{totalAmount.toLocaleString()}</span>
                            <PaymentStatusBadge status={paymentStatus} />
                            {booking.uploadedImages && booking.uploadedImages.length > 0 && (
                              <span style={{ color: '#17a2b8' }}>
                                📸 {booking.uploadedImages.length} image(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="folder-actions">
                        <BookingStatusBadge status={status} />
                        <span className="expand-icon">
                          {expandedBookings[booking.id] ? '▼' : '►'}
                        </span>
                      </div>
                    </div>

                    {expandedBookings[booking.id] && (
                      <div className="booking-folder-content">
                        <div className="grid grid-cols-2" style={{ gap: '2rem', marginBottom: '1.5rem' }}>
                          <div>
                            <h5>Customer Information</h5>
                            <div className="info-grid">
                              <div className="info-item">
                                <strong>Name:</strong> {booking.name}
                              </div>
                              <div className="info-item">
                                <strong>Email:</strong> {booking.email}
                              </div>
                              <div className="info-item">
                                <strong>Contact:</strong> {booking.contact}
                              </div>
                              <div className="info-item">
                                <strong>Venue:</strong> {booking.venue}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h5>Booking Details</h5>
                            <div className="info-grid">
                              <div className="info-item">
                                <strong>Start Date:</strong> {booking.startDate}
                              </div>
                              <div className="info-item">
                                <strong>End Date:</strong> {booking.endDate}
                              </div>
                              <div className="info-item">
                                <strong>Duration:</strong> {duration} days
                              </div>
                              <div className="info-item">
                                <strong>Booked On:</strong> {new Date(booking.timestamp).toLocaleDateString()}
                              </div>
                              {booking.updatedAt && (
                                <div className="info-item">
                                  <strong>Last Updated:</strong> {new Date(booking.updatedAt).toLocaleDateString()}
                                </div>
                              )}
                              <div className="info-item">
                                <strong>Status:</strong> <BookingStatusBadge status={status} />
                              </div>
                              <div className="info-item">
                                <strong>Payment Status:</strong> <PaymentStatusBadge status={paymentStatus} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Add Payment Summary Section */}
                        <div className="payment-summary-section" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                          <h5>Payment Summary</h5>
                          <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                            <div className="payment-item" style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Total Amount</div>
                              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#343a40' }}>
                                ₱{totalAmount.toLocaleString()}
                              </div>
                            </div>
                            <div className="payment-item" style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Amount Paid</div>
                              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: amountPaid > 0 ? '#28a745' : '#dc3545' }}>
                                ₱{amountPaid.toLocaleString()}
                              </div>
                              {booking.paymentDetails?.paymentHistory && booking.paymentDetails.paymentHistory.length > 0 && (
                                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  ({booking.paymentDetails.paymentHistory.length} payment{booking.paymentDetails.paymentHistory.length > 1 ? 's' : ''})
                                </div>
                              )}
                            </div>
                            <div className="payment-item" style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Balance</div>
                              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: balance === 0 ? '#28a745' : balance > 0 ? '#ffc107' : '#dc3545' }}>
                                ₱{balance.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {booking.paymentDetails?.paymentHistory && booking.paymentDetails.paymentHistory.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <strong>Payment History:</strong>
                              {booking.paymentDetails.paymentHistory.map((payment, index) => (
                                <div key={index} style={{ fontSize: '0.75rem', padding: '0.25rem', borderBottom: '1px solid #dee2e6' }}>
                                  ₱{payment.amount.toLocaleString()} - {new Date(payment.date).toLocaleDateString()} - {payment.status} 
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Image Upload Section */}
                        <div className="image-upload-section" style={{ marginBottom: '1.5rem' }}>
                          <h5>Upload Images of payment</h5>
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileSelect(booking.id, e)}
                                style={{ display: 'none' }}
                                id={`file-input-${booking.id}`}
                              />
                              <label 
                                htmlFor={`file-input-${booking.id}`}
                                className="btn btn-outline-primary"
                                style={{ cursor: 'pointer', padding: '0.5rem 1rem' }}
                              >
                                Select Images
                              </label>
                              {selectedFiles[booking.id] && selectedFiles[booking.id].length > 0 && (
                                <span style={{ fontSize: '0.875rem' }}>
                                  {selectedFiles[booking.id].length} file(s) selected
                                </span>
                              )}
                              <button
                                className="btn btn-primary"
                                onClick={() => handleImageUpload(booking.id)}
                                disabled={uploadingImages[booking.id] || !selectedFiles[booking.id] || selectedFiles[booking.id].length === 0}
                              >
                                {uploadingImages[booking.id] ? 'Uploading...' : 'Upload Images'}
                              </button>
                            </div>
                            
                            {uploadProgress[booking.id] && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                <div>Uploading: {uploadProgress[booking.id].fileName}</div>
                                <div>
                                  Progress: {uploadProgress[booking.id].current} of {uploadProgress[booking.id].total}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Display Uploaded Images */}
                          {booking.uploadedImages && booking.uploadedImages.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <h6>Uploaded Images ({booking.uploadedImages.length})</h6>
                              <div className="uploaded-images-grid" style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                                gap: '1rem',
                                marginTop: '0.5rem'
                              }}>
                                {booking.uploadedImages.map((image, index) => (
                                  <div key={index} className="uploaded-image-card" style={{ 
                                    border: '1px solid #dee2e6', 
                                    borderRadius: '8px',
                                    padding: '0.5rem',
                                    position: 'relative'
                                  }}>
                                    <div style={{ 
                                      height: '150px', 
                                      overflow: 'hidden',
                                      borderRadius: '4px',
                                      marginBottom: '0.5rem'
                                    }}>
                                      <img 
                                        src={image.thumbnailUrl || image.secure_url} 
                                        alt={`Booking image ${index + 1}`}
                                        style={{ 
                                          width: '100%', 
                                          height: '100%', 
                                          objectFit: 'cover' 
                                        }}
                                      />
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                      {image.fileName}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                      <a 
                                        href={image.secure_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-primary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                      >
                                        View Full
                                      </a>
                                      <button
                                        onClick={() => deleteBookingImage(booking.id, index)}
                                        className="btn btn-sm btn-outline-danger"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.25rem' }}>
                                      Uploaded: {new Date(image.uploadedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="booked-items-section">
                          <h5>Booked Items</h5>
                          {booking.package ? (
                            <div className="items-grid">
                              <div className="item-card">
                                <div className="item-info">
                                  <h6>{booking.package.name}</h6>
                                  <span className="items-category">Package</span>
                                </div>
                                <div className="item-details">
                                  <span className="item-price">₱{booking.package.price?.toLocaleString()} per day</span><br></br>
                                  <span className="item-calculation">
                                    {duration} days
                                  </span>
                                </div>
                              </div>
                              {booking.package.items && booking.package.items.length > 0 && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                  <h6 style={{ marginBottom: '0.5rem' }}>Package Includes:</h6>
                                  {booking.package.items.map((item, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                      <span>{item.name}</span>
                                      <span>Qty: {item.quantity || 1}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : booking.items && booking.items.length > 0 ? (
                            <div className="items-grid">
                              {booking.items.map((item, index) => {
                                const unitPrice = getUnitPrice(item);
                                const quantity = item.quantity || 1;
                                const itemTotal = calculateItemTotal(item, duration);
                                
                                return (
                                  <div key={index} className="item-card">
                                    <div className="item-info">
                                      <h6>{item.name}</h6>
                                      <span className="items-category">{item.category || 'Rental Item'}</span>
                                    </div>
                                    <div className="item-details">
                                      <span className="item-quantity">Qty: {quantity}</span><br></br>
                                      <span className="item-price">₱{unitPrice.toLocaleString()} per day</span><br></br>
                                      <span className="item-total">
                                        <strong>Item Total: ₱{itemTotal.toLocaleString()}</strong>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p>No items found in this booking.</p>
                          )}
                          <div className="booking-total" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                            <strong>Total Amount: ₱{totalAmount.toLocaleString()}</strong>
                            <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                            </div>
                          </div>
                        </div>

                        <div className="booking-actions">
                          <button
                            className="btn btn-secondary"
                            onClick={() => toggleBookingFolder(booking.id)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserBookingPanel;