import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import { SpaceBrowser } from './SpaceBrowser';
import { ChatViewer } from './ChatViewer';

interface SpaceInfo {
  name: string;
  schema: 'files' | 'chatlog';
}

export function SpaceRouter() {
  const { space } = useParams();
  const [schema, setSchema] = useState<string | null>(null);

  useEffect(() => {
    apiGet<SpaceInfo[]>('/admin/spaces').then(spaces => {
      const s = spaces.find(s => s.name === space);
      setSchema(s?.schema || 'files');
    });
  }, [space]);

  if (!schema) return null;
  if (schema === 'chatlog') return <ChatViewer />;
  return <SpaceBrowser />;
}
