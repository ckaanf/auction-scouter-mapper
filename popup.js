/**
 * 숫자로 구성된 가격을 "X조 Y억 Z만 W" 메소 형태로 깔끔하게 변환합니다.
 * @param {number|string} rawPrice - 경매장 아이템 가격 데이터 (예: 4235234325632)
 * @returns {string} 포맷팅된 가격 문자열
 */
function formatPrice(rawPrice) {
    const price = Number(rawPrice);
    if (!price || isNaN(price)) return "가격 정보 없음";

    // 각 단위별 금액 산출
    const jo = Math.floor(price / 1000000000000);
    const eok = Math.floor((price % 1000000000000) / 100000000);
    const man = Math.floor((price % 100000000) / 10000);
    const rest = price % 10000;

    let result = [];
    if (jo > 0) result.push(`${jo}조`);
    if (eok > 0) result.push(`${eok}억`);
    if (man > 0) result.push(`${man}만`);
    if (rest > 0 || result.length === 0) result.push(`${rest}`);

    return result.join(' ') + ' 메소';
}

// 아이템 목록 제어
document.addEventListener('DOMContentLoaded', () => {
    const itemList = document.getElementById('itemList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const exportBtn = document.getElementById('exportBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    let auctionItems = [];
    
    function loadData() {
        chrome.storage.local.get(['auctionWishlist'], (result) => {
            if (result.auctionWishlist && result.auctionWishlist.items && result.auctionWishlist.items.length > 0) {
                auctionItems = result.auctionWishlist.items;
                renderItems();
                selectAllCheckbox.disabled = false;
                exportBtn.disabled = false;
            } else {
                auctionItems = [];
                itemList.innerHTML = '<div class="empty-msg">저장된 찜 목록이 없습니다.<br>메이플 경매장 찜 목록 페이지를 방문해주세요.</div>';
                selectAllCheckbox.disabled = true;
                exportBtn.disabled = true;
            }
        });
    }

    function renderItems() {
        itemList.innerHTML = '';
        auctionItems.forEach((item, index) => {
            // 마감 및 찜 해제 여부 검사
            const isClosed = item.isClosed === true;
            const isUnwished = item.isUnwished === true;

            const div = document.createElement('div');
            div.className = 'item';
            if (isUnwished) div.classList.add('unwished');
            if (isClosed) div.classList.add('closed'); // 마감 스타일 적용 (반투명화)

            // [기획 수정] 마감 상품이어도 선택해서 환산기에 넣어볼 수 있도록 disabled 제거
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.value = index;

            const img = document.createElement('img');
            img.src = item.itemIcon?.fallBackUrl || "";

            const infoDiv = document.createElement('div');
            infoDiv.className = 'item-info';

            // 아이템 이름
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = item.toolTip?.itemName || "이름 없는 아이템";
            infoDiv.appendChild(nameSpan);

            // 아이템 가격 (Format 적용)
            const priceSpan = document.createElement('span');
            priceSpan.className = 'item-price';
            priceSpan.textContent = formatPrice(item.price);
            infoDiv.appendChild(priceSpan);

            // 해시태그형 상태 배지 배치 컨테이너
            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'badge-container';

            if (isUnwished) {
                const unwishedBadge = document.createElement('span');
                unwishedBadge.className = 'status-badge unwished-badge';
                unwishedBadge.textContent = '#찜해제';
                badgeContainer.appendChild(unwishedBadge);
            }

            if (isClosed) {
                const closedBadge = document.createElement('span');
                closedBadge.className = 'status-badge closed-badge';
                closedBadge.textContent = '#판매종료';
                badgeContainer.appendChild(closedBadge);
            }

            if (isUnwished || isClosed) {
                infoDiv.appendChild(badgeContainer);
            }

            // 개별 삭제 버튼
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '삭제';
            deleteBtn.onclick = () => deleteItem(item.tradeSn);

            div.appendChild(checkbox);
            div.appendChild(img);
            div.appendChild(infoDiv);
            div.appendChild(deleteBtn);
            itemList.appendChild(div);
        });
    }

    function deleteItem(targetTradeSn) {
        const updatedItems = auctionItems.filter(item => item.tradeSn !== targetTradeSn);
        chrome.storage.local.set({ auctionWishlist: { items: updatedItems } }, () => {
            loadData();
        });
    }

    clearAllBtn.addEventListener('click', () => {
        if (confirm('보관소의 모든 목록을 삭제하시겠습니까?')) {
            chrome.storage.local.set({ auctionWishlist: { items: [] } }, () => {
                loadData();
            });
        }
    });

    // [기획 수정] 마감 상품 여부와 관계없이 모든 체크박스를 동기화
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    exportBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.item-checkbox:checked');
        const selectedItems = Array.from(checkboxes).map(cb => auctionItems[cb.value]);

        if (selectedItems.length === 0) {
            alert('추가할 아이템을 먼저 선택해주세요.');
            return;
        }

        // 별도 파일(mapper.js)에 선언된 mapToCalcFormat을 바로 사용
        const mappedData = selectedItems.map(mapToCalcFormat);
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (itemsToInject) => {
                try {
                    let existingData = localStorage.getItem('equipBookmarkList');
                    let parsedData = existingData ? JSON.parse(existingData) : { state: { bookmarkList: [] }, version: 0 };

                    if (!parsedData.state) parsedData.state = {};
                    if (!Array.isArray(parsedData.state.bookmarkList)) parsedData.state.bookmarkList = [];

                    // 새로운 아이템들을 기존 리스트에 추가
                    parsedData.state.bookmarkList.push(...itemsToInject);

                    // 1. 아이템 객체의 최상위 28개 키 순서 정의 (분석.json과 100% 일치)
                    const exactOrder = [
                        "slot", "part", "name", "iconUrl", "starforce", "starforce_scroll_flag", "scroll_upgrade",
                        "totalOption", "baseOption", "addOption", "etcOption", "starforceOption",
                        "potential_grade", "potential_option_1", "additional_potential_grade", "additional_potential_option_1",
                        "exceptionalOption", "hasExceptional", "soul_name", "soul_option", "ring_level", "itemScore",
                        "character_name", "class_group", "cuttable_count", "title", "bookMark", "isEquipped"
                    ];

                    // 2. 내부 옵션 객체의 19개 스탯 키 순서 정의
                    const statOrder = [
                        "str", "dex", "int", "luk", "max_hp", "max_mp",
                        "attack_power", "magic_power", "armor", "speed",
                        "jump", "damage", "boss_damage", "ignore_monster_armor",
                        "all_stat", "max_hp_rate", "max_mp_rate",
                        "base_equipment_level", "equipment_level_decrease"
                    ];

                    // 3. 재귀적으로 객체를 우리가 원하는 순서의 '새로운 객체'로 복사하는 함수
                    const sortObjectKeys = (obj) => {
                        if (obj === null || typeof obj !== 'object') {
                            return obj;
                        }

                        // 배열인 경우 내부 요소들만 재귀적으로 처리
                        if (Array.isArray(obj)) {
                            return obj.map(sortObjectKeys);
                        }

                        const sortedObj = {};

                        // 아이템 객체인 경우 (exactOrder에 지정된 키들을 우선 순서대로 조립)
                        if (obj.hasOwnProperty('slot') && obj.hasOwnProperty('name')) {
                            exactOrder.forEach(key => {
                                if (obj.hasOwnProperty(key)) {
                                    sortedObj[key] = sortObjectKeys(obj[key]);
                                }
                            });
                            // 혹시 exactOrder에 누락된 키가 있다면 마지막에 병합
                            Object.keys(obj).forEach(key => {
                                if (!exactOrder.includes(key)) {
                                    sortedObj[key] = sortObjectKeys(obj[key]);
                                }
                            });
                            return sortedObj;
                        }

                        // 스탯 옵션 객체인 경우 (totalOption, baseOption 등)
                        if (obj.hasOwnProperty('str') && obj.hasOwnProperty('luk')) {
                            statOrder.forEach(key => {
                                if (obj.hasOwnProperty(key)) {
                                    sortedObj[key] = sortObjectKeys(obj[key]);
                                }
                            });
                            // 혹시 statOrder에 누락된 키가 있다면 마지막에 병합 (예: base_equipment_level 등)
                            Object.keys(obj).forEach(key => {
                                if (!statOrder.includes(key)) {
                                    sortedObj[key] = sortObjectKeys(obj[key]);
                                }
                            });
                            return sortedObj;
                        }

                        // 일반 객체인 경우 (예: state, version 등) 원래 키 순서대로 처리
                        Object.keys(obj).forEach(key => {
                            sortedObj[key] = sortObjectKeys(obj[key]);
                        });

                        return sortedObj;
                    };

                    // 4. 전체 parsedData 구조를 위 규칙에 맞춰 물리적으로 재조립
                    const orderedRoot = {
                        state: {
                            bookmarkList: sortObjectKeys(parsedData.state.bookmarkList)
                        },
                        version: parsedData.version ?? 0
                    };

                    // 정렬되어 직렬화된 문자열을 생성
                    const finalJsonString = JSON.stringify(orderedRoot);

                    // 완벽한 순서가 보장된 상태로 localStorage에 저장
                    localStorage.setItem('equipBookmarkList', finalJsonString);

                    alert('성공적으로 환산 아이템메이커에 추가되었습니다.');
                    location.reload();

                } catch (e) {
                    alert('데이터 주입 중 오류가 발생했습니다: ' + e.message);
                }
            },
            args: [mappedData]
        });
    });

    loadData();
});