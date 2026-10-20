(function() {
    function initBase64Tool() {
        const container = document.getElementById('tool-base64-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const outputBase64 = document.getElementById('output-base64');
        const btnCopy = document.getElementById('btn-copy');
        const btnClear = document.getElementById('btn-clear');
        const inputBase64 = document.getElementById('input-base64');
        const btnPreview = document.getElementById('btn-preview');
        const imagePreview = document.getElementById('image-preview');

        // Image to Base64
        function processFile(file) {
            if (!file.type.startsWith('image/')) {
                alert('请上传图片文件');
                return;
            }
            outputBase64.value = '处理中...';
            const reader = new FileReader();
            reader.onload = (e) => {
                outputBase64.value = e.target.result;
            };
            reader.onerror = () => {
                alert('读取文件失败');
                outputBase64.value = '';
            };
            reader.readAsDataURL(file);
        }

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = '#eef4fe';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.background = '';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = '';
            const files = e.dataTransfer.files;
            if (files.length) processFile(files[0]);
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) processFile(fileInput.files[0]);
        });

        btnCopy.addEventListener('click', () => {
            if (!outputBase64.value || outputBase64.value === '处理中...') return;
            outputBase64.select();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(outputBase64.value).then(() => {
                    const prevText = btnCopy.textContent;
                    btnCopy.textContent = '已复制！';
                    setTimeout(() => { btnCopy.textContent = prevText; }, 1200);
                });
            } else {
                document.execCommand('copy');
                const prevText = btnCopy.textContent;
                btnCopy.textContent = '已复制！';
                setTimeout(() => { btnCopy.textContent = prevText; }, 1200);
            }
        });

        btnClear.addEventListener('click', () => {
            outputBase64.value = '';
            fileInput.value = '';
        });

        // Base64 to Image (支持自动补齐 data:image 前缀)
        btnPreview.addEventListener('click', () => {
            let val = inputBase64.value.trim();
            if (!val) {
                imagePreview.innerHTML = '<span style="color: #999;">预览区域</span>';
                return;
            }
            if (!val.startsWith('data:image/')) {
                // 如果只输入了裸 Base64 编码，自动补全 data:image/png;base64,
                val = 'data:image/png;base64,' + val.replace(/^data:.*?,/, '');
            }
            imagePreview.innerHTML = `<img src="${val}" style="max-width:100%; max-height:400px; object-fit:contain; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.15);" onerror="this.parentElement.innerHTML='<span style=\\'color:#ef4444\\'>无法解析图片，请检查 Base64 代码是否有效完整</span>'">`;
        });
    }

    document.addEventListener('DOMContentLoaded', initBase64Tool);
    document.addEventListener('pjax:complete', initBase64Tool);
})();
