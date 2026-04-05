const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Parses the Naver blog URL to fetch its real content
 * Naver blogs nest content inside an iframe with id "mainFrame"
 * @param {string} url - The original Naver Blog URL
 * @returns {Promise<string>} The extracted text content from the blog
 */
async function scrapeNaverBlogText(url) {
    try {
        // Step 1: Fetch the initial outer page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        
        let $ = cheerio.load(response.data);
        const iframeSrc = $('#mainFrame').attr('src');
        
        if (!iframeSrc) {
            // Some blogs might not use the mainFrame (e.g. mobile versions or tistory blogs)
            // Let's just try to extract from current body
            return extractText($);
        }

        // Step 2: Construct the iframe URL and fetch it
        // iframeSrc usually starts with /PostView.naver?...
        const iframeUrl = iframeSrc.startsWith('http') 
            ? iframeSrc 
            : `https://blog.naver.com${iframeSrc}`;
            
        const iframeResponse = await axios.get(iframeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        
        $ = cheerio.load(iframeResponse.data);
        
        return extractText($);
    } catch (error) {
        console.error(`Failed to scrape blog content from ${url}:`, error.message);
        return null;
    }
}

function extractText($) {
    // Naver blog contents are usually under specific divs like .se-main-container or #postViewArea
    // Let's extract from obvious content containers or fallback to body, removing script/style tags.
    const contentContainers = ['.se-main-container', '#post-view', '#postViewArea'];
    let contentHtml = '';
    
    for (const selector of contentContainers) {
        if ($(selector).length > 0) {
            contentHtml = $(selector).html();
            break;
        }
    }
    
    if (!contentHtml) {
        // fallback to body if no specific container found
        contentHtml = $('body').html();
    }
    
    // Load the extracted subset into a new cheerio context to clean it
    const $content = cheerio.load(contentHtml || '');
    $content('script, style, iframe, nav, footer, header').remove();
    
    const text = $content.text().replace(/\s+/g, ' ').trim();
    return text;
}

module.exports = {
    scrapeNaverBlogText
};
