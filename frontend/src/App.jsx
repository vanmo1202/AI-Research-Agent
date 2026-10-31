import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RunDashboardPage from './pages/RunDashboardPage';
import CreateRunPage from './pages/CreateRunPage';
import RunProgressPage from './pages/RunProgressPage';
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
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<RunDashboardPage />} />
        <Route path="research/new" element={<CreateRunPage />} />
        <Route path="research/:requestId/runs/:runId" element={<RunProgressPage />} />
        <Route path="workflow-1" element={<Workflow1Page />} />
        <Route path="research/:requestId" element={<ResearchPlanPage />} />
        <Route path="workflow-2" element={<Workflow2Page />} />
        <Route path="workflow-2/:requestId" element={<Workflow2Page />} />
        <Route path="workflow-3" element={<RequestPicker destination="workflow-3" />} />
        <Route path="workflow-4" element={<RequestPicker destination="workflow-4" />} />
        <Route path="workflow-3/:requestId" element={<EvidencePage />} />
        <Route path="workflow-4/:requestId" element={<ReportPage />} />
        <Route path="research/:requestId/sources" element={<Workflow2Page />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="sources/:sourceId" element={<SourceDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
