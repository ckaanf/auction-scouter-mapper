document.addEventListener('DOMContentLoaded', () => {
    const tabWishlist = document.getElementById('tabWishlist');
    const tabStorage = document.getElementById('tabStorage');
    const tabScouterSpecOrder = document.getElementById('tabScouterSpecOrder');
    
    const wishlistContent = document.getElementById('wishlistContent');
    const storageContent = document.getElementById('storageContent');
    const scouterSpecOrderContent = document.getElementById('scouterSpecOrderContent');

    // 3. 탭 전환 공통 함수
    function switchTab(activeBtn, activeContent) {
        // 모든 버튼과 컨텐츠에서 active 클래스 제거
        [tabWishlist, tabStorage, tabScouterSpecOrder].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        [wishlistContent, storageContent, scouterSpecOrderContent].forEach(content => {
            if (content) content.classList.remove('active');
        });
        
        // 선택한 탭과 컨텐츠에 active 클래스 부여
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    // 4. 각 탭 클릭 이벤트 바인딩
    if (tabWishlist && wishlistContent) {
        tabWishlist.addEventListener('click', () => {
            switchTab(tabWishlist, wishlistContent);
            if (typeof loadData === 'function') loadData(); // 기존 경매장 찜 목록 함수 호출용
        });
    }

    if (tabStorage && storageContent) {
        tabStorage.addEventListener('click', () => {
            switchTab(tabStorage, storageContent);
            if (typeof loadFolders === 'function') loadFolders(); // 기존 보관함 함수 호출용
        });
    }

    if (tabScouterSpecOrder && scouterSpecOrderContent) {
        tabScouterSpecOrder.addEventListener('click', () => {
            switchTab(tabScouterSpecOrder, scouterSpecOrderContent);
        });
    }
});