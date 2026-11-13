import { lazy, Suspense } from 'react';
import { AuthProvider, ProtectedRoute } from './auth/AuthProvider';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
const Workflow1Page = lazy(() => import('./pages/NewResearchPage'));
const RunWorkspacePage = lazy(() => import('./pages/RunWorkspacePage'));
const ResearchHistoryPage = lazy(() => import('./pages/ResearchHistoryPage'));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'));
const ResearchCatalogPage = lazy(() => import('./pages/ResearchCatalogPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const ResearchPlanPage = lazy(() => import('./pages/ResearchEntryPage'));
const Workflow2Page = lazy(() => import('./pages/Workflow2Page'));
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';
import SourceDetailPage from './pages/SourceDetailPage';
import NotFoundPage from './pages/NotFoundPage';
const EvidencePage = lazy(() => import('./pages/EvidencePage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
import DocumentLibraryPage from './pages/DocumentLibraryPage';
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage'));
const DocumentChatPage = lazy(() => import('./pages/DocumentChatPage'));

const AgentMemoryPage = lazy(() => import('./pages/AgentMemoryPage'));
import './knowledge.css';
import './styles/research-workspace.css';
import './researchos.css';
import './styles/editorial.css';
import './styles/workflow-editorial.css';
import './styles/knowledge-editorial.css';
import './styles/review-editorial.css';
import './styles/workspace.css';
import './styles/reference.css';
import './styles/horizontal-navigation.css';
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
              <Route path="researches" element={<ResearchHistoryPage />} />
              <Route path="research/:requestId/runs/:runId" element={<RunWorkspacePage />} />
              <Route path="schedules" element={<SchedulesPage />} />
              <Route path="automations" element={<SchedulesPage automation />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="evidence" element={<ResearchCatalogPage kind="evidence" />} />
              <Route path="reports" element={<ResearchCatalogPage kind="report" />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="research/:requestId" element={<ResearchPlanPage />} />
              <Route path="workflow-2" element={<Workflow2Page />} />
              <Route path="workflow-2/:requestId" element={<Workflow2Page />} />
              <Route path="workflow-3" element={<ResearchCatalogPage kind="evidence" />} />
              <Route path="workflow-4" element={<ResearchCatalogPage kind="report" />} />
              <Route path="workflow-3/:requestId" element={<EvidencePage />} />
              <Route path="workflow-4/:requestId" element={<ReportPage />} />
              <Route path="research/:requestId/sources" element={<Workflow2Page />} />
              <Route path="documents" element={<DocumentLibraryPage />} />
              <Route path="documents/:documentId" element={<DocumentDetailPage />} />
              <Route path="chat" element={<DocumentChatPage />} />
              <Route path="chat/:chatId" element={<DocumentChatPage />} />
              <Route path="research/:requestId/chat" element={<DocumentChatPage />} />
              <Route path="research/:requestId/chat/:chatId" element={<DocumentChatPage />} />
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
