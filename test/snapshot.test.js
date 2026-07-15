const { mapToCalcFormat } = require('../src/mapper');
const auctionData = require('./data/auction.json');

describe('환산 규격 변환 스냅샷 테스트', () => {
    test('경매장 원본 데이터 변환 결과가 이전과 일치해야 한다', () => {
        const items = Array.isArray(auctionData) ? auctionData : (auctionData.items || []);
        
        if (items.length === 0) {
            throw new Error("테스트할 데이터가 없습니다. JSON 구조를 확인하세요!");
        }
    
        items.forEach((item) => {
            const result = mapToCalcFormat(item);
            expect(result).toMatchSnapshot({
                character_name: expect.any(String),
            });
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('totalOption');
        });
    });
});