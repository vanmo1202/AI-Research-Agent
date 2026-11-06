import { AuthProvider, ProtectedRoute } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import Workflow1Page from './pages/Workflow1Page';
import ResearchPlanPage from './pages/ResearchPlanPage';
import Workflow2Page from './pages/Workflow2Page';
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';
import SourceDetailPage from './pages/SourceDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import EvidencePage from './pages/EvidencePage';
import ReportPage from './pages/ReportPage';
import RequestPicker from './components/research/RequestPicker';
import DocumentLibraryPage from './pages/DocumentLibraryPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import ResearchChatPage from './pages/ResearchChatPage';
import AgentMemoryPage from './pages/AgentMemoryPage';
import './knowledge.css';
import './researchos.css';
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="workflow-1" element={<Workflow1Page />} />
            <Route path="research/:requestId" element={<ResearchPlanPage />} />
            <Route path="workflow-2" element={<Workflow2Page />} />
            <Route path="workflow-2/:requestId" element={<Workflow2Page />} />
            <Route path="workflow-3" element={<RequestPicker destination="workflow-3" />} />
            <Route path="workflow-4" element={<RequestPicker destination="workflow-4" />} />
            <Route path="workflow-3/:requestId" element={<EvidencePage />} />
            <Route path="workflow-4/:requestId" element={<ReportPage />} />
            <Route path="research/:requestId/sources" element={<Workflow2Page />} />
            <Route path="documents" element={<DocumentLibraryPage />} />
            <Route path="documents/:documentId" element={<DocumentDetailPage />} />
            <Route path="chat" element={<ResearchChatPage />} />
            <Route path="research/:requestId/chat" element={<ResearchChatPage />} />
            <Route path="research/:requestId/chat/:chatId" element={<ResearchChatPage />} />
            <Route path="memories" element={<AgentMemoryPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="sources/:sourceId" element={<SourceDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
