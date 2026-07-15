// 페이지 로딩 완료 대기 헬퍼 함수
function waitForTabToComplete(tabId) {
    return new Promise((resolve) => {
        const listener = (changeTabId, changeInfo) => {
            if (changeTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

// 팝업에서 보내는 비동기 주입 요청 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'OPEN_AND_INJECT') {
        const { url, items, folderName, mode } = message;

        (async () => {
            try {
                // 1. 새 탭을 즉시 전면에 활성화하여 개설
                const newTab = await chrome.tabs.create({ url: url, active: true });

                // 2. 백그라운드 서비스 워커가 새 탭의 로딩 완료를 대기
                await waitForTabToComplete(newTab.id);

                // 3. SPA 프레임워크 안정화를 위한 안전 대기 버퍼
                await new Promise(resolve => setTimeout(resolve, 1200));

                // 4. 새 탭 컨텍스트 내부로 주입 실행
                await chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    func: (itemsToOverwrite, fName, runMode) => {
                        try {
                            if (runMode === 'SWAP') {
                                // [수정] 기획하신 정확한 텍스트와 아이템 개수 연동
                                const confirmSwapOnSite = confirm(`'${fName}' 보관함의 아이템 세트(${itemsToOverwrite.length}개)로 환산 사이트 데이터를 교체(Swap)하시겠습니까?\n기존에 환산 사이트에 등록되어 있던 세트 목록은 덮어씌워집니다.`);
                                if (!confirmSwapOnSite) {
                                    alert('작업이 취소되었습니다. 환산 주스텟 - 아이템메이커 화면에서 직접 교체해 주세요.');
                                    return;
                                }
                            }

                            const exactOrder = [
                                "slot", "part", "name", "iconUrl", "starforce", "starforce_scroll_flag", "scroll_upgrade",
                                "totalOption", "baseOption", "addOption", "etcOption", "starforceOption",
                                "potential_grade", "potential_option_1", "additional_potential_grade", "additional_potential_option_1",
                                "exceptionalOption", "hasExceptional", "soul_name", "soul_option", "ring_level", "itemScore",
                                "character_name", "class_group", "cuttable_count", "title", "bookMark", "isEquipped"
                            ];

                            const statOrder = [
                                "str", "dex", "int", "luk", "max_hp", "max_mp",
                                "attack_power", "magic_power", "armor", "speed",
                                "jump", "damage", "boss_damage", "ignore_monster_armor",
                                "all_stat", "max_hp_rate", "max_mp_rate",
                                "base_equipment_level", "equipment_level_decrease"
                            ];

                            const sortObjectKeys = (obj) => {
                                if (obj === null || typeof obj !== 'object') return obj;
                                if (Array.isArray(obj)) return obj.map(sortObjectKeys);
                                const sortedObj = {};

                                if (obj.hasOwnProperty('slot') && obj.hasOwnProperty('name')) {
                                    exactOrder.forEach(key => {
                                        if (obj.hasOwnProperty(key)) sortedObj[key] = sortObjectKeys(obj[key]);
                                    });
                                    Object.keys(obj).forEach(key => {
                                        if (!exactOrder.includes(key)) sortedObj[key] = sortObjectKeys(obj[key]);
                                    });
                                    return sortedObj;
                                }

                                if (obj.hasOwnProperty('str') && obj.hasOwnProperty('luk')) {
                                    statOrder.forEach(key => {
                                        if (obj.hasOwnProperty(key)) sortedObj[key] = sortObjectKeys(obj[key]);
                                    });
                                    Object.keys(obj).forEach(key => {
                                        if (!statOrder.includes(key)) sortedObj[key] = sortObjectKeys(obj[key]);
                                    });
                                    return sortedObj;
                                }

                                Object.keys(obj).forEach(key => {
                                    sortedObj[key] = sortObjectKeys(obj[key]);
                                });
                                return sortedObj;
                            };

                            let existingData = localStorage.getItem('equipBookmarkList');
                            let parsedData = (runMode === 'EXPORT' && existingData) 
                                ? JSON.parse(existingData) 
                                : { state: { bookmarkList: [] }, version: 0 };

                            if (!parsedData.state) parsedData.state = {};
                            if (!Array.isArray(parsedData.state.bookmarkList)) parsedData.state.bookmarkList = [];

                            if (runMode === 'EXPORT') {
                                parsedData.state.bookmarkList.push(...itemsToOverwrite);
                            } else {
                                parsedData.state.bookmarkList = itemsToOverwrite;
                            }

                            const orderedRoot = {
                                state: {
                                    bookmarkList: sortObjectKeys(parsedData.state.bookmarkList)
                                },
                                version: parsedData.version ?? 0
                            };

                            localStorage.setItem('equipBookmarkList', JSON.stringify(orderedRoot));
                            alert(runMode === 'EXPORT' ? '성공적으로 환산 아이템메이커에 추가되었습니다.' : '성공적으로 선택한 캐릭터 보관함 세트로 동기화되었습니다.');
                            
                            // [해결] 리액트 라우터 충돌(Uncaught in promise false) 방지를 위해 약간의 딜레이 후 새로고침
                            setTimeout(() => {
                                location.reload();
                            }, 50);

                        } catch (e) {
                            alert('데이터 주입 중 오류가 발생했습니다: ' + e.message);
                        }
                    },
                    args: [items, folderName, mode]
                });
            } catch (err) {
                console.error('[Background] 비동기 처리 중 예외 발생:', err);
            }
        })();

        // [해결] 팝업창이 바로 닫힐 것이므로, 비동기 응답 대기를 뜻하는 return true를 삭제하고 
        // 즉시 채널을 안전하게 끊어 포트 유실 에러를 원천 예방합니다.
        return false; 
    }
});