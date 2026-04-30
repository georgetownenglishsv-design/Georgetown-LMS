
import React, { useState, useEffect } from 'react';
import { AppUser } from '../types';
import Sidebar from './Sidebar';
import TeacherSidebar from './TeacherSidebar';
import Dashboard from './Dashboard';
import StudentList from './StudentList';
import CourseList from './CourseList';
import CreateCourse from './CreateCourse';
import CategoryList from './CategoryList';
import Settings from './Settings';
import ExamList from './ExamList';
import ExamDetails from './ExamDetails';
import TeacherList from './TeacherList';
import TeacherDashboard from './TeacherDashboard';
import TeacherAttendance from './TeacherAttendance';
import TeacherSchedule from './TeacherSchedule';
import TeacherHistory from './TeacherHistory';
import TeacherDetailAdmin from './TeacherDetailAdmin';
import StudentEnrollment from './StudentEnrollment';
import AdminCalendar from './AdminCalendar';
import ScheduleManager from './ScheduleManager'; 
import Finance from './Finance';
import WebCourseManager from './WebCourseManager';
import WebExamManager from './WebExamManager'; 
import WebStoreManager from './WebStoreManager';
import WebLandingManager from './WebLandingManager'; 
import TestimonialManager from './TestimonialManager';
import FAQManager from './FAQManager';
import TeamsManager from './TeamsManager'; 
import MarketingTools from './MarketingTools';
import AnalyticsDashboard from './AnalyticsDashboard'; // NEW IMPORT
import LevelTestManager from './LevelTestManager'; // Imported
import PackageList from './PackageList'; // NEW IMPORT
import { MockTestAdmin } from './MockTestAdmin'; // NEW IMPORT
import { Icon } from './Icon';
import { useGarbageCollector } from '../hooks/useGarbageCollector';
import { runCourseLifecycleCheck } from '../services/db'; 
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, useLocation } = ReactRouterDOM as any;

interface PortalProps {
    userProfile: AppUser;
    onLogout: () => void;
}

const Portal: React.FC<PortalProps> = ({ userProfile, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getInitialState = () => {
      const path = location.pathname.replace(/\/$/, '');
      const pathParts = path.split('/').filter(Boolean);
      const view = pathParts[1] || 'dashboard'; 
      const id = pathParts[2] || null;
      return { view, id };
  };

  const initialState = getInitialState();
  const [currentView, setCurrentView] = useState(initialState.view);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialState.id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useGarbageCollector(userProfile);

  useEffect(() => {
      if (userProfile.role === 'Administrador' || userProfile.role === 'Secretaría' || userProfile.isSuperAdmin) {
          runCourseLifecycleCheck();
      }
  }, [userProfile]);

  useEffect(() => {
      const { view, id } = getInitialState();
      if (view !== currentView || id !== selectedEntityId) {
          setCurrentView(view);
          setSelectedEntityId(id);
      }
  }, [location.pathname]);

  const handleNavigate = (view: string, id?: string) => {
      let path = `/portal/${view}`;
      if (id) path += `/${id}`;
      navigate(path);
      setIsMobileMenuOpen(false);
  };

  const MobileHeader = () => (
      <div className="lg:hidden fixed top-4 left-4 z-40">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-3 bg-white dark:bg-surface-dark text-slate-700 dark:text-white rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-surface-highlight transition-colors">
              <Icon name="menu" className="text-xl" />
          </button>
      </div>
  );
  const TeacherMobileHeader = () => (
      <div className="md:hidden fixed top-4 left-4 z-40">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-3 bg-[#111218] text-white rounded-xl shadow-lg border border-gray-800 hover:bg-gray-900 transition-colors">
              <Icon name="menu" className="text-xl" />
          </button>
      </div>
  );

  if (userProfile.role === 'Profesor') {
      const renderTeacherContent = () => {
          switch (currentView) {
              case 'attendance':
                  return <TeacherAttendance classId={selectedEntityId || undefined} userProfile={userProfile} onBack={() => handleNavigate('dashboard')} />;
              case 'schedule':
                  return <TeacherSchedule userProfile={userProfile} />;
              case 'history':
                  return <TeacherHistory userProfile={userProfile} />;
              case 'dashboard':
              default:
                  return <TeacherDashboard userProfile={userProfile} onNavigate={handleNavigate} />;
          }
      };

      return (
          <div className="flex min-h-screen w-full relative bg-background-light dark:bg-background-dark">
              <TeacherMobileHeader />
              <TeacherSidebar currentView={currentView} onNavigate={handleNavigate} userProfile={userProfile} onLogout={onLogout} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
              <div className="flex-1 flex flex-col min-w-0 h-screen pt-16 md:pt-0">
                  {renderTeacherContent()}
              </div>
          </div>
      );
  }

  const renderAdminContent = () => {
    switch (currentView) {
      case 'students':
        return <StudentList onNavigate={handleNavigate} />;
      case 'enrollment':
        return <StudentEnrollment onBack={() => handleNavigate('students')} />;
      case 'courses':
        return <CourseList onNavigate={handleNavigate} />;
      case 'create-course':
        return <CreateCourse onBack={() => handleNavigate('courses')} courseId={selectedEntityId || undefined} />;
      case 'categories':
        return <CategoryList />;
      case 'marketing': 
        return <MarketingTools />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'level-tests': // NEW
        return <LevelTestManager />;
      case 'mock-tests': // NEW ROUTE
        return <MockTestAdmin />;
      case 'memberships': // NEW ROUTE
        return <PackageList />;
      case 'web-courses':
        return <WebCourseManager />;
      case 'web-exams': 
        return <WebExamManager />;
      case 'web-store': 
        return <WebStoreManager />;
      case 'web-landing': 
        return <WebLandingManager />;
      case 'web-testimonials': 
        return <TestimonialManager />;
      case 'web-faqs': 
        return <FAQManager />;
      case 'settings':
        return <Settings />;
      case 'teams-manager': 
        return <TeamsManager />;
      case 'calendar':
        return <AdminCalendar />;
      case 'schedule-manager': 
        return <ScheduleManager />;
      case 'finance':
        return <Finance />;
      case 'teachers':
        return <TeacherList onViewDetails={(id) => handleNavigate('teacher-details', id)} />;
      case 'teacher-details':
        return selectedEntityId
            ? <TeacherDetailAdmin teacherId={selectedEntityId} currentUser={userProfile} onBack={() => handleNavigate('teachers')} />
            : <TeacherList onViewDetails={(id) => handleNavigate('teacher-details', id)} />;
      case 'exams':
        return <ExamList onViewRegistration={(id) => handleNavigate('exam-details', id)} />;
      case 'exam-details':
        return selectedEntityId 
            ? <ExamDetails registrationId={selectedEntityId} onBack={() => handleNavigate('exams')} />
            : <ExamList onViewRegistration={(id) => handleNavigate('exam-details', id)} />;
      case 'dashboard':
      default:
        return <Dashboard userProfile={userProfile} onNavigate={handleNavigate} />;
    }
  };

  if (currentView === 'enrollment' || currentView === 'create-course') {
      return renderAdminContent();
  }

  return (
    <div className="flex min-h-screen w-full relative bg-background-light dark:bg-background-dark">
      <MobileHeader />
      <Sidebar 
          currentView={currentView.startsWith('exam') ? 'exams' : (currentView.startsWith('teacher') ? 'teachers' : (currentView === 'create-course' ? 'courses' : currentView))} 
          onNavigate={handleNavigate} 
          userProfile={userProfile} 
          onLogout={onLogout} 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen pt-16 lg:pt-0">
          {renderAdminContent()}
      </div>
    </div>
  );
};

export default Portal;
