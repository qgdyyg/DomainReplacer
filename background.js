// 初始化时加载保存的规则
chrome.runtime.onInstalled.addListener(() => {
    // 从存储中获取规则
    chrome.storage.sync.get(['domainRules'], (result) => {
        const rules = result.domainRules || [
            { original: "south-plus.net", target: "bbs.imoutolove.me" },
            { original: "north-plus.net", target: "bbs.imoutolove.me" },
            { original: "level-plus.net", target: "bbs.imoutolove.me" },
            { original: "white-plus.net", target: "bbs.imoutolove.me" }
        ];
        
        // 保存默认规则（如果是首次安装）
        if (!result.domainRules) {
            chrome.storage.sync.set({ domainRules: rules });
        }
        
        // 应用规则
        updateExtensionRules(rules);
    });

    // 图标点击事件
    if (chrome.action) {
        chrome.action.onClicked.addListener(() => {
            chrome.tabs.create({ url: "https://south-plus.net" });
        });
    }
});

// 更新扩展的替换规则
function updateExtensionRules(customRules) {
    // 转换为declarativeNetRequest格式的规则
    const rules = customRules.map((rule, index) => {
        return {
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
        };
    });
    
    // 先清除所有现有规则
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds
        }, () => {
            // 添加新规则
            chrome.declarativeNetRequest.updateDynamicRules({
                addRules: rules
            });
        });
    });
}
    