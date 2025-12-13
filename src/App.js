import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { PaymentProvider } from './context/PaymentContext';
import { IDVerificationProvider } from './context/IDVerificationContext';
import Home from './pages/Home';
import LoginRegister from './pages/LoginRegister';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RentItems from './pages/RentItems';
import Packages from './pages/Packages';
import Services from './pages/Services';
import About from './pages/About';
import Photobooth from './pages/Photobooth';
import Information from './pages/Information';
import RentSchedule from './pages/RentSchedule';
import ConfirmationPage from './pages/ConfirmationPage';
import PaymentModal from './components/user/UserPaymentPanel';
import PasswordReset from './pages/PasswordReset';
import './App.css';
import './styles/about.css';
import './styles/confirmation.css';
import './styles/dashboard.css';
import './styles/home.css';
import './styles/information.css';
import './styles/packages.css';
import './styles/photobooth.css';
import './styles/policy_styles.css';
import './styles/rent-item.css';
import './styles/rent-schedule.css';
import './styles/service.css';
import './styles/global.css';

function AppContent() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login-register" element={<LoginRegister />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/userDashboard" element={<UserDashboard />} />
          <Route path="/adminDashboard" element={<AdminDashboard />} /> {/* NEW */}
          <Route path="/rent-items" element={<RentItems />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/services" element={<Services />} />
          <Route path="/about" element={<About />} />
          <Route path="/photobooth" element={<Photobooth />} />
          <Route path="/information" element={<Information />} />
          <Route path="/rent-schedule" element={<RentSchedule />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Routes>
        <PaymentModal />
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <PaymentProvider>
          <IDVerificationProvider>
            <AppContent />
          </IDVerificationProvider>
        </PaymentProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;