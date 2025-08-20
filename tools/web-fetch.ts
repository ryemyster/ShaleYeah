#!/usr/bin/env node
/**
 * Fetch URL, strip text, return JSON {url,text} for research agent
 * Usage: node web-fetch.ts <url>
 */

import * as https from "https";
import * as http from "http";
import { fileURLToPath } from "url";

export interface FetchResult {
  url: string;
  text: string;
  status?: number;
  error?: string;
}

export function stripHtmlTags(html: string): string {
  let result = html;

  // Repeat a regex until no more matches (stable loop for CodeQL)
  const removeAll = (s: string, re: RegExp): string => {
    let prev: string;
    do {
      prev = s;
      s = s.replace(re, "");
    } while (s !== prev);
    return s;
  };

  // 1) Remove comments, CDATA, processing instructions, DOCTYPE
  result = removeAll(result, /<!--[\s\S]*?-->/g);
  result = removeAll(result, /<!\[CDATA\[[\s\S]*?\]\]>/g);
  result = removeAll(result, /<\?[\s\S]*?\?>/g);
  result = removeAll(result, /<!DOCTYPE[\s\S]*?>/gi);

  // 2) Kill script/style blocks (comprehensive malformed tag handling)
  // Handle all possible malformed closing tags including </script\t\n bar>
  result = removeAll(result, /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script[^>]*>/gi);
  result = removeAll(result, /<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style[^>]*>/gi);
  // Also remove any remaining script/style opening tags without proper closing
  result = removeAll(result, /<\s*script\b[^>]*>/gi);
  result = removeAll(result, /<\s*style\b[^>]*>/gi);

  // 3) Remove high-risk paired tags
  const paired = ["iframe", "object", "embed", "applet", "form", "textarea", "button", "select"];
  for (const tag of paired) {
    const re = new RegExp(`<\\s*${tag}\\b[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, "gi");
    result = removeAll(result, re);
  }

  // 4) Remove risky single/self-closing tags AND all remaining tags
  const singles = ["input", "meta", "link", "base", "source", "track"];
  for (const tag of [...paired, ...singles]) {
    const re = new RegExp(`<\\s*${tag}\\b[^>]*\\/?>`, "gi");
    result = removeAll(result, re);
  }

  // 4b) Extract text content from safe tags, then remove ALL tags
  const safeTextTags = ["div", "span", "p", "a", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "b", "i", "strong", "em"];
  for (const tag of safeTextTags) {
    // Extract text content from paired tags before removal
    const pairedRe = new RegExp(`<\\s*${tag}\\b[^>]*>([\\s\\S]*?)<\\s*\\/\\s*${tag}\\s*>`, "gi");
    result = result.replace(pairedRe, "$1 ");
  }
  
  // Remove dangerous self-closing tags completely
  const dangerousSingleTags = ["img", "input", "meta", "link", "base", "source", "track"];
  for (const tag of dangerousSingleTags) {
    const singleRe = new RegExp(`<\\s*${tag}\\b[^>]*\\/?>`, "gi");
    result = removeAll(result, singleRe);
  }

  // 5) Nuke ALL dangerous URL schemes and inline JS vectors (CodeQL-hardened)
  // Use removeAll pattern to prevent multi-character reintroduction vulnerabilities
  result = removeAll(result, /(?:javascript|data|vbscript):/gi);
  result = removeAll(result, /\son\w+\s*=\s*(['"])[\s\S]*?\1/gi);
  result = removeAll(result, /\son\w+\s*=\s*[^\s'">]+/gi);

  // 6) Remove any remaining tags comprehensively, then single-char strip
  result = removeAll(result, /<[\s\S]*?>/g);   // Any tag with any content including newlines
  result = removeAll(result, /<[^>]*>/g);       // Standard tag removal
  result = result.replace(/[<>]/g, "");         // Final cleanup of stray brackets

  // 7) Decode safe entities (do NOT decode &lt; or &gt;)
  result = result
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&"); // last

  // 8) Normalize whitespace
  return result.replace(/[\r\n\t\f\v]+/g, " ").replace(/\s+/g, " ").trim();
}

export function fetchUrl(url: string): Promise<FetchResult> {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;

    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "SHALE-YEAH-Research-Agent/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 10000,
      },
      (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          const contentType = response.headers["content-type"] || "";

          if (contentType.includes("text/html")) {
            const cleanText = stripHtmlTags(data);
            resolve({
              url,
              text: cleanText,
              status: response.statusCode,
            });
          } else {
            const text = data.length > 10000 ? data.substring(0, 10000) + "..." : data;
            resolve({
              url,
              text,
              status: response.statusCode,
            });
          }
        });
      }
    );

    request.on("error", (error) => {
      resolve({
        url,
        text: "",
        error: error.message,
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({
        url,
        text: "",
        error: "Request timeout",
      });
    });
  });
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: node web-fetch.ts <url>");
    console.error("Example: node web-fetch.ts https://example.com");
    process.exit(1);
  }

  // Validate URL format and scheme (comprehensive security check)
  try {
    const u = new URL(url);
    // Only allow http and https - block all dangerous schemes
    const allowedProtocols = ["http:", "https:"];
    if (!allowedProtocols.includes(u.protocol)) {
      console.error(`Unsupported protocol: ${u.protocol}. Only http and https are allowed.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }

  try {
    const result = await fetchUrl(url);

    console.log(JSON.stringify(result, null, 2));

    if (result.error) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Unexpected error: ${error}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const isDirectlyExecuted = process.argv[1] === __filename;

if (isDirectlyExecuted) {
  main();
}