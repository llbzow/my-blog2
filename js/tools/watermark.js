(function() {
    function initWatermarkTool() {
        const container = document.getElementById('tool-watermark-container');
        if (!container) return;

        // Stop propagation
        container.addEventListener('click', (e) => e.stopPropagation());

        let wmType = 'text';
        let visImg = new Image();
        let wmImg = new Image(); // For image watermark

        // Tabs
        window.switchTab = function(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tool-section-content').forEach(s => s.style.display = 'none');
            
            if (tab === 'visible') {
                document.querySelector('.tab:nth-child(1)').classList.add('active');
                document.getElementById('tab-visible').style.display = 'block';
            } else {
                document.querySelector('.tab:nth-child(2)').classList.add('active');
                document.getElementById('tab-invisible').style.display = 'block';
            }
        };

        window.toggleWmType = function() {
            const val = document.querySelector('input[name="wm-type"]:checked').value;
            wmType = val;
            if (val === 'text') {
                document.getElementById('ctrl-text-group').style.display = 'contents';
                document.getElementById('ctrl-image-group').style.display = 'none';
            } else {
                document.getElementById('ctrl-text-group').style.display = 'none';
                document.getElementById('ctrl-image-group').style.display = 'grid'; // grid or contents
                // Actually image controls are in a grid-column span 2
                document.getElementById('ctrl-image-group').style.display = 'contents'; 
            }
            drawVisible();
        };

        window.downloadCanvas = function(id, name) {
            const c = document.getElementById(id);
            if (c.width === 0) return;
            const link = document.createElement('a');
            link.download = name;
            link.href = c.toDataURL();
            link.click();
        }

        // --- Visible Watermark ---
        const visFile = document.getElementById('vis-file');
        const wmImgFile = document.getElementById('wm-img-file');
        
        visFile.addEventListener('change', function(e) {
            if(!e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                visImg.onload = drawVisible;
                visImg.src = event.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        });

        wmImgFile.addEventListener('change', function(e) {
            if(!e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                wmImg.onload = drawVisible;
                wmImg.src = event.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        });

        // Add listeners to controls
        ['vis-text', 'vis-size', 'vis-color', 'vis-opacity', 'vis-pos', 'wm-scale'].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('input', drawVisible);
                el.addEventListener('change', drawVisible);
            }
        });

        function drawVisible() {
            if (!visImg.src) return;
            const cvs = document.getElementById('vis-canvas');
            const ctx = cvs.getContext('2d');
            
            cvs.width = visImg.width;
            cvs.height = visImg.height;
            ctx.drawImage(visImg, 0, 0);

            const opacity = parseFloat(document.getElementById('vis-opacity').value);
            const pos = document.getElementById('vis-pos').value;
            ctx.globalAlpha = opacity;

            if (wmType === 'text') {
                const text = document.getElementById('vis-text').value;
                const size = parseInt(document.getElementById('vis-size').value);
                const color = document.getElementById('vis-color').value;
                ctx.font = `bold ${size}px sans-serif`;
                ctx.fillStyle = color;
                
                drawContent(ctx, pos, (x, y) => ctx.fillText(text, x, y), cvs.width, cvs.height, 300, 150);
            } else if (wmType === 'image' && wmImg.src) {
                const scale = parseFloat(document.getElementById('wm-scale').value);
                const w = wmImg.width * scale;
                const h = wmImg.height * scale;
                
                drawContent(ctx, pos, (x, y) => ctx.drawImage(wmImg, x - w/2, y - h/2, w, h), cvs.width, cvs.height, w * 1.5, h * 1.5);
            }
        }

        function drawContent(ctx, pos, drawFn, w, h, spaceX, spaceY) {
            if (pos === 'center') {
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                drawFn(w/2, h/2);
            } else if (pos === 'bottom-right') {
                ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
                drawFn(w - 20, h - 20);
            } else if (pos === 'top-left') {
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                drawFn(20, 20);
            } else if (pos === 'repeat') {
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.rotate(-45 * Math.PI / 180);
                const diag = Math.sqrt(w*w + h*h);
                // Draw in rotated grid
                for (let x = -diag; x < diag; x += spaceX) {
                    for (let y = -diag; y < diag; y += spaceY) {
                        drawFn(x, y);
                    }
                }
                ctx.setTransform(1, 0, 0, 1, 0, 0); 
            }
        }

        // --- Invisible Watermark (LSB) ---
        let invisImg = new Image();
        document.getElementById('invis-file').addEventListener('change', function(e) {
            if(!e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                invisImg.onload = () => {
                    const cvs = document.getElementById('invis-canvas');
                    cvs.width = invisImg.width;
                    cvs.height = invisImg.height;
                    const ctx = cvs.getContext('2d');
                    ctx.drawImage(invisImg, 0, 0);
                    document.getElementById('invis-result').innerText = '';
                };
                invisImg.src = event.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        });

        window.encodeLSB = function() {
            if (!invisImg.src) return;
            const text = document.getElementById('invis-text').value;
            if (!text) { alert('请输入文字'); return; }

            const cvs = document.getElementById('invis-canvas');
            const ctx = cvs.getContext('2d');
            const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const data = imgData.data;

            let binary = '';
            const len = text.length;
            binary += len.toString(2).padStart(16, '0');
            for (let i = 0; i < len; i++) binary += text.charCodeAt(i).toString(2).padStart(16, '0');

            if (binary.length > data.length / 4) { alert('文字太长'); return; }

            let bitIdx = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (bitIdx >= binary.length) break;
                data[i] = (data[i] & 0xFE) | parseInt(binary[bitIdx]);
                bitIdx++;
            }
            ctx.putImageData(imgData, 0, 0);
            alert('加密完成！');
        }

        window.decodeLSB = function() {
            if (!invisImg.src) return;
            const cvs = document.getElementById('invis-canvas');
            const ctx = cvs.getContext('2d');
            const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const data = imgData.data;

            let lenBin = '';
            for (let i = 0; i < 16 * 4; i += 4) lenBin += (data[i] & 1).toString();
            const len = parseInt(lenBin, 2);

            if (len <= 0 || len > 10000) {
                document.getElementById('invis-result').innerText = '未检测到水印';
                return;
            }

            let text = '';
            let charBin = '';
            let bitCount = 0;
            for (let i = 64; i < data.length; i += 4) { // Start after 16*4 = 64 bytes
                charBin += (data[i] & 1).toString();
                bitCount++;
                if (bitCount === 16) {
                    text += String.fromCharCode(parseInt(charBin, 2));
                    charBin = '';
                    bitCount = 0;
                    if (text.length === len) break;
                }
            }
            document.getElementById('invis-result').innerText = '检测结果: ' + text;
        }
    }

    document.addEventListener('DOMContentLoaded', initWatermarkTool);
    document.addEventListener('pjax:complete', initWatermarkTool);
})();
