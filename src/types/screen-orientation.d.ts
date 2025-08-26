// Augment DOM typings to include ScreenOrientation.lock()
// Some TS lib.dom versions omit this method.

declare global {
  interface ScreenOrientation {
    lock(
      orientation:
        | "any"
        | "natural"
        | "landscape"
        | "landscape-primary"
        | "landscape-secondary"
        | "portrait"
        | "portrait-primary"
        | "portrait-secondary"
    ): Promise<void>;
  }
}

export {};

