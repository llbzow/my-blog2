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
            if (!outputBase64.value) return;
            outputBase64.select();
            navigator.clipboard.writeText(outputBase64.value).then(() => alert('已复制到剪贴板'));
        });

        btnClear.addEventListener('click', () => {
            outputBase64.value = '';
            fileInput.value = '';
        });

        // Base64 to Image
        btnPreview.addEventListener('click', () => {
            const val = inputBase64.value.trim();
            if (!val) {
                imagePreview.innerHTML = '<span style="color: #999;">预览区域</span>';
                return;
            }
            imagePreview.innerHTML = `<img src="${val}" style="max-width:100%; box-shadow:0 2px 8px rgba(0,0,0,0.2);" onerror="this.parentElement.innerHTML='<span style=\\'color:red\\'>无法解析图片，请检查 Base64 代码是否完整</span>'">`;
        });
    }

    document.addEventListener('DOMContentLoaded', initBase64Tool);
    document.addEventListener('pjax:complete', initBase64Tool);
})();
