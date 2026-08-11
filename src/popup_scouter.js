// ==========================================
// [Section 1] 이벤트 감지 및 바인딩
// ==========================================
// DOM 로드 타이밍 문제 방지를 위해 문서 전체에서 클릭을 감지합니다.
document.addEventListener('click', (e) => {
    // 분석 실행 버튼 클릭 감지
    if (e.target && e.target.id === 'specOrderBtn') {
        console.log("🖱️ [Scouter] 분석 버튼 클릭 감지됨!");
        runSpecOrderAnalysis();
    }
});


// ==========================================
// [Section 2] 동일 아이템/스킬 단계 병합 (Helper)
// ==========================================
function mergeSelectedItems(selectedItems) {
    const map = new Map();

    selectedItems.forEach(item => {
        let key = item.name;
        let category = item.category || '기타';
        let baseName = item.name;
        let fromLevel = null, toLevel = null;
        let formatType = 'single';
        let img = item.img || '';

        // 1. 스타포스 파싱
        const starMatch = item.name.match(/^스타포스\((.+) (\d+)>(.+)\)$/);
        if (starMatch) {
            category = '스타포스'; baseName = starMatch[1].trim();
            fromLevel = parseInt(starMatch[2], 10); toLevel = parseInt(starMatch[3], 10);
            key = `STARFORCE_${baseName}`; formatType = 'starforce';
        } 
        // 2. 헥사 코어 파싱
        else if (item.name.startsWith('[헥사]')) {
            const hexaMatch = item.name.match(/^\[헥사\] (.+) \((\d+)→(\d+)\)$/);
            if (hexaMatch) {
                category = '헥사'; baseName = hexaMatch[1].trim();
                fromLevel = parseInt(hexaMatch[2], 10); toLevel = parseInt(hexaMatch[3], 10);
                key = `HEXA_${baseName}`; formatType = 'hexa';
            }
        } 
        // 3. 심볼 파싱
        else if (item.name.startsWith('[심볼]')) {
            const symbolMatch = item.name.match(/^\[심볼\] (.+) (\d+)레벨$/);
            if (symbolMatch) {
                category = '심볼'; baseName = symbolMatch[1].trim();
                toLevel = parseInt(symbolMatch[2], 10); fromLevel = toLevel - 1;
                key = `SYMBOL_${baseName}`; formatType = 'symbol';
            }
        } 
        // 4. 기타 카테고리 분류
        else if (item.name.startsWith('윗잠') || item.name.startsWith('에디')) category = '잠재능력';
        else if (item.name.startsWith('작(')) category = '주문서/작';
        else if (item.name.startsWith('추옵(')) category = '추가옵션';
        else if (item.name.startsWith('[북마크]')) category = '북마크';

        // 그룹 누적 생성
        if (!map.has(key)) {
            map.set(key, { category, baseName, formatType, fromLevel, toLevel, totalCost: 0, fdMultiplier: 1, img, rawItems: [] });
        }

        const group = map.get(key);
        group.rawItems.push(item);
        group.totalCost += item.cost;
        group.fdMultiplier *= (1 + (item.actualIncrease / 100));
        if (!group.img && item.img) group.img = item.img; // 이미지 보정

        // 최소~최대 구간 갱신
        if (fromLevel !== null && (group.fromLevel === null || fromLevel < group.fromLevel)) group.fromLevel = fromLevel;
        if (toLevel !== null && (group.toLevel === null || toLevel > group.toLevel)) group.toLevel = toLevel;
    });

    const mergedResults = [];
    map.forEach(group => {
        const totalFdPercent = (group.fdMultiplier - 1) * 100;
        let mergedName = group.baseName;
        
        // 최종 표시 이름 포맷팅
        if (group.formatType === 'starforce') mergedName = `${group.baseName} (${group.fromLevel}>${group.toLevel}성)`;
        else if (group.formatType === 'hexa') mergedName = `${group.baseName} (${group.fromLevel}→${group.toLevel}레벨)`;
        else if (group.formatType === 'symbol') mergedName = group.rawItems.length === 1 ? `${group.baseName} ${group.toLevel}레벨` : `${group.baseName} (${group.fromLevel}→${group.toLevel}레벨)`;

        mergedResults.push({ 
            category: group.category, 
            name: mergedName, 
            cost: group.totalCost, 
            actualIncrease: totalFdPercent, 
            stepCount: group.rawItems.length, 
            img: group.img 
        });
    });
    return mergedResults;
}


// ==========================================
// [Section 3] 핵심 스펙업 데이터 처리 및 분석 로직
// ==========================================
function processSpecOrder(data, rawBookMark, targetFinalDamage = 30) {
    try {
        let allItems = [];

        // A. [일반 장비] 파싱
        const commonKeys = ['star_result', 'poten_result', 'upgrade_result', 'addOption_result', 'star_result_no'];
        commonKeys.forEach(key => {
            if (data[key] && Array.isArray(data[key])) {
                let cat = '장비';
                if (key.startsWith('star')) cat = '스타포스';
                else if (key.startsWith('poten')) cat = '잠재능력';
                else if (key.startsWith('upgrade')) cat = '주문서/작';
                else if (key.startsWith('addOption')) cat = '추가옵션';

                data[key].forEach(item => {
                    const cost = Number(item[2]) || 0;
                    const eff1B = Number(item[3]) || 0; 
                    allItems.push({ category: cat, name: item[0], cost: cost, eff100B: eff1B * 100, actualIncrease: eff1B * cost, img: item[4] || "" });
                });
            }
        });

        // B. [심볼] 파싱
        if (data.symbol_result && Array.isArray(data.symbol_result)) {
            data.symbol_result.forEach(item => {
                const cost = Number(item[2]) || 0;
                const eff1B = Number(item[3]) || 0;
                allItems.push({ category: '심볼', name: `[심볼] ${item[0]} ${item[1]}레벨`, cost: cost, eff100B: (eff1B / 1.5) * 100, actualIncrease: eff1B * cost, img: item[4] || "" });
            });
        }

        // C. [헥사 코어] 파싱
        if (data.class_hexa && Array.isArray(data.class_hexa)) {
            data.class_hexa.forEach(hexaItem => {
                const skillName = hexaItem[0];
                const levelInfo = hexaItem[10]; 
                
                // const targetLevel = parseInt(levelInfo.split('→')[1], 10);
                // const currentLevel = (data.now_hexa && data.now_hexa[skillName]) ? data.now_hexa[skillName] : 0;
                // if (targetLevel <= currentLevel) return;

                const scoreItem7 = Number(hexaItem[7]) || 0; 
                const fragmentCount = Number(hexaItem[4]) || 0; 
                
                const actualIncrease = scoreItem7 * (fragmentCount / 30);
                const expectedCost = fragmentCount * 0.07 * 1.5; 
                const eff100B = expectedCost > 0 ? (actualIncrease / expectedCost) * 100 : 0;
                allItems.push({ category: '헥사', name: `[헥사] ${skillName} (${levelInfo})`, cost: expectedCost, eff100B: eff100B, actualIncrease: actualIncrease, img:  `https://maplescouter.com//${hexaItem[2]}` || "" });
            });
        }

        // D. [북마크] 파싱 (필요 시 주석 해제하여 사용)
        try {
            if (rawBookMark) {
                const localData = JSON.parse(rawBookMark);
                if (localData && localData.state && Array.isArray(localData.state.simulBookmarkList)) {
                    localData.state.simulBookmarkList.forEach(bookmark => {
                        const weight = bookmark.noTrade ? 1.5 : 1.0;
                        const finalCost = Number(bookmark.cost) * weight || 0;
                        const eff100B = finalCost > 0 ? (Number(bookmark.eff) / finalCost) * 100 : 0;
                        
                        // 현재는 제외 상태 - 필요 시 아래 코드 주석 해제
                        /*
                        allItems.push({
                            category: '북마크',
                            name: `[북마크] ${bookmark.name}`,
                            cost: finalCost,
                            eff100B: eff100B,
                            actualIncrease: Number(bookmark.eff) || 0,
                            img: bookmark.img || ""
                        });
                        */
                    });
                }
            }
        } catch (lmError) {
            console.warn("⚠️ 북마크 파싱 실패:", lmError.message);
        }

        // E. 100억당 효율 기준 정렬
        allItems.sort((a, b) => b.eff100B - a.eff100B);

        // F. 목표 도달 계산 (최종뎀 복리 누적)
        let currentFdMultiplier = 1;
        let accumulatedCost = 0;
        const selectedItems = [];

        for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i];
            selectedItems.push(item);
            currentFdMultiplier *= (1 + (item.actualIncrease / 100));
            accumulatedCost += item.cost;

            const currentTotalFdPercent = (currentFdMultiplier - 1) * 100;
            if (currentTotalFdPercent >= targetFinalDamage) break; 
        }

        const totalAchievedFd = (currentFdMultiplier - 1) * 100;

        // G. 병합 및 카테고리별 그룹화
        const mergedSummaryList = mergeSelectedItems(selectedItems);
        const groupedCategory = {};
        
        mergedSummaryList.forEach(item => {
            if (!groupedCategory[item.category]) {
                groupedCategory[item.category] = [];
            }
            groupedCategory[item.category].push(item);
        });

        return { targetFinalDamage, totalAchievedFd, accumulatedCost, selectedItems, mergedSummaryList, groupedCategory, allItems };
    } catch (error) {
        console.error("❌ processSpecOrder 에러:", error.message);
        return null;
    }
}


// ==========================================
// [Section 4] 분석 실행 및 HTML UI 렌더링
// ==========================================
function runSpecOrderAnalysis() {
    // 1. 유저가 입력한 목표 수치 가져오기 (기본값 30)
    const targetInput = document.getElementById('targetFdInput');
    const targetFd = targetInput ? (parseFloat(targetInput.value) || 30) : 30;

    // 2. 스토리지에서 가로챈 데이터 가져오기
    chrome.storage.local.get(['specOrderData', 'rawBookmarkData'], (result) => {
        const data = result.specOrderData;
        const rawBookMark = result.rawBookmarkData;
        const container = document.getElementById('scouterResultContainer');
        
        // 데이터가 없으면 에러 메시지 렌더링
        if (!data) {
            console.warn("⚠️ 환산기 데이터 없음");
            if (container) container.innerHTML = `<div style="color:#d4380d; text-align:center; padding:20px; font-weight:bold;">⚠️ 환산기 사이트에서<br>[스펙업 순서]를 먼저 갱신(검색)해주세요!</div>`;
            return;
        }

        if (container) container.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">🔄 데이터를 분석 중입니다...</div>`;

        // 3. 분석 로직 실행
        const analysisResult = processSpecOrder(data, rawBookMark, targetFd);

        // 4. 결과를 화면(UI)에 예쁘게 그리기
        if (analysisResult && container) {
            renderAnalysisUI(analysisResult, container);
        } else if (container) {
            container.innerHTML = `<div style="color:red; text-align:center;">❌ 분석 중 오류가 발생했습니다.</div>`;
        }
    });
}

function renderAnalysisUI(res, container) {
    // 1. 요약 정보 박스
    let html = `
        <div style="background: #fff8ec; border: 1px solid #ffd591; padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;">
            <div style="font-weight: bold; color: #d46b08; margin-bottom: 5px;">📈 스펙업 최단 경로 요약</div>
            <div>총 필요 기댓값: <b style="color: #cf1322;">약 ${res.accumulatedCost.toFixed(2)}억 메소</b></div>
            <div>예상 최종뎀 상승: <b style="color: #389e0d;">+${res.totalAchievedFd.toFixed(3)}%</b> (목표: ${res.targetFinalDamage}%)</div>
        </div>
    `;

    const categoryOrder = ['스타포스', '심볼', '헥사', '잠재능력', '주문서/작', '추가옵션', '북마크', '장비', '기타'];

    // 2. 카테고리별 <details> 접이식 아코디언 생성
    categoryOrder.forEach(catName => {
        if (res.groupedCategory[catName] && res.groupedCategory[catName].length > 0) {
            const count = res.groupedCategory[catName].length;

            html += `
                <details open style="margin-bottom: 8px; border: 1px solid #e8e8e8; border-radius: 6px; background: #fafafa; overflow: hidden;">
                    <summary style="font-weight: bold; color: #333; font-size: 12px; padding: 8px 10px; cursor: pointer; user-select: none; background: #f5f5f5; outline: none; border-bottom: 1px solid #eee;">
                        📂 [${catName}] <span style="font-weight: normal; color: #888; font-size: 11px; margin-left: 4px;">(${count}개 항목)</span>
                    </summary>
                    <div style="padding: 6px 8px 2px 8px; background: #ffffff;">
            `;

            res.groupedCategory[catName].forEach(item => {
                const imgTag = item.img 
                    ? `<img src="${item.img}" style="width: 28px; height: 28px; object-fit: contain; margin-right: 10px; background: #fafafa; border-radius: 4px; border: 1px solid #eee;">` 
                    : `<div style="width: 28px; height: 28px; background: #f5f5f5; border: 1px solid #e8e8e8; border-radius: 4px; margin-right: 10px; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">💎</div>`;
                
                const stepBadge = item.stepCount > 1 ? ` <span style="background: #e6f7ff; color: #096dd9; padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 4px;">${item.stepCount}단계 합산</span>` : '';

                html += `
                    <div style="display: flex; align-items: center; background: #ffffff; border: 1px solid #e8e8e8; border-radius: 6px; padding: 7px 9px; margin-bottom: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        ${imgTag}
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: bold; color: #333; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;">
                                ${item.name}${stepBadge}
                            </div>
                            <div style="font-size: 11px; color: #777; display: flex; justify-content: space-between;">
                                <span>기댓값: <b style="color:#fa8c16;">${item.cost.toFixed(2)}억</b></span>
                                <span>최종뎀: <b style="color:#52c41a;">+${item.actualIncrease.toFixed(3)}%</b></span>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </details>
            `;
        }
    });

    container.innerHTML = html;
}