// 存储键名
const RULES_KEY = 'domainRules';

// DOM元素
const originalDomainInput = document.getElementById('originalDomain');
const targetDomainInput = document.getElementById('targetDomain');
const addRuleBtn = document.getElementById('addRuleBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editHint = document.getElementById('editHint');
const rulesList = document.getElementById('rulesList');
const selectAll = document.getElementById('selectAll');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// 当前正在编辑的规则 id（null 表示新增模式）
let editingId = null;

// 域名规范化：去掉协议、路径、查询串和尾部点号，统一小写。
// 防止粘贴完整 URL（如 https://south-plus.net/）导致规则失效。
function normalizeDomain(value) {
  return String(value)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.+$/, '')
    .toLowerCase();
}

// 初始化：加载已保存的规则
document.addEventListener('DOMContentLoaded', loadRules);

// ============ 添加规则 ============
addRuleBtn.addEventListener('click', async () => {
  const original = normalizeDomain(originalDomainInput.value);
  const target = normalizeDomain(targetDomainInput.value);

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

// ============ 编辑规则 ============
saveEditBtn.addEventListener('click', async () => {
  const original = normalizeDomain(originalDomainInput.value);
  const target = normalizeDomain(targetDomainInput.value);

  if (!original || !target) {
    alert('请输入完整的原始域名和目标域名！');
    return;
  }

  const rules = await getRules();
  // 查重时排除正在编辑的这条规则自身
  const exists = rules.some(rule => rule.original === original && rule.id !== editingId);
  if (exists) {
    alert(`已存在原始域名为 "${original}" 的规则，请修改后重试！`);
    return;
  }

  const rule = rules.find(r => r.id === editingId);
  if (rule) {
    rule.original = original;
    rule.target = target;
    await saveRules(rules);
  }

  exitEditMode();
  renderRules(rules);
});

cancelEditBtn.addEventListener('click', () => {
  exitEditMode();
  loadRules();
});

// 进入编辑模式：把规则回填到表单并高亮对应行
async function startEdit(ruleId) {
  const rules = await getRules();
  const rule = rules.find(r => r.id === ruleId);
  if (!rule) return;

  editingId = ruleId;
  originalDomainInput.value = rule.original;
  targetDomainInput.value = rule.target;

  addRuleBtn.classList.add('hidden');
  saveEditBtn.classList.remove('hidden');
  cancelEditBtn.classList.remove('hidden');
  editHint.classList.add('visible');
  editHint.textContent = `正在编辑：${rule.original}（修改后点击"保存修改"）`;

  renderRules(rules); // 重新渲染以高亮正在编辑的行
  originalDomainInput.focus();
}

// 退出编辑模式，恢复为新增模式
function exitEditMode() {
  editingId = null;
  originalDomainInput.value = '';
  targetDomainInput.value = '';
  addRuleBtn.classList.remove('hidden');
  saveEditBtn.classList.add('hidden');
  cancelEditBtn.classList.add('hidden');
  editHint.classList.remove('visible');
  editHint.textContent = '';
}

// ============ 批量选择 / 批量删除 ============
selectAll.addEventListener('change', () => {
  rulesList.querySelectorAll('.rule-check').forEach(cb => {
    cb.checked = selectAll.checked;
  });
  updateBatchUI();
});

batchDeleteBtn.addEventListener('click', async () => {
  const selectedIds = getSelectedIds();
  if (selectedIds.length === 0) return;
  if (!confirm(`确定删除选中的 ${selectedIds.length} 条规则吗？`)) return;

  let rules = await getRules();
  rules = rules.filter(rule => !selectedIds.includes(rule.id));
  await saveRules(rules);

  // 正在编辑的规则被删除时，退出编辑模式
  if (editingId !== null && selectedIds.includes(editingId)) {
    exitEditMode();
  }
  renderRules(rules);
});

// 获取勾选的规则 id 列表
function getSelectedIds() {
  return Array.from(rulesList.querySelectorAll('.rule-check:checked'))
    .map(cb => parseInt(cb.dataset.id));
}

// 更新批量删除按钮与全选框状态
function updateBatchUI() {
  const checks = Array.from(rulesList.querySelectorAll('.rule-check'));
  const checkedCount = checks.filter(cb => cb.checked).length;

  batchDeleteBtn.disabled = checkedCount === 0;
  batchDeleteBtn.textContent = checkedCount > 0 ? `删除选中(${checkedCount})` : '删除选中';

  // 全选框三态：全选 / 半选 / 未选
  selectAll.checked = checks.length > 0 && checkedCount === checks.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

// 勾选状态变化时刷新批量按钮
rulesList.addEventListener('change', (e) => {
  if (e.target.classList.contains('rule-check')) {
    updateBatchUI();
  }
});

// ============ 导出规则（JSON文件） ============
exportBtn.addEventListener('click', async () => {
  const rules = await getRules();
  if (rules.length === 0) {
    alert('暂无规则可导出！');
    return;
  }

  const jsonStr = JSON.stringify(rules, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  // 使用 ISO 日期（含 - 而非 /，/ 是非法文件名字符）
  a.download = `域名替换规则_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

// ============ 导入规则（JSON文件） ============
importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

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

      // 合并规则（去重），同批导入的规则使用递增 id，避免删除时互相误伤
      const existingRules = await getRules();
      const mergedRules = [...existingRules];
      let nextId = Date.now();
      importedRules.forEach(imported => {
        const impOriginal = normalizeDomain(imported.original);
        const impTarget = normalizeDomain(imported.target);
        if (!impOriginal || !impTarget) return; // 跳过无效条目
        const exists = mergedRules.some(exist => exist.original === impOriginal);
        if (!exists) {
          mergedRules.push({ original: impOriginal, target: impTarget, id: nextId++ });
        }
      });

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

// ============ 列表交互：单条编辑 / 单条删除 ============
rulesList.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const ruleId = parseInt(e.target.dataset.id);
    let rules = await getRules();
    rules = rules.filter(rule => rule.id !== ruleId);
    await saveRules(rules);

    // 删除的正是正在编辑的规则时，退出编辑模式
    if (editingId === ruleId) {
      exitEditMode();
    }
    renderRules(rules);
  } else if (e.target.classList.contains('edit-btn') || e.target.classList.contains('rule-text')) {
    startEdit(parseInt(e.target.dataset.id));
  }
});

// ============ 存储读写 ============
// 从存储获取规则
async function getRules() {
  const result = await chrome.storage.local.get(RULES_KEY);
  return result[RULES_KEY] || [];
}

// 保存规则到存储
async function saveRules(rules) {
  await chrome.storage.local.set({ [RULES_KEY]: rules });
}

// ============ 渲染 ============
// 渲染规则列表（使用 DOM API 构建节点，避免用户输入被当作 HTML 解析）
function renderRules(rules) {
  rulesList.innerHTML = '';
  if (rules.length === 0) {
    const empty = document.createElement('li');
    empty.style.cssText = 'color: #999; text-align: center;';
    empty.textContent = '暂无规则';
    rulesList.appendChild(empty);
    updateBatchUI();
    return;
  }

  rules.forEach(rule => {
    const li = document.createElement('li');
    if (rule.id === editingId) {
      li.classList.add('editing');
    }

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'rule-check';
    check.dataset.id = rule.id;
    check.title = '勾选后可批量删除';

    const text = document.createElement('span');
    text.className = 'rule-text';
    text.dataset.id = rule.id;
    text.title = '点击编辑此规则';
    text.textContent = `${rule.original} → ${rule.target}`;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.dataset.id = rule.id;
    editBtn.textContent = '编辑';

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.dataset.id = rule.id;
    delBtn.textContent = '删除';

    li.append(check, text, editBtn, delBtn);
    rulesList.appendChild(li);
  });

  updateBatchUI();
}

// 加载规则并渲染；同时补全缺失的 id（旧版迁移数据可能没有 id）并回写存储
async function loadRules() {
  let rules = await getRules();
  let changed = false;
  rules = rules
    .filter(rule => rule && rule.original && rule.target)
    .map((rule, i) => {
      if (typeof rule.id !== 'number') {
        changed = true;
        return { ...rule, id: Date.now() + i };
      }
      return rule;
    });
  if (changed) {
    await saveRules(rules);
  }
  renderRules(rules);
}
