const { GoogleGenAI } = require('@google/genai');

/**
 * Analyzes the top scraped blog contents to extract SEO optimization factors.
 * @param {string} keyword - The search keyword
 * @param {Array<{title: string, content: string, rank: number}>} blogs - Array of scraped blog data
 * @returns {Promise<Object>} JSON containing the analysis report
 */
async function analyzeCompetitors(keyword, blogs) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `당신은 대한민국 최고의 네이버 블로그 SEO 전문가이자 데이터 분석가입니다. 
다음은 검색어 "${keyword}"로 상위 노출된 네이버 블로그 게시글 10개의 실제 데이터입니다.

[분석 가이드 및 페르소나]
- 단순히 '글이 좋다'는 식의 추상적인 설명은 절대 금지입니다.
- 각 블로그가 왜 1~10위에 위치했는지, 타 경쟁사 글 대비 무엇이 더 나았는지(콘텐츠의 우위)를 '데이터'와 '구체적 수치'로 추론하여 증명하세요.
- 분석 지표: 제목 내 키워드 배치(전방/중간), 도입부 키워드 노출 시점, 본문 내 텍스트 밀도(추정 공백 제외 글자수), 이미지/동영상 배치 흐름, 전문성 지표(표/리스트/인용구 활용)를 분석하세요.

[데이터 시작]
${blogs.map(blog => `
[랭킹 ${blog.rank}위]
제목: ${blog.title}
본문: ${blog.content.substring(0, 4000)}...
`).join('\n')}
[데이터 끝]

분석 요청 사항:
1. 키워드 전략 (Keyword Strategy): "${keyword}"가 제목과 도입부에서 어떻게 배치되어 있는지, 상위 노출을 만드는 '황금 배치' 패턴을 요약하세요.
2. 주제 적합성 및 LSI (Topic & Context): 상위 글들이 공통적으로 다루는 핵심 연관 키워드(LSI) 5개를 찾아내고, 이 키워드들이 검색 의도와 어떻게 연결되는지 설명하세요.
3. 상위 노출 필수 가이드라인 5가지: 1위를 하기 위한 **구체적 실행 지침**을 "행동지침: 실제 적용 예시" 형식으로 작성하세요.
4. 전방위적 랭킹 요인 분석 (The "Metrics" Analysis): 1위부터 10위까지 개별 블로그에 대해 다음 항목을 압도적인 디테일로 분석하세요.
   - 키워드 최적화: 제목과 본문 첫 부분의 키워드 활용방식
   - 콘텐츠 경쟁 우위: 하위 순위 글보다 이 글이 더 높은 평가를 받은 결정적 이유 (예: "3위 글은 단순 후기인 반면, 2위인 이 글은 '논문 수치'와 '비교 표'를 사용해 정보의 신뢰도를 극대화함")

응답은 반드시 아래 JSON 형식에 맞게 작성해주세요 (마크다운 제외, 순수 JSON 텍스트만):
{
  "keywordDensity": "키워드 배치 및 텍스트 구조 전략 요약 (500자 내외 상세히)",
  "commonTopics": ["공통주제1 (맥락 포함)", "공통주제2 (맥락 포함)", "공통주제3 (맥락 포함)"],
  "contentIntent": "사용자 검색 의도와 이를 충족한 서사 구조 분석",
  "seoGuidelines": [
    "지침 1: 구체적 액션 + 예시",
    "지침 2: 구체적 액션 + 예시",
    "지침 3: 구체적 액션 + 예시",
    "지침 4: 구체적 액션 + 예시",
    "지침 5: 구체적 액션 + 예시"
  ],
  "blogRankingReasons": [
    { 
      "rank": 1, 
      "title": "제목", 
      "link": "${blogs[0]?.link || ''}", 
      "reason": "키워드 배치, 정보의 밀도, 하위 순위 대비 결정적 차별점(Killer Factor)을 포함한 심층 분석" 
    }
  ]
} (실제 데이터의 모든 랭킹(1~10위)을 위 형식으로 반드시 상세히 채워 넣으세요)`;

    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 2000; // 2 seconds

    while (attempts < maxAttempts) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: promptText,
                config: {
                    temperature: 0.3,
                }
            });
            
            let responseText = response.text;
            
            if (responseText.startsWith('```json')) {
                responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
            } else if (responseText.startsWith('```')) {
                responseText = responseText.replace(/```\n?/, '').replace(/```\n?$/, '').trim();
            }

            return JSON.parse(responseText);
        } catch (error) {
            attempts++;
            console.error(`LLM Analyzer Attempt ${attempts} failed:`, error.message);
            
            // Check if it's a transient error (like 503 Service Unavailable)
            const isTransient = error.message.includes('503') || error.message.includes('Service Unavailable') || error.message.includes('high demand');
            
            if (isTransient && attempts < maxAttempts) {
                console.log(`Wait ${retryDelay}ms before retrying due to high demand...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempts)); // Exponentially wait
                continue;
            }
            
            if (attempts >= maxAttempts) {
                throw new Error('분석 API 오류 (최대 재시도 초과): ' + (error.message || '알 수 없는 오류'));
            }
            throw error;
        }
    }
}

module.exports = {
    analyzeCompetitors
};
