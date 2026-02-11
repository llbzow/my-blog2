(function() {
    let selectedFile = null;
    let targetFormat = null;
    let queue = [];
    const { jsPDF } = window.jspdf;
    
    // Internal fallback key
    const DEFAULT_API_KEY = "sk-9a9f51b5638c4df79e53debf3aa12182";

    function initConverterTool() {
        const container = document.getElementById('tool-converter-container');
        if (!container) return;

        container.addEventListener('click', (e) => e.stopPropagation());

        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', handleFileSelect);

        const dropZone = document.querySelector('.drop-zone');
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#eff6ff'; });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.background = 'white'; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = 'white';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect({ target: fileInput });
            }
        });

        window.filterFormats = function(type) {
            document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.querySelectorAll('.format-item').forEach(item => {
                if (type === 'all' || item.dataset.type === type) item.style.display = 'flex';
                else item.style.display = 'none';
            });
        };
    }

    function handleFileSelect(e) {
        if (!e.target.files.length) return;
        selectedFile = e.target.files[0];
        document.getElementById('selected-file-name').innerText = selectedFile.name;
        document.querySelector('.upload-section h3').innerText = "已选择: " + selectedFile.name;
        targetFormat = null;
        document.getElementById('action-bar').style.display = 'none';
        document.querySelectorAll('.format-item').forEach(el => el.classList.remove('selected'));
    }

    window.selectFormat = function(fmt) {
        if (!selectedFile) { alert('请先选择文件'); return; }
        targetFormat = fmt;
        document.getElementById('target-format-name').innerText = fmt.toUpperCase();
        document.getElementById('action-bar').style.display = 'block';
        document.querySelectorAll('.format-item').forEach(el => el.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        const aiPanel = document.getElementById('ai-settings-panel');
        aiPanel.style.display = (fmt === 'ocr-md') ? 'block' : 'none';
    };

    window.startConversion = async function() {
        if (!selectedFile || !targetFormat) return;
        const id = Date.now();
        addToQueue(id, selectedFile.name, targetFormat);
        updateQueueStatus(id, 'processing');
        try {
            await processConversion(selectedFile, targetFormat, id);
            updateQueueStatus(id, 'done');
        } catch (err) {
            console.error("Conversion Error:", err);
            updateQueueStatus(id, 'error', err.message);
        }
    };

    function addToQueue(id, filename, format) {
        const q = document.getElementById('conversion-queue');
        if (q.children[0] && q.children[0].innerText.includes('暂无任务')) q.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.id = 'task-' + id;
        div.innerHTML = `<div><strong>${filename}</strong> <span style="color:#999">→ ${format.toUpperCase()}</span></div><div class="queue-status status-pending">等待中...</div>`;
        q.prepend(div);
    }

    function updateQueueStatus(id, status, msg) {
        const el = document.getElementById('task-' + id).querySelector('.queue-status');
        if (status === 'processing') {
            el.className = 'queue-status status-processing';
            el.innerText = msg || '转换中...';
        } else if (status === 'done') {
            el.className = 'queue-status status-done';
            el.innerHTML = '完成 <a href="#" onclick="downloadResult(' + id + ')">下载</a>';
        } else if (status === 'error') {
            el.className = 'queue-status status-error';
            el.innerText = '失败: ' + (msg || '未知错误');
        }
    }

    // --- Core Conversion Logic ---
    let resultBlobs = {};

    async function processConversion(file, format, id) {
        const ext = file.name.split('.').pop().toLowerCase();
        let blob, filename;

        // --- 1. AI OCR (PDF/Image -> OCR -> LLM -> Markdown) ---
        if (format === 'ocr-md') {
            const userKey = document.getElementById('api-key').value.trim();
            const apiKey = userKey || DEFAULT_API_KEY;

            let fullText = "";
            let worker = null;

            try {
                // Initialize Tesseract Worker ONCE
                updateQueueStatus(id, 'processing', '初始化 OCR 引擎...');
                worker = Tesseract.createWorker({ logger: m => console.log(m) });
                await worker.load();
                await worker.loadLanguage('eng+chi_sim');
                await worker.initialize('eng+chi_sim');

                if (ext === 'pdf') {
                    const arrayBuffer = await file.arrayBuffer();
                    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
                    const pdf = await loadingTask.promise;
                    
                    // Iterate ALL pages
                    for (let i = 1; i <= pdf.numPages; i++) {
                        updateQueueStatus(id, 'processing', `正在识别第 ${i}/${pdf.numPages} 页...`);
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({scale: 2.0});
                        const cvs = document.createElement('canvas');
                        cvs.width = viewport.width; cvs.height = viewport.height;
                        await page.render({canvasContext: cvs.getContext('2d'), viewport}).promise;
                        const imgData = cvs.toDataURL('image/jpeg');
                        
                        const result = await worker.recognize(imgData);
                        fullText += `\n\n## Page ${i}\n\n` + result.data.text;
                    }
                } else {
                    // Image
                    updateQueueStatus(id, 'processing', '正在识别图片...');
                    const imgData = await readFileAsDataURL(file);
                    const result = await worker.recognize(imgData);
                    fullText = result.data.text;
                }
                
                await worker.terminate();
            } catch (e) {
                if(worker) await worker.terminate();
                throw new Error("OCR 识别失败: " + e.message);
            }

            if (!fullText.trim()) throw new Error('OCR 未识别到有效文字');

            // LLM Processing
            updateQueueStatus(id, 'processing', 'AI 正在排版整理...');
            // Chunking if too large (DeepSeek limit approx 32k chars, safe limit 10k per chunk)
            // For now, simple truncate or send all if small
            const MAX_CHARS = 15000;
            const textToSend = fullText.length > MAX_CHARS ? fullText.substring(0, MAX_CHARS) + "\n\n(Text truncated due to length limit)..." : fullText;

            try {
                const response = await fetch("https://api.deepseek.com/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            { role: "system", content: "你是一个文档排版助手。请将用户提供的 OCR 识别文本整理成格式优美的 Markdown 文档。修复识别错误，还原标题、列表等结构，保留原始内容，不要包含其他对话。" },
                            { role: "user", content: textToSend }
                        ],
                        stream: false
                    })
                });
                
                if (!response.ok) throw new Error(`API 调用失败: ${response.status}`);
                const data = await response.json();
                if (!data.choices) throw new Error("API 返回格式异常");
                
                blob = new Blob([data.choices[0].message.content], { type: 'text/markdown' });
                filename = file.name + '.md';
            } catch(e) {
                throw new Error("AI 处理失败: " + e.message);
            }
        }

        // --- 2. Smart TXT Extraction (OCR fallback) ---
        else if (format === 'txt') {
            if (ext === 'pdf') {
                updateQueueStatus(id, 'processing', '正在提取文本...');
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument(arrayBuffer);
                const pdf = await loadingTask.promise;
                
                let fullText = '';
                let needsOCR = false;

                // Try normal extraction first
                for(let i=1; i<=pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    if (pageText.length < 50) needsOCR = true; // Heuristic: Scanned PDF has little text
                    fullText += pageText + '\n\n';
                }

                // If text is too short, assume scanned PDF and use OCR
                if (needsOCR || fullText.trim().length < 20) {
                    console.log("Detecting scanned PDF, switching to OCR mode...");
                    updateQueueStatus(id, 'processing', '检测到扫描件，启用 OCR...');
                    fullText = ""; // Reset
                    
                    const worker = Tesseract.createWorker();
                    await worker.load();
                    await worker.loadLanguage('eng+chi_sim');
                    await worker.initialize('eng+chi_sim');

                    for(let i=1; i<=pdf.numPages; i++) {
                        updateQueueStatus(id, 'processing', `OCR 识别中 ${i}/${pdf.numPages}...`);
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({scale: 1.5});
                        const cvs = document.createElement('canvas');
                        cvs.width = viewport.width; cvs.height = viewport.height;
                        await page.render({canvasContext: cvs.getContext('2d'), viewport}).promise;
                        const result = await worker.recognize(cvs.toDataURL('image/jpeg'));
                        fullText += result.data.text + '\n\n';
                    }
                    await worker.terminate();
                }
                
                blob = new Blob([fullText], { type: 'text/plain' });
                filename = file.name + '.txt';
            } else if (['jpg','png','jpeg'].includes(ext)) {
                // Image -> Text (Always OCR)
                updateQueueStatus(id, 'processing', 'OCR 识别中...');
                const worker = Tesseract.createWorker();
                await worker.load();
                await worker.loadLanguage('eng+chi_sim');
                await worker.initialize('eng+chi_sim');
                const imgData = await readFileAsDataURL(file);
                const result = await worker.recognize(imgData);
                await worker.terminate();
                
                blob = new Blob([result.data.text], { type: 'text/plain' });
                filename = file.name + '.txt';
            } else if (ext === 'md') {
                const text = await file.text();
                // Strip HTML
                const temp = document.createElement("div");
                temp.innerHTML = marked.parse(text);
                blob = new Blob([temp.innerText], { type: 'text/plain' });
                filename = file.name + '.txt';
            }
        }

        // --- 3. MD -> HTML/PDF ---
        else if (ext === 'md') {
            const text = await file.text();
            if (format === 'html') {
                const html = marked.parse(text);
                blob = new Blob([html], { type: 'text/html' });
                filename = file.name + '.html';
            } else if (format === 'pdf') {
                const html = marked.parse(text);
                const container = createHiddenContainer(html);
                document.body.appendChild(container);
                const canvas = await html2canvas(container);
                const pdf = new jsPDF();
                const imgData = canvas.toDataURL('image/jpeg');
                addImageToPDF(pdf, imgData);
                blob = pdf.output('blob');
                filename = file.name + '.pdf';
                document.body.removeChild(container);
            }
        }

        // --- 4. Excel/Data ---
        else if (['xlsx', 'xls', 'csv'].includes(ext)) {
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab, {type: 'array'});
            const ws = wb.Sheets[wb.SheetNames[0]];
            
            if (format === 'csv') {
                const csv = XLSX.utils.sheet_to_csv(ws);
                blob = new Blob([csv], {type: 'text/csv'});
                filename = file.name + '.csv';
            } else if (format === 'json') {
                const json = JSON.stringify(XLSX.utils.sheet_to_json(ws), null, 2);
                blob = new Blob([json], {type: 'application/json'});
                filename = file.name + '.json';
            } else if (format === 'xlsx' && ext === 'csv') {
                 const newWb = XLSX.utils.book_new();
                 XLSX.utils.book_append_sheet(newWb, ws, "Sheet1");
                 const wbout = XLSX.write(newWb, {bookType:'xlsx', type:'array'});
                 blob = new Blob([wbout], {type:"application/octet-stream"});
                 filename = file.name + '.xlsx';
            }
        }

        // --- 5. Docx -> PDF ---
        else if (ext === 'docx' && format === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            const container = createHiddenContainer(result.value);
            document.body.appendChild(container);
            const canvas = await html2canvas(container);
            const pdf = new jsPDF();
            const imgData = canvas.toDataURL('image/jpeg');
            addImageToPDF(pdf, imgData);
            blob = pdf.output('blob');
            filename = file.name.replace('.docx', '.pdf');
            document.body.removeChild(container);
        }

        // --- 6. Image -> PDF/JPG/PNG ---
        else if (['jpg', 'png', 'jpeg', 'webp', 'bmp'].includes(ext)) {
            const imgData = await readFileAsDataURL(file);
            if (format === 'pdf') {
                const pdf = new jsPDF();
                addImageToPDF(pdf, imgData);
                blob = pdf.output('blob');
                filename = file.name + '.pdf';
            } else if (['jpg', 'png'].includes(format)) {
                 const img = await loadImage(imgData);
                 const cvs = document.createElement('canvas');
                 cvs.width = img.width; cvs.height = img.height;
                 cvs.getContext('2d').drawImage(img, 0, 0);
                 const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
                 const newData = cvs.toDataURL(mime);
                 blob = dataURLtoBlob(newData);
                 filename = file.name + '.' + format;
            }
        }

        // --- 7. PDF -> Visual Docx / Images ---
        else if (ext === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;

            if (format === 'pdf-img') {
                const zip = new JSZip();
                for(let i=1; i<=pdf.numPages; i++) {
                    updateQueueStatus(id, 'processing', `导出图片 ${i}/${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({scale: 1.5});
                    const cvs = document.createElement('canvas');
                    cvs.height = viewport.height;
                    cvs.width = viewport.width;
                    await page.render({canvasContext: cvs.getContext('2d'), viewport}).promise;
                    const imgData = cvs.toDataURL('image/jpeg').split(',')[1];
                    zip.file(`page-${i}.jpg`, imgData, {base64: true});
                }
                blob = await zip.generateAsync({type:"blob"});
                filename = file.name + '-images.zip';
            }
            else if (format === 'docx') {
                if (typeof docx === 'undefined') throw new Error('Docx library not loaded');
                const docChildren = [];
                for(let i=1; i<=pdf.numPages; i++) {
                     updateQueueStatus(id, 'processing', `转换页面 ${i}/${pdf.numPages}...`);
                     const page = await pdf.getPage(i);
                     const viewport = page.getViewport({scale: 1.5}); 
                     const cvs = document.createElement('canvas');
                     cvs.height = viewport.height;
                     cvs.width = viewport.width;
                     await page.render({canvasContext: cvs.getContext('2d'), viewport}).promise;
                     const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
                     const base64Data = dataUrl.split(',')[1];
                     const binaryString = window.atob(base64Data);
                     const bytes = new Uint8Array(binaryString.length);
                     for (let j = 0; j < binaryString.length; j++) { bytes[j] = binaryString.charCodeAt(j); }
                     const imageRun = new docx.ImageRun({
                         data: bytes,
                         transformation: { width: 600, height: (viewport.height / viewport.width) * 600 },
                     });
                     docChildren.push(new docx.Paragraph({ children: [imageRun] }));
                }
                const doc = new docx.Document({ sections: [{ children: docChildren }] });
                blob = await docx.Packer.toBlob(doc);
                filename = file.name.replace('.pdf', '.docx');
            }
        }
        
        if (!blob) throw new Error(`暂不支持 ${ext} -> ${format} 转换`);
        resultBlobs[id] = { blob: blob, filename: filename };
    }

    // Helpers (createHiddenContainer, addImageToPDF, loadImage, readFileAsDataURL, dataURLtoBlob, downloadResult) omitted for brevity but assumed present if unchanged...
    // WAIT, I must include helpers or the code will break. Re-including them.
    function createHiddenContainer(html) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.width = '790px'; 
        div.style.background = 'white';
        div.style.padding = '40px';
        div.style.color = '#000';
        div.innerHTML = html;
        return div;
    }

    function addImageToPDF(pdf, imgData) {
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        if (pdfHeight > pdf.internal.pageSize.getHeight()) {
             pdf.internal.pageSize.setHeight(pdfHeight);
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    window.downloadResult = function(id) {
        const res = resultBlobs[id];
        if (!res) return;
        saveAs(res.blob, res.filename); 
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initConverterTool);
    } else {
        initConverterTool();
    }
})();