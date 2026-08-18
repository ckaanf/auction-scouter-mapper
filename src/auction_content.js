console.log('[Extension] 콘텐츠 스크립트 실행됨');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/auction_inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 환산 계산 가능한 장비 슬롯 화이트리스트 정의
const VALID_SLOTS = [
    "반지", "반지1", "반지2", "반지3", "반지4",
    "펜던트", "펜던트1", "펜던트2",
    "무기", "보조무기", "포스실드", "엠블렘", "기계 심장", "체스피스",
    "벨트", "모자", "얼굴장식", "눈장식",
    "상의", "하의", "신발", "귀고리",
    "어깨장식", "장갑", "망토", "배지", "훈장", "포켓 아이템"
];

// 안전한 ID 문자열 변환 함수
const toSnStr = (val) => (val !== undefined && val !== null ? String(val) : '');

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // [1] GET 통신 (목록 불러오기) -> 필터링, 상호 동기화 및 병합 처리
    if (event.data.type === 'AUCTION_WISHLIST_INTERCEPTED') {
        const newData = event.data.payload;
        if (!newData || !newData.items || !Array.isArray(newData.items)) return;

        // 경매장 전체 목록 조회가 맞는지 확인 플래그 (API 응답 구조에 따라 필요 시 추가/조정)
        const isFullListFetch = event.data.isFullList === true; 

        const filteredItems = newData.items.filter(newItem => {
            const t = newItem.toolTip;
            if (!t || !t.categories) return false;

            const part = t.categories[0] || "";
            const slot = t.categories[1] || "";
            const isCash = newItem.isCash;
            
            return !isCash && (VALID_SLOTS.includes(slot) || VALID_SLOTS.includes(part));
        });

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            let existingItems = (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) ? result.auctionWishlist.items : [];
            let addedCount = 0;
            let closedCount = 0;
            let unwishedCount = 0;
            let skippedCount = newData.items.length - filteredItems.length;

            const newTradeSns = filteredItems.map(item => toSnStr(item.tradeSn));

            // 2. [역방향 감지] 전체 목록 조회일 때만 안전하게 처리 (페이지네이션 오작동 방지)
            if (isFullListFetch) {
                existingItems = existingItems.map(oldItem => {
                    const oldTradeSnStr = toSnStr(oldItem.tradeSn);
                    if (!newTradeSns.includes(oldTradeSnStr)) {
                        if (!oldItem.isUnwished) {
                            oldItem.isUnwished = true;
                            unwishedCount++;
                        }
                    }
                    return oldItem;
                });
            }

            // 3. [정방향 업데이트 및 병합] 새로 받아온 데이터 동기화
            filteredItems.forEach(newItem => {
                const isProductClosed = newItem.status && newItem.status !== 'ON_SALE';
                const newTradeSnStr = toSnStr(newItem.tradeSn);

                const existingIndex = existingItems.findIndex(item => toSnStr(item.tradeSn) === newTradeSnStr);

                if (existingIndex > -1) {
                    existingItems[existingIndex].isUnwished = false;

                    if (isProductClosed) {
                        existingItems[existingIndex].isClosed = true;
                        closedCount++;
                    } else {
                        existingItems[existingIndex].isClosed = false;
                    }
                } else {
                    newItem.isUnwished = false;
                    newItem.isClosed = isProductClosed;

                    if (isProductClosed) closedCount++;

                    existingItems.push(newItem);
                    addedCount++;
                }
            });

            chrome.storage.local.set({ auctionWishlist: { items: existingItems } }, () => {
                console.log(`[Extension] 찜 목록 동기화 완료 (신규 추가: ${addedCount}개 / 찜 해제 감지: ${unwishedCount}개 / 마감 상태 전환: ${closedCount}개 / 카테고리 제외: ${skippedCount}개 / 총 보관량: ${existingItems.length}개)`);
            });
        });
    }

    // [2] DELETE 통신 (찜 해제) -> 상태 플래그 변경
    if (event.data.type === 'AUCTION_WISHLIST_DELETED') {
        const { tradeSn } = event.data.payload;
        const targetTradeSnStr = toSnStr(tradeSn);

        chrome.storage.local.get(['auctionWishlist'], (result) => {
            if (result.auctionWishlist && Array.isArray(result.auctionWishlist.items)) {
                let items = result.auctionWishlist.items;
                let updated = false;

                items = items.map(item => {
                    if (toSnStr(item.tradeSn) === targetTradeSnStr) {
                        item.isUnwished = true;
                        updated = true;
                    }
                    return item;
                });

                if (updated) {
                    chrome.storage.local.set({ auctionWishlist: { items: items } }, () => {
                        console.log(`[Extension] 아이템 찜 해제 상태로 변경됨: ${targetTradeSnStr}`);
                    });
                }
            }
        });
    }
});