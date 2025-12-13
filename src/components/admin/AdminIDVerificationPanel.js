// IDVerificationPanel.js
import React, { useState } from 'react';

const AdminIDVerificationPanel = ({
  verifications,
  verificationLoading,
  updateVerificationStatus,
  onViewVerification
}) => {
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [customReason, setCustomReason] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedImage, setSelectedImage] = useState(null);

  // Predefined rejection reasons - updated structure
  const rejectionReasons = [
    { value: 'name_mismatch', label: 'Mismatched Full Name' },
    { value: 'id_number_mismatch', label: 'Invalid or Mismatched ID Number' },
    { value: 'dob_mismatch', label: 'Incorrect Date of Birth' },
    { value: 'address_mismatch', label: 'Incorrect Address' },
    { value: 'unreadable_id_photo', label: 'Unreadable ID Photo' },
    { value: 'incomplete_id_photo', label: 'Incomplete ID Photo' },
    { value: 'blurred_selfie', label: 'Blurred Selfie' }
  ];

  const handleReasonChange = (reasonValue) => {
    if (selectedReasons.includes(reasonValue)) {
      setSelectedReasons(selectedReasons.filter(r => r !== reasonValue));
    } else {
      setSelectedReasons([...selectedReasons, reasonValue]);
    }
  };

  const handleVerificationStatusUpdate = async (verificationId, status) => {
    let rejectionReason = '';

    if (status === 'rejected') {
      if (selectedReasons.length === 0) {
        alert('Please select at least one rejection reason');
        return;
      }

      // Format the rejection reason
      if (selectedReasons.includes('other') && customReason.trim()) {
        rejectionReason = `${selectedReasons.filter(r => r !== 'other').join(', ')}, ${customReason}`;
      } else {
        rejectionReason = selectedReasons.join(', ');
      }
    }

    const result = await updateVerificationStatus(verificationId, status, rejectionReason);
    if (result.success) {
      setSelectedVerification(null);
      setSelectedReasons([]);
      setCustomReason('');
    } else {
      alert('Failed to update verification');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'green';
      case 'rejected': return 'red';
      case 'pending': return 'orange';
      default: return 'gray';
    }
  };

  // Helper function to format user name
  const formatUserName = (verification) => {
    const { firstName, middleName, lastName, suffix } = verification;
    let fullName = firstName || '';

    if (middleName) fullName += ` ${middleName}`;
    if (lastName) fullName += ` ${lastName}`;
    if (suffix) fullName += ` ${suffix}`;

    return fullName.trim();
  };

  // Sorting functionality
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedVerifications = () => {
    if (!sortConfig.key) return verifications;

    return [...verifications].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = formatUserName(a).toLowerCase();
          bValue = formatUserName(b).toLowerCase();
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case 'submittedAt':
          aValue = new Date(a.submittedAt);
          bValue = new Date(b.submittedAt);
          break;
        case 'attempts':
          aValue = a.resubmissionCount || 0;
          bValue = b.resubmissionCount || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Image Modal Component
  const ImageModal = () => {
    if (!selectedImage) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <button
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1'
            }}
          >
            ✕
          </button>
          <div style={{
            padding: '20px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '10px', color: '#333' }}>{selectedImage.title}</h3>
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              style={{
                marginTop: '50px',
                maxWidth: '85vw',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Verification Detail View
  if (selectedVerification) {
    const isPending = selectedVerification.status === 'pending';
    // Disable approve button when rejection reasons are selected
    const approveDisabled = verificationLoading || !isPending || selectedReasons.length > 0;
    // Disable reject button when no rejection reasons are selected
    const rejectDisabled = verificationLoading || !isPending || selectedReasons.length === 0

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <button
            className="back-button"
            onClick={() => setSelectedVerification(null)}
          >
            ← Back to Verifications
          </button>
          <div className="header-content">
            <h1>ID Verification Review</h1>
            <p>Review user identity verification submission</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-2" style={{ gap: '2rem' }}>
              <div>
                <h4>Personal Information</h4>
                <p><strong>Name:</strong> {formatUserName(selectedVerification)}</p>
                <p><strong>ID Type:</strong> {selectedVerification.idType.replace('_', ' ').toUpperCase()}</p>
                <p><strong>ID Number:</strong> {selectedVerification.idNumber}</p>
                <p><strong>Date of Birth:</strong> {selectedVerification.dateOfBirth}</p>
                <p><strong>Phone:</strong> {selectedVerification.phoneNumber}</p>
                <p><strong>Address:</strong> {selectedVerification.address}</p>
                <p><strong>User Email:</strong> {selectedVerification.userEmail}</p>
                <p><strong>Status:</strong>
                  <span style={{ color: getStatusColor(selectedVerification.status), marginLeft: '0.5rem' }}>
                    {selectedVerification.status.toUpperCase()}
                  </span>
                </p>

                {/* ADD RESUBMISSION COUNT HERE */}
                <p><strong>Submission Attempts: </strong>
                  {selectedVerification.resubmissionCount || 0}
                </p>

                <p><strong>Submitted:</strong> {new Date(selectedVerification.submittedAt).toLocaleString()}</p>
                {selectedVerification.verifiedAt && (
                  <p><strong>Verified/Rejected:</strong> {new Date(selectedVerification.verifiedAt).toLocaleString()}</p>
                )}
                {selectedVerification.adminNotes && selectedVerification.status === 'rejected' && (
                  <p><strong>Rejection Reason:</strong> {
                    selectedVerification.adminNotes.split(',').map(reason => {
                      const reasonObj = rejectionReasons.find(r => r.value === reason.trim());
                      return reasonObj ? reasonObj.label : reason;
                    }).join(', ')
                  }</p>
                )}
              </div>

              <div>
                <h4>ID Images</h4>

                {/* ID Front */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong>ID Front:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                      src={selectedVerification.idFront.secure_url}
                      alt="ID Front"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '150px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button
                      onClick={() => setSelectedImage({
                        url: selectedVerification.idFront.secure_url,
                        title: 'ID Front - Full View'
                      })}
                      className="btn btn-outline-primary btn-sm"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      View
                    </button>
                  </div>
                </div>

                {/* ID Back */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong>ID Back:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                      src={selectedVerification.idBack.secure_url}
                      alt="ID Back"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '150px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button
                      onClick={() => setSelectedImage({
                        url: selectedVerification.idBack.secure_url,
                        title: 'ID Back - Full View'
                      })}
                      className="btn btn-outline-primary btn-sm"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      View
                    </button>
                  </div>
                </div>

                {/* Clear Selfie */}
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Clear Selfie:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                      src={selectedVerification.selfie.secure_url}
                      alt="Clear Selfie"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '150px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                    <button
                      onClick={() => setSelectedImage({
                        url: selectedVerification.selfie.secure_url,
                        title: 'Selfie - Full View'
                      })}
                      className="btn btn-outline-primary btn-sm"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h4>Admin Actions</h4>

              {/* Rejection Reason Checkboxes - Only show when rejecting */}
              {isPending && (
                <div className="form-group">
                  <label className="form-label">Rejection Reasons (Select all that apply) *</label>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    {rejectionReasons.map(reason => (
                      <label key={reason.value} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: selectedReasons.includes(reason.value) ? '#e3f2fd' : 'white'
                      }}>
                        <input
                          type="checkbox"
                          value={reason.value}
                          checked={selectedReasons.includes(reason.value)}
                          onChange={() => handleReasonChange(reason.value)}
                          style={{ marginRight: '0.5rem' }}
                        />
                        {reason.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    handleVerificationStatusUpdate(selectedVerification.id, 'verified');
                  }}
                  className="btn btn-primary"
                  disabled={approveDisabled}
                  title={selectedReasons.length > 0 ? "Clear rejection reasons to approve" : ""}
                >
                  Approve Verification
                </button>
                <button
                  onClick={() => {
                    if (selectedReasons.length === 0) {
                      alert('Please select at least one rejection reason');
                      return;
                    }
                    handleVerificationStatusUpdate(selectedVerification.id, 'rejected');
                  }}
                  className="btn btn-danger"
                  disabled={rejectDisabled}
                >
                  Reject Verification
                </button>
                <button
                  onClick={() => setSelectedVerification(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Image Modal */}
        <ImageModal />
      </div>
    );
  }

  // Main Verification List View
  const sortedVerifications = getSortedVerifications();

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h3>ID Verifications</h3>
          <p>Manage user identity verification requests</p>
        </div>
        <div className="card-body">
          {verifications.length === 0 ? (
            <div className="empty-state">
              <h3>No Verification Requests</h3>
              <p>No users have submitted ID verification requests yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd', cursor: 'pointer' }}
                    onClick={() => handleSort('name')}
                  >
                    User {getSortIndicator('name')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd' }}>ID Type</th>
                  <th
                    style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd', cursor: 'pointer' }}
                    onClick={() => handleSort('status')}
                  >
                    Status {getSortIndicator('status')}
                  </th>
                  <th
                    style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd', cursor: 'pointer' }}
                    onClick={() => handleSort('attempts')}
                  >
                    Attempts {getSortIndicator('attempts')}
                  </th>
                  <th
                    style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd', cursor: 'pointer' }}
                    onClick={() => handleSort('submittedAt')}
                  >
                    Submitted {getSortIndicator('submittedAt')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedVerifications.map(verification => (
                  <tr key={verification.id}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      <div>
                        <strong>{formatUserName(verification)}</strong>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>{verification.userEmail}</div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      {verification.idType.replace('_', ' ').toUpperCase()}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      <span style={{
                        color: getStatusColor(verification.status),
                        fontWeight: 'bold'
                      }}>
                        {verification.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      {verification.resubmissionCount || 0}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      {new Date(verification.submittedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedVerification(verification)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal />
    </div>
  );
};

export default AdminIDVerificationPanel;