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

// 네이버 API 키 설정 (보안을 위해 환경 변수 사용 권장)
const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 사용자가 화면에서 검색을 누르면 호출되는 통신 주소
app.get('/api/search/blog', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).json({ error: 'Naver API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.' });
    }

    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
            params: {
                query: query,
                display: 30, // 분석을 위해 넉넉히 가져옴
                start: 1,
                sort: 'sim'
            },
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('API Request Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: '네이버 검색 중 오류가 발생했습니다.' });
    }
});

// --- AI Agent Endpoints ---

// 1. Analysis Agent (Scrapes top blogs and asks LLM)
app.post('/api/agents/analyze', async (req, res) => {
    const { keyword, items } = req.body;
    if (!keyword || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: '키워드와 분석할 아이템이 필요합니다.' });
    }

    try {
        // 최대 10개의 블로그 본문을 성공적으로 가져올 때까지 시도
        const results = [];
        const limit = 10;
        
        // Vercel 타임아웃을 피하기 위해 병렬 처리를 극대화 (10개 동시 시도)
        const candidates = items.slice(0, 15); // 여유 있게 15개 후보군 설정
        
        const scrapePromises = candidates.map(async (item, idx) => {
            try {
                const content = await scrapeNaverBlogText(item.link);
                if (content && content.length > 300) { // 의미 있는 분량 보장
                    return {
                        rank: items.indexOf(item) + 1,
                        title: item.title.replace(/<[^>]*>?/gm, ''),
                        link: item.link,
                        content: content
                    };
                }
            } catch (e) {
                console.error(`Scrape Error [${item.link}]:`, e.message);
            }
            return null;
        });

        const allScraped = await Promise.all(scrapePromises);
        const validResults = allScraped.filter(b => b !== null).slice(0, limit);
        
        if (validResults.length === 0) {
            return res.status(500).json({ error: '블로그 내용을 가져오는 데 실패했습니다. 다시 시도해 주세요.' });
        }

        const analysisReport = await analyzeCompetitors(keyword, validResults);
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
