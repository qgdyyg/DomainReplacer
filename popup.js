// 存储键名
const RULES_KEY = 'domainReplacementRules';

// DOM元素
const originalDomainInput = document.getElementById('originalDomain');
const targetDomainInput = document.getElementById('targetDomain');
const addRuleBtn = document.getElementById('addRuleBtn');
const rulesList = document.getElementById('rulesList');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// 初始化：加载已保存的规则
document.addEventListener('DOMContentLoaded', loadRules);

// 添加规则
addRuleBtn.addEventListener('click', async () => {
  const original = originalDomainInput.value.trim();
  const target = targetDomainInput.value.trim();

  if (!original || !target) {
    alert('请输入完整的原始域名和目标域名！');
    return;
  }

  // 获取现有规则
  const rules = await getRules();
  // 避免重复（按原始域名去重）
  const exists = rules.some(rule => rule.original === original);
  if (exists) {
    alert(`已存在原始域名为 "${original}" 的规则，请修改后重试！`);
    return;
  }

  // 添加新规则
  rules.push({ original, target, id: Date.now() }); // id用于删除
  await saveRules(rules);
  renderRules(rules);

  // 清空输入框
  originalDomainInput.value = '';
  targetDomainInput.value = '';
});

// 导出规则（JSON文件）
exportBtn.addEventListener('click', async () => {
  const rules = await getRules();
  if (rules.length === 0) {
    alert('暂无规则可导出！');
    return;
  }

  // 转换为JSON字符串
  const jsonStr = JSON.stringify(rules, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 创建下载链接
  const a = document.createElement('a');
  a.href = url;
  a.download = `域名替换规则_${new Date().toLocaleDateString()}.json`;
  a.click();

  // 释放URL
  URL.revokeObjectURL(url);
});

// 导入规则（JSON文件）
importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 读取文件内容
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const jsonStr = event.target.result;
      const importedRules = JSON.parse(jsonStr);

      // 验证规则格式
      if (!Array.isArray(importedRules) || !importedRules.every(rule => 
        rule.original && rule.target
      )) {
        throw new Error('JSON格式错误，规则必须包含original和target字段！');
      }

      // 合并规则（去重）
      const existingRules = await getRules();
      const mergedRules = [...existingRules];
      importedRules.forEach(imported => {
        const exists = mergedRules.some(exist => exist.original === imported.original);
        if (!exists) {
          mergedRules.push({ ...imported, id: Date.now() });
        }
      });

      // 保存并刷新
      await saveRules(mergedRules);
      renderRules(mergedRules);
      alert(`成功导入 ${importedRules.length} 条规则（已自动去重）！`);
    } catch (err) {
      alert(`导入失败：${err.message}`);
    }
  };
  reader.readAsText(file, 'UTF-8');

  // 重置文件输入
  importFile.value = '';
});

// 删除规则
rulesList.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const ruleId = parseInt(e.target.dataset.id);
    const rules = await getRules();
    const filteredRules = rules.filter(rule => rule.id !== ruleId);
    await saveRules(filteredRules);
    renderRules(filteredRules);
  }
});

// 从存储获取规则
async function getRules() {
  const result = await chrome.storage.local.get(RULES_KEY);
  return result[RULES_KEY] || [];
}

// 保存规则到存储
async function saveRules(rules) {
  await chrome.storage.local.set({ [RULES_KEY]: rules });
}

// 渲染规则列表
function renderRules(rules) {
  rulesList.innerHTML = '';
  if (rules.length === 0) {
    rulesList.innerHTML = '<li style="color: #999; text-align: center;">暂无规则</li>';
    return;
  }

  rules.forEach(rule => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rule-text">${rule.original} → ${rule.target}</span>
      <button class="delete-btn" data-id="${rule.id}">删除</button>
    `;
    rulesList.appendChild(li);
  });
}

// 加载规则并渲染
async function loadRules() {
  const rules = await getRules();
  renderRules(rules);
}