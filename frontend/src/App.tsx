import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import { Login } from './pages/Login'
import { Projects } from './pages/Projects'
import { Risks } from './pages/Risks'
import { Repository } from './pages/Repository'
import { ProjectDetail } from './pages/ProjectDetail'
import { RecordActivity } from './pages/RecordActivity'
import { ProjectSetup } from './pages/ProjectSetup'
import { AdminPanel } from './pages/AdminPanel'
import { AdminSettings } from './pages/AdminSettings'
import { RecordExpenditure } from './pages/RecordExpenditure'
import { Monitoring } from './pages/Monitoring'
import { Overview } from './pages/Overview'

const PrivateRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" />;
  
  const user = JSON.parse(userStr);
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <PrivateRoute>
            <DashboardLayout>
              <Overview />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/projects" element={
          <PrivateRoute>
            <DashboardLayout>
              <Projects />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/projects/:id" element={
          <PrivateRoute>
            <DashboardLayout>
              <ProjectDetail />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/activity" element={
          <PrivateRoute>
            <DashboardLayout>
              <RecordActivity />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/expenditure" element={
          <PrivateRoute>
            <DashboardLayout>
              <RecordExpenditure />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/setup" element={
          <PrivateRoute roles={['admin', 'pm', 'executive']}>
            <DashboardLayout>
              <ProjectSetup />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/risks" element={
          <PrivateRoute>
            <DashboardLayout>
              <Risks />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/repository" element={
          <PrivateRoute>
            <DashboardLayout>
              <Repository />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/admin" element={
          <PrivateRoute roles={['admin', 'executive']}>
            <DashboardLayout>
              <AdminPanel />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute roles={['admin', 'executive']}>
            <DashboardLayout>
              <AdminSettings />
            </DashboardLayout>
          </PrivateRoute>
        } />

        <Route path="/monitoring" element={
          <PrivateRoute roles={['admin', 'executive']}>
            <DashboardLayout>
              <Monitoring />
            </DashboardLayout>
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  )
}

export default App
