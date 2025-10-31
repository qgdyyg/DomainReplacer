// 保存规则到存储
function saveRules(rules) {
    chrome.storage.sync.set({ domainRules: rules }, () => {
        updateRulesList();
        updateExtensionRules(rules);
    });
}

// 获取所有规则
function getRules(callback) {
    chrome.storage.sync.get(['domainRules'], (result) => {
        const rules = result.domainRules || [
            { original: "south-plus.net", target: "bbs.imoutolove.me" },
            { original: "north-plus.net", target: "bbs.imoutolove.me" },
            { original: "level-plus.net", target: "bbs.imoutolove.me" },
            { original: "white-plus.net", target: "bbs.imoutolove.me" }
        ];
        callback(rules);
    });
}

// 添加新规则
document.getElementById('addRule').addEventListener('click', () => {
    const original = document.getElementById('originalDomain').value.trim();
    const target = document.getElementById('targetDomain').value.trim();
    
    if (original && target) {
        getRules(rules => {
            // 检查是否已存在相同规则
            const exists = rules.some(rule => rule.original === original);
            if (!exists) {
                rules.push({ original, target });
                saveRules(rules);
                
                // 清空输入框
                document.getElementById('originalDomain').value = '';
                document.getElementById('targetDomain').value = '';
            } else {
                alert('该原始域名的规则已存在！');
            }
        });
    } else {
        alert('请输入原始域名和目标域名！');
    }
});

// 更新规则列表显示
function updateRulesList() {
    const rulesList = document.getElementById('rulesList');
    rulesList.innerHTML = '';
    
    getRules(rules => {
        if (rules.length === 0) {
            rulesList.innerHTML = '<p>暂无规则，请添加</p>';
            return;
        }
        
        rules.forEach((rule, index) => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            
            ruleItem.innerHTML = `
                <div class="rule-info">
                    <strong>${rule.original}</strong> → ${rule.target}
                </div>
                <div class="rule-actions">
                    <button class="edit-btn" data-index="${index}">编辑</button>
                    <button class="delete-btn" data-index="${index}">删除</button>
                </div>
            `;
            
            rulesList.appendChild(ruleItem);
        });
        
        // 添加编辑和删除事件监听
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deleteRule(index);
            });
        });
        
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                editRule(index);
            });
        });
    });
}

// 删除规则
function deleteRule(index) {
    getRules(rules => {
        rules.splice(index, 1);
        saveRules(rules);
    });
}

// 编辑规则
function editRule(index) {
    getRules(rules => {
        const rule = rules[index];
        const newOriginal = prompt('请输入原始域名:', rule.original);
        const newTarget = prompt('请输入目标域名:', rule.target);
        
        if (newOriginal !== null && newTarget !== null && newOriginal.trim() && newTarget.trim()) {
            rules[index] = {
                original: newOriginal.trim(),
                target: newTarget.trim()
            };
            saveRules(rules);
        }
    });
}

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
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(rule => rule.id)
    }, () => {
        // 添加新规则
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: rules
        });
    });
}

// 页面加载时显示规则列表
document.addEventListener('DOMContentLoaded', updateRulesList);
    