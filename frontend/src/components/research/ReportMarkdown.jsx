import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeExternalUrl } from '../../utils/format';
export default function ReportMarkdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => {
          const safe = safeExternalUrl(href);
          return safe ? (
            <a href={safe} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
