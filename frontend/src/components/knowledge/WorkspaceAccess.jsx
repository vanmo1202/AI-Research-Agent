import { useAuth } from '../../auth/AuthProvider';
export default function WorkspaceAccess({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}
