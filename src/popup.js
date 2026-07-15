// =========================================
// [Section 1] 유틸리티 및 공통 함수
// =========================================
function formatPrice(rawPrice) {
    const price = Number(rawPrice);
    if (!price || isNaN(price)) return "가격 정보 없음";

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

function showModal(message, callback) {
    const modal = document.getElementById('charNameModal');
    const msg = document.getElementById('modalMessage');
    const input = document.getElementById('modalInput');
    const confirmBtn = document.getElementById('modalConfirmBtn');

    msg.textContent = message;
    modal.style.display = 'flex';
    input.focus();

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    };

    document.getElementById('modalConfirmBtn').onclick = () => {
        const val = input.value.trim();
        if (!val) {
            alert('캐릭터 이름을 입력해주세요!');
            return;
        }
        modal.style.display = 'none';
        input.value = '';
        callback(val);
    };

    document.getElementById('modalCancelBtn').onclick = () => {
        modal.style.display = 'none';
        input.value = '';
        callback(null);
    };

    document.getElementById('charNameModal').onclick = (e) => {
        if (e.target.id === 'charNameModal') {
            document.getElementById('charNameModal').style.display = 'none';
        }
    };
}
// 추후 개발 예정
async function verifyAndExport(charName, mappedData, mode) {
    try {
        // 1. 캐릭터 정보 API 조회
        const url = `https://api.maplescouter.com/api/id?name=${encodeURIComponent(charName)}&preset=00000&region=kms`;
        const response = await fetch(url);
        const data = await response.json();

        // API 결과 확인 (캐릭터 존재 여부)
        if (!data || data.error) {
            alert('캐릭터 정보를 찾을 수 없습니다. 이름을 다시 확인해주세요.');
            return;
        }

        // 2. 캐릭터 정보가 맞는지 최종 확인 모달 띄우기
        // (필요 시 기존 showModal을 재활용하거나 확인창용 모달 별도 구성)
        const confirmMsg = `조회된 캐릭터: ${data.name} (Lv.${data.level})\n이 캐릭터의 데이터로 이동할까요?`;

        if (confirm(confirmMsg)) {
            // 3. 기존 이동 로직 수행
            const targetUrl = `https://maplescouter.com/ko/item?name=${encodeURIComponent(data.name)}&preset=00000`;
            chrome.runtime.sendMessage({
                action: 'OPEN_AND_INJECT',
                url: targetUrl,
                items: mappedData,
                folderName: mode === 'SWAP' ? '데이터' : '',
                mode: mode
            });
            window.close();
        }
    } catch (e) {
        alert('캐릭터 조회 중 오류가 발생했습니다.');
    }
}

// =========================================
// [Section 2] 초기화 및 DOM 엘리먼트 바인딩
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // 탭 내비게이션
    const tabWishlist = document.getElementById('tabWishlist');
    const tabStorage = document.getElementById('tabStorage');
    const wishlistContent = document.getElementById('wishlistContent');
    const storageContent = document.getElementById('storageContent');

    // 보관함 탭 전용 엘리먼트
    const newFolderNameInput = document.getElementById('newFolderName');
    const createFolderBtn = document.getElementById('createFolderBtn');
    const folderList = document.getElementById('folderList');

    // 역방향 불러오기 관련 엘리먼트
    const myFromSiteBtn = document.getElementById('myFromSiteBtn');
    const importFromSiteBtn = document.getElementById('importFromSiteBtn');
    const importedListWrapper = document.getElementById('importedListWrapper');
    const importedItemsContainer = document.getElementById('importedItems');
    const targetFolderSelect = document.getElementById('targetFolderSelect');
    const submitImportBtn = document.getElementById('submitImportBtn');
    const selectAllImported = document.getElementById('selectAllImported'); // 전체 선택 엘리먼트 추가

    // 찜 목록 탭의 폴더 수납 컨트롤
    const wishlistTargetFolderSelect = document.getElementById('wishlistTargetFolderSelect');
    const wishlistToFolderBtn = document.getElementById('wishlistToFolderBtn');

    // 찜 목록 관리 엘리먼트
    const itemList = document.getElementById('itemList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const exportBtn = document.getElementById('exportBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    let auctionItems = [];
    let savedFolders = [];
    let importedItemsTemp = [];

    // =========================================
    // [Section 3] 상단 탭 내비게이션 전환 로직
    // =========================================
    tabWishlist.addEventListener('click', () => {
        tabWishlist.classList.add('active');
        tabStorage.classList.remove('active');
        wishlistContent.classList.add('active');
        storageContent.classList.remove('active');
        loadData();
    });

    tabStorage.addEventListener('click', () => {
        tabStorage.classList.add('active');
        tabWishlist.classList.remove('active');
        storageContent.classList.add('active');
        wishlistContent.classList.remove('active');
        loadFolders();
    });

    // =========================================
    // [Section 4] 데이터 통합 로드 및 찜 목록 렌더링
    // =========================================
    function loadData() {
        chrome.storage.local.get(['auctionWishlist', 'wishlistFolders'], (result) => {
            if (result.wishlistFolders && Array.isArray(result.wishlistFolders.folders)) {
                savedFolders = result.wishlistFolders.folders;
            } else {
                savedFolders = [];
            }
            updateFolderSelectOptions();

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
            const isClosed = item.isClosed === true;
            const isUnwished = item.isUnwished === true;

            const div = document.createElement('div');
            div.className = 'item';
            if (isUnwished) div.classList.add('unwished');
            if (isClosed) div.classList.add('closed');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.value = index;

            const img = document.createElement('img');
            img.src = item.itemIcon?.fallBackUrl || "";

            const infoDiv = document.createElement('div');
            infoDiv.className = 'item-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = item.toolTip?.itemName || "이름 없는 아이템";
            infoDiv.appendChild(nameSpan);

            const priceSpan = document.createElement('span');
            priceSpan.className = 'item-price';
            priceSpan.textContent = formatPrice(item.price);
            infoDiv.appendChild(priceSpan);

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

    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // =========================================
    // [Section 5] 보관함 폴더 렌더링 및 드롭다운 관리
    // =========================================
    function loadFolders() {
        chrome.storage.local.get(['wishlistFolders'], (result) => {
            if (result.wishlistFolders && Array.isArray(result.wishlistFolders.folders)) {
                savedFolders = result.wishlistFolders.folders;
            } else {
                savedFolders = [];
            }
            renderFolders();
            updateFolderSelectOptions();
        });
    }

    function renderFolders() {
        folderList.innerHTML = '';
        if (savedFolders.length === 0) {
            folderList.innerHTML = '<div class="empty-msg">생성된 보관함 폴더가 없습니다.<br>상단에서 새 캐릭터 폴더를 만들어보세요!</div>';
            return;
        }

        savedFolders.forEach(folder => {
            if (folder.isExpanded === undefined) {
                folder.isExpanded = false;
            }

            const card = document.createElement('div');
            card.className = 'folder-card';

            const header = document.createElement('div');
            header.className = 'folder-header';

            const title = document.createElement('span');
            title.className = 'folder-title';
            title.textContent = `${folder.isExpanded ? '📂' : '📁'} ${folder.name} (${folder.items.length}개)`;
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.style.gap = '6px';

            const actions = document.createElement('div');
            actions.className = 'folder-actions';

            const activeBtn = document.createElement('button');
            activeBtn.className = 'btn-mini btn-active';
            activeBtn.textContent = '활성화 (Swap)';
            activeBtn.onclick = (e) => {
                e.stopPropagation();
                swapFolderToCalc(folder.id);
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-mini btn-del';
            delBtn.textContent = '삭제';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
            };

            actions.appendChild(activeBtn);
            actions.appendChild(delBtn);
            header.appendChild(title);
            header.appendChild(actions);
            card.appendChild(header);

            header.addEventListener('click', () => {
                folder.isExpanded = !folder.isExpanded;
                renderFolders();
            });

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'folder-items';

            if (!folder.isExpanded) {
                itemsContainer.style.display = 'none';
            } else {
                itemsContainer.style.display = 'flex';
            }

            if (folder.items.length === 0) {
                itemsContainer.innerHTML = '<div class="empty-msg" style="font-size: 10px; padding: 10px 0;">폴더가 비어있습니다.</div>';
            } else {
                folder.items.forEach((item, itemIdx) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'folder-item';

                    const itemInfo = document.createElement('div');
                    itemInfo.className = 'folder-item-info';

                    const img = document.createElement('img');
                    img.src = item.iconUrl || "";

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = `[${item.slot}] ${item.name || "알 수 없는 장비"}`;

                    itemInfo.appendChild(img);
                    itemInfo.appendChild(nameSpan);

                    const itemDelBtn = document.createElement('button');
                    itemDelBtn.className = 'btn-mini btn-del';
                    itemDelBtn.textContent = '삭제';
                    itemDelBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteItemFromFolder(folder.id, itemIdx);
                    };

                    itemDiv.appendChild(itemInfo);
                    itemDiv.appendChild(itemDelBtn);
                    itemsContainer.appendChild(itemDiv);
                });
            }

            card.appendChild(itemsContainer);
            folderList.appendChild(card);
        });
    }

    function updateFolderSelectOptions() {
        const optionTemplate = `
            <option value="">-- 보관할 폴더 선택 --</option>
            <option value="NEW_FOLDER">🆕 [새 폴더 만들어 이동...]</option>
        `;

        targetFolderSelect.innerHTML = optionTemplate;
        wishlistTargetFolderSelect.innerHTML = optionTemplate;

        savedFolders.forEach(folder => {
            const opt1 = document.createElement('option');
            opt1.value = folder.id;
            opt1.textContent = `📁 ${folder.name}`;
            targetFolderSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = folder.id;
            opt2.textContent = `📁 ${folder.name}`;
            wishlistTargetFolderSelect.appendChild(opt2);
        });
    }

    // =========================================
    // [Section 6] 폴더 데이터 수정 제어 (추가/삭제)
    // =========================================
    createFolderBtn.addEventListener('click', () => {
        const folderName = newFolderNameInput.value.trim();
        if (!folderName) {
            alert('폴더 이름을 입력해 주세요.');
            return;
        }

        const newFolder = {
            id: `folder_${Date.now()}`,
            name: folderName,
            items: []
        };

        savedFolders.push(newFolder);
        chrome.storage.local.set({ wishlistFolders: { folders: savedFolders } }, () => {
            newFolderNameInput.value = '';
            loadFolders();
        });
    });

    function deleteFolder(folderId) {
        if (confirm('이 폴더와 포함된 모든 아이템을 보관함에서 영구 삭제하시겠습니까?')) {
            savedFolders = savedFolders.filter(f => f.id !== folderId);
            chrome.storage.local.set({ wishlistFolders: { folders: savedFolders } }, () => {
                loadFolders();
            });
        }
    }

    function deleteItemFromFolder(folderId, itemIndex) {
        savedFolders = savedFolders.map(f => {
            if (f.id === folderId) {
                f.items.splice(itemIndex, 1);
            }
            return f;
        });
        chrome.storage.local.set({ wishlistFolders: { folders: savedFolders } }, () => {
            loadFolders();
        });
    }

    // =========================================
    // [Section 7] 역방향 불러오기 (사이트 -> 익스텐션 보관함)
    // =========================================
    importFromSiteBtn.addEventListener('click', async () => {
        if (importedListWrapper.classList.contains('active')) {
            importedListWrapper.classList.remove('active');
            importedItemsTemp = [];
            importedItemsContainer.innerHTML = '';
            return;
        }

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes('maplescouter.com')) {
            alert('환산 사이트 장비 데이터를 가져오려면\n현재 탭이 메이플 환산기(maplescouter.com) 사이트여야 합니다.');
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const localData = localStorage.getItem('equipBookmarkList');
                    if (!localData) return [];
                    const parsed = JSON.parse(localData);
                    return parsed?.state?.bookmarkList || [];
                } catch (e) {
                    return [];
                }
            }
        }, (results) => {
            if (!results || !results[0] || !Array.isArray(results[0].result)) {
                alert('환산 사이트 장비 데이터를 가져오는 데 실패했습니다.');
                return;
            }

            const items = results[0].result;
            if (items.length === 0) {
                alert('환산기 사이트에 등록된 장비 세트가 없습니다.');
                return;
            }

            importedItemsTemp = items;
            renderImportedItems();
        });
    });

    myFromSiteBtn.addEventListener('click', async () => {
        if (importedListWrapper.classList.contains('active')) {
            importedListWrapper.classList.remove('active');
            importedItemsTemp = [];
            importedItemsContainer.innerHTML = '';
            return;
        }

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes('maplescouter.com')) {
            alert('환산 사이트 커스텀 장비를 가져오려면\n현재 탭이 메이플 환산기(maplescouter.com) 사이트여야 합니다.');
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const localData = localStorage.getItem('customEquipList');
                    if (!localData) return [];
                    const parsed = JSON.parse(localData);
                    return parsed?.state?.customEquipList || parsed?.state?.bookmarkList || (Array.isArray(parsed) ? parsed : []);
                } catch (e) {
                    return [];
                }
            }
        }, (results) => {
            if (!results || !results[0] || !Array.isArray(results[0].result)) {
                alert('환산 사이트 커스텀 장비 데이터를 가져오는 데 실패했습니다.');
                return;
            }

            let items = results[0].result;

            const VALID_SLOTS = [
                "반지", "반지1", "반지2", "반지3", "반지4",
                "펜던트", "펜던트1", "펜던트2",
                "무기", "보조무기", "포스실드", "엠블렘", "기계 심장",
                "벨트", "모자", "얼굴장식", "눈장식",
                "상의", "하의", "신발", "귀고리",
                "어깨장식", "장갑", "망토", "배지", "훈장"
            ];

            items = items.filter(item => VALID_SLOTS.includes(item.slot));

            if (items.length === 0) {
                alert('가져올 수 있는 유효한 커스텀 장비가 없습니다.');
                return;
            }

            importedItemsTemp = items;
            renderImportedItems();
        });
    });

    selectAllImported.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.imported-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    function renderImportedItems() {
        importedItemsContainer.innerHTML = '';
        selectAllImported.checked = true; // 리스트를 새로 열 때 기본으로 전체 선택 상태 체크

        importedItemsTemp.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'imported-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'imported-checkbox';
            checkbox.value = index;
            checkbox.checked = true;

            const img = document.createElement('img');
            img.src = item.iconUrl || "";

            const nameSpan = document.createElement('span');
            nameSpan.textContent = `[${item.slot}] ${item.name}`;

            div.appendChild(checkbox);
            div.appendChild(img);
            div.appendChild(nameSpan);
            importedItemsContainer.appendChild(div);
        });

        importedListWrapper.classList.add('active');
    }

    submitImportBtn.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('.imported-checkbox:checked');
        if (checkedBoxes.length === 0) {
            alert('이동할 아이템을 1개 이상 선택해 주세요.');
            return;
        }

        const selectedFolderId = targetFolderSelect.value;
        if (!selectedFolderId) {
            alert('아이템을 수납할 폴더를 지정해 주세요.');
            return;
        }

        const itemsToMove = Array.from(checkedBoxes).map(cb => importedItemsTemp[parseInt(cb.value, 10)]);

        if (selectedFolderId === 'NEW_FOLDER') {
            const newName = prompt('새로운 보관함 캐릭터 폴더 이름을 입력해 주세요:');
            if (!newName || !newName.trim()) {
                alert('폴더 이름이 입력되지 않아 작업을 취소합니다.');
                return;
            }

            const newFolder = {
                id: `folder_${Date.now()}`,
                name: newName.trim(),
                items: itemsToMove
            };

            savedFolders.push(newFolder);
        } else {
            savedFolders = savedFolders.map(f => {
                if (f.id === selectedFolderId) {
                    f.items.push(...itemsToMove);
                }
                return f;
            });
        }

        chrome.storage.local.set({ wishlistFolders: { folders: savedFolders } }, () => {
            alert(`성공적으로 ${itemsToMove.length}개의 장비가 보관함 폴더로 수납되었습니다.`);
            importedListWrapper.classList.remove('active');
            importedItemsTemp = [];
            loadFolders();
        });
    });

    // =========================================
    // [Section 8] 1번 탭 찜 목록 -> 보관함 폴더 수납
    // =========================================
    wishlistToFolderBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.item-checkbox:checked');
        const selectedItems = Array.from(checkboxes).map(cb => auctionItems[cb.value]);

        if (selectedItems.length === 0) {
            alert('보관할 아이템을 먼저 선택해주세요.');
            return;
        }

        const selectedFolderId = wishlistTargetFolderSelect.value;
        if (!selectedFolderId) {
            alert('아이템을 수납할 캐릭터 폴더를 선택해 주세요.');
            return;
        }

        const mappedData = selectedItems.map(mapToCalcFormat);

        if (selectedFolderId === 'NEW_FOLDER') {
            const newName = prompt('새로운 캐릭터 보관함 폴더 이름을 입력해 주세요:');
            if (!newName || !newName.trim()) {
                alert('폴더 이름이 입력되지 않아 작업을 취소합니다.');
                return;
            }

            const newFolder = {
                id: `folder_${Date.now()}`,
                name: newName.trim(),
                items: mappedData
            };

            savedFolders.push(newFolder);
        } else {
            savedFolders = savedFolders.map(f => {
                if (f.id === selectedFolderId) {
                    f.items.push(...mappedData);
                }
                return f;
            });
        }

        chrome.storage.local.set({ wishlistFolders: { folders: savedFolders } }, () => {
            alert(`선택한 ${mappedData.length}개의 장비가 보관함의 폴더로 보관되었습니다.`);
            checkboxes.forEach(cb => cb.checked = false);
            selectAllCheckbox.checked = false;
            loadData();
        });
    });

    // =========================================
    // [Section 9] 찜 목록 -> 환산 사이트로 바로 추가 (Export)
    // =========================================
    exportBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.item-checkbox:checked');
        const selectedItems = Array.from(checkboxes).map(cb => auctionItems[cb.value]);

        if (selectedItems.length === 0) {
            alert('추가할 아이템을 먼저 선택해주세요.');
            return;
        }

        const mappedData = selectedItems.map(mapToCalcFormat);
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes('maplescouter.com')) {
            const confirmRedirect = confirm('현재 활성화된 탭이 메이플 환산기(maplescouter.com) 사이트가 아닙니다.\n캐릭터 이름을 입력하고 새 탭으로 환산기를 열어 자동으로 아이템을 추가하시겠습니까?');

            if (confirmRedirect) {
                showModal('이동할 캐릭터 이름을 입력해주세요:', (charName) => {
                    if (charName && charName.trim()) {
                        const targetUrl = `https://maplescouter.com/ko/item?name=${encodeURIComponent(charName.trim())}&preset=00000`;
                        chrome.runtime.sendMessage({
                            action: 'OPEN_AND_INJECT',
                            url: targetUrl,
                            items: mappedData,
                            folderName: '',
                            mode: 'EXPORT'
                        }).catch(() => { });
                        window.close();
                    } else {
                        alert('캐릭터명이 입력되지 않아 아이템 추가 작업을 취소합니다.');
                    }
                });
            } else {
                alert('아이템 추가 작업이 취소되었습니다. 환산 주스텟 - 아이템메이커 화면에서 다시 실행해 주세요.');
            }
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (itemsToInject) => {
                try {
                    let existingData = localStorage.getItem('equipBookmarkList');
                    let parsedData = existingData ? JSON.parse(existingData) : { state: { bookmarkList: [] }, version: 0 };

                    if (!parsedData.state) parsedData.state = {};
                    if (!Array.isArray(parsedData.state.bookmarkList)) parsedData.state.bookmarkList = [];

                    parsedData.state.bookmarkList.push(...itemsToInject);

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

                    const orderedRoot = {
                        state: {
                            bookmarkList: sortObjectKeys(parsedData.state.bookmarkList)
                        },
                        version: parsedData.version ?? 0
                    };

                    localStorage.setItem('equipBookmarkList', JSON.stringify(orderedRoot));
                    alert('성공적으로 환산 아이템메이커에 추가되었습니다.');
                    location.reload();

                } catch (e) {
                    alert('데이터 주입 중 오류가 발생했습니다: ' + e.message);
                }
            },
            args: [mappedData]
        }).catch((err) => {
            console.log('[Popup] 주입 리로드 정상 예외 처리:', err);
        });
    });

    // =========================================
    // [Section 10] 보관함 폴더 -> 환산 사이트로 덮어쓰기 (Swap)
    // =========================================
    async function swapFolderToCalc(folderId) {
        const targetFolder = savedFolders.find(f => f.id === folderId);
        if (!targetFolder) return;

        if (targetFolder.items.length === 0) {
            alert('선택한 폴더에 담긴 아이템이 없어 스왑할 수 없습니다.');
            return;
        }

        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes('maplescouter.com')) {
            const confirmRedirect = confirm('현재 활성화된 탭이 메이플 환산기(maplescouter.com) 사이트가 아닙니다.\n새 탭으로 환산기를 열어 보관함을 교체하시겠습니까?');

            if (confirmRedirect) {
                showModal('이동할 캐릭터 이름을 입력해 주세요:', (charName) => {
                    if (charName && charName.trim()) {
                        const targetUrl = `https://maplescouter.com/ko/item?name=${encodeURIComponent(charName.trim())}&preset=00000`;

                        chrome.runtime.sendMessage({
                            action: 'OPEN_AND_INJECT',
                            url: targetUrl,
                            items: targetFolder.items,
                            folderName: targetFolder.name,
                            mode: 'SWAP'
                        }).catch(() => { });
                        window.close();
                    } else {
                        alert('캐릭터명이 입력되지 않아 작업을 취소합니다.');
                    }
                });
            } else {
                alert('작업이 취소되었습니다. 환산 주스텟 - 아이템메이커 화면에서 직접 교체해 주세요.');
            }
            return;
        }

        if (!confirm(`'${targetFolder.name}' 보관함의 아이템 세트(${targetFolder.items.length}개)로 환산 사이트 데이터를 교체(Swap)하시겠습니까?\n기존에 환산 사이트에 등록되어 있던 세트 목록은 덮어씌워집니다.`)) {
            alert('작업이 취소되었습니다. 환산 주스텟 - 아이템메이커 화면에서 직접 교체해 주세요.');
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (itemsToOverwrite) => {
                try {
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

                    const orderedRoot = {
                        state: {
                            bookmarkList: sortObjectKeys(itemsToOverwrite)
                        },
                        version: 0
                    };

                    localStorage.setItem('equipBookmarkList', JSON.stringify(orderedRoot));
                    alert('성공적으로 선택한 캐릭터 보관함 세트로 동기화되었습니다.');
                    location.reload();

                } catch (e) {
                    alert('동기화 주입 중 오류가 발생했습니다: ' + e.message);
                }
            },
            args: [targetFolder.items]
        }).catch((err) => {
            console.log('[Popup] Swap 리로드 정상 예외 처리:', err);
        });
    }

    loadData();
});