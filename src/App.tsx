import { AppProviders } from "./app/providers/AppProviders";
import { AppRoutes } from "./app/router/AppRoutes";
import { AppLayout } from "./components/layout/AppLayout";

export default function App() {
  return (
    <AppProviders>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </AppProviders>
  );
}
