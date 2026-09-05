import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AiBuyerProvider } from './context/AiBuyerContext';
import Layout from './components/layout/Layout';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';

export default function App() {
  return (
    <AiBuyerProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/orders" element={<OrdersPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AiBuyerProvider>
  );
}
