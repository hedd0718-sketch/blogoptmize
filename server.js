require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { scrapeNaverBlogText } = require('./agents/researcher');
const { analyzeCompetitors } = require('./agents/analyzer');
const { coachDraft } = require('./agents/coach');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
// 웹 화면(HTML/CSS/JS)을 사용자에게 제공
app.use(express.static(path.join(__dirname, 'public')));

// 네이버 API 키 설정 (보안을 위해 환경 변수 사용)
const CLIENT_ID = process.env.NAVER_CLIENT_ID || 'dHzZ8BCRTjx2TkABZE6A';
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'aiomnRV9GP';

// 사용자가 화면에서 검색을 누르면 호출되는 통신 주소
app.get('/api/search/blog', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Search keyword is required' });
    }

    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
            params: {
                query: query,
                display: 30, // 노출 개수 (분석을 위해 여유있게 30개로 설정)
                start: 1,
                sort: 'sim'  // sim: 정확도순, date: 최신순
            },
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('API Request Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch data from Naver API' });
    }
});

// --- AI Agent Endpoints ---

// 1. Analysis Agent (Scrapes top blogs and asks LLM)
app.post('/api/agents/analyze', async (req, res) => {
    const { keyword, items } = req.body;
    if (!keyword || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Keyword and items (array) required.' });
    }

    try {
        // Scrape up to 10 blogs successfully
        const results = [];
        const limit = 10;
        let currentIndex = 0;

        // Parallel processing of batches for speed and reliability
        while (results.length < limit && currentIndex < items.length) {
            const batchSize = Math.min(limit - results.length, 5); // Process in batches of 5
            const batch = items.slice(currentIndex, currentIndex + batchSize);
            currentIndex += batchSize;

            const scrapedBatch = await Promise.all(batch.map(async (item, idx) => {
                try {
                    const content = await scrapeNaverBlogText(item.link);
                    if (content && content.length > 200) { // Ensure content is meaningful
                        return {
                            rank: items.indexOf(item) + 1,
                            title: item.title.replace(/<[^>]*>?/gm, ''),
                            link: item.link,
                            content: content
                        };
                    }
                } catch (e) {
                    console.error(`Failed to scrape ${item.link}:`, e.message);
                }
                return null;
            }));

            results.push(...scrapedBatch.filter(b => b !== null));
        }

        const scrapedDataList = results.slice(0, limit);
        
        if (scrapedDataList.length === 0) {
            return res.status(500).json({ error: '블로그 내용을 가져오는 데 실패했습니다. 다시 시도해 주세요.' });
        }

        const analysisReport = await analyzeCompetitors(keyword, scrapedDataList);
        res.json({ success: true, report: analysisReport });
    } catch (error) {
        console.error('Analysis API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Coaching Agent (Compares draft with analysis)
app.post('/api/agents/coach', async (req, res) => {
    const { keyword, guidelines, draft } = req.body;
    if (!keyword || !guidelines || !draft) {
        return res.status(400).json({ error: 'Missing required data for coaching.' });
    }

    try {
        const feedback = await coachDraft(keyword, guidelines, draft);
        res.json({ success: true, feedback });
    } catch (error) {
        console.error('Coaching API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 서버 구동 (로컬 환경에서 직접 실행 시에만 호출)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 블로그 검색기 전용 서버가 시작되었습니다!`);
        console.log(`👉 인터넷 브라우저에 아래 주소를 입력하세요:`);
        console.log(`▶▶ http://localhost:${PORT} ◀◀`);
        console.log(`======================================================\n`);
    });
}

// Vercel 배포를 위한 익스포트
module.exports = app;
