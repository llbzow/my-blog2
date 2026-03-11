/**
 * 排序算法演示逻辑 (15种算法)
 */
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sort-container');
    const sizeInput = document.getElementById('array-size');
    const algorithmSelect = document.getElementById('algorithm-select');
    const speedSelect = document.getElementById('speed-select');
    const btnGenerate = document.getElementById('btn-generate');
    const btnSort = document.getElementById('btn-sort');

    let array = [];
    let isSorting = false;
    let cancelSort = false;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function generateArray() {
        if (isSorting) return;
        
        container.innerHTML = '';
        array = [];
        let size = parseInt(sizeInput.value);
        if (isNaN(size) || size < 10) size = 10;
        if (size > 100) size = 100;
        sizeInput.value = size;

        for (let i = 0; i < size; i++) {
            const value = Math.floor(Math.random() * 290) + 10;
            array.push(value);
            
            const bar = document.createElement('div');
            bar.classList.add('sort-bar');
            bar.style.height = `${value}px`;
            const barWidth = Math.max(2, Math.floor((container.clientWidth - size * 2) / size));
            bar.style.width = `${barWidth}px`;
            container.appendChild(bar);
        }
    }

    function updateBar(index, height, colorClass) {
        const bars = container.children;
        if (bars[index]) {
            if (height !== null) bars[index].style.height = `${height}px`;
            bars[index].classList.remove('comparing', 'swapping', 'sorted');
            if (colorClass) bars[index].classList.add(colorClass);
        }
    }

    // --- Algorithm Implementations ---

    async function bubbleSort() {
        const n = array.length;
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i - 1; j++) {
                if (cancelSort) return;
                updateBar(j, null, 'comparing');
                updateBar(j + 1, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if (array[j] > array[j + 1]) {
                    updateBar(j, null, 'swapping');
                    updateBar(j + 1, null, 'swapping');
                    let temp = array[j]; array[j] = array[j + 1]; array[j + 1] = temp;
                    updateBar(j, array[j], null);
                    updateBar(j + 1, array[j + 1], null);
                } else {
                    updateBar(j, null, null);
                    updateBar(j + 1, null, null);
                }
            }
            updateBar(n - i - 1, null, 'sorted');
        }
        updateBar(0, null, 'sorted');
    }

    async function selectionSort() {
        const n = array.length;
        for (let i = 0; i < n - 1; i++) {
            let minIndex = i;
            updateBar(minIndex, null, 'swapping');
            for (let j = i + 1; j < n; j++) {
                if (cancelSort) return;
                updateBar(j, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if (array[j] < array[minIndex]) {
                    if (minIndex !== i) updateBar(minIndex, null, null);
                    minIndex = j;
                    updateBar(minIndex, null, 'swapping');
                } else {
                    updateBar(j, null, null);
                }
            }
            if (minIndex !== i) {
                updateBar(i, null, 'swapping');
                await sleep(parseInt(speedSelect.value));
                let temp = array[i]; array[i] = array[minIndex]; array[minIndex] = temp;
                updateBar(i, array[i], null);
                updateBar(minIndex, array[minIndex], null);
            } else {
                updateBar(i, null, null);
            }
            updateBar(i, null, 'sorted');
        }
        updateBar(n - 1, null, 'sorted');
    }

    async function insertionSort() {
        const n = array.length;
        updateBar(0, null, 'sorted');
        for (let i = 1; i < n; i++) {
            if (cancelSort) return;
            let key = array[i];
            let j = i - 1;
            updateBar(i, null, 'swapping');
            await sleep(parseInt(speedSelect.value));
            while (j >= 0 && array[j] > key) {
                if (cancelSort) return;
                updateBar(j, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                array[j + 1] = array[j];
                updateBar(j + 1, array[j + 1], 'sorted');
                updateBar(j, null, 'swapping');
                j = j - 1;
            }
            array[j + 1] = key;
            updateBar(j + 1, array[j + 1], 'sorted');
            for(let k=0; k<=i; k++) updateBar(k, null, 'sorted');
        }
    }

    async function quickSort(start = 0, end = array.length - 1) {
        if (cancelSort) return;
        if (start >= end) {
            if(start === end && start >= 0 && start < array.length) updateBar(start, null, 'sorted');
            return;
        }
        let pivotIndex = await partition(start, end);
        if (cancelSort) return;
        updateBar(pivotIndex, null, 'sorted');
        await Promise.all([
            quickSort(start, pivotIndex - 1),
            quickSort(pivotIndex + 1, end)
        ]);
    }
    async function partition(start, end) {
        let pivotValue = array[end];
        let pivotIndex = start;
        updateBar(end, null, 'swapping');
        for (let i = start; i < end; i++) {
            if (cancelSort) return start;
            updateBar(i, null, 'comparing');
            updateBar(pivotIndex, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if (array[i] < pivotValue) {
                let temp = array[i]; array[i] = array[pivotIndex]; array[pivotIndex] = temp;
                updateBar(i, array[i], null);
                updateBar(pivotIndex, array[pivotIndex], null);
                pivotIndex++;
            } else {
                updateBar(i, null, null);
                if (pivotIndex !== i) updateBar(pivotIndex, null, null);
            }
        }
        let temp = array[pivotIndex]; array[pivotIndex] = array[end]; array[end] = temp;
        updateBar(pivotIndex, array[pivotIndex], null);
        updateBar(end, array[end], null);
        return pivotIndex;
    }

    async function mergeSort(start = 0, end = array.length - 1) {
        if (cancelSort) return;
        if (start >= end) {
            if(start === end && start >=0) updateBar(start, null, 'sorted');
            return;
        }
        let mid = Math.floor((start + end) / 2);
        await mergeSort(start, mid);
        await mergeSort(mid + 1, end);
        await merge(start, mid, end);
    }
    async function merge(start, mid, end) {
        let temp = [];
        let i = start, j = mid + 1;
        while(i <= mid && j <= end) {
            if(cancelSort) return;
            updateBar(i, null, 'comparing');
            updateBar(j, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if (array[i] <= array[j]) {
                temp.push(array[i]);
                updateBar(i, null, null); i++;
            } else {
                temp.push(array[j]);
                updateBar(j, null, null); j++;
            }
        }
        while(i <= mid) { temp.push(array[i]); i++; }
        while(j <= end) { temp.push(array[j]); j++; }
        for(let k = 0; k < temp.length; k++) {
            if(cancelSort) return;
            array[start + k] = temp[k];
            updateBar(start + k, array[start + k], 'swapping');
            await sleep(parseInt(speedSelect.value));
            updateBar(start + k, null, 'sorted');
        }
    }

    async function heapSort() {
        let n = array.length;
        for(let i = Math.floor(n/2)-1; i>=0; i--){
            await heapify(n, i);
        }
        for(let i = n-1; i>0; i--){
            if(cancelSort) return;
            updateBar(0, null, 'swapping');
            updateBar(i, null, 'swapping');
            await sleep(parseInt(speedSelect.value));
            let temp = array[0]; array[0] = array[i]; array[i] = temp;
            updateBar(0, array[0], null);
            updateBar(i, array[i], 'sorted');
            await heapify(i, 0);
        }
        if(!cancelSort) updateBar(0, null, 'sorted');
    }
    async function heapify(n, i) {
        if(cancelSort) return;
        let largest = i;
        let l = 2*i + 1;
        let r = 2*i + 2;
        if (l < n) {
            updateBar(l, null, 'comparing');
            updateBar(largest, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if(array[l] > array[largest]) largest = l;
            updateBar(l, null, null);
            updateBar(i, null, null);
        }
        if (r < n) {
            updateBar(r, null, 'comparing');
            updateBar(largest, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if(array[r] > array[largest]) largest = r;
            updateBar(r, null, null);
            if(largest!=r) updateBar(largest, null, null);
        }
        if (largest !== i) {
            updateBar(i, null, 'swapping');
            updateBar(largest, null, 'swapping');
            await sleep(parseInt(speedSelect.value));
            let temp = array[i]; array[i] = array[largest]; array[largest] = temp;
            updateBar(i, array[i], null);
            updateBar(largest, array[largest], null);
            await heapify(n, largest);
        }
    }

    async function shellSort() {
        let n = array.length;
        for (let gap = Math.floor(n/2); gap > 0; gap = Math.floor(gap/2)) {
            for (let i = gap; i < n; i++) {
                if(cancelSort) return;
                let temp = array[i];
                let j;
                updateBar(i, null, 'swapping');
                await sleep(parseInt(speedSelect.value));
                for (j = i; j >= gap && array[j - gap] > temp; j -= gap) {
                    if(cancelSort) return;
                    updateBar(j - gap, null, 'comparing');
                    await sleep(parseInt(speedSelect.value));
                    array[j] = array[j - gap];
                    updateBar(j, array[j], 'swapping');
                    updateBar(j - gap, null, null);
                }
                array[j] = temp;
                updateBar(j, array[j], null);
                updateBar(i, null, null);
            }
        }
    }

    async function cocktailShakerSort() {
        let is_swapped = true;
        let start = 0;
        let end = array.length - 1;
        while(is_swapped) {
            is_swapped = false;
            for(let i=start; i<end; i++){
                if(cancelSort) return;
                updateBar(i, null, 'comparing');
                updateBar(i+1, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if(array[i] > array[i+1]){
                    updateBar(i, null, 'swapping'); updateBar(i+1, null, 'swapping');
                    let temp = array[i]; array[i] = array[i+1]; array[i+1] = temp;
                    updateBar(i, array[i], null); updateBar(i+1, array[i+1], null);
                    is_swapped = true;
                } else {
                    updateBar(i, null, null); updateBar(i+1, null, null);
                }
            }
            if(!is_swapped) break;
            updateBar(end, null, 'sorted');
            end--;
            is_swapped = false;
            for(let i=end-1; i>=start; i--){
                if(cancelSort) return;
                updateBar(i, null, 'comparing');
                updateBar(i+1, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if(array[i] > array[i+1]){
                    updateBar(i, null, 'swapping'); updateBar(i+1, null, 'swapping');
                    let temp = array[i]; array[i] = array[i+1]; array[i+1] = temp;
                    updateBar(i, array[i], null); updateBar(i+1, array[i+1], null);
                    is_swapped = true;
                } else {
                    updateBar(i, null, null); updateBar(i+1, null, null);
                }
            }
            updateBar(start, null, 'sorted');
            start++;
        }
    }

    async function combSort() {
        let n = array.length;
        let gap = n;
        let swapped = true;
        while(gap !== 1 || swapped) {
            if(cancelSort) return;
            gap = Math.floor(gap / 1.3);
            if(gap < 1) gap = 1;
            swapped = false;
            for(let i=0; i<n-gap; i++){
                if(cancelSort) return;
                updateBar(i, null, 'comparing');
                updateBar(i+gap, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if(array[i] > array[i+gap]){
                    updateBar(i, null, 'swapping'); updateBar(i+gap, null, 'swapping');
                    let temp = array[i]; array[i] = array[i+gap]; array[i+gap] = temp;
                    updateBar(i, array[i], null); updateBar(i+gap, array[i+gap], null);
                    swapped = true;
                } else {
                    updateBar(i, null, null); updateBar(i+gap, null, null);
                }
            }
        }
    }

    async function gnomeSort() {
        let index = 0;
        while(index < array.length) {
            if(cancelSort) return;
            if(index == 0) index++;
            updateBar(index, null, 'comparing');
            updateBar(index-1, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if(array[index] >= array[index-1]){
                updateBar(index, null, null); updateBar(index-1, null, null);
                index++;
            } else {
                updateBar(index, null, 'swapping'); updateBar(index-1, null, 'swapping');
                let temp = array[index]; array[index] = array[index-1]; array[index-1] = temp;
                updateBar(index, array[index], null); updateBar(index-1, array[index-1], null);
                index--;
            }
        }
    }

    async function oddEvenSort() {
        let isSorted = false;
        while(!isSorted) {
            isSorted = true;
            for(let i=1; i<=array.length-2; i=i+2){
                if(cancelSort) return;
                updateBar(i, null, 'comparing'); updateBar(i+1, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if(array[i] > array[i+1]){
                    updateBar(i, null, 'swapping'); updateBar(i+1, null, 'swapping');
                    let temp = array[i]; array[i] = array[i+1]; array[i+1] = temp;
                    updateBar(i, array[i], null); updateBar(i+1, array[i+1], null);
                    isSorted = false;
                } else {
                    updateBar(i, null, null); updateBar(i+1, null, null);
                }
            }
            for(let i=0; i<=array.length-2; i=i+2){
                if(cancelSort) return;
                updateBar(i, null, 'comparing'); updateBar(i+1, null, 'comparing');
                await sleep(parseInt(speedSelect.value));
                if(array[i] > array[i+1]){
                    updateBar(i, null, 'swapping'); updateBar(i+1, null, 'swapping');
                    let temp = array[i]; array[i] = array[i+1]; array[i+1] = temp;
                    updateBar(i, array[i], null); updateBar(i+1, array[i+1], null);
                    isSorted = false;
                } else {
                    updateBar(i, null, null); updateBar(i+1, null, null);
                }
            }
        }
    }

    async function cycleSort() {
        let n = array.length;
        for(let cycle_start = 0; cycle_start <= n-2; cycle_start++) {
            if(cancelSort) return;
            let item = array[cycle_start];
            let pos = cycle_start;
            for(let i = cycle_start+1; i<n; i++){
                updateBar(i, null, 'comparing'); await sleep(parseInt(speedSelect.value));
                if(array[i] < item) pos++;
                updateBar(i, null, null);
            }
            if(pos == cycle_start) {
                updateBar(cycle_start, null, 'sorted'); continue;
            }
            while(item == array[pos]) pos += 1;
            if(pos != cycle_start) {
                updateBar(pos, null, 'swapping'); await sleep(parseInt(speedSelect.value));
                let temp = item; item = array[pos]; array[pos] = temp;
                updateBar(pos, array[pos], 'sorted');
            }
            while(pos != cycle_start) {
                if(cancelSort) return;
                pos = cycle_start;
                for(let i=cycle_start+1; i<n; i++){
                    updateBar(i, null, 'comparing'); await sleep(parseInt(speedSelect.value));
                    if(array[i] < item) pos += 1;
                    updateBar(i, null, null);
                }
                while(item == array[pos]) pos += 1;
                if(item != array[pos]) {
                    updateBar(pos, null, 'swapping'); await sleep(parseInt(speedSelect.value));
                    let temp = item; item = array[pos]; array[pos] = temp;
                    updateBar(pos, array[pos], 'sorted');
                }
            }
        }
    }

    async function pancakeSort() {
        let n = array.length;
        for(let curr_size=n; curr_size>1; --curr_size){
            if(cancelSort) return;
            let mi = await findMax(curr_size);
            if(cancelSort) return;
            if(mi != curr_size-1){
                await flip(mi);
                if(cancelSort) return;
                await flip(curr_size-1);
            }
            updateBar(curr_size-1, null, 'sorted');
        }
        updateBar(0, null, 'sorted');
    }
    async function findMax(n){
        let max_idx = 0;
        for(let i=0; i<n; i++){
            updateBar(i, null, 'comparing'); updateBar(max_idx, null, 'comparing');
            await sleep(parseInt(speedSelect.value));
            if(array[i] > array[max_idx]){
                updateBar(max_idx, null, null); max_idx = i;
            } else { updateBar(i, null, null); }
        }
        updateBar(max_idx, null, null);
        return max_idx;
    }
    async function flip(i){
        let start = 0;
        while(start < i){
            updateBar(start, null, 'swapping'); updateBar(i, null, 'swapping');
            await sleep(parseInt(speedSelect.value));
            let temp = array[start]; array[start] = array[i]; array[i] = temp;
            updateBar(start, array[start], null); updateBar(i, array[i], null);
            start++; i--;
        }
    }

    async function radixSort() {
        let max = Math.max(...array);
        for(let exp = 1; Math.floor(max/exp) > 0; exp *= 10) {
            if(cancelSort) return;
            await countingSortForRadix(exp);
        }
    }
    async function countingSortForRadix(exp) {
        let output = new Array(array.length).fill(0);
        let count = new Array(10).fill(0);
        for(let i=0; i<array.length; i++){
            count[Math.floor(array[i]/exp)%10]++;
        }
        for(let i=1; i<10; i++){
            count[i] += count[i-1];
        }
        for(let i=array.length-1; i>=0; i--){
            let idx = Math.floor(array[i]/exp)%10;
            output[count[idx]-1] = array[i];
            count[idx]--;
        }
        for(let i=0; i<array.length; i++){
            if(cancelSort) return;
            array[i] = output[i];
            updateBar(i, array[i], 'swapping');
            await sleep(parseInt(speedSelect.value));
            updateBar(i, null, null);
        }
    }

    async function bogoSort() {
        let count = 0;
        while(true) {
            if(cancelSort) return;
            let sorted = true;
            for(let i=1; i<array.length; i++){
                if(array[i] < array[i-1]){ sorted = false; break; }
            }
            if(sorted) break;

            count++;
            for(let i=array.length-1; i>0; i--){
                let j = Math.floor(Math.random()*(i+1));
                let temp = array[i]; array[i] = array[j]; array[j] = temp;
                updateBar(i, array[i], 'swapping'); updateBar(j, array[j], 'swapping');
            }
            await sleep(parseInt(speedSelect.value));
            for(let i=0; i<array.length; i++) updateBar(i, null, null);
            
            if (count > 200) {
                alert("猴子排序 (Bogo Sort) 太慢了，为防止卡死，已自动终止！");
                return;
            }
        }
    }


    // ----------------------------------------
    // UI Controls
    // ----------------------------------------

    function disableControls(disabled) {
        sizeInput.disabled = disabled;
        algorithmSelect.disabled = disabled;
        btnSort.disabled = disabled;
        if(disabled) {
            btnGenerate.innerText = '⏹️ 停止排序';
            btnSort.style.opacity = '0.5';
        } else {
            btnGenerate.innerText = '🔄 生成新数据';
            btnSort.style.opacity = '1';
        }
    }

    btnGenerate.addEventListener('click', () => {
        if (isSorting) {
            cancelSort = true;
            isSorting = false;
            disableControls(false);
            setTimeout(generateArray, 200);
        } else {
            generateArray();
        }
    });

    btnSort.addEventListener('click', async () => {
        if (isSorting) return;
        
        const isAlreadySorted = Array.from(container.children).every(el => el.classList.contains('sorted'));
        if(isAlreadySorted || array.length === 0) {
            generateArray();
            await sleep(200);
        }

        isSorting = true;
        cancelSort = false;
        disableControls(true);

        const algo = algorithmSelect.value;
        try {
            switch(algo) {
                case 'bubble': await bubbleSort(); break;
                case 'selection': await selectionSort(); break;
                case 'insertion': await insertionSort(); break;
                case 'quick': await quickSort(); break;
                case 'merge': await mergeSort(); break;
                case 'heap': await heapSort(); break;
                case 'shell': await shellSort(); break;
                case 'cocktail': await cocktailShakerSort(); break;
                case 'comb': await combSort(); break;
                case 'gnome': await gnomeSort(); break;
                case 'oddEven': await oddEvenSort(); break;
                case 'cycle': await cycleSort(); break;
                case 'pancake': await pancakeSort(); break;
                case 'radix': await radixSort(); break;
                case 'bogo': await bogoSort(); break;
            }

            if(!cancelSort) {
                for(let i=0; i<array.length; i++) {
                    updateBar(i, null, 'sorted');
                }
            }
        } catch(e) {
            console.error("Sorting error:", e);
        }

        isSorting = false;
        disableControls(false);
    });

    window.addEventListener('resize', () => {
        if (array.length > 0 && container.clientWidth > 0) {
            const size = array.length;
            const barWidth = Math.max(2, Math.floor((container.clientWidth - size * 2) / size));
            const bars = container.children;
            for (let i = 0; i < bars.length; i++) {
                bars[i].style.width = `${barWidth}px`;
            }
        }
    });

    generateArray();
});
