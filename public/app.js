document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const searchInput = document.getElementById('keyword-input');
    const searchBtn = document.getElementById('search-btn');
    const analyzeLoading = document.getElementById('analyze-loading');
    const analyzeResult = document.getElementById('analyze-result');
    
    const draftInput = document.getElementById('draft-input');
    const coachBtn = document.getElementById('coach-btn');
    const coachLoading = document.getElementById('coach-loading');
    const coachResult = document.getElementById('coach-result');
    
    // Hidden storage for current session
    const hiddenGuidelines = document.getElementById('hidden-guidelines');
    let currentKeyword = '';

    // ==========================================
    // Tab Switching Logic
    // ==========================================
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // ==========================================
    // 1. Analyze Agent Flow
    // ==========================================
    searchInput.focus();

    const startAnalysis = async () => {
        const keyword = searchInput.value.trim();
        if (!keyword) {
            alert('키워드를 입력해주세요!');
            return;
        }

        currentKeyword = keyword;

        // Reset UI
        analyzeResult.classList.add('hidden');
        analyzeLoading.classList.remove('hidden');

        try {
            // Step 1: Fetch Naver Blog Links
            const naverRes = await fetch(`/api/search/blog?query=${encodeURIComponent(keyword)}`);
            if (!naverRes.ok) throw new Error('네이버 검색 실패');
            const data = await naverRes.json();
            
            if (!data.items || data.items.length === 0) {
                analyzeLoading.classList.add('hidden');
                alert('검색 결과가 없습니다.');
                return;
            }

            // Step 2: Call Analysis Agent
            const analyzeRes = await fetch('/api/agents/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, items: data.items })
            });

            const analyzeData = await analyzeRes.json();
            if (!analyzeRes.ok) throw new Error(analyzeData.error || '분석 에이전트 통신 실패');
            
            if (analyzeData.error) throw new Error(analyzeData.error);

            renderAnalysisReport(analyzeData.report);

        } catch (error) {
            console.error(error);
            alert('분석 중 오류 발생: ' + error.message);
        } finally {
            analyzeLoading.classList.add('hidden');
        }
    };

    searchBtn.addEventListener('click', startAnalysis);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startAnalysis();
    });

    // "이 가이드로 코칭받기" 버튼 로직
    const copyToCoachBtn = document.getElementById('copy-to-coach-btn');
    if (copyToCoachBtn) {
        copyToCoachBtn.addEventListener('click', () => {
            // 이미 분석 결과가 있는 상태이므로 탭만 전환해주면 됨
            // hidden-guidelines는 renderAnalysisReport에서 이미 채워짐
            const coachTab = Array.from(tabs).find(t => t.dataset.tab === 'tab-coach');
            if (coachTab) {
                coachTab.click();
                draftInput.focus();
                // 살짝 스크롤 내려주기
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // Render logic for Analysis
    function renderAnalysisReport(report) {
        document.getElementById('report-density').textContent = report.keywordDensity || '정보 없음';
        document.getElementById('report-intent').textContent = report.contentIntent || '정보 없음';
        
        const topicsUl = document.getElementById('report-topics');
        topicsUl.innerHTML = '';
        if (report.commonTopics) {
            report.commonTopics.forEach(t => {
                topicsUl.innerHTML += `<li>${t}</li>`;
            });
        }

        const guideOl = document.getElementById('report-guidelines');
        guideOl.innerHTML = '';
        if (report.seoGuidelines) {
            report.seoGuidelines.forEach(g => {
                // Split Action and Example if the AI follows the "지침: 예시" pattern
                const parts = g.split(':');
                if (parts.length > 1) {
                    guideOl.innerHTML += `
                        <li style="margin-bottom: 1.5rem;">
                            <strong style="color: #A78BFA; display: block; margin-bottom: 0.5rem;">📌 ${parts[0].trim()}</strong>
                            <div style="font-size: 0.95rem; color: #94A3B8; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                                💡 예시: ${parts.slice(1).join(':').trim()}
                            </div>
                        </li>`;
                } else {
                    guideOl.innerHTML += `<li style="margin-bottom: 1rem;">✅ ${g}</li>`;
                }
            });
            // Save guidelines as JSON string for the next tab
            hiddenGuidelines.value = JSON.stringify(report.seoGuidelines);
        }

        const rankingContainer = document.getElementById('report-ranking-reasons');
        if (rankingContainer) {
            rankingContainer.innerHTML = '';
            if (report.blogRankingReasons) {
                report.blogRankingReasons.forEach(item => {
                    const card = document.createElement('a');
                    card.className = 'blog-card glass-panel';
                    card.href = item.link || '#';
                    card.target = '_blank';
                    card.style.display = 'block';
                    card.style.textDecoration = 'none';
                    card.style.color = 'inherit';
                    card.innerHTML = `
                        <div style="padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-size:0.9rem; font-weight:bold; color:#38BDF8;">🏆 ${item.rank}위 정밀 랭킹 분석</div>
                                <div style="font-size:0.8rem; background: rgba(56, 189, 248, 0.2); color: #38BDF8; padding: 2px 8px; border-radius: 4px;">Top Performance</div>
                            </div>
                            <div class="blog-title" style="margin-bottom:12px; line-height: 1.5; font-size: 1.15rem; font-weight: 700;">${item.title}</div>
                            <div class="blog-desc" style="font-size:0.95rem; opacity:1; line-height: 1.7; color:#e2e8f0; background: rgba(15, 23, 42, 0.6); padding: 15px; border-radius: 12px; border-left: 4px solid #38BDF8;">
                                <strong style="color: #60a5fa; display: block; margin-bottom: 8px;">🔍 검색 엔진 평가 데이터:</strong>
                                ${item.reason.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                    rankingContainer.appendChild(card);
                });
            }
        }

        analyzeResult.classList.remove('hidden');
    }

    // ==========================================
    // 2. Coaching Agent Flow
    // ==========================================
    coachBtn.addEventListener('click', async () => {
        if (!currentKeyword || !hiddenGuidelines.value) {
            alert('코칭을 받기 전에 1단계 [상위 블로그 분석]을 먼저 완료해주세요!');
            // Auto switch to tab 1
            tabs[0].click();
            return;
        }

        const draft = draftInput.value.trim();
        if (draft.length < 50) {
            alert('코칭을 받으려면 초안을 최소 50자 이상 작성해주세요.');
            return;
        }

        let guidelines = [];
        try {
            guidelines = JSON.parse(hiddenGuidelines.value);
        } catch (e) {
            alert('가이드라인 데이터를 읽을 수 없습니다.');
            return;
        }

        coachResult.classList.add('hidden');
        coachLoading.classList.remove('hidden');

        try {
            const res = await fetch('/api/agents/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: currentKeyword, guidelines, draft })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '코칭 에이전트 통신 실패');
            
            if (data.error) throw new Error(data.error);

            renderCoachingReport(data.feedback);

        } catch (error) {
            console.error(error);
            alert('코칭 중 오류 발생: ' + error.message);
        } finally {
            coachLoading.classList.add('hidden');
        }
    });

    function renderCoachingReport(feedback) {
        document.getElementById('coach-score').textContent = feedback.score || 0;
        
        const praiseUl = document.getElementById('coach-praise');
        praiseUl.innerHTML = '';
        if (feedback.praise) {
            feedback.praise.forEach(p => praiseUl.innerHTML += `<li>✅ ${p}</li>`);
        }

        const impUl = document.getElementById('coach-improvements');
        impUl.innerHTML = '';
        if (feedback.improvements) {
            feedback.improvements.forEach(imp => {
                impUl.innerHTML += `
                    <li style="margin-bottom: 20px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 15px;">
                        <div style="font-weight: bold; color: #f87171; margin-bottom: 8px;">❌ [아쉬운 점]  ${imp.issue}</div>
                        <div style="background: rgba(30, 41, 59, 0.8); padding: 12px; border-left: 4px solid #60a5fa; border-radius: 4px;">
                            <strong style="color: #60a5fa; display: block; margin-bottom: 5px;">✍️ 구체적 수정 제안:</strong>
                            ${imp.suggestion.replace(/\n/g, '<br>')}
                        </div>
                    </li>`;
            });
        }

        const titleUl = document.getElementById('coach-titles');
        titleUl.innerHTML = '';
        if (feedback.suggestedTitles) {
            feedback.suggestedTitles.forEach(t => titleUl.innerHTML += `<li>✨ ${t}</li>`);
        }

        coachResult.classList.remove('hidden');
    }
});
