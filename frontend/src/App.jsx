import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import TeachersPage from './pages/TeachersPage';
import ParentsPage from './pages/ParentsPage';
import AcademicYearsPage from './pages/AcademicYearsPage';
import ClassesPage from './pages/ClassesPage';
import SubjectsPage from './pages/SubjectsPage';
import EnrollmentsPage from './pages/EnrollmentsPage';
import AttendancePage from './pages/AttendancePage';
import ExaminationsPage from './pages/ExaminationsPage';
import ResultsPage from './pages/ResultsPage';
import FeesPage from './pages/FeesPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import SettingsPage from './pages/SettingsPage';

import './App.css';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<Layout><DashboardPage /></Layout>} />
              <Route path="/students" element={<Layout><StudentsPage /></Layout>} />
              <Route path="/teachers" element={<Layout><TeachersPage /></Layout>} />
              <Route path="/parents" element={<Layout><ParentsPage /></Layout>} />
              <Route path="/academic-years" element={<Layout><AcademicYearsPage /></Layout>} />
              <Route path="/classes" element={<Layout><ClassesPage /></Layout>} />
              <Route path="/subjects" element={<Layout><SubjectsPage /></Layout>} />
              <Route path="/enrollments" element={<Layout><EnrollmentsPage /></Layout>} />
              <Route path="/attendance" element={<Layout><AttendancePage /></Layout>} />
              <Route path="/examinations" element={<Layout><ExaminationsPage /></Layout>} />
              <Route path="/results" element={<Layout><ResultsPage /></Layout>} />
              <Route path="/fees" element={<Layout><FeesPage /></Layout>} />
              <Route path="/announcements" element={<Layout><AnnouncementsPage /></Layout>} />
              <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
