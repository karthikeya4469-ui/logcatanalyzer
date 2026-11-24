export const DEFAULT_RULES = {
  tags: [],
  regexRules: [],
}

export const RULES_STORAGE_KEY = 'logscope-custom-rules-v1'

export const CATEGORIES = {
  JAVA_CRASH: { label: 'Java crash', color: '#fb7185', severity: 'Fatal' },
  ANR: { label: 'ANR', color: '#fbbf24', severity: 'Error' },
  NATIVE_TOMBSTONE: { label: 'Native', color: '#c084fc', severity: 'Fatal' },
  SYSTEM_KERNEL_HW: { label: 'System / HW', color: '#38bdf8', severity: 'Warning' },
  CUSTOM_APP_TAG: { label: 'Custom rule', color: '#6ee7c0', severity: 'Notice' },
}

export function loadRules() {
  try {
    const saved = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return DEFAULT_RULES
    return {
      tags: Array.isArray(saved.tags) ? saved.tags.filter((tag) => typeof tag === 'string') : [],
      regexRules: Array.isArray(saved.regexRules)
        ? saved.regexRules.filter((rule) => rule && typeof rule.pattern === 'string')
        : [],
    }
  } catch {
    return DEFAULT_RULES
  }
}
