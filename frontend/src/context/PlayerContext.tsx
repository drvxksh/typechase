import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface PlayerContextType {
  playerId: string | null;
  isPlayerIdLoaded: boolean;
  setPlayerId: (id: string) => void;
  checkAndRestorePlayerId: () => void;
}

// Create the context with a default value
const PlayerContext = createContext<PlayerContextType>({
  playerId: null,
  isPlayerIdLoaded: false,
  setPlayerId: () => {},
  checkAndRestorePlayerId: () => {},
});

// Custom hook to use the player context
export const usePlayer = () => useContext(PlayerContext);

interface PlayerProviderProps {
  children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  // This state will persist in memory even if localStorage is deleted
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isPlayerIdLoaded, setIsPlayerIdLoaded] = useState(false);

  // Initialize from localStorage on first load
  useEffect(() => {
    const storedPlayerId = localStorage.getItem("playerId");
    if (storedPlayerId) {
      setPlayerId(storedPlayerId);
    }
    setIsPlayerIdLoaded(true);
  }, []);

  // When playerId changes in the context, update localStorage too
  useEffect(() => {
    if (playerId) {
      try {
        localStorage.setItem("playerId", playerId);
      } catch (error) {
        console.warn("Failed to save playerId to localStorage:", error);
      }
    }
  }, [playerId]);

  // Function to check if playerId is missing from localStorage but available in context
  const checkAndRestorePlayerId = () => {
    const localStoragePlayerId = localStorage.getItem("playerId");

    // If playerId is in memory but missing from localStorage, restore it
    if (!localStoragePlayerId && playerId) {
      try {
        localStorage.setItem("playerId", playerId);
      } catch (error) {
        console.warn("Failed to restore playerId to localStorage:", error);
      }
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        playerId,
        isPlayerIdLoaded,
        setPlayerId,
        checkAndRestorePlayerId,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
