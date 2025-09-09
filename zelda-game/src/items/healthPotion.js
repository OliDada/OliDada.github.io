import { playerState } from "../state/stateManagers.js";

export function useHealthPotion(k) {
    if (playerState.getPotions() > 0 && playerState.getHealth() < playerState.getMaxHealth()) {
        playerState.usePotion();
        playerState.setHealth(Math.min(playerState.getHealth() + 2, playerState.getMaxHealth())); // Heals 2 hearts
        return true;
    }
    return false;
}
