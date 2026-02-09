(function() {
    let originalImg = null;
    let targetR=255, targetG=255, targetB=255;

    function initRemoveBgTool() {
        const container = document.getElementById('tool-removebg-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const fileInput = document.getElementById('file-input');
        const toleranceInput = document.getElementById('tolerance');
        const tolVal = document.getElementById('tol-val');
        const targetColorBox = document.getElementById('target-color');
        const targetColorText = document.getElementById('target-color-text');
        const btnReset = document.getElementById('btn-reset');
        const btnDownload = document.getElementById('btn-download');
        const uploadBox = document.getElementById('upload-box');

        uploadBox.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', function(e) {
            if (!e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    originalImg = img;
                    renderImage();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        });

        function renderImage() {
            if (!originalImg) return;
            canvas.width = originalImg.width;
            canvas.height = originalImg.height;
            ctx.drawImage(originalImg, 0, 0);
        }

        btnReset.addEventListener('click', renderImage);

        canvas.addEventListener('click', function(e) {
            if (!originalImg) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const p = ctx.getImageData(x, y, 1, 1).data;
            targetR = p[0];
            targetG = p[1];
            targetB = p[2];
            
            const hex = "#" + ((1 << 24) + (targetR << 16) + (targetG << 8) + targetB).toString(16).slice(1);
            targetColorBox.style.background = hex;
            targetColorText.innerText = hex;
            
            processRemoval();
        });

        function processRemoval() {
            if (!originalImg) return;
            ctx.drawImage(originalImg, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const tolerance = parseInt(toleranceInput.value);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                const dist = Math.sqrt(Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2));
                
                if (dist < tolerance * 1.5) {
                    data[i+3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }
        
        toleranceInput.addEventListener('input', () => {
            tolVal.innerText = toleranceInput.value;
        });
        toleranceInput.addEventListener('change', processRemoval);

        btnDownload.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = 'removed-bg.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    document.addEventListener('DOMContentLoaded', initRemoveBgTool);
    document.addEventListener('pjax:complete', initRemoveBgTool);
})();
