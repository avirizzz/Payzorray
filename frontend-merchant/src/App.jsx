import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MerchantProvider } from './context/MerchantContext';
import LandingPage from './pages/LandingPage';
import PickerPage from './pages/PickerPage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import OrdersPage from './pages/OrdersPage';
import CatalogPage from './pages/CatalogPage';
import ChatPage from './pages/ChatPage';
import UpsellPage from './pages/UpsellPage';
import CampaignsPage from './pages/CampaignsPage';

export default function App() {
  return (
    <MerchantProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pick" element={<PickerPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/upsell" element={<UpsellPage />} />
        </Routes>
      </BrowserRouter>
    </MerchantProvider>
  );
}
