// ==========================================
// [Section 1] 이벤트 감지 및 바인딩
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['scouterConfig', 'lastSpecResult'], (res) => {
        // 1. 설정값 복구 (기존 로직 유지)
        if (res.scouterConfig) {
            const cfg = res.scouterConfig;
            if (document.getElementById('targetFdInput')) document.getElementById('targetFdInput').value = cfg.targetFd;
            if (document.getElementById('untradeWeightInput')) document.getElementById('untradeWeightInput').value = cfg.untradeWeight;
            if (document.getElementById('fragmentPriceInput')) document.getElementById('fragmentPriceInput').value = cfg.fragmentPriceMan;
            if (document.getElementById('flamePriceInput')) document.getElementById('flamePriceInput').value = cfg.flamePriceMan;
            updateCurrentDisplay(cfg);
        }

        // 2. 이전 계산 결과 복구 (캐싱)
        if (res.lastSpecResult) {
            if (typeof renderAnalysisUI === 'function') {
                const container = document.getElementById('scouterResultContainer');
                renderAnalysisUI(res.lastSpecResult, container);
            }
        }
    });
});


document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'specOrderBtn') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentUrl = tabs[0].url || "";

            if (!currentUrl.includes("maplescouter.com") || !currentUrl.includes("spec-order")) {
                alert("이 기능은 메이플스토리 환산기 사이트의 [스펙업 순서] 페이지에서만 사용할 수 있습니다.\n\n먼저 해당 페이지로 이동 후 다시 시도해주세요!");
                return;
            }

            runSpecOrderAnalysis();
        });
    }
});

function updateCurrentDisplay(cfg) {
    const fdEl = document.getElementById('targetFdCurrent');
    const weightEl = document.getElementById('untradeWeightCurrent');
    const fragEl = document.getElementById('fragmentPriceCurrent');
    const flameEl = document.getElementById('flamePriceCurrent');

    if (fdEl) fdEl.innerText = `현재 적용 : ${cfg.targetFd} %`;
    if (weightEl) weightEl.innerText = `현재 가중치 : ${cfg.untradeWeight} 배`;
    if (fragEl) fragEl.innerText = `현재 가격 : ${cfg.fragmentPriceMan.toLocaleString()} 만`;
    if (flameEl) flameEl.innerText = `현재 가격 : ${cfg.flamePriceMan.toLocaleString()} 만`;
}

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
// [Section 3] 핵심 스펙업 데이터 처리 (추옵 기댓값만 마스킹 & 전체 일관 정렬)
// ==========================================
function processSpecOrder(characterApi, data, rawBookMark, config) {
    try {
        let allItems = [];
        const { targetFd, untradeWeight, fragmentPriceEok, flamePriceEok } = config;

        // A. 일반 장비 파싱 (교불 _no 키 자동 판별 및 가중치 적용)
        const commonKeys = [
            'star_result', 'star_result_no',
            'poten_result', 'poten_result_no',
            'upgrade_result', 'upgrade_result_no',
            'addOption_result', 'addOption_result_no'
        ];

        commonKeys.forEach(key => {
            if (data[key] && Array.isArray(data[key])) {
                let cat = '장비';
                if (key.startsWith('star')) cat = '스타포스';
                else if (key.startsWith('poten')) cat = '잠재능력';
                else if (key.startsWith('upgrade')) cat = '주문서/작';
                else if (key.startsWith('addOption')) cat = '추가옵션';

                const isNoTrade = key.endsWith('_no');

                data[key].forEach(item => {
                    const originalCost = Number(item[2]) || 0; // 원본 기댓값
                    const eff1B = Number(item[3]) || 0;        // 1억당 원본 효율

                    const weight = isNoTrade ? untradeWeight : 1.0;
                    const adjustedCost = originalCost * weight;         // 교불이면 비용 상승
                    const eff100B = (eff1B / weight) * 100;             // 교불이면 100억당 효율 하락
                    const actualIncrease = eff1B * originalCost;        // 스펙상 상승하는 최종뎀은 불변

                    let displayCost = adjustedCost;
                    if (cat === '추가옵션') {
                        displayCost = "검증 중";
                    }

                    allItems.push({
                        category: cat,
                        name: item[0],
                        cost: displayCost,
                        eff100B: eff100B,              // 교불 가중치가 타서 정확해진 정렬용 효율 점수
                        actualIncrease: actualIncrease,
                        img: item[4] || ""
                    });
                });
            }
        });

        // B. 심볼 파싱
        if (data.symbol_result && Array.isArray(data.symbol_result)) {
            data.symbol_result.forEach(item => {
                const originalCost = Number(item[2]) || 0;
                const eff1B = Number(item[3]) || 0;
                const actualIncrease = eff1B * originalCost;

                const adjustedCost = originalCost * untradeWeight;
                const eff100B = (eff1B / untradeWeight) * 100;

                allItems.push({
                    category: '심볼',
                    name: `[심볼] ${item[0]} ${item[1]}레벨`,
                    cost: adjustedCost,
                    eff100B: eff100B,
                    actualIncrease: actualIncrease,
                    img: item[4] || ""
                });
            });
        }

        // C. 헥사 코어 파싱
        if (data.class_hexa && Array.isArray(data.class_hexa)) {
            data.class_hexa.forEach(hexaItem => {
                const skillName = hexaItem[0];
                const targetLevel = Number(hexaItem[1]) || 0;
                const levelInfo = hexaItem[10] || `${targetLevel - 1}→${targetLevel}`;

                const scoreItem7 = Number(hexaItem[7]) || 0;
                const fragmentCount = Number(hexaItem[4]) || 0;

                const adjustedCost = fragmentCount * fragmentPriceEok * untradeWeight;
                const actualIncrease = scoreItem7 * (fragmentCount / 30);
                const eff100B = adjustedCost > 0 ? (actualIncrease / adjustedCost) * 100 : 0;

                allItems.push({
                    category: '헥사',
                    name: `[헥사] ${skillName} (${levelInfo})`,
                    cost: adjustedCost,
                    eff100B: eff100B,
                    actualIncrease: actualIncrease,
                    img: `https://maplescouter.com//${hexaItem[2]}` || ""
                });
            });
        }

        // D. 📌 북마크 파싱 (캐릭터 검증 포함)
        const characterName = characterApi?.state?.searchResult?.userApiData?.info?.character_name || "Unknown";
        try {
            if (rawBookMark) {
                const localData = JSON.parse(rawBookMark);
                if (localData && localData.state && Array.isArray(localData.state.simulBookmarkList)) {
                    localData.state.simulBookmarkList.forEach(bookmark => {
                        const bookmarkCharacterName = bookmark.character || "Unknown";
                        const weight = bookmark.noTrade ? untradeWeight : 1.0;
                        const finalCost = Number(bookmark.cost) * weight || 0;
                        const actualIncrease = Number(bookmark.eff) || 0;

                        if (bookmarkCharacterName === characterName) {
                            allItems.push({
                                category: '북마크',
                                name: `[북마크] ${bookmark.name}`,
                                cost: 0,
                                eff100B: 0,
                                actualIncrease: actualIncrease,
                                img: bookmark.img || ""
                            });
                        }
                    });
                }
            }
        } catch (lmError) { }

        // E. 100억당 효율 기준 정렬 (A, B, C, D 카테고리 전체가 eff100B 숫자 필드로 완벽하게 정렬됨)
        allItems.sort((a, b) => b.eff100B - a.eff100B);

        // F. 목표 도달 계산 (복리 누적)
        let currentFdMultiplier = 1;
        let accumulatedCost = 0;
        const selectedItemsIncludingBookmark = [];

        for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i];
            selectedItemsIncludingBookmark.push(item);
            currentFdMultiplier *= (1 + (item.actualIncrease / 100));

            const itemCostNum = typeof item.cost === 'number' ? item.cost : 0;
            accumulatedCost += itemCostNum;

            const currentTotalFdPercent = (currentFdMultiplier - 1) * 100;
            if (currentTotalFdPercent >= targetFd) break;
        }

        const totalAchievedFd = (currentFdMultiplier - 1) * 100;
        const selectedItems = selectedItemsIncludingBookmark.filter(item => item.category !== '북마크');

        // G. 병합 및 그룹화
        const mergedSummaryList = mergeSelectedItems(selectedItems);
        const groupedCategory = {};

        mergedSummaryList.forEach(item => {
            if (!groupedCategory[item.category]) groupedCategory[item.category] = [];
            groupedCategory[item.category].push(item);
        });

        const statTime = new Date().toISOString();
        return { config, totalAchievedFd, accumulatedCost, selectedItems, mergedSummaryList, groupedCategory, allItems, statTime };
    } catch (error) {
        console.error("❌ processSpecOrder 에러:", error.message);
        return null;
    }
}


// ==========================================
// [Section 4] 분석 실행 및 아코디언 UI 렌더링
// ==========================================
function runSpecOrderAnalysis() {
    let fragmentPriceMan = parseFloat(document.getElementById('fragmentPriceInput')?.value) || 700;
    let flamePriceMan = parseFloat(document.getElementById('flamePriceInput')?.value) || 300;

    if (fragmentPriceMan >= 10000) fragmentPriceMan = fragmentPriceMan / 10000;
    if (flamePriceMan >= 10000) flamePriceMan = flamePriceMan / 10000;

    const config = {
        targetFd: parseFloat(document.getElementById('targetFdInput')?.value) || 30,
        untradeWeight: parseFloat(document.getElementById('untradeWeightInput')?.value) || 1.5,
        fragmentPriceMan: fragmentPriceMan,
        flamePriceMan: flamePriceMan,
        fragmentPriceEok: fragmentPriceMan / 10000,
        flamePriceEok: flamePriceMan / 10000
    };

    updateCurrentDisplay(config);
    chrome.storage.local.set({ scouterConfig: config });

    // 🔥 북마크 데이터(rawBookmarkData)도 함께 불러옵니다.
    chrome.storage.local.get(['characterApiData', 'specOrderData', 'rawBookmarkData'], (result) => {
        const characterApi = result.characterApiData;
        const data = result.specOrderData;
        const rawBookMark = result.rawBookmarkData;
        const container = document.getElementById('scouterResultContainer');

        if (!data) {
            if (container) container.innerHTML = `<div style="color:#d4380d; text-align:center; padding:20px; font-weight:bold;">⚠️ 환산기 사이트에서<br>[스펙업 순서]를 먼저 갱신(검색)해주세요!</div>`;
            return;
        }

        if (container) container.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">🔄 커스텀 설정을 반영하여 분석 중입니다...</div>`;

        // 북마크 데이터 포함하여 위치 계산
        const analysisResult = processSpecOrder(characterApi, data, rawBookMark, config);
        if (analysisResult && container) {
            analysisResult.calculatedAt = new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            renderAnalysisUI(analysisResult, container);

            chrome.storage.local.set({ lastSpecResult: analysisResult }, () => {
            });

            const selectedCount = analysisResult.selectedItems.length;

            const highlightNames = selectedCount > 0
                ? [analysisResult.selectedItems[selectedCount - 1].name]
                : [];

            chrome.tabs.query(
                {
                    active: true,
                    currentWindow: true
                },
                (tabs) => {

                    const activeTab = tabs[0];

                    if (!activeTab?.id) {
                        console.error(
                            "[MapleScouter] 활성 탭이 없습니다."
                        );
                        return;
                    }

                    if (
                        !activeTab.url ||
                        !activeTab.url.includes("maplescouter.com")
                    ) {
                        console.error(
                            "[MapleScouter] Maplescouter 탭이 아닙니다:",
                            activeTab.url
                        );
                        return;
                    }

                    chrome.tabs.sendMessage(
                        activeTab.id,
                        {
                            type: "MAPLESCOUTER_HIGHLIGHT_NAMES",
                            highlightNames: highlightNames
                        },
                        (response) => {

                            if (chrome.runtime.lastError) {
                                console.error(
                                    "[MapleScouter] 메시지 전송 실패:",
                                    chrome.runtime.lastError.message
                                );
                                return;
                            }
                        }
                    );
                }
            );

        } else if (container) {
            container.innerHTML = `<div style="color:red; text-align:center;">❌ 분석 중 오류가 발생했습니다.</div>`;
        }
    });
}

function renderAnalysisUI(res, container) {
    let html = `
        <div style="background: #fff8ec; border: 1px solid #ffd591; padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: bold; color: #d46b08; margin-bottom: 5px;">📈 스펙업 최단 경로 요약</div>
            <div style="font-size: 11px; color: #8c8c8c; margin-bottom: 8px;">🕒 분석 일시: ${res.calculatedAt || new Date().toLocaleString('ko-KR')}</div>        
        </div>
            <div>총 필요 기댓값: <b style="color: #cf1322;">약 ${res.accumulatedCost.toFixed(2)}억 메소</b></div>
            <div>예상 최종뎀 상승: <b style="color: #389e0d;">+${res.totalAchievedFd.toFixed(3)}%</b> (목표: ${res.config.targetFd}%)</div>
        </div>
        
        <div style="display: flex; gap: 4px; margin-bottom: 10px;">
            <button id="viewSummaryBtn" style="flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; cursor: pointer;">📂 카테고리별 요약</button>
            <button id="viewDetailBtn" style="flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #d9d9d9; background: #fff; color: #666; border-radius: 4px; cursor: pointer;">📌 상세 진행 순서 (${res.selectedItems.length}단계)</button>
        </div>

        <div id="viewSummaryArea">
    `;

    const categoryOrder = ['스타포스', '심볼', '헥사', '잠재능력', '주문서/작', '추가옵션', '장비', '기타'];

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
                const costDisplay = typeof item.cost === 'number' ? `${item.cost.toFixed(2)}억` : item.cost;
                html += `
                    <div style="display: flex; align-items: center; background: #ffffff; border: 1px solid #e8e8e8; border-radius: 6px; padding: 7px 9px; margin-bottom: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        ${imgTag}
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: bold; color: #333; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;">
                                ${item.name}${stepBadge}
                            </div>
                            <div style="font-size: 11px; color: #777; display: flex; justify-content: space-between;">
                                <span>기댓값: <b style="color:#fa8c16;">${costDisplay}</b></span>
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

    html += `</div>`; // View 1 종료

    // 💡 View 2: 상세 1단계별 순서 리스트
    html += `<div id="viewDetailArea" style="display: none;">`;
    res.selectedItems.forEach((item, idx) => {
        const imgTag = item.img
            ? `<img src="${item.img}" style="width: 24px; height: 24px; object-fit: contain; margin-right: 8px; border-radius: 3px;">`
            : `<div style="width: 24px; height: 24px; background: #f0f0f0; border-radius: 3px; margin-right: 8px; display:inline-flex; align-items:center; justify-content:center; font-size:10px;">${idx + 1}</div>`;

            const costDisplay = typeof item.cost === 'number' ? `${item.cost.toFixed(2)}억` : item.cost;
        html += `
            <div style="display: flex; align-items: center; background: #fff; border: 1px solid #eee; border-radius: 5px; padding: 6px 8px; margin-bottom: 5px;">
                <span style="font-size: 11px; font-weight: bold; color: #888; width: 22px;">#${idx + 1}</span>
                ${imgTag}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-weight: 500; font-size: 11px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 10px; color: #888; margin-top: 1px;">
                        기댓값: <b style="color:#fa8c16;">${costDisplay}</b> | 상승: <b style="color:#52c41a;">+${item.actualIncrease.toFixed(3)}%</b>
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`; // View 2 종료

    container.innerHTML = html;

    // 💡 탭 토글 스크립트 이벤트 바인딩
    document.getElementById('viewSummaryBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; cursor: pointer;";
    document.getElementById('viewDetailBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #d9d9d9; background: #fff; color: #666; border-radius: 4px; cursor: pointer;";

    document.getElementById('viewSummaryBtn').addEventListener('click', () => {
        document.getElementById('viewSummaryArea').style.display = 'block';
        document.getElementById('viewDetailArea').style.display = 'none';

        document.getElementById('viewSummaryBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; cursor: pointer;";
        document.getElementById('viewDetailBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #d9d9d9; background: #fff; color: #666; border-radius: 4px; cursor: pointer;";
    });

    document.getElementById('viewDetailBtn').addEventListener('click', () => {
        document.getElementById('viewSummaryArea').style.display = 'none';
        document.getElementById('viewDetailArea').style.display = 'block';

        document.getElementById('viewDetailBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #1890ff; background: #e6f7ff; color: #1890ff; border-radius: 4px; cursor: pointer;";
        document.getElementById('viewSummaryBtn').style.cssText = "flex: 1; padding: 6px; font-size: 11px; font-weight: bold; border: 1px solid #d9d9d9; background: #fff; color: #666; border-radius: 4px; cursor: pointer;";
    });
}