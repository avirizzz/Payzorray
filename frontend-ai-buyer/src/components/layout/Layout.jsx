import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div style={{ height: '100%', display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>{children}</main>
    </div>
  );
}
