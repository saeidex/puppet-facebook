"use server";

import {
  ThreadManager,
  closeBrowsers,
  initializeBrowsers,
  navigateAll,
  takeScreenshotsAll,
} from "./thread-manager";

export async function handleThreadAutomation(
  threads: number,
  headless = false
) {
  let manager: ThreadManager | null = null;

  try {
    manager = await initializeBrowsers(threads, undefined, {
      headless,
    });

    await navigateAll(manager, "https://m.facebook.com");

    await takeScreenshotsAll(manager);
  } finally {
    if (manager) {
      await closeBrowsers(manager);
    }
  }
}
