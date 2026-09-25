function mapToCalcFormat(auctionItem) {
    const t = auctionItem.toolTip;
    const upgrade = t.upgradeInfo || {};
    const job = t.reqJob || "";

    const PART_EQUALS_SLOT = [
        "반지", "반지1", "반지2", "반지3", "반지4",
        "펜던트", "펜던트1", "펜던트2",
        "보조무기", "포스실드", "소울링", "방패", "블레이드",
        "엠블렘", "기계 심장",
        "벨트", "모자", "얼굴장식", "눈장식",
        "상의", "하의", "신발", "귀고리",
        "어깨장식", "장갑", "망토", "배지", "훈장", "포켓 아이템"
    ];

    const SECONDARY_WEAPON_PARTS = [
        "보조무기", "포스실드", "소울링", "방패", "블레이드", "단검용 검집", "부적",
        "메달", "로자리오", "쇠사슬", "마도서", "화살깃", "활골무", "유물",
        "오브", "마법구슬", "문서", "마법화살", "카드", "여우구슬", "선추",
        "컨트롤러", "무기 전송장치", "조준기", "화약통", "추", "무게추", "리스트밴드", "장미", "노리개"
    ];

    // 직업별 유효 스탯 필터링 조건 보강 (데몬 직업군, 제논 및 하위 전사 직업 대응)
    const getValidKeysForJob = (jobName) => {
        if (jobName.includes("제논")) {
            return ["str", "dex", "luk", "attack_power", "all_stat"];
        }
        if (jobName.includes("전사") || jobName.includes("데몬") || jobName.includes("아란") || jobName.includes("카이저") || jobName.includes("미하일") || jobName.includes("제로")) {
            return ["str", "dex", "max_hp", "attack_power", "all_stat"];
        }
        if (jobName.includes("마법사") || jobName.includes("루미너스") || jobName.includes("일리움") || jobName.includes("키네시스") || jobName.includes("라라")) {
            return ["int", "luk", "magic_power", "all_stat"];
        }
        if (jobName.includes("궁수") || jobName.includes("메르세데스") || jobName.includes("패스파인더") || jobName.includes("카인")) {
            return ["dex", "str", "attack_power", "all_stat"];
        }
        if (jobName.includes("도적") || jobName.includes("팬텀") || jobName.includes("칼리") || jobName.includes("호영")) {
            return ["luk", "dex", "str", "attack_power", "all_stat"];
        }
        if (jobName.includes("해적") || jobName.includes("은월") || jobName.includes("아크") || jobName.includes("엔젤릭버스터")) {
            return ["str", "dex", "attack_power", "all_stat"];
        }
        return ["str", "dex", "int", "luk", "max_hp", "attack_power", "magic_power", "all_stat"];
    };
    const validKeys = getValidKeysForJob(job);
    const statMaskGroup = ["str", "dex", "int", "luk", "attack_power", "magic_power"];

    const createStatObj = (s, includeLevel = false) => {
        const obj = {};
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

    const parseOptions = (entries) => {
        const opts = ["없음", "없음", "없음"];
        if (entries && Array.isArray(entries)) {
            for (let i = 0; i < Math.min(entries.length, 3); i++) {
                opts[i] = entries[i].text || "없음";
            }
        }
        return opts;
    };

    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const msPart = String(now.getMilliseconds()).padStart(3, '0');
    const characterName = `ItemMaker${datePart}_${timePart}${msPart.slice(0, 3)}`;

    const categories = Array.isArray(t.categories) ? t.categories : [];
    const rawSlot = categories[0] || "기타";
    const rawPart = categories[1] || "기타";

    let mappedSlot = rawSlot;
    let mappedPart = rawPart;

    if (categories.includes("보조무기") || SECONDARY_WEAPON_PARTS.includes(rawPart) || SECONDARY_WEAPON_PARTS.includes(categories[2])) {
        mappedSlot = "보조무기";
    } else if (PART_EQUALS_SLOT.includes(mappedPart)) {
        mappedSlot = mappedPart;
    }

    let mappedClassGroup = "도적";
    if (job.includes("전사") || job.includes("데몬") || job.includes("아란") || job.includes("카이저") || job.includes("미하일") || job.includes("제로")) {
        mappedClassGroup = "전사";
    } else if (job.includes("마법사") || job.includes("루미너스") || job.includes("일리움") || job.includes("키네시스") || job.includes("라라")) {
        mappedClassGroup = "마법사";
    } else if (job.includes("궁수") || job.includes("메르세데스") || job.includes("패스파인더") || job.includes("카인")) {
        mappedClassGroup = "궁수";
    } else if (job.includes("도적") || job.includes("팬텀") || job.includes("칼리") || job.includes("호영") || job.includes("제논")) {
        mappedClassGroup = "도적";
    } else if (job.includes("해적") || job.includes("은월") || job.includes("아크") || job.includes("엔젤릭버스터")) {
        mappedClassGroup = "해적";
    }

    return {
        slot: mappedSlot,
        part: mappedPart,
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
            exceptional_upgrade: 0
        },
        hasExceptional: false,
        soul_name: t.soulWeapon?.name || null,
        soul_option: t.soulWeapon?.option || null,
        ring_level: t.seedRingLevel || 0,
        itemScore: "0",
        character_name: characterName,
        class_group: mappedClassGroup,
        cuttable_count: "255",
        title: "",
        bookMark: true,
        isEquipped: false,
        soul_potential_option_1: [
            null,
            null,
            null
        ],
        soul_atk: "0",
        soul_potential_grade: null,
        soul_potential_amplified_grade: null
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mapToCalcFormat };
}