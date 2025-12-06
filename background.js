// background.js：Manifest V3 标准语法，无乱码、无残留错误代码
chrome.runtime.onInstalled.addListener(() => {
    // 扩展安装时加载并应用规则
    chrome.storage.sync.get(['domainRules'], (result) => {
        const defaultRules = [
            { original: "south-plus.net", target: "bbs.imoutolove.me" },
            { original: "north-plus.net", target: "bbs.imoutolove.me" },
            { original: "level-plus.net", target: "bbs.imoutolove.me" },
            { original: "white-plus.net", target: "bbs.imoutolove.me" }
        ];
        const rules = result.domainRules || defaultRules;
        
        // 首次安装时保存默认规则
        if (!result.domainRules) {
            chrome.storage.sync.set({ domainRules: rules });
        }
        
        // 应用替换规则
        updateExtensionRules(rules);
    });

    // 图标点击事件（正常工作）
    if (chrome.action) {
        chrome.action.onClicked.addListener(() => {
            chrome.tabs.create({ url: "https://south-plus.net" });
        });
    }
});

// 更新域名替换规则（适配 declarativeNetRequest）
function updateExtensionRules(customRules) {
    const netRules = customRules.map((rule, index) => ({
        "id": index + 1,
        "priority": 1,
        "action": {
            "type": "redirect",
            "redirect": {
                "regexSubstitution": `https://${rule.target}/\\2`
            }
        },
        "condition": {
            "regexFilter": `^https?://(.*\\.)?${rule.original}/(.*)`,
            "resourceTypes": ["main_frame", "sub_frame"]
        }
    }));

    // 清除旧规则 + 添加新规则（避免冲突）
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        const existingIds = existingRules.map(r => r.id);
        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds }, () => {
            chrome.declarativeNetRequest.updateDynamicRules({ addRules: netRules }, () => {
                console.log(`规则生效：共 ${netRules.length} 条`);
            });
        });
    });
}