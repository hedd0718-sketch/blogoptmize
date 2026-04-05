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
- 각 블로그가 왜 1~10위에 위치했는지, 타 경쟁사 글 대비 무엇이 더 나았는지(콘텐츠의 우위)를 '데이터'와 '패턴'으로 증명하세요.
- 분석 지표: 제목 내 키워드 인덱스(1~3순위 여부), 도입부(첫 3문장) 내 키워드 노출, 본문 길이(텍스트 밀도), 이미지/동영상 배치 흐름, 전문 필드(리스트/표/데이터) 활용 유무를 추론하세요.

[데이터 시작]
${blogs.map(blog => `
[랭킹 ${blog.rank}위]
제목: ${blog.title}
링크: ${blog.link}
본문요약: ${blog.content.substring(0, 3500)}...
`).join('\n')}
[데이터 끝]

분석 요청 사항 (매우 구체적이고 디테일하게 작성):
1. 키워드 전략 (Keyword Strategy): "${keyword}"가 제목과 도입부에서 어떻게 배치되어 있는지, 검색 유입을 극대화하는 '황금 배치' 패턴을 분석하세요.
2. 주제 적합성 및 LSI (Topic Authority & Context): 상위 10개 글의 공통 LSI 키워드 5개와, 이 키워드들이 검색 만족도(Search Intent)에 왜 중요한지 맥락을 함께 설명하세요.
3. 의도 파악 (Deep Search Intent): 사용자의 검색 의도를 '정보형', '체험형', '비교형'으로 분류하고, 상위 글들이 이를 어떤 서사 구조(스토리텔링 vs 리스트)로 충족했는지 기술하세요.
4. 상위 노출 필수 가이드라인 5가지 (SEO Blueprint): 1위를 하기 위한 **구체적 실행 지명 5가지**를 "행동지침 + 실제 적용 예시" 쌍으로 작성하세요.
5. 전방위적 랭킹 요인 분석 (The "Metrics" Analysis - 매우 중요): 1위부터 10위까지 개별 블로그에 대해 다음 항목을 포함하여 압도적인 디테일로 분석하세요.
   - 키워드 위치: 제목의 어느 지점, 본문 첫 노출 지점
   - 콘텐츠 볼륨: 타 글 대비 텍스트 밀도와 정보의 구체성 추정
   - 결정적 차별점 (Killer Factor): 이 글이 바로 아래 순위 글보다 더 높은 점수를 받은 결정적 이유 (예: "경쟁사는 단순 제품 나열인 반면, 이 글은 '논문 수치'를 인용하여 데이터의 신뢰도를 확보함")

응답은 반드시 아래 JSON 형식에 맞게 작성해주세요 (\`\`\`json 마크다운 제외, 순수 JSON 텍스트만):
{
  "keywordDensity": "키워드 배치 및 텍스트 구조 전략 요약 (매우 상세히)",
  "commonTopics": ["공통주제1 (맥락 설명 포함)", "공통주제2 (맥락 설명 포함)", "공통주제3 (맥락 설명 포함)"],
  "contentIntent": "사용자 검색 의도와 이를 충족한 상위 글들의 서사 구조 분석",
  "seoGuidelines": [
    "지침 1: 구체적 액션 + 적용 예시",
    "지침 2: 구체적 액션 + 적용 예시",
    "지침 3: 구체적 액션 + 적용 예시",
    "지침 4: 구체적 액션 + 적용 예시",
    "지침 5: 구체적 액션 + 적용 예시"
  ],
  "blogRankingReasons": [
    { 
      "rank": 1, 
      "title": "제목", 
      "link": "링크", 
      "reason": "압도적 디테일의 분석 (키워드 위치, 콘텐츠 볼륨 추정, 타 경쟁사 대비 결정적 차별점 포함)" 
    },
    ... (10위까지 동일하게 반드시 상세 작성)
  ]
}`;

    try {
        // gemini-2.5-flash or gemini-2.0-flash is standard. Assuming user has access.
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptText,
            config: {
                temperature: 0.3,
            }
        });
        
        let responseText = response.text;
        
        // Remove markdown JSON codeblocks if present
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```\n?/, '').replace(/```\n?$/, '').trim();
        }

        return JSON.parse(responseText);
    } catch (error) {
        console.error('LLM Analyzer Error:', error);
        throw new Error('분석 API 오류: ' + (error.message || '알 수 없는 오류'));
    }
}

module.exports = {
    analyzeCompetitors
};
