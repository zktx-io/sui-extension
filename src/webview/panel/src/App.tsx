import { useEffect, useRef, useState } from 'react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

import './App.css';

import { COMMENDS, RequestData } from './utilities/commends';
import { vscode } from './utilities/vscode';
import { User } from './components/User';
import { Bot } from './components/Bot';
import { Skeleton } from './components/Skeleton';

function App() {
  const initialized = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [htmlHistory, setHtmlHistory] = useState<(string | RequestData)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [htmlHistory]);

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case 'sui-extension.ask-su.file':
        case 'sui-extension.ask-su.folder':
          setIsLoading(() => true);
          setHtmlHistory((old) => [
            ...old,
            { code: true, content: message.data },
            '',
          ]);
          break;
        case COMMENDS.AiHistory:
          const temp: (string | RequestData)[] = [];
          message.data.forEach((item: { user: RequestData; bot: string }) => {
            temp.push(item.user, item.bot);
          });
          setHtmlHistory(() => temp);
          if (scrollContainerRef.current) {
            setTimeout(() => {
              scrollContainerRef.current!.scrollTop =
                scrollContainerRef.current!.scrollHeight;
            }, 5);
          }
          initialized.current = true;
          break;
        case COMMENDS.AiStream:
          setHtmlHistory((old) => [...old.slice(0, -1), message.data]);
          break;
        case COMMENDS.AiStreamEnd:
          setIsLoading(() => false);
          break;
        default:
          break;
      }
    };

    if (!initialized.current) {
      vscode.postMessage({ command: COMMENDS.Env });
    }

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {htmlHistory.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--vscode-foreground)',
              fontSize: '1.2rem',
              textAlign: 'center',
              height: '100%',
            }}
          >
            👋 Hello, Sui! Start a conversation. 💬
          </div>
        ) : (
          htmlHistory.map((item, key) =>
            typeof item === 'string' ? (
              isLoading && key === htmlHistory.length - 1 && !item ? (
                <Skeleton key={key} />
              ) : (
                <Bot key={key} data={item} />
              )
            ) : (
              <User
                key={key}
                data={item.code ? 'Code Analysis...' : item.content}
              />
            ),
          )
        )}
      </div>
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          paddingBottom: '1rem',
        }}
      >
        <VSCodeTextField
          style={{
            width: '100%',
            color: 'var(--vscode-input-foreground)',
          }}
          disabled={isLoading || !initialized.current}
          value={input}
          placeholder="Message..."
          onChange={(event) => {
            !isLoading && setInput((event.target as any)?.value || '');
          }}
          onKeyDown={(event) => {
            const value = (event.target as any)?.value || '';
            if (event.key === 'Enter' && value && !isLoading) {
              vscode.postMessage({
                command: COMMENDS.AiQuestion,
                data: value,
              });
              setInput('');
              setIsLoading(() => true);
              setHtmlHistory((old) => [
                ...old,
                { code: false, content: value },
                '',
              ]);
            }
          }}
        />
      </div>
    </div>
  );
}

export default App;
