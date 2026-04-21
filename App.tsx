
import React, { useState, useEffect, PropsWithChildren } from 'react';
// Fix: Use namespace import to bypass missing named exports error in certain environments
import * as ReactRouterDOM from 'react-router-dom';
// Changed HashRouter to BrowserRouter for clean URLs
const { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } = ReactRouterDOM as any;
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Portal from './components/Portal';
import StudentEnrollment from './components/StudentEnrollment';
import PublicCourses from './components/PublicCourses';
import PublicCourseDetail from './components/PublicCourseDetail'; 
import PublicExams from './components/PublicExams'; 
import PublicExamDetail from './components/PublicExamDetail';
import PublicStore from './components/PublicStore';
import CourseSearch from './components/CourseSearch'; 
import ContactPage from './components/ContactPage';
import StudentLogin from './components/StudentLogin';
import StudentPortal from './components/StudentPortal';
import PlacementTest from './components/PlacementTest'; // Imported
import TryEmma from './components/TryEmma';
import { auth } from './firebase';
import { Icon } from './components/Icon';
import { syncCurrentUserToFirestore } from './services/db';
import { AppUser } from './types';
import ScrollToTop from './components/ScrollToTop';

// Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-background-dark text-white">
    <Icon name="sync" className="animate-spin text-4xl text-primary" />
  </div>
);

interface RouteWrapperProps {
  user: AppUser | null;
  loading: boolean;
}

// Protected Route Wrapper
const ProtectedRoute: React.FC<PropsWithChildren<RouteWrapperProps>> = ({ children, user, loading }) => {
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Login Route Wrapper
const LoginRoute: React.FC<PropsWithChildren<RouteWrapperProps>> = ({ children, user, loading }) => {
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/portal" replace />;
  return <>{children}</>;
};

import { ToeicMockTestPage } from './components/ToeicMockTestPage';

const AppRoutes: React.FC = () => {
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Auth State Listener
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
          const profile = await syncCurrentUserToFirestore(currentUser);
          setUserProfile(profile);
      } else {
          setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (profile: AppUser) => {
      setUserProfile(profile);
      navigate('/portal');
  };

  return (
    <Routes>
      {/* 1. Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/toeicmocktest" element={<ToeicMockTestPage />} />
      <Route path="/courses" element={<PublicCourses />} />
      <Route path="/courses/:id" element={<PublicCourseDetail />} /> 
      <Route path="/exams" element={<PublicExams />} />
      <Route path="/exams/:id" element={<PublicExamDetail />} />
      <Route path="/store" element={<PublicStore />} />
      <Route path="/search" element={<CourseSearch />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/placement-test" element={<PlacementTest />} /> 
      <Route path="/try-emma" element={<TryEmma />} />
      
      {/* Enrollment */}
      <Route path="/enroll" element={
        <StudentEnrollment 
            onBack={() => navigate('/')} 
            isPublic={true} 
        />
      } />

      {/* 2. Login (Admin/Teacher) */}
      <Route path="/login" element={
        <LoginRoute user={userProfile} loading={loading}>
            <Login onLogin={handleLoginSuccess} />
        </LoginRoute>
      } />

      {/* 3. Admin Portal */}
      <Route path="/portal/*" element={
        <ProtectedRoute user={userProfile} loading={loading}>
            <Portal 
                userProfile={userProfile!} 
                onLogout={() => { 
                    auth.signOut(); 
                    setUserProfile(null); 
                    navigate('/login');
                }} 
            />
        </ProtectedRoute>
      } />

      {/* 4. Student Portal */}
      <Route path="/student/login" element={<StudentLogin />} />
      <Route path="/student/dashboard" element={<StudentPortal />} />

      {/* 5. Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
