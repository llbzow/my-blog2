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

        function calculateHash() {
            const text = inputText.value;
            if (!text) {
                resMd5.innerText = '-';
                resSha1.innerText = '-';
                resSha256.innerText = '-';
                resSha512.innerText = '-';
                return;
            }

            if (typeof CryptoJS === 'undefined') {
                resMd5.innerText = '加载核心库失败，请检查网络...';
                return;
            }

            resMd5.innerText = CryptoJS.MD5(text).toString();
            resSha1.innerText = CryptoJS.SHA1(text).toString();
            resSha256.innerText = CryptoJS.SHA256(text).toString();
            resSha512.innerText = CryptoJS.SHA512(text).toString();
        }

        inputText.addEventListener('input', calculateHash);

        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-copy-target');
                const text = document.getElementById(targetId).innerText;
                if (text === '-' || text.includes('失败')) return;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = e.target.innerText;
                    e.target.innerText = '已复制';
                    setTimeout(() => e.target.innerText = originalText, 1000);
                });
            });
        });

        // Check if library loaded
        const checkLib = setInterval(() => {
            if (typeof CryptoJS !== 'undefined') {
                clearInterval(checkLib);
                calculateHash();
            }
        }, 500);
    }

    document.addEventListener('DOMContentLoaded', initHashTool);
    document.addEventListener('pjax:complete', initHashTool);
})();
