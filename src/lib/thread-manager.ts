import path from "node:path";
import fs from "node:fs";
import puppeteer, {
  KnownDevices,
  Browser,
  Page,
  PuppeteerLaunchOptions,
} from "puppeteer";
import { randomUUID } from "node:crypto";

type BrowserThread = {
  browser: Browser;
  page: Page;
};

type ThreadManager = {
  threads: BrowserThread[];
  isInitialized: boolean;
};

const createThreadManager = (): ThreadManager => ({
  threads: [],
  isInitialized: false,
});

const initializeBrowsers = async (
  threadCount: number,
  device = KnownDevices["Pixel 4"],
  launchOptions: Partial<PuppeteerLaunchOptions> = {}
): Promise<ThreadManager> => {
  const manager = createThreadManager();

  const defaultLaunchOptions: PuppeteerLaunchOptions = {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--window-size=${device.viewport.width},${device.viewport.height}`,
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--user-agent=${device.userAgent}`,
    ],
  };

  const options = {
    ...defaultLaunchOptions,
    ...launchOptions,
    args: [...(defaultLaunchOptions.args ?? []), ...(launchOptions.args ?? [])],
  };

  try {
    for (let i = 0; i < threadCount; i++) {
      const browser = await puppeteer.launch(options);

      const page = await browser.newPage();
      await page.emulate(device);

      manager.threads.push({ browser, page });

      // Position windows in a grid
      const columns = Math.ceil(Math.sqrt(threadCount));
      const row = Math.floor(i / columns);
      const col = i % columns;

      const pages = await browser.pages();
      const windowHandle = pages[0];

      await windowHandle.evaluate(
        (layout) => {
          window.moveTo(
            layout.col * (layout.width + 10),
            layout.row * (layout.height + 10)
          );
        },
        {
          row,
          col,
          width: device.viewport.width,
          height: device.viewport.height,
        }
      );
    }

    manager.isInitialized = true;
    console.log(
      `Successfully initialized ${threadCount} browser threads with ${device.userAgent}`
    );
    return manager;
  } catch (error) {
    await closeBrowsers(manager);
    throw error;
  }
};

const navigateAll = async (
  manager: ThreadManager,
  url: string
): Promise<void> => {
  await Promise.all(
    manager.threads.map(async ({ page }, index) => {
      try {
        await page.goto(url, { waitUntil: "networkidle0" });
        console.log(`Thread ${index + 1}: Successfully navigated to ${url}`);
      } catch (error) {
        console.error(`Thread ${index + 1}: Navigation failed:`, error);
      }
    })
  );
};

const closeBrowsers = async (manager: ThreadManager): Promise<void> => {
  await Promise.all(
    manager.threads.map(async ({ browser }, index) => {
      try {
        await browser.close();
        console.log(`Thread ${index + 1}: Browser closed successfully`);
      } catch (error) {
        console.error(`Thread ${index + 1}: Failed to close browser:`, error);
      }
    })
  );

  manager.threads = [];
  manager.isInitialized = false;
};

const executeForAll = async (
  manager: ThreadManager,
  action: (page: Page) => Promise<void>
): Promise<void> => {
  await Promise.all(
    manager.threads.map(async ({ page }, index) => {
      try {
        await action(page);
        console.log(`Thread ${index + 1}: Action executed successfully`);
      } catch (error) {
        console.error(`Thread ${index + 1}: Action failed:`, error);
      }
    })
  );
};

const takeScreenshotsAll = async (manager: ThreadManager) => {
  const screenshotsDir = path.join("src", "assets", "screenshots");

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  await executeForAll(manager, async (page) => {
    const imgId = randomUUID();
    const screenshotPath = path.join(
      screenshotsDir,
      `screenshot-${Date.now()}-${imgId}.png`
    );
    await page.screenshot({
      path: screenshotPath,
    });
  });
};

export type { BrowserThread, ThreadManager };
export {
  initializeBrowsers,
  navigateAll,
  executeForAll,
  takeScreenshotsAll,
  closeBrowsers,
};
