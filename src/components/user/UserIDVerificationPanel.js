import React, { useState, useEffect } from 'react';
import { useIDVerification } from '../../context/IDVerificationContext';

const UserIDVerificationPanel = ({ onCancel }) => {
  const { userVerification, submitVerification, loading } = useIDVerification();
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    idNumber: '',
    idType: 'ePhil_id',
    dateOfBirth: '',
    address: '',
    phoneNumber: ''
  });
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);

  const rejectionReasons = {
    'name_mismatch': 'Mismatched Full Name: The name you provided does not match your official government record. Please ensure it matches exactly as it appears on your ID.',
    'id_number_mismatch': 'Invalid or Mismatched ID Number: The ID number you entered is incorrect or does not match our verification system.',
    'dob_mismatch': 'Incorrect Date of Birth: The date of birth you entered does not match your official government record.',
    'address_mismatch': 'Incorrect address: The address you entered does not match your official government record.',
    'unreadable_id_photo': 'Unreadable ID Photo: The uploaded image is too blurry, dark, or has glare, making the text impossible to read. Please retake a clear, well-lit photo.',
    'incomplete_id_photo': 'Incomplete ID Photo: Parts of your ID are cut off in the image. Please ensure the entire document (all four corners) is visible within the frame.',
    'blurred_selfie': 'Blurred Selfie: The selfie is too blurry or dark. Please retake a clear, well-lit photo of your face.',
    'other': 'Other Reason'
  };

  const shouldHighlightField = (fieldType) => {
    if (!userVerification?.adminNotes) return false;
    
    const reasons = userVerification.adminNotes.split(',').map(r => r.trim());
    
    switch (fieldType) {
      case 'name':
        return reasons.some(reason => reason === 'name_mismatch');
      case 'idNumber':
        return reasons.some(reason => reason === 'id_number_mismatch');
      case 'dob':
        return reasons.some(reason => reason === 'dob_mismatch');
      case 'address':
        return reasons.some(reason => reason === 'address_mismatch');
      case 'idPhotos':
        return reasons.some(reason => 
          reason === 'unreadable_id_photo' || reason === 'incomplete_id_photo'
        );
      case 'selfie':
        return reasons.some(reason => reason === 'blurred_selfie');
      default:
        return false;
    }
  };

  useEffect(() => {
    if (userVerification) {
      setFormData({
        firstName: userVerification.firstName || '',
        middleName: userVerification.middleName || '',
        lastName: userVerification.lastName || '',
        suffix: userVerification.suffix || '',
        idNumber: userVerification.idNumber || '',
        idType: userVerification.idType || 'ePhil_id',
        dateOfBirth: userVerification.dateOfBirth || '',
        address: userVerification.address || '',
        phoneNumber: userVerification.phoneNumber || ''
      });
      
      if (userVerification.idFront) {
        setIdFrontPreview(userVerification.idFront.secure_url);
      }
      if (userVerification.idBack) {
        setIdBackPreview(userVerification.idBack.secure_url);
      }
      if (userVerification.selfie) {
        setSelfiePreview(userVerification.selfie.secure_url);
      }
    }
  }, [userVerification]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e, setFileFunction, setPreviewFunction) => {
    const file = e.target.files[0];
    if (file) {
      setFileFunction(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewFunction(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasNewImages = idFront || idBack || selfie;
    const hasExistingImages = userVerification?.idFront && userVerification?.idBack && userVerification?.selfie;
    
    if (!hasNewImages && !hasExistingImages) {
      alert('Please upload all required images');
      return;
    }

    const verificationData = {
      ...formData,
      idFront: idFront || userVerification?.idFront || null,
      idBack: idBack || userVerification?.idBack || null,
      selfie: selfie || userVerification?.selfie || null
    };

    const result = await submitVerification(verificationData);
    
    if (result.success) {
      alert(userVerification ? 'ID verification resubmitted successfully! It will be reviewed again by our team.' : 'ID verification submitted successfully! It will be reviewed by our team.');
      if (!userVerification) {
        setFormData({
          firstName: '',
          middleName: '',
          lastName: '',
          suffix: '',
          idNumber: '',
          idType: 'ePhil_id',
          dateOfBirth: '',
          address: '',
          phoneNumber: ''
        });
        setIdFront(null);
        setIdBack(null);
        setSelfie(null);
        setIdFrontPreview(null);
        setIdBackPreview(null);
        setSelfiePreview(null);
      }
      if (onCancel) onCancel();
    } else {
      alert('Failed to submit verification: ' + result.error);
    }
  };

  const isResubmission = userVerification && userVerification.status === 'rejected';

  const getRejectionReason = () => {
    if (!userVerification?.adminNotes) return null;
    
    const reasonKey = userVerification.adminNotes;
    
    if (reasonKey.includes(',')) {
      const reasons = reasonKey.split(',').map(r => r.trim());
      return reasons.map(singleReason => {
        return rejectionReasons[singleReason] || singleReason;
      }).join('\n• ');
    }
    
    return rejectionReasons[reasonKey] || userVerification.adminNotes;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{isResubmission ? 'Resubmit ID Verification' : 'ID Verification'}</h3>
        <p>
          {isResubmission 
            ? 'Please update your verification details and resubmit for review.'
            : 'Complete your identity verification using ePhil ID or National ID'
          }
        </p>
        {isResubmission && userVerification?.adminNotes && (
          <div style={{ 
            backgroundColor: '#ffe6e6', 
            border: '1px solid #ffcccc',
            borderRadius: '4px',
            padding: '0.75rem',
            marginTop: '0.5rem'
          }}>
            <strong style={{ color: '#d32f2f' }}>Previous Rejection Reason:</strong>
            <div style={{ 
              margin: '0.25rem 0 0 0', 
              color: '#d32f2f',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              whiteSpace: 'pre-line'
            }}>
              • {getRejectionReason()}
            </div>
          </div>
        )}
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                name="firstName"
                className="form-input"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                style={{
                  borderColor: shouldHighlightField('name') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('name') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                type="text"
                name="middleName"
                className="form-input"
                value={formData.middleName}
                onChange={handleInputChange}
                placeholder="Optional"
                style={{
                  borderColor: shouldHighlightField('name') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('name') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                name="lastName"
                className="form-input"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                style={{
                  borderColor: shouldHighlightField('name') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('name') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Suffix</label>
              <input
                type="text"
                name="suffix"
                className="form-input"
                value={formData.suffix}
                onChange={handleInputChange}
                placeholder="e.g., Jr., Sr., II, III"
                style={{
                  borderColor: shouldHighlightField('name') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('name') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ID Type *</label>
              <select
                name="idType"
                className="form-select"
                value={formData.idType}
                onChange={handleInputChange}
                required
              >
                <option value="ePhil_id">ePhil ID</option>
                <option value="national_id">National ID</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">ID Number *</label>
              <input
                type="text"
                name="idNumber"
                className="form-input"
                value={formData.idNumber}
                onChange={handleInputChange}
                required
                style={{
                  borderColor: shouldHighlightField('idNumber') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('idNumber') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth *</label>
              <input
                type="date"
                name="dateOfBirth"
                className="form-input"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                required
                style={{
                  borderColor: shouldHighlightField('dob') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('dob') ? '#fff5f5' : ''
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                name="phoneNumber"
                className="form-input"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group grid-cols-2">
              <label className="form-label">Address *</label>
              <textarea
                name="address"
                className="form-textarea"
                rows="3"
                value={formData.address}
                onChange={handleInputChange}
                required
                style={{
                  borderColor: shouldHighlightField('address') ? '#d32f2f' : '',
                  backgroundColor: shouldHighlightField('address') ? '#fff5f5' : ''
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Required Images *</h4>
            <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
              {isResubmission 
                ? 'You can update your images or keep the existing ones. Only upload new images if you need to change them.'
                : 'Please upload clear images of your ID and a selfie holding your ID.'
              }
            </p>
            
            <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">ID Front Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setIdFront, setIdFrontPreview)}
                  className="form-input"
                  style={{
                    borderColor: shouldHighlightField('idPhotos') ? '#d32f2f' : '',
                    backgroundColor: shouldHighlightField('idPhotos') ? '#fff5f5' : ''
                  }}
                />
                {idFrontPreview && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={idFrontPreview} alt="ID Front" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
                {!idFrontPreview && userVerification?.idFront && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={userVerification.idFront.secure_url} alt="ID Front" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">ID Back Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setIdBack, setIdBackPreview)}
                  className="form-input"
                  style={{
                    borderColor: shouldHighlightField('idPhotos') ? '#d32f2f' : '',
                    backgroundColor: shouldHighlightField('idPhotos') ? '#fff5f5' : ''
                  }}
                />
                {idBackPreview && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={idBackPreview} alt="ID Back" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
                {!idBackPreview && userVerification?.idBack && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={userVerification.idBack.secure_url} alt="ID Back" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Clear Selfie</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setSelfie, setSelfiePreview)}
                  className="form-input"
                  style={{
                    borderColor: shouldHighlightField('selfie') ? '#d32f2f' : '',
                    backgroundColor: shouldHighlightField('selfie') ? '#fff5f5' : ''
                  }}
                />
                {selfiePreview && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={selfiePreview} alt="Selfie with ID" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
                {!selfiePreview && userVerification?.selfie && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img src={userVerification.selfie.secure_url} alt="Selfie with ID" style={{ maxWidth: '100%', maxHeight: '150px' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }}></div>
                  {isResubmission ? 'Resubmitting...' : 'Submitting...'}
                </>
              ) : (
                isResubmission ? 'Resubmit Verification' : 'Submit Verification'
              )}
            </button>
            
            {onCancel && (
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserIDVerificationPanel;