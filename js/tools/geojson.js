(function() {
    let map = null;
    let geoJsonLayer = null;
    const API_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=';

    function initGeoJsonTool() {
        const container = document.getElementById('tool-geojson-container');
        if (!container) return;

        // Stop click propagation to prevent global theme effects
        container.addEventListener('click', (e) => e.stopPropagation());

        const input = document.getElementById('geojson-input');
        const btnLoad = document.getElementById('btn-load');
        const btnDownload = document.getElementById('btn-download-json');
        const btnQuery = document.getElementById('btn-query-area');
        const selectProv = document.getElementById('select-prov');
        const selectCity = document.getElementById('select-city');
        const selectDist = document.getElementById('select-dist');
        const errorMsg = document.getElementById('error-msg');

        if (map) { map.remove(); map = null; }

        if (typeof L === 'undefined') {
            const checkL = setInterval(() => {
                if (typeof L !== 'undefined') {
                    clearInterval(checkL);
                    initMap();
                }
            }, 200);
        } else {
            initMap();
        }

        // Init Data
        fetchDistricts('100000', selectProv);

        function initMap() {
            if (map) return;
            // Remove attribution
            map = L.map('map', { attributionControl: false }).setView([35.8617, 104.1954], 4);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        }

        async function fetchDistricts(adcode, targetSelect) {
            try {
                targetSelect.innerHTML = '<option value="">加载中...</option>';
                const url = `${API_BASE}${adcode}_full`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Fetch failed');
                const data = await res.json();
                
                targetSelect.innerHTML = '<option value="">请选择</option>';
                data.features.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.properties.adcode;
                    opt.innerText = f.properties.name;
                    targetSelect.appendChild(opt);
                });
                targetSelect.disabled = false;
            } catch (e) {
                targetSelect.innerHTML = '<option value="">无下级/未找到</option>';
                targetSelect.disabled = true;
            }
        }

        selectProv.addEventListener('change', () => {
            selectCity.innerHTML = '<option value="">选择城市</option>';
            selectDist.innerHTML = '<option value="">选择区县</option>';
            if (selectProv.value) fetchDistricts(selectProv.value, selectCity);
        });

        selectCity.addEventListener('change', () => {
            selectDist.innerHTML = '<option value="">选择区县</option>';
            if (selectCity.value) fetchDistricts(selectCity.value, selectDist);
        });

        btnQuery.addEventListener('click', async () => {
            const code = selectDist.value || selectCity.value || selectProv.value;
            if (!code) {
                alert('请先选择一个区域');
                return;
            }
            btnQuery.disabled = true;
            btnQuery.innerText = '查询中...';

            let data = null;
            try {
                // Try _full first for children details
                const res = await fetch(`${API_BASE}${code}_full`);
                if (res.ok) data = await res.json();
                else {
                    // Fallback to boundary only
                    const res2 = await fetch(`${API_BASE}${code}`);
                    if (res2.ok) data = await res2.json();
                }
            } catch (e) {}

            btnQuery.disabled = false;
            btnQuery.innerText = '查询区域';

            if (data) {
                input.value = JSON.stringify(data, null, 2);
                loadGeoJSON();
            } else {
                alert('获取数据失败，请稍后重试');
            }
        });

        function loadGeoJSON() {
            const val = input.value.trim();
            errorMsg.style.display = 'none';
            if (!val) return;

            try {
                const data = JSON.parse(val);
                if (geoJsonLayer) map.removeLayer(geoJsonLayer);

                geoJsonLayer = L.geoJSON(data, {
                    onEachFeature: function (feature, layer) {
                        if (feature.properties) {
                            let popup = '<div style="max-height: 200px; overflow-y: auto;"><table>';
                            for (const k in feature.properties) {
                                popup += `<tr><td><strong>${k}</strong></td><td>${feature.properties[k]}</td></tr>`;
                            }
                            popup += '</table></div>';
                            layer.bindPopup(popup);
                        }
                    }
                }).addTo(map);

                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) map.fitBounds(bounds);

            } catch (e) {
                errorMsg.innerText = 'JSON 解析错误: ' + e.message;
                errorMsg.style.display = 'block';
            }
        }

        btnLoad.addEventListener('click', loadGeoJSON);
        
        btnDownload.addEventListener('click', () => {
            if (!input.value) return;
            const blob = new Blob([input.value], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "data.geojson";
            a.click();
        });
    }

    document.addEventListener('DOMContentLoaded', initGeoJsonTool);
    document.addEventListener('pjax:complete', initGeoJsonTool);
})();
