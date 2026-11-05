import { useEffect, useState } from 'react';
import { getWorkspaceKey, setWorkspaceKey } from '../../services/knowledgeApi';
import Card from '../ui/Card';
import Button from '../ui/Button';
export default function WorkspaceAccess({ children }) {
  const [key, setKey] = useState(getWorkspaceKey);
  const [input, setInput] = useState('');
  useEffect(() => {
    const refresh = () => setKey(getWorkspaceKey());
    window.addEventListener('knowledge:access', refresh);
    return () => window.removeEventListener('knowledge:access', refresh);
  }, []);
  if (!key)
    return (
      <Card className="knowledge-card">
        <h1>Mở Knowledge Workspace</h1>
        <p>
          Nhập khóa workspace do người quản trị cung cấp. Khóa chỉ được lưu trong phiên tab hiện
          tại.
        </p>
        <form
          className="knowledge-form"
          onSubmit={(e) => {
            e.preventDefault();
            setWorkspaceKey(input);
            setInput('');
          }}
        >
          <label>
            Khóa workspace
            <input
              type="password"
              required
              minLength={24}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Button type="submit">Mở workspace</Button>
        </form>
      </Card>
    );
  return (
    <>
      <div className="knowledge-access">
        <span>Workspace riêng tư</span>
        <Button variant="ghost" onClick={() => setWorkspaceKey('')}>
          Khóa workspace
        </Button>
      </div>
      {children}
    </>
  );
}
