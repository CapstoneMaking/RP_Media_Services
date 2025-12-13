// components/user/CollectionsPanel.js - UPDATED BADGE TEXT (ID VERIFICATION REMOVED)
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePayment } from '../../context/PaymentContext';
import { useIDVerification } from '../../context/IDVerificationContext';

const UsersCollectionsPanel = ({ 
  userCollections, 
  setUserCollections, 
  viewCollection, 
  loading 
}) => {
  const { collections } = useApp();
  const { user } = useAuth();
  const { paymentStatus, payments } = usePayment();
  const { userVerification } = useIDVerification();
  
  const hasAccessToCollection = (collectionId) => {
    if (user?.email === 'admin@rpmediaservices.com' || user?.email === 'admin@example.com') {
      return true;
    }
    
    const collection = collections.find(c => c.id === collectionId);
    if (collection && collection.price === 0) {
      return true;
    }
    
    if (paymentStatus.isPaid) {
      if (paymentStatus.accessType === 'all') {
        return true;
      }
      
      const hasPaidAccess = paymentStatus.collectionAccess?.includes(collectionId);
      if (hasPaidAccess) {
        return true;
      }
    }
    
    const validPayments = payments.filter(p => 
      p.status === 'completed' || p.status === 'paid'
    );
    
    const paymentAccess = validPayments.some(payment => {
      return payment.collectionAccess?.includes(collectionId);
    });
    
    return paymentAccess;
  };

  const loadUserCollections = async () => {
    if (!user || !collections) return;
    
    const filteredCollections = collections
      .filter(collection => {
        return collection.assignedUsers?.includes(user.email);
      })
      .map(collection => {
        const hasAccess = hasAccessToCollection(collection.id);
        return {
          ...collection,
          hasAccess: hasAccess,
          isPremium: collection.price > 0
        };
      });
    
    setUserCollections(filteredCollections);
  };

  useEffect(() => {
    if (user && collections) {
      loadUserCollections();
    }
  }, [user, collections, paymentStatus, payments]);

  return (
    <div className="fade-in">
      {/* Collections Grid Only - ID Verification moved to Dashboard */}
      {userCollections.length === 0 ? (
        <div className="empty-state">
          <h3>No Collections Available</h3>
          <p>You don't have any collections assigned to you yet.</p>
        </div>
      ) : (
        <div className="collections-grid">
          {userCollections.map(collection => (
            <div key={collection.id} className={`collection-card ${collection.isPremium ? 'premium-collection' : ''}`}>
              <div className="collection-header">
                <h3>{collection.name}</h3>
                <div className="badges-container">
                  {/* Updated badge text */}
                  <span className="badge">{collection.imageCount || 0} files</span>
                  {collection.isPremium ? (
                    collection.hasAccess ? (
                      <span className="badge badge-success">Unlocked</span>
                    ) : (
                      <span className="badge badge-premium">Premium - ₱{collection.price}</span>
                    )
                  ) : (
                    <span className="badge badge-success">Free Access</span>
                  )}
                  <span className="badge badge-info">Images & Videos</span>
                </div>
              </div>
              
              <p className="collection-description">{collection.description}</p>
              
              <div className="collection-meta">
                <span>Created: {new Date(collection.createdAt).toLocaleDateString()}</span>
                {collection.isPremium && !collection.hasAccess && (
                  <div className="payment-required">
                    Payment required to view content
                  </div>
                )}
              </div>
              
              <div className="collection-actions">
                <button
                  className={`btn ${collection.hasAccess ? 'btn-primary' : collection.isPremium ? 'btn-premium' : 'btn-primary'}`}
                  onClick={() => viewCollection(collection)}
                  disabled={loading}
                >
                  {collection.hasAccess ? (
                    'View Collection'
                  ) : collection.isPremium ? (
                    `Unlock for ₱${collection.price}`
                  ) : (
                    'View Collection'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersCollectionsPanel;