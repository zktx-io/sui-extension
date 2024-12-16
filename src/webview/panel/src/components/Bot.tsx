import { useEffect, useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

export const Bot = ({ data }: { data: string }) => {
  const [html, setHtml] = useState<string>('');
  useEffect(() => {
    const renderer = {
      code: ({ text, lang }: { text: string; lang?: string }) => {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
        const highlighted = hljs.highlight(text, { language }).value;
        return `<pre style="overflow-x: auto; font-family: monospace;"><code class="hljs ${language}">${highlighted}</code></pre>`;
      },
    };
    marked.use({ renderer });
    const renderedHtml = marked.parse(data, { async: false, gfm: true });
    setHtml(() => renderedHtml);
  }, [data]);
  return (
    <div
      style={{
        width: '80%',
        textAlign: 'left',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
