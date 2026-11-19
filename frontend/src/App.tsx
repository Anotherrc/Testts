import { AppRouter } from './routes';
import { AccessibilityProvider } from './context/AccessibilityContext';

function App() {
    return (
        <AccessibilityProvider>
            <AppRouter />
        </AccessibilityProvider>
    );
}

export default App;