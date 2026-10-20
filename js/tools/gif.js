(function() {
    let images = [];

    function initGifTool() {
        const container = document.getElementById('tool-gif-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const fileInput = document.getElementById('file-input');
        const imgList = document.getElementById('img-list');
        const btnCreate = document.getElementById('btn-create');
        const resultGif = document.getElementById('result-gif');
        const downloadLink = document.getElementById('download-link');
        const uploadBox = document.getElementById('upload-box');

        uploadBox.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', handleFiles);

        function handleFiles(e) {
            const files = Array.from(e.target.files);
            if (!files.length) return;

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    images.push(event.target.result);
                    renderPreview();
                };
                reader.readAsDataURL(file);
            });
        }

        function renderPreview() {
            imgList.innerHTML = '';
            images.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'img-item';
                img.style.width = '80px';
                img.style.height = '80px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '4px';
                img.style.border = '1px solid #ddd';
                imgList.appendChild(img);
            });
        }

        btnCreate.addEventListener('click', createGIF);

        function createGIF() {
            if (images.length === 0) {
                alert('请先上传图片');
                return;
            }

            if (typeof gifshot === 'undefined') {
                alert('GIF 库未加载，请检查网络');
                return;
            }

            const interval = parseFloat(document.getElementById('interval').value);
            const width = parseInt(document.getElementById('gif-width').value);
            const height = parseInt(document.getElementById('gif-height').value);

            btnCreate.innerText = '生成中...';
            btnCreate.disabled = true;

            gifshot.createGIF({
                images: images,
                interval: interval,
                gifWidth: width,
                gifHeight: height,
                numFrames: images.length
            }, function(obj) {
                if(!obj.error) {
                    const image = obj.image;
                    resultGif.src = image;
                    resultGif.style.display = 'inline-block';
                    
                    downloadLink.href = image;
                    downloadLink.download = 'animation.gif';
                    downloadLink.style.display = 'inline-block';
                } else {
                    alert('生成失败');
                }
                btnCreate.innerText = '生成 GIF';
                btnCreate.disabled = false;
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initGifTool);
    document.addEventListener('pjax:complete', initGifTool);
})();
