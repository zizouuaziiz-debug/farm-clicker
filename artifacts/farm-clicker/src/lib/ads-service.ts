// Thin wrapper around the Adsgram SDK (loaded globally via the script tag in
// index.html — see https://docs.adsgram.ai, "recommended for LLM" install
// method). This is the only file in the app that touches `window.Adsgram`;
// everything else goes through `useRewardedAd`.

export const ADSGRAM_BLOCK_ID = import.meta.env.VITE_ADSGRAM_BLOCK_ID || "int-12127";

export interface AdsgramShowResult {
  done: boolean;
  description?: string;
  state?: "load" | "render" | "playing" | "destroy";
  error?: boolean;
}

interface AdsgramController {
  show: () => Promise<AdsgramShowResult>;
  destroy?: () => void;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => AdsgramController;
    };
  }
}

class AdsService {
  private controllers = new Map<string, AdsgramController>();

  isSdkLoaded(): boolean {
    return typeof window !== "undefined" && !!window.Adsgram;
  }

  private getController(blockId: string): AdsgramController {
    if (!window.Adsgram) {
      throw new Error("Adsgram SDK not loaded");
    }
    let controller = this.controllers.get(blockId);
    if (!controller) {
      controller = window.Adsgram.init({ blockId });
      this.controllers.set(blockId, controller);
    }
    return controller;
  }

  /**
   * Shows a rewarded ad and resolves once it's been watched to completion.
   * Throws if the SDK isn't available, the ad fails to load, or the viewer
   * closes it before it finishes — callers should treat any rejection as
   * "no reward" and never call the claim endpoint.
   */
  async showRewarded(blockId: string = ADSGRAM_BLOCK_ID): Promise<void> {
    const controller = this.getController(blockId);
    const result = await controller.show();
    if (!result.done) {
      throw new Error(result.description || "Ad was closed before finishing");
    }
  }
}

// Singleton: Adsgram controllers are meant to be initialized once per block
// and reused, not recreated on every render.
export const adsService = new AdsService();
