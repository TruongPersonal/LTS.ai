import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProcessingProvider } from './context/ProcessingContext';
import { FloatingProcessingWidget } from './components/common/FloatingProcessingWidget';
import { AppRoutes } from './AppRoutes';
import './i18n';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProcessingProvider>
            <AppRoutes />
            <FloatingProcessingWidget />
          </ProcessingProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
