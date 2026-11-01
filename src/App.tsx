/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BoilerProvider } from './context/BoilerContext';
import { Layout } from './components/Layout';
import { HomeDashboard } from './pages/HomeDashboard';
import { CalculationPage } from './pages/CalculationPage';
import { HistoryPage } from './pages/HistoryPage';
import { ChemicalsPage } from './pages/ChemicalsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BoilerProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/calculation" element={<CalculationPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/chemicals" element={<ChemicalsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </BoilerProvider>
  );
}
