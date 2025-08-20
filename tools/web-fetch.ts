#!/usr/bin/env node
/**
 * Fetch URL, strip text, return JSON {url,text} for research agent
 * Usage: node web-fetch.ts <url>
 */

import * as https from 'https';
import * as http from 'http';

interface FetchResult {
  url: string;
  text: string;
  status?: number;
  error?: string;
}

function stripHtmlTags(html: string): string {
  // Basic HTML tag removal for text extraction with security fixes
  let result = html;
  
  // Fix #2 & #3: Iterative removal of script/style tags to handle nested/malformed tags
  // Improved regex to handle malformed script tags like "</script >"
  let prevLength: number;
  do {
    prevLength = result.length;
    // Handle script tags with optional attributes and whitespace
    // Use [\s\S] instead of . with 's' flag for ES5 compatibility
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    // Handle style tags with optional attributes and whitespace  
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  } while (result.length !== prevLength);
  
  // Remove remaining HTML tags
  result = result.replace(/<[^>]*>/g, '');
  
  // Fix #1: HTML entity decoding in correct order to prevent double-unescaping
  // Process specific entities first, then &amp; last to avoid double-unescaping
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'); // Move &amp; replacement to LAST to prevent double-unescaping
  
  // Clean up whitespace
  result = result
    .replace(/\s+/g, ' ')
    .trim();
    
  return result;
}

function fetchUrl(url: string): Promise<FetchResult> {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    
    const request = client.get(url, {
      headers: {
        'User-Agent': 'SHALE-YEAH-Research-Agent/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        const contentType = response.headers['content-type'] || '';
        
        if (contentType.includes('text/html')) {
          // Strip HTML tags to get clean text
          const cleanText = stripHtmlTags(data);
          resolve({
            url,
            text: cleanText,
            status: response.statusCode
          });
        } else {
          // For non-HTML content, return as-is (truncated if too long)
          const text = data.length > 10000 ? data.substring(0, 10000) + '...' : data;
          resolve({
            url,
            text,
            status: response.statusCode
          });
        }
      });
    });
    
    request.on('error', (error) => {
      resolve({
        url,
        text: '',
        error: error.message
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve({
        url,
        text: '',
        error: 'Request timeout'
      });
    });
  });
}

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: node web-fetch.ts <url>');
    console.error('Example: node web-fetch.ts https://example.com');
    process.exit(1);
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }
  
  try {
    const result = await fetchUrl(url);
    
    // Output JSON for programmatic consumption
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with error code if fetch failed
    if (result.error) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`Unexpected error: ${error}`);
    process.exit(1);
  }
}

// CLI usage - check for direct execution
if (require.main === module) {
  main();
}

export { fetchUrl, FetchResult };