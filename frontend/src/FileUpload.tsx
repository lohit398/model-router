import { useState } from 'react';

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<any>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setResponse(data);
  };

  return (
    <div>
      <h2>Upload File</h2>
      <form onSubmit={onSubmit}>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit">Upload</button>
      </form>

      {response && (
        <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8 }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}
