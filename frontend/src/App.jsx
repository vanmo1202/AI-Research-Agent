import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import Workflow1Page from './pages/Workflow1Page';
import ResearchPlanPage from './pages/ResearchPlanPage';
import Workflow2Page from './pages/Workflow2Page';
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="workflow-1" element={<Workflow1Page />} />
        <Route path="research/:requestId" element={<ResearchPlanPage />} />
        <Route path="workflow-2" element={<Workflow2Page />} />
        <Route path="workflow-2/:requestId" element={<Workflow2Page />} />
        <Route path="research/:requestId/sources" element={<Workflow2Page />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
