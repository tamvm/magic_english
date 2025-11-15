import puppeteer from 'puppeteer';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

class WebScrapingService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeUrl(url, options = {}) {
    const { timeout = 60000 } = options; // Increased to 60 seconds for web scraping

    let browser = null;
    let page = null;

    try {
      // Validate URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
      }

      browser = await this.initBrowser();
      page = await browser.newPage();

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Set extra headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // Block unnecessary resources to speed up loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      console.log(`Navigating to: ${url}`);

      // Navigate to the URL with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout
      });

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the HTML content
      const html = await page.content();

      // Close page
      await page.close();

      // Extract main content using Mozilla Readability
      const content = this.extractMainContent(html, url);

      console.log(`Content extracted - Title: ${content.title}, Length: ${content.textContent?.length || 0} chars`);

      if (!content.textContent || content.textContent.length < 100) {
        throw new Error(`Insufficient content extracted: only ${content.textContent?.length || 0} characters found`);
      }

      return {
        success: true,
        url,
        title: content.title,
        content: content.textContent,
        excerpt: content.excerpt,
        error: null
      };

    } catch (error) {
      console.error('Web scraping error:', error);

      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore close errors
        }
      }

      return {
        success: false,
        url,
        title: null,
        content: null,
        excerpt: null,
        error: error.message
      };
    }
  }

  extractMainContent(html, url) {
    try {
      // Create a JSDOM instance
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style, nav, footer, aside, .advertisement, .ads, .sidebar');
      scripts.forEach(el => el.remove());

      // Use Mozilla Readability to extract main content
      const reader = new Readability(document);
      const article = reader.parse();

      if (article) {
        return {
          title: article.title,
          textContent: article.textContent.trim(),
          excerpt: article.excerpt,
          length: article.length
        };
      } else {
        // Fallback to extracting text from main content areas
        // Add BBC Learning English specific selectors
        const contentSelectors = [
          '.transcript', // BBC Learning English transcript
          '.programme-text', // BBC Learning English programme text
          '.episode-text', // BBC Learning English episode content
          '.content-wrapper', // BBC general content wrapper
          'article',
          'main',
          '.content',
          '.post-content',
          '.entry-content',
          '.article-content',
          '[role="main"]',
          '.episode-content', // Additional BBC selectors
          '.story-body', // BBC News style content
        ];

        let content = '';
        let title = document.querySelector('title')?.textContent || '';

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            content = element.textContent.trim();
            break;
          }
        }

        // If no main content found, get text from body but exclude common non-content areas
        if (!content) {
          const excludeSelectors = 'nav, footer, aside, header, .menu, .navigation, .sidebar, .ads, .advertisement';
          const excludeElements = document.querySelectorAll(excludeSelectors);
          excludeElements.forEach(el => el.remove());

          content = document.body?.textContent?.trim() || '';
        }

        return {
          title: title,
          textContent: content,
          excerpt: content.substring(0, 200) + '...',
          length: content.length
        };
      }
    } catch (error) {
      console.error('Content extraction error:', error);
      throw new Error('Failed to extract content from webpage');
    }
  }

  async processTextContent(text) {
    // Clean up the text content
    const cleanedText = text
      .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    return {
      success: true,
      title: 'Pasted Text Content',
      content: cleanedText,
      excerpt: cleanedText.substring(0, 200) + (cleanedText.length > 200 ? '...' : ''),
      error: null
    };
  }

  // Cleanup method for graceful shutdown
  async cleanup() {
    await this.closeBrowser();
  }
}

// Create a singleton instance
const webScrapingService = new WebScrapingService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await webScrapingService.cleanup();
});

process.on('SIGINT', async () => {
  await webScrapingService.cleanup();
});

export { webScrapingService };