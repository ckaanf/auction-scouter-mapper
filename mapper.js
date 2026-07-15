function mapToCalcFormat(auctionItem) {
    const t = auctionItem.toolTip;
    const upgrade = t.upgradeInfo || {};
    const job = t.reqJob || "";

    // 1. 직업별 유효 스탯 필터링
    const getValidKeysForJob = (jobName) => {
        if (jobName.includes("전사")) return ["str", "dex", "attack_power", "all_stat"];
        if (jobName.includes("마법사")) return ["int", "luk", "magic_power", "all_stat"];
        if (jobName.includes("궁수")) return ["dex", "str", "attack_power", "all_stat"];
        if (jobName.includes("도적")) return ["luk", "dex", "str", "attack_power", "all_stat"];
        return ["str", "dex", "int", "luk", "attack_power", "magic_power", "all_stat"];
    };
    const validKeys = getValidKeysForJob(job);
    const statMaskGroup = ["str", "dex", "int", "luk", "attack_power", "magic_power"];

    // 2. 내부 스탯 옵션 순서 보장 생성기
    const createStatObj = (s, includeLevel = false) => {
        const obj = {};
        
        // 요청하신 JSON의 내부 옵션 순서와 100% 일치
        const orderedKeys = [
            "str", "dex", "int", "luk", "max_hp", "max_mp", 
            "attack_power", "magic_power", "armor", "speed", 
            "jump", "damage", "boss_damage", "ignore_monster_armor", 
            "all_stat", "max_hp_rate", "max_mp_rate"
        ];
        
        const apiMap = { 
            str: 'str', dex: 'dex', int: 'int', luk: 'luk', max_hp: 'mhp', max_mp: 'mmp', 
            attack_power: 'pad', magic_power: 'mad', armor: 'pdd', speed: 'speed', jump: 'jump', 
            damage: 'dam', boss_damage: 'bdr', ignore_monster_armor: 'imdr', all_stat: 'all', 
            max_hp_rate: 'hpr', max_mp_rate: 'mpr' 
        };

        orderedKeys.forEach(key => {
            let val = Number(s?.[apiMap[key]] || 0);

            if (statMaskGroup.includes(key) && !validKeys.includes(key)) {
                val = 0;
            }
            obj[key] = String(val);
        });
        
        obj["base_equipment_level"] = includeLevel ? Number(t.reqLevel || 0) : 0;
        obj["equipment_level_decrease"] = Number(s?.reduceReq || 0);
        return obj;
    };

    // 3. 잠재능력 배열 생성 (3개 요소 고정)
    const parseOptions = (entries) => {
        const opts = ["없음", "없음", "없음"];
        if (entries && Array.isArray(entries)) {
            for (let i = 0; i < Math.min(entries.length, 3); i++) {
                opts[i] = entries[i].text || "없음";
            }
        }
        return opts;
    };

    // 4. 고유 식별자 생성
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const msPart = String(now.getMilliseconds()).padStart(3, '0');
    const characterName = `ItemMaker${datePart}_${timePart}${msPart.slice(0, 3)}`;

    // 5. 반환 객체 (JSON 키 순서를 그대로 적용)
    return {
        slot: t.categories[1] || t.categories[0] || "기타",
        part: t.categories[1] || t.categories[0] || "기타",
        name: t.itemName,
        iconUrl: t.itemIcon?.fallBackUrl || "",
        starforce: String(t.starforce || 0),
        starforce_scroll_flag: "미사용",
        scroll_upgrade: String(upgrade.scroll?.current || 0),
        totalOption: createStatObj(t.stat, true),
        baseOption: createStatObj(t.baseStat, true),
        addOption: createStatObj(t.exOptionStat, false),
        etcOption: createStatObj(t.upgradeStat, false),
        starforceOption: createStatObj(t.starforceStat, false),
        potential_grade: ["", "레어", "에픽", "유니크", "레전드리"][upgrade.potential?.grade] || "",
        potential_option_1: parseOptions(upgrade.potential?.entries),
        additional_potential_grade: ["", "레어", "에픽", "유니크", "레전드리"][upgrade.additionalPotential?.grade] || "",
        additional_potential_option_1: parseOptions(upgrade.additionalPotential?.entries),
        exceptionalOption: {
            str: "0",
            dex: "0",
            int: "0",
            luk: "0",
            max_hp: "0",
            max_mp: "0",
            attack_power: "0",
            magic_power: "0",
            exceptional_upgrade: 0 // JSON 예시와 동일하게 숫자 0으로 할당
        },
        hasExceptional: false,
        soul_name: t.soulWeapon?.name || null,
        soul_option: t.soulWeapon?.option || null,
        ring_level: t.seedRingLevel || 0,
        itemScore: "0",
        character_name: characterName,
        class_group: job || "도적",
        cuttable_count: "255",
        title: "",
        bookMark: true,
        isEquipped: false
    };
}