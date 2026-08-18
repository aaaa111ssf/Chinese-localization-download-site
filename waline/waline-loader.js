// Waline ES Module → window.Waline 适配器
// waline.js 是 ES Module 格式（含 export），不能直接用 <script> 加载
// 通过 type="module" 方式加载本文件，将 Waline 挂到全局
import { init } from './waline.js';
window.Waline = { init };