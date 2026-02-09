(function() {
    let surfaceImg = null;
    let hiddenImg = null;

    function initMirageTankTool() {
        const container = document.getElementById('tool-mirage-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const imgSurfaceInput = document.getElementById('img-surface');
        const imgHiddenInput = document.getElementById('img-hidden');
        const btnGenerate = document.getElementById('generate-btn');
        const btnDownload = document.getElementById('btn-download');
        const canvas = document.getElementById('result-canvas');
        const resultArea = document.getElementById('result-area');
        const bgBtns = document.querySelectorAll('.preview-bg-btn');

        function handleFile(input, imgId, textId, type) {
            input.addEventListener('change', (e) => {
                if (!e.target.files.length) return;
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        document.getElementById(imgId).src = img.src;
                        document.getElementById(imgId).style.display = 'block';
                        document.getElementById(textId).style.display = 'none';
                        if (type === 'surface') surfaceImg = img;
                        else hiddenImg = img;
                        checkReady();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        function checkReady() {
            btnGenerate.disabled = !(surfaceImg && hiddenImg);
        }

        function generateMirageTank() {
            if (!surfaceImg || !hiddenImg) return;

            const width = Math.max(surfaceImg.width, hiddenImg.width);
            const height = Math.max(surfaceImg.height, hiddenImg.height);

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const cvs1 = document.createElement('canvas');
            cvs1.width = width; cvs1.height = height;
            const ctx1 = cvs1.getContext('2d');
            ctx1.fillStyle = '#fff';
            ctx1.fillRect(0, 0, width, height);
            ctx1.drawImage(surfaceImg, 0, 0, width, height);
            const data1 = ctx1.getImageData(0, 0, width, height).data;

            const cvs2 = document.createElement('canvas');
            cvs2.width = width; cvs2.height = height;
            const ctx2 = cvs2.getContext('2d');
            ctx2.fillStyle = '#000';
            ctx2.fillRect(0, 0, width, height);
            ctx2.drawImage(hiddenImg, 0, 0, width, height);
            const data2 = ctx2.getImageData(0, 0, width, height).data;

            const resultData = ctx.createImageData(width, height);
            const d = resultData.data;

            for (let i = 0; i < d.length; i += 4) {
                const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2];
                const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
                
                const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2];
                const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

                let a = (gray2 - gray1 + 255) / 255;
                if (a < 0) a = 0;
                if (a > 1) a = 1;

                let p = 0;
                if (a > 0.01) p = gray2 / a;
                if (p > 255) p = 255;

                d[i] = p;
                d[i+1] = p;
                d[i+2] = p;
                d[i+3] = a * 255;
            }

            ctx.putImageData(resultData, 0, 0);
            resultArea.style.display = 'block';
        }

        handleFile(imgSurfaceInput, 'preview-surface-img', 'preview-surface-text', 'surface');
        handleFile(imgHiddenInput, 'preview-hidden-img', 'preview-hidden-text', 'hidden');

        btnGenerate.addEventListener('click', generateMirageTank);

        bgBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-bg');
                if (type === 'white') canvas.style.background = 'white';
                else if (type === 'black') canvas.style.background = 'black';
                else canvas.style.background = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><rect width=\"10\" height=\"10\" fill=\"%23ccc\"/><rect x=\"10\" y=\"10\" width=\"10\" height=\"10\" fill=\"%23ccc\"/></svg>') repeat";
            });
        });

        btnDownload.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = 'mirage-tank.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    document.addEventListener('DOMContentLoaded', initMirageTankTool);
    document.addEventListener('pjax:complete', initMirageTankTool);
})();
