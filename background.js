// background.js
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const { domainReplacementRules } = await chrome.storage.local.get('domainReplacementRules');
    if (!domainReplacementRules || domainReplacementRules.length === 0) return;

    const url = new URL(details.url);
    const originalDomain = url.hostname;
    const rule = domainReplacementRules.find(r => r.original === originalDomain);

    if (rule) {
      // 替换域名并跳转
      url.hostname = rule.target;
      return { redirectUrl: url.toString() };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);