// 兼容旧路径：所有 API 共用安全工具统一由 functions/_lib.js 提供。
export {
    consumeRateLimit,
    corsHeaders,
    ensureUserCookie,
    getIpHash,
    getUserKey,
    isSameOriginWrite,
    isValidModName,
    json
} from '../_lib.js';
