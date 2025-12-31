import { FileUpload } from './FileUpload';
import { RoutingTable } from './RoutingTable';

function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Airr File → Transcript → Router POC</h1>
      <FileUpload />
      <RoutingTable />
    </div>
  );
}

export default App;
