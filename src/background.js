const REMOTE_CONFIG_URL = "https://gist.githubusercontent.com/ckaanf/0b4dc45cd2a73c4f0135500ee0c8ed38/raw/maple_scouter_config.json";

chrome.runtime.onInstalled.addListener(() => {
    fetchRemoteConfig();
    chrome.alarms.create("updateConfig", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updateConfig") {
        fetchRemoteConfig();
    }
});

async function fetchRemoteConfig() {
    try {
        const cacheBusterUrl = `${REMOTE_CONFIG_URL}?t=${Date.now()}`;
        const res = await fetch(cacheBusterUrl);
        const data = await res.json();
        chrome.storage.local.set({ remoteConfig: data });
    } catch (e) {
        console.warn("원격 설정 동기화 실패", e);
    }
}



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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'OPEN_AND_INJECT') {
        const { url, items, folderName, mode } = message;

        (async () => {
            try {
                const newTab = await chrome.tabs.create({ url: url, active: true });

                await waitForTabToComplete(newTab.id);
                await new Promise(resolve => setTimeout(resolve, 1200));
                await chrome.scripting.executeScript({
                    target: { tabId: newTab.id },
                    func: (itemsToOverwrite, fName, runMode) => {
                        try {
                            if (runMode === 'SWAP') {
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

        return false;
    }
});