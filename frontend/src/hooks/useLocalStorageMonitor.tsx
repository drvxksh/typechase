import { useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";

/**
 * A hook that monitors localStorage for changes and restores playerId if deleted
 */
export function useLocalStorageMonitor() {
  const { playerId, checkAndRestorePlayerId } = usePlayer();

  useEffect(() => {
    // Function to handle storage changes
    const handleStorageChange = (event: StorageEvent) => {
      // If the playerId was deleted from localStorage
      if (event.key === "playerId" && event.newValue === null) {
        // Restore it from context
        checkAndRestorePlayerId();
      }
    };

    // Add event listener for storage events
    window.addEventListener("storage", handleStorageChange);

    // Also set up a periodic check
    const intervalId = setInterval(checkAndRestorePlayerId, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, [playerId, checkAndRestorePlayerId]);
}
