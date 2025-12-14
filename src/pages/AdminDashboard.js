import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useIDVerification } from '../context/IDVerificationContext';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useNavigate, Link } from 'react-router-dom';

// Import panels
import CollectionsPanel from '../components/admin/AdminCollectionsPanel';
import BookingHistory from '../components/admin/AdminBookingPanel';
import IDVerificationPanel from '../components/admin/AdminIDVerificationPanel';
import DamagedItemsPanel from '../components/admin/AdminDamagedItemsPanel';
import Inventory from '../components/admin/AdminInventoryPanel';

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

const AdminDashboard = () => {
  const { collections, users, createCollection, uploadMultipleFilesToCollection, deleteCollection, deleteFile, getCollectionFiles, loading, rentalItems } = useApp();
  const { verifications, updateVerificationStatus, loading: verificationLoading } = useIDVerification();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('collections');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const navigate = useNavigate();

  // Navigation functions
  const showSidebar = () => setSidebarVisible(true);
  const hideSidebar = () => setSidebarVisible(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login-register');
    } catch (error) {
      showMessage('Failed to logout. Please try again.');
    }
  };

  // Dashboard Header Component - UPDATED: Removed inventory stats
  const DashboardHeader = () => {
    return (
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <p>Manage collections, users, and inventory</p>
        </div>
        <div className="stats-container">
          <span className="stat-badge">{collections.length} collections</span>
          <span className="stat-badge">{users.filter(u => u.role === 'user').length} users</span>
          <span className="stat-badge">{verifications.length} verifications</span>
          
          <button 
            className="btn btn-secondary logout-btn"
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
    );
  };

  // Dashboard Tabs Component - UPDATED: Removed inventory stats from tab
  const DashboardTabs = () => {
    return (
      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          Collections ({collections.length})
        </button>
        <button 
          className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          Bookings & Schedule
        </button>
        <button 
          className={`tab ${activeTab === 'id-verification' ? 'active' : ''}`}
          onClick={() => setActiveTab('id-verification')}
        >
          ID Verifications ({verifications.length})
        </button>
        <button 
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory Management
        </button>
        <button 
          className={`tab ${activeTab === 'damaged-items' ? 'active' : ''}`}
          onClick={() => setActiveTab('damaged-items')}
        >
          Maintenance
        </button>
      </div>
    );
  };

  // Navigation Component - Using your original structure
  const Navigation = () => (
    <nav>
      <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
        <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
        <li><Link to="/home">Home</Link></li>
        <li><Link to="/rent-items">Rent</Link></li>
        <li><Link to="/packages">Packages</Link></li>
        <li><Link to="/services">Services</Link></li>
        <li><Link to="/photobooth">Photobooth</Link></li>
        <li><Link to="/about">About us</Link></li>
        <li><a href="/adminDashboard">Admin Dashboard</a></li>
      </ul>
      <ul>
        <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
        <li className="hideOnMobile"><Link to="/home">Home</Link></li>
        <li className="hideOnMobile"><Link to="/rent-items">Rent</Link></li>
        <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
        <li className="hideOnMobile"><Link to="/services">Services</Link></li>
        <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
        <li className="hideOnMobile"><Link to="/about">About Us</Link></li>
        <li className="hideOnMobile"><a href="/adminDashboard">Admin Dashboard</a></li>
        <li className="menu-button" onClick={showSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg></a></li>
      </ul>
    </nav>
  );

  // Footer Component - Using your original structure
  const Footer = () => (
    <footer className="footer">
      <div className="copyright">
        <div className="column ss-copyright">
          <span>&copy; 2025 RP Media Services. All rights reserved</span> 
        </div>
      </div>
    </footer>
  );

// In your AdminDashboard.js, replace the renderActivePanel function with this:

  const renderActivePanel = () => {
    const PanelWrapper = ({ children, className = "" }) => (
      <div className={`dashboard-panel-wrapper ${className}`}>
        {children}
      </div>
    );

    switch (activeTab) {
      case 'collections':
        return (
          <PanelWrapper>
            <CollectionsPanel
              collections={collections}
              users={users}
              loading={loading}
              uploading={loading}
              createCollection={createCollection}
              uploadMultipleFilesToCollection={uploadMultipleFilesToCollection}
              deleteCollection={deleteCollection}
              deleteFile={deleteFile}
              getCollectionFiles={getCollectionFiles}
            />
          </PanelWrapper>
        );

      case 'bookings':
        return (
          <PanelWrapper>
            <BookingHistory isAdmin={true} />
          </PanelWrapper>
        );

      case 'id-verification':
        return (
          <PanelWrapper>
            <IDVerificationPanel
              verifications={verifications}
              verificationLoading={verificationLoading}
              updateVerificationStatus={updateVerificationStatus}
            />
          </PanelWrapper>
        );

      case 'inventory':
        return (
          <PanelWrapper>
            <Inventory />
          </PanelWrapper>
        );

      case 'damaged-items':
        return (
          <PanelWrapper>
            <DamagedItemsPanel />
          </PanelWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Navigation />
      
      <div className="dashboard">
        <DashboardHeader />
        <DashboardTabs />
        {renderActivePanel()}
      </div>

      <Footer />
    </>
  );
};

export default AdminDashboard;