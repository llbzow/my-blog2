(function() {
    function initHashTool() {
        const container = document.getElementById('tool-hash-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const inputText = document.getElementById('input-text');
        const resMd5 = document.getElementById('res-md5');
        const resSha1 = document.getElementById('res-sha1');
        const resSha256 = document.getElementById('res-sha256');
        const resSha512 = document.getElementById('res-sha512');
        const copyBtns = document.querySelectorAll('.copy-btn');

        async function calculateHash() {
            const text = inputText.value;
            if (!text) {
                resMd5.innerText = '-';
                resSha1.innerText = '-';
                resSha256.innerText = '-';
                resSha512.innerText = '-';
                return;
            }

            if (typeof CryptoJS !== 'undefined') {
                resMd5.innerText = CryptoJS.MD5(text).toString();
                resSha1.innerText = CryptoJS.SHA1(text).toString();
                resSha256.innerText = CryptoJS.SHA256(text).toString();
                resSha512.innerText = CryptoJS.SHA512(text).toString();
                return;
            }

            // 原生 Web Crypto API 兜底
            if (window.crypto && crypto.subtle) {
                try {
                    const enc = new TextEncoder().encode(text);
                    const hashBuffer256 = await crypto.subtle.digest('SHA-256', enc);
                    resSha256.innerText = Array.from(new Uint8Array(hashBuffer256)).map(b => b.toString(16).padStart(2, '0')).join('');
                    
                    const hashBuffer1 = await crypto.subtle.digest('SHA-1', enc);
                    resSha1.innerText = Array.from(new Uint8Array(hashBuffer1)).map(b => b.toString(16).padStart(2, '0')).join('');
                    resMd5.innerText = '（原生引擎暂不支持 MD5，等待 CryptoJS 加载）';
                    resSha512.innerText = '-';
                    return;
                } catch(e) {}
            }

            resMd5.innerText = '正在等待哈希核心库就绪...';
        }

        inputText.addEventListener('input', calculateHash);

        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-copy-target');
                const text = document.getElementById(targetId).innerText;
                if (text === '-' || text.includes('失败') || text.includes('等待')) return;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = e.target.innerText;
                    e.target.innerText = '已复制';
                    setTimeout(() => e.target.innerText = originalText, 1000);
                });
            });
        });

        // Check if library loaded with max timeout to prevent infinite loop
        let attempts = 0;
        const checkLib = setInterval(() => {
            attempts++;
            if (typeof CryptoJS !== 'undefined') {
                clearInterval(checkLib);
                calculateHash();
            } else if (attempts >= 10) {
                clearInterval(checkLib);
            }
        }, 500);
    }

    document.addEventListener('DOMContentLoaded', initHashTool);
    document.addEventListener('pjax:complete', initHashTool);
})();
