// 代理 Waline API 请求到 Waline Worker
// 解决 workers.dev 在大陆无法访问的问题
// 浏览器访问 /waline-proxy/* 时，由本函数转发到 Waline Worker

const WALINE_WORKER = 'https://waline-on-worker.a2107478976.workers.dev';

// 需要转发 Cookie 的路径（登录相关）
const COOKIE_PATHS = ['/api/user/login', '/api/user/info', '/api/token', '/api/oauth'];

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // 提取 /waline-proxy/ 之后的路径
    const path = url.pathname.replace(/^\/waline-proxy/, '') || '/';
    const targetUrl = WALINE_WORKER + path + url.search;

    // 构造转发请求
    const headers = new Headers(request.headers);
    headers.set('Host', new URL(WALINE_WORKER).host);

    // 登录相关请求转发 Cookie
    const needsCookie = COOKIE_PATHS.some(p => path.startsWith(p));
    if (!needsCookie) {
        headers.delete('Cookie');
    }

    try {
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
        });

        // 复制响应头（允许跨域）
        const respHeaders = new Headers(response.headers);
        respHeaders.set('Access-Control-Allow-Origin', '*');
        respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(response.body, {
            status: response.status,
            headers: respHeaders
        });
    } catch (e) {
        return new Response(JSON.stringify({ errno: 1, errmsg: '评论服务不可用' }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}