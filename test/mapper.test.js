const { mapToCalcFormat } = require('../src/mapper');

describe('mapToCalcFormat 도메인 로직 테스트', () => {

    test('도적 직업군의 아이템은 INT와 마력이 0으로 마스킹되어야 한다', () => {
        // given: 경매장에서 추출된 도적 장비 원본 데이터 세팅
        const mockThiefItem = {
            toolTip: {
                reqJob: "도적",
                categories: ["방어구", "상의"],
                itemName: "에테르넬 시프셔츠",
                reqLevel: 250,
                stat: {
                    str: "50",
                    dex: "50",
                    int: "50", // 마스킹 대상
                    luk: "50",
                    attack_power: "20",
                    magic_power: "20" // 마스킹 대상
                }
            }
        };

        // when: 환산 규격으로 매핑
        const result = mapToCalcFormat(mockThiefItem);

        // then: 직업군이 도적으로 설정되었는지, 불필요 스탯이 0으로 처리되었는지 검증
        expect(result.class_group).toBe("도적");
        expect(result.totalOption.luk).toBe("50");
        expect(result.totalOption.int).toBe("0"); 
        expect(result.totalOption.magic_power).toBe("0");
    });

    test('잠재능력이 없는 경우 "없음" 3줄로 포맷팅되어야 한다', () => {
        const mockEmptyPotentialItem = {
            toolTip: {
                reqJob: "전사",
                categories: ["방어구", "모자"],
                itemName: "빈 모자",
                // upgradeInfo에 잠재능력이 아예 없는 상태
            }
        };

        const result = mapToCalcFormat(mockEmptyPotentialItem);

        expect(result.potential_option_1).toEqual(["없음", "없음", "없음"]);
        expect(result.potential_grade).toBe("");
    });
});