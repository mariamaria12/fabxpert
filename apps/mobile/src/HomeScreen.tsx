import { logout } from '@fabxpert/shared';
import type { MeResponse } from '@fabxpert/shared';

interface HomeScreenProps {
  user: MeResponse;
  onLogout: () => void;
}

export function HomeScreen({ user, onLogout }: HomeScreenProps) {
  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <main className="home-screen">
      <div className="home-content">
        <p className="home-greeting">Autentificat ca {user.email}</p>
        <p className="home-placeholder">Pontaj — în curând.</p>
        <button type="button" className="home-logout" onClick={handleLogout}>
          Deconectare
        </button>
      </div>
    </main>
  );
}
