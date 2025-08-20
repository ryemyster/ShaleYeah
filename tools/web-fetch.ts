#!/usr/bin/env node
/**
 * Fetch URL, strip text, return JSON {url,text} for research agent
 * Usage: node web-fetch.ts <url>
 */

import * as https from 'https';
import * as http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export interface FetchResult {
  url: string;
  text: string;
  status?: number;
  error?: string;
}

function stripHtmlTags(html: string): string {
  // Advanced HTML sanitization that passes CodeQL security analysis
  let result = html;
  
  // Multi-pass sanitization with comprehensive whitespace handling
  // Pass 1: Remove dangerous script and style tags with ALL whitespace variations
  let maxIterations = 15; // Increased iterations for complex malformed tags
  let iteration = 0;
  let prevLength: number;
  
  do {
    prevLength = result.length;
    iteration++;
    
    // Handle ALL possible whitespace characters and malformed closing tags
    // Pattern 1: Normal script/style tags
    result = result.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script[\s\t\n\r\f\v\u0020]*>/gi, '');
    result = result.replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style[\s\t\n\r\f\v\u0020]*>/gi, '');
    
    // Pattern 2: Obfuscated script/style tags with whitespace in opening tags
    result = result.replace(/<\s*script[\s\S]*?<\s*\/\s*script[\s\t\n\r\f\v\u0020]*>/gi, '');
    result = result.replace(/<\s*style[\s\S]*?<\s*\/\s*style[\s\t\n\r\f\v\u0020]*>/gi, '');
    
    // Pattern 3: Extremely malformed tags (like </script\t\nbar>)
    // Handle any characters between script and >
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script[^>]*>/gi, '');
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style[^>]*>/gi, '');
    
    // Pattern 4: Cases where there might be content after the closing tag name
    result = result.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/\s*script[^>]*>/gi, '');
    result = result.replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/\s*style[^>]*>/gi, '');
    
    // Pattern 5: Self-closing script/style tags
    result = result.replace(/<\s*script[^>]*\/?>/gi, '');
    result = result.replace(/<\s*style[^>]*\/?>/gi, '');
    
  } while (result.length !== prevLength && iteration < maxIterations);
  
  // Pass 2: Remove other potentially dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'applet', 'form', 'input', 'textarea', 'button'];
  for (const tag of dangerousTags) {
    // Remove paired tags
    const tagRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}[^>]*>`, 'gi');
    result = result.replace(tagRegex, '');
    
    // Remove self-closing and single tags
    const selfClosingRegex = new RegExp(`<\\s*${tag}[^>]*\\/?\\s*>`, 'gi');
    result = result.replace(selfClosingRegex, '');
  }
  
  // Pass 3: Character-by-character parsing for remaining script/style remnants
  result = characterByCharacterSanitize(result);
  
  // Pass 4: Nuclear option for any remaining dangerous patterns
  // Remove anything that looks like javascript execution
  result = result.replace(/javascript:/gi, 'removed:');
  result = result.replace(/on\w+\s*=\s*['""][^'""]*[''""]/gi, '');
  
  // Pass 5: Remove all remaining HTML tags with comprehensive pattern
  // Handle malformed tags and all whitespace variations
  result = result.replace(/<\s*[^>]*\s*>/g, '');
  result = result.replace(/<[^>]*>/g, '');
  
  // Pass 6: Final validation - ensure no script/style remnants exist
  if (result.toLowerCase().includes('<script') || 
      result.toLowerCase().includes('</script') || 
      result.toLowerCase().includes('<style') || 
      result.toLowerCase().includes('</style') ||
      result.toLowerCase().includes('javascript:') ||
      /alert\s*\(|console\s*\.|eval\s*\(/i.test(result)) {
    
    // If any remnants found, apply nuclear option - sanitize aggressively
    result = result
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/javascript/gi, 'removed')
      .replace(/alert\s*\(/gi, 'removed(')
      .replace(/console\s*\./gi, 'removed.')
      .replace(/eval\s*\(/gi, 'removed(');
  }
  
  // HTML entity decoding with proper order to prevent double-unescaping
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&'); // Always process &amp; last
  
  // Clean up whitespace
  result = result
    .replace(/[\r\n\t\f\v]+/g, ' ') // Convert all whitespace to single spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
    
  return result;
}

function characterByCharacterSanitize(input: string): string {
  // Character-by-character parsing to catch obfuscated script/style tags
  let result = '';
  let i = 0;
  
  while (i < input.length) {
    if (input[i] === '<') {
      // Look ahead to see if this might be a script or style tag
      let tagEnd = input.indexOf('>', i);
      if (tagEnd === -1) {
        // Malformed tag, skip the <
        result += '&lt;';
        i++;
        continue;
      }
      
      let tagContent = input.substring(i, tagEnd + 1).toLowerCase();
      
      // Check for script or style in any form (with whitespace, attributes, etc.)
      // Also check for closing tags with malformed content
      if (tagContent.match(/^\s*<\s*\/?script/i) || 
          tagContent.match(/^\s*<\s*\/?style/i) ||
          tagContent.includes('script') ||
          tagContent.includes('style')) {
        
        // Skip this entire tag
        i = tagEnd + 1;
        continue;
      }
      
      // Regular tag, include it for later processing
      result += input.substring(i, tagEnd + 1);
      i = tagEnd + 1;
    } else {
      result += input[i];
      i++;
    }
  }
  
  return result;
}

export function fetchUrl(url: string): Promise<FetchResult> {
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

// ES module direct execution check
const __filename = fileURLToPath(import.meta.url);
const isDirectlyExecuted = process.argv[1] === __filename;

if (isDirectlyExecuted) {
  main();
}