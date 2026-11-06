import { lazy, Suspense } from 'react';
import { AuthProvider, ProtectedRoute } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import Workflow1Page from './pages/Workflow1Page';
const ResearchPlanPage = lazy(() => import('./pages/ResearchPlanPage'));
const Workflow2Page = lazy(() => import('./pages/Workflow2Page'));
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';
import SourceDetailPage from './pages/SourceDetailPage';
import NotFoundPage from './pages/NotFoundPage';
const EvidencePage = lazy(() => import('./pages/EvidencePage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
import RequestPicker from './components/research/RequestPicker';
import DocumentLibraryPage from './pages/DocumentLibraryPage';
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage'));
const ResearchChatPage = lazy(() => import('./pages/ResearchChatPage'));
const AgentMemoryPage = lazy(() => import('./pages/AgentMemoryPage'));
import './knowledge.css';
import './styles/research-workspace.css';
import './researchos.css';
import './styles/editorial.css';
import './styles/workflow-editorial.css';
import './styles/knowledge-editorial.css';
import './styles/review-editorial.css';
export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<p role="status">Đang tải trang…</p>}>
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
      </Suspense>
    </AuthProvider>
  );
}
