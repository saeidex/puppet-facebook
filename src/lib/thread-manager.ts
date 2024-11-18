import path from "node:path";
import fs from "node:fs";
import puppeteer, {
  KnownDevices,
  Browser,
  Page,
  PuppeteerLaunchOptions,
  HTTPRequest,
} from "puppeteer";
import { randomUUID } from "node:crypto";

type BrowserThread = {
  browser: Browser;
  page: Page;
};

type ThreadManager = {
  threads: BrowserThread[];
  isInitialized: boolean;
  headless: PuppeteerLaunchOptions["headless"];
};

const createThreadManager = (
  headless: PuppeteerLaunchOptions["headless"]
): ThreadManager => ({
  threads: [],
  isInitialized: false,
  headless,
});

const initializeBrowsers = async (
  threadCount: number,
  device = KnownDevices["Pixel 4"],
  launchOptions: Partial<PuppeteerLaunchOptions> = {}
): Promise<ThreadManager> => {
  const manager = createThreadManager(launchOptions.headless);

  const defaultLaunchOptions: PuppeteerLaunchOptions = {
    headless: manager.headless,
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

      const pages = await browser.pages();
      const page = pages[0] || (await browser.newPage());
      await page.emulate(device);

      manager.threads.push({ browser, page });

      // Position windows in a grid
      const columns = Math.ceil(Math.sqrt(threadCount));
      const row = Math.floor(i / columns);
      const col = i % columns;

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

const BLOCKED_RESOURCES = new Set(["image", "stylesheet", "font", "media"]);

async function handleRequest(
  req: HTTPRequest,
  preloadCache: Map<string, Buffer>
) {
  try {
    const url = req.url();
    const resourceType = req.resourceType();

    // Debug logging to verify interception
    console.log(`Handling request: ${url} [${resourceType}]`);

    if (preloadCache.has(url)) {
      const cachedContent = preloadCache.get(url);
      if (!cachedContent) {
        return await req.continue();
      }
      return await req.respond({
        status: 200,
        body: cachedContent,
        contentType: "text/html",
      });
    }

    if (BLOCKED_RESOURCES.has(resourceType)) {
      console.log(`Blocking resource: ${url} [${resourceType}]`);
      return await req.abort("blockedbyclient");
    }

    return await req.continue();
  } catch (error) {
    console.error("Error in request handler:", error);
    await req.continue().catch(console.error);
  }
}

async function setupPageListeners(
  page: Page,
  preloadCache: Map<string, Buffer>
) {
  // Remove existing listeners if any
  await page.removeAllListeners("request");
  await page.removeAllListeners("response");

  // Enable request interception BEFORE adding listeners
  await page.setRequestInterception(true);

  // Add request listener
  page.on("request", async (req) => {
    await handleRequest(req, preloadCache);
  });

  // Add response listener for caching
  page.on("response", async (response) => {
    try {
      if (response.ok() && response.request().resourceType() === "document") {
        const buffer = await response.buffer();
        preloadCache.set(response.url(), buffer);
      }
    } catch (error) {
      console.error("Error handling response:", error);
    }
  });
}

interface NavigationOptions {
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
}

interface NavigationResult {
  success: boolean;
  threadIndex: number;
  url: string;
  error?: Error;
}

async function navigateAll(
  manager: ThreadManager,
  url: string,
  options: NavigationOptions = {}
): Promise<NavigationResult[]> {
  const defaultOptions = {
    timeout: 30000,
    waitUntil: "networkidle0" as const,
    ...options,
  };

  console.log(`Running in ${manager.headless ? "headless" : "headed"} mode`);

  const results = await Promise.allSettled(
    manager.threads.map(async ({ page }, index) => {
      const preloadCache = new Map<string, Buffer>();

      try {
        if (manager.headless) {
          await setupPageListeners(page, preloadCache);

          page.on("requestfailed", (request) => {
            console.log(
              `Request failed: ${request.url()} [${request.resourceType()}]`
            );
          });

          page.on("requestfinished", (request) => {
            console.log(
              `Request finished: ${request.url()} [${request.resourceType()}]`
            );
          });
        }

        console.log(`Thread ${index + 1}: Starting navigation to ${url}`);
        const response = await page.goto(url, {
          ...defaultOptions,
          waitUntil: "networkidle0",
        });

        if (!response) {
          throw new Error("Navigation resulted in no response");
        }

        console.log(`Thread ${index + 1}: Successfully navigated to ${url}`);
        return {
          success: true,
          threadIndex: index,
          url,
          statusCode: response.status(),
        };
      } catch (error) {
        console.error(`Thread ${index + 1}: Navigation failed:`, error);
        throw {
          success: false,
          threadIndex: index,
          error,
          url,
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      success: false,
      threadIndex: index,
      error: result.reason,
      url,
    };
  });
}

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
