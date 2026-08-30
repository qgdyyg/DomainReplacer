// background.js — 域名替换核心逻辑
// popup 与 background 统一使用 chrome.storage.local 的 domainRules 键，
// popup 每次保存规则都会触发 storage.onChanged，实时刷新 DNR 动态规则。

// 版本标记：Service Worker 每次启动都会打印此行，用于确认实际运行的代码版本
console.log('[DomainReplacer] background.js v1.5 已加载');

const STORAGE_KEY = 'domainRules';
const LEGACY_POPUP_KEY = 'domainReplacementRules';

const DEFAULT_RULES = [
    { original: 'south-plus.net', target: 'bbs.imoutolove.me', id: 1 },
    { original: 'north-plus.net', target: 'bbs.imoutolove.me', id: 2 },
    { original: 'level-plus.net', target: 'bbs.imoutolove.me', id: 3 },
    { original: 'white-plus.net', target: 'bbs.imoutolove.me', id: 4 }
];

// 覆盖全部资源类型：普通网页(main_frame)、iframe(sub_frame)、以及
// 其他扩展（如 feedbro）内置页面通过 fetch/XHR 发起的请求(xmlhttprequest)。
// 注意：DNR 枚举中 XHR 写作 xmlhttprequest（无下划线），与 MV2 webRequest 的
// xmlhttp_request 不同；以下为 Chrome 报错信息中列出的全部合法值。
const RESOURCE_TYPES = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'media',
    'websocket',
    'csp_report',
    'webbundle',
    'webtransport',
    'other'
];

// 转义域名中的正则特殊字符（如 . ，否则 south-plus.net 会误匹配 south-plusXnet）
function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 域名规范化：去掉协议、路径、查询串和尾部点号，统一小写。
// 防止用户粘贴完整 URL（如 https://south-plus.net/）破坏正则或产生错误重定向。
function normalizeDomain(value) {
    return String(value)
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/[/?#].*$/, '')
        .replace(/\.+$/, '')
        .toLowerCase();
}

// 规则变更时实时刷新（popup 保存/删除/导入后立即生效）
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
        applyRules();
    }
});

chrome.runtime.onInstalled.addListener(init);

// DNR 动态规则本身会跨会话持久化，启动时同步一次作为兜底
chrome.runtime.onStartup.addListener(applyRules);

async function init() {
    const local = await chrome.storage.local.get([STORAGE_KEY, LEGACY_POPUP_KEY]);
    const sync = await chrome.storage.sync.get([STORAGE_KEY]);

    let rules = local[STORAGE_KEY];
    if (!Array.isArray(rules)) {
        // 迁移旧版本分散存储的规则：
        // 优先取 popup 旧键（storage.local.domainReplacementRules），
        // 其次取 background 旧键（storage.sync.domainRules）
        if (Array.isArray(local[LEGACY_POPUP_KEY]) && local[LEGACY_POPUP_KEY].length) {
            rules = local[LEGACY_POPUP_KEY];
        } else if (Array.isArray(sync[STORAGE_KEY]) && sync[STORAGE_KEY].length) {
            rules = sync[STORAGE_KEY];
        } else {
            rules = DEFAULT_RULES;
        }
    }

    // 统一补全缺失的 id（旧版 sync 默认规则没有 id 字段，
    // popup 的编辑/删除/批量删除都依赖 id），并过滤无效规则
    rules = rules
        .filter(r => r && r.original && r.target)
        .map((r, i) => (typeof r.id === 'number' && r.id) ? r : { ...r, id: Date.now() + i });
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });

    // 清理旧键，避免残留
    if (local[LEGACY_POPUP_KEY]) {
        await chrome.storage.local.remove(LEGACY_POPUP_KEY);
    }

    await applyRules();
}

// 将用户规则转换为 DNR 动态规则并全量刷新
async function applyRules() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const rules = (data[STORAGE_KEY] || [])
            .filter(r => r && r.original && r.target)
            .map(r => ({
                original: normalizeDomain(r.original),
                target: normalizeDomain(r.target)
            }))
            .filter(r => r.original && r.target);

        const netRules = rules.map((rule, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    // 捕获组说明：\1=子域名(丢弃，统一跳到目标域名)，
                    // \2=端口(丢弃)，\3=路径+查询参数(完整保留)
                    regexSubstitution: `https://${rule.target}\\3`
                }
            },
            condition: {
                // 结尾 $ 锚定，避免误匹配 south-plus.net.evil.com 之类的域名
                regexFilter: `^https?://(.*\\.)?${escapeRegExp(rule.original)}(:\\d+)?(/.*)?$`,
                resourceTypes: RESOURCE_TYPES
            }
        }));

        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existing.map(r => r.id),
            addRules: netRules
        });
        console.log(`[DomainReplacer] 规则已生效：共 ${netRules.length} 条`);
    } catch (err) {
        console.error('[DomainReplacer] 更新规则失败：', err);
    }
}
