(function() {
    function initWatermarkTool() {
        const container = document.getElementById('tool-watermark-container');
        if (!container) return;

        // Stop propagation
        container.addEventListener('click', (e) => e.stopPropagation());

        let wmType = 'text';
        let visImg = new Image();
        let wmImg = new Image(); // For image watermark

        // --- Tabs ---
        window.switchTab = function(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tool-section-content').forEach(s => s.style.display = 'none');
            
            if (tab === 'visible') {
                document.querySelector('.tab:nth-child(1)').classList.add('active');
                document.getElementById('tab-visible').style.display = 'block';
            } else if (tab === 'invisible') {
                document.querySelector('.tab:nth-child(2)').classList.add('active');
                document.getElementById('tab-invisible').style.display = 'block';
            } else {
                document.querySelector('.tab:nth-child(3)').classList.add('active');
                document.getElementById('tab-remove').style.display = 'block';
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
            const text = document.getElementById('invis-text').value;
            if (!text || !invisImg.src) return alert('请先上传图片并输入文字');
            
            const cvs = document.getElementById('invis-canvas');
            const ctx = cvs.getContext('2d');
            const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const data = imgData.data;
            
            // Simple LSB encoding (Text -> Binary -> Modify R channel LSB)
            // Implementation simplified for brevity
            alert('隐写功能演示：实际写入需完整二进制编码逻辑');
        };

        window.decodeLSB = function() {
             alert('隐写功能演示：实际读取需完整二进制解码逻辑');
        };


        // --- Remove Watermark (New) ---
        let removeFile = document.getElementById('remove-file');
        let removeImgData = null; // Store original img data for undo
        let pdfFileBytes = null;
        let isMaskMode = false;

        removeFile.addEventListener('change', async function(e) {
            if(!e.target.files.length) return;
            const file = e.target.files[0];
            
            if (file.type.startsWith('image/')) {
                document.getElementById('remove-image-ui').style.display = 'block';
                document.getElementById('remove-pdf-ui').style.display = 'none';
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const cvs = document.getElementById('remove-canvas');
                        cvs.width = img.width;
                        cvs.height = img.height;
                        const ctx = cvs.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        removeImgData = ctx.getImageData(0, 0, cvs.width, cvs.height); // Save for undo
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
                
                initBrush();

            } else if (file.type === 'application/pdf') {
                document.getElementById('remove-image-ui').style.display = 'none';
                document.getElementById('remove-pdf-ui').style.display = 'block';
                
                pdfFileBytes = await file.arrayBuffer();
                renderPDF(pdfFileBytes);
            }
        });

        // Image Brush Logic
        function initBrush() {
            const cvs = document.getElementById('remove-canvas');
            const ctx = cvs.getContext('2d');
            let isDrawing = false;

            cvs.onmousedown = (e) => {
                isDrawing = true;
                ctx.beginPath();
                const rect = cvs.getBoundingClientRect();
                const scaleX = cvs.width / rect.width;
                const scaleY = cvs.height / rect.height;
                ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
            };
            
            cvs.onmousemove = (e) => {
                if (!isDrawing) return;
                const rect = cvs.getBoundingClientRect();
                const scaleX = cvs.width / rect.width;
                const scaleY = cvs.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const size = document.getElementById('brush-size').value;

                // Simple Inpainting: Fill with average color of surrounding area? 
                // Or just blur? Let's do a simple clone effect (taking pixel from nearby)
                // For demo, we just smear using a blur-like effect by drawing with low opacity
                // Actually, a simple 'blur' brush is easier to implement
                
                ctx.lineWidth = size;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#fff'; // White out for simplicity or...
                // Better: Get color from nearby? Too complex for this snippet.
                // Let's implement a 'Blur' brush by copying a region slightly offset
                
                // Demo: Just paint white (assuming white background document)
                // or blur.
                ctx.save();
                ctx.filter = 'blur(5px)';
                ctx.globalCompositeOperation = 'source-over';
                // Draw line
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.restore();
            };
            
            cvs.onmouseup = () => isDrawing = false;
        }

        window.undoRemove = function() {
            if (!removeImgData) return;
            const cvs = document.getElementById('remove-canvas');
            const ctx = cvs.getContext('2d');
            ctx.putImageData(removeImgData, 0, 0);
        }

        // PDF Logic
        async function renderPDF(data) {
            const loadingTask = pdfjsLib.getDocument(data);
            const pdf = await loadingTask.promise;
            const container = document.getElementById('pdf-container');
            container.innerHTML = ''; // Clear

            // Render first 3 pages only for demo performance
            const numPages = Math.min(pdf.numPages, 3);
            
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const scale = 1.0;
                const viewport = page.getViewport({scale: scale});

                const wrapper = document.createElement('div');
                wrapper.className = 'pdf-page-wrapper';
                wrapper.dataset.pageIndex = i - 1; // 0-based
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;

                wrapper.appendChild(canvas);
                container.appendChild(wrapper);

                // Add mask listener
                initMasking(wrapper);
            }
        }

        window.toggleMaskMode = function() {
            isMaskMode = !isMaskMode;
            const btn = document.getElementById('btn-add-mask-mode');
            btn.style.background = isMaskMode ? '#e6a23c' : '#49b1f5';
            btn.innerText = isMaskMode ? '退出框选模式' : '🔳 进入框选模式';
        }

        function initMasking(wrapper) {
            let startX, startY;
            let currentMask = null;

            wrapper.addEventListener('mousedown', (e) => {
                if (!isMaskMode) return;
                const rect = wrapper.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                
                currentMask = document.createElement('div');
                currentMask.className = 'remove-mask';
                currentMask.style.left = startX + 'px';
                currentMask.style.top = startY + 'px';
                wrapper.appendChild(currentMask);
            });

            wrapper.addEventListener('mousemove', (e) => {
                if (!isMaskMode || !currentMask) return;
                const rect = wrapper.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                const left = Math.min(currentX, startX);
                const top = Math.min(currentY, startY);

                currentMask.style.width = width + 'px';
                currentMask.style.height = height + 'px';
                currentMask.style.left = left + 'px';
                currentMask.style.top = top + 'px';
            });

            wrapper.addEventListener('mouseup', () => {
                currentMask = null;
            });
        }

        window.saveCleanPDF = async function() {
            if (!pdfFileBytes) return;
            const { PDFDocument, rgb } = PDFLib;
            const pdfDoc = await PDFDocument.load(pdfFileBytes);
            const pages = pdfDoc.getPages();
            
            // Iterate over all DOM wrappers to find masks
            const wrappers = document.querySelectorAll('.pdf-page-wrapper');
            
            wrappers.forEach(wrapper => {
                const pageIndex = parseInt(wrapper.dataset.pageIndex);
                if (pageIndex >= pages.length) return;
                
                const page = pages[pageIndex];
                const { width, height } = page.getSize();
                // Canvas size might scale, assume 1:1 for now or calculate scale
                const canvas = wrapper.querySelector('canvas');
                const scaleX = width / canvas.width;
                const scaleY = height / canvas.height;

                const masks = wrapper.querySelectorAll('.remove-mask');
                masks.forEach(mask => {
                    // DOM coords (top-left is 0,0)
                    const x = parseFloat(mask.style.left);
                    const y = parseFloat(mask.style.top);
                    const w = parseFloat(mask.style.width);
                    const h = parseFloat(mask.style.height);

                    // PDF coords (bottom-left is 0,0 usually, but PDFLib handles it)
                    // We need to convert DOM Y (from top) to PDF Y (from bottom)
                    // PDF Y = PageHeight - (DOM Y + Height) * Scale
                    
                    const rectX = x * scaleX;
                    const rectW = w * scaleX;
                    const rectH = h * scaleY;
                    const rectY = height - (y * scaleY) - rectH;

                    page.drawRectangle({
                        x: rectX,
                        y: rectY,
                        width: rectW,
                        height: rectH,
                        color: rgb(1, 1, 1), // White
                    });
                });
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'cleaned_document.pdf';
            link.click();
        };

    }

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWatermarkTool);
    } else {
        initWatermarkTool();
    }
})();
