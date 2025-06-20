document.addEventListener('DOMContentLoaded', () => {
    // 全局变量
    let inspectionData = null; // 存储加载的巡检数据
    let filteredData = null; // 存储筛选后的数据
    let currentPage = 1;
    const itemsPerPage = 10; // 每页显示的记录数
    
    // 字段映射（用于匹配不同的可能字段名）
    let fieldMapping = {
        building: null, // 楼宇字段名
        floor: null,    // 楼层字段名
        deviceType: '设备类型', // 设备类型字段名，默认用预处理生成的
        deviceId: null,   // 设备编号字段名
        location: null    // 位置描述字段名
    };

    // 获取DOM元素
    const fileInput = document.getElementById('json-file');
    const fileNameDisplay = document.getElementById('file-name');
    const buildingSelect = document.getElementById('building-select');
    const floorSelect = document.getElementById('floor-select');
    const deviceTypeSelect = document.getElementById('device-type-select');
    const applyFilter = document.getElementById('apply-filter');
    const resetFilter = document.getElementById('reset-filter');
    
    const totalDevicesEl = document.getElementById('total-devices');
    const totalBuildingsEl = document.getElementById('total-buildings');
    const totalDeviceTypesEl = document.getElementById('total-device-types');
    const displayedDevicesEl = document.getElementById('displayed-devices');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    const deviceCategories = document.getElementById('device-categories');
    const locationTree = document.getElementById('location-tree');
    const tableBody = document.getElementById('table-body');
    const pagination = document.getElementById('pagination');
    const tableSearch = document.getElementById('table-search');
    const exportDataBtn = document.getElementById('export-data');
    
    const modal = document.getElementById('device-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModal = document.querySelector('.close-modal');

    // 初始化事件监听器
    initEventListeners();

    // 设置事件监听器
    function initEventListeners() {
        // 文件上传监听
        fileInput.addEventListener('change', handleFileUpload);

        // 筛选器监听
        applyFilter.addEventListener('click', applyFilters);
        resetFilter.addEventListener('click', resetFilters);
        
        // 选项卡切换
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // 表格搜索监听
        tableSearch.addEventListener('input', debounce(handleTableSearch, 300));
        
        // 导出数据按钮监听
        exportDataBtn.addEventListener('click', exportDataToJson);
        
        // 模态框关闭按钮
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // 处理文件上传
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        fileNameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // 解析JSON数据
                inspectionData = JSON.parse(e.target.result);
                
                // 处理数据结构
                inspectionData = preprocessData(inspectionData);
                
                // 检测并映射数据字段
                detectDataFields();
                
                // 初始化筛选器
                initFilters();
                
                // 应用数据筛选
                applyFilters();
                
                // 更新统计信息
                updateStatistics();
                
                // 激活UI按钮
                enableUIControls();

                console.log("字段映射结果：", fieldMapping);
            } catch (error) {
                alert('解析JSON文件时出错：' + error.message);
                console.error(error);
            }
        };
        reader.readAsText(file);
    }
    
    // 预处理数据，确保格式一致，并加上设备类型字段
    function preprocessData(data) {
        // 如果数据是数组格式，直接返回
        if (Array.isArray(data)) {
            // 检查是否有"具体巡检计划主题"字段
            if (data.length > 0 && data[0]['具体巡检计划主题']) {
                data.forEach(item => {
                    item['设备类型'] = item['具体巡检计划主题'];
                });
            }
            return data;
        } 
        // 如果是对象格式，尝试提取数据
        else if (typeof data === 'object' && data !== null) {
            let allItems = [];
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data[key].forEach(item => {
                        // 优先用"具体巡检计划主题"，否则用key
                        item['设备类型'] = item['具体巡检计划主题'] || key;
                        allItems.push(item);
                    });
                }
            }
            if (allItems.length > 0) {
                return allItems;
            }
        }
        // 如果无法确定格式，返回原始数据
        return data;
    }

    // 检测并映射数据字段
    function detectDataFields() {
        if (!inspectionData || !inspectionData.length) return;

        // 可能的字段名映射（中文和英文变体）
        const possibleFieldNames = {
            building: ['楼宇', '建筑', '建筑物', 'building', 'buildings', 'buildingName', '楼宇名称', '楼宇名'],
            floor: ['楼层', '层', '层数', 'floor', 'floors', 'floorNumber', '楼层号', '层号'],
            deviceType: ['设备类型', '类型', '设备种类', 'deviceType', 'device_type', 'type', 'equipment', 'equipmentType', '巡检设备', '设备'],
            deviceId: ['设备编号', '编号', '设备号', 'deviceId', 'device_id', 'id', 'equipmentId', 'equipment_id', 'code'],
            location: ['位置', '位置描述', '安装位置', 'location', 'position', 'address', 'installLocation', '巡检点位', '点位']
        };

        // 样本数据，用于检测
        const sampleItem = inspectionData[0];
        const fields = Object.keys(sampleItem);

        // 对每个需要映射的字段
        for (const mappingKey in fieldMapping) {
            // 寻找匹配的字段名
            const possibleNames = possibleFieldNames[mappingKey];
            
            for (const field of fields) {
                // 如果字段名直接匹配
                if (possibleNames.includes(field)) {
                    fieldMapping[mappingKey] = field;
                    break;
                }
                
                // 尝试模糊匹配（字段名包含关键词）
                const fieldLower = field.toLowerCase();
                const matches = possibleNames.some(name => 
                    fieldLower.includes(name.toLowerCase())
                );
                
                if (matches) {
                    fieldMapping[mappingKey] = field;
                    break;
                }
            }
        }

        // 如果没有找到，尝试通过值来推断
        if (!fieldMapping.deviceType) {
            // 查找可能包含设备类型的字段（如果值有重复）
            const potentialTypeFields = [];
            
            fields.forEach(field => {
                const values = new Set(inspectionData.map(item => item[field]));
                // 如果不同值的数量较小（相对于总数据量），可能是分类字段
                if (values.size > 1 && values.size < inspectionData.length / 3) {
                    potentialTypeFields.push({field, uniqueCount: values.size});
                }
            });
            
            // 按唯一值数量排序，取最可能的
            if (potentialTypeFields.length > 0) {
                potentialTypeFields.sort((a, b) => a.uniqueCount - b.uniqueCount);
                fieldMapping.deviceType = potentialTypeFields[0].field;
            }
        }
        
        // 同样方法尝试查找楼宇和楼层字段
        if (!fieldMapping.building) {
            const buildingCandidates = fields.filter(f => 
                !Object.values(fieldMapping).includes(f) && 
                new Set(inspectionData.map(item => item[f])).size < inspectionData.length / 2
            );
            
            if (buildingCandidates.length > 0) {
                fieldMapping.building = buildingCandidates[0];
            }
        }
        
        if (!fieldMapping.floor) {
            const floorCandidates = fields.filter(f => 
                f !== fieldMapping.building && 
                !Object.values(fieldMapping).includes(f) && 
                new Set(inspectionData.map(item => item[f])).size < inspectionData.length / 2
            );
            
            if (floorCandidates.length > 0) {
                fieldMapping.floor = floorCandidates[0];
            }
        }
    }

    // 提取楼宇号（如1号楼、2号楼、12号楼）
    function extractBuildingNo(str) {
        if (!str) return '';
        const match = str.match(/(\d+号楼)/);
        return match ? match[1] : str;
    }
    // 提取楼层数字（如-1、1、2），非数字返回原字符串
    function extractFloorNum(str) {
        if (typeof str === 'number') return str;
        if (!str) return '';
        const match = str.toString().match(/-?\d+/);
        return match ? parseInt(match[0], 10) : str;
    }

    // 初始化筛选器
    function initFilters() {
        if (!inspectionData) return;
        // 清空现有选项
        buildingSelect.innerHTML = '<option value="all">所有楼宇</option>';
        floorSelect.innerHTML = '<option value="all">所有楼层</option>';
        deviceTypeSelect.innerHTML = '<option value="all">所有设备类型</option>';
        // 提取唯一的楼宇、楼层和设备类型
        const buildingNames = new Set();
        const floors = new Set();
        const deviceTypes = new Set();
        inspectionData.forEach(item => {
            // 楼宇原始名称去重
            if (fieldMapping.building && item[fieldMapping.building]) {
                buildingNames.add(item[fieldMapping.building]);
            }
            // 楼层
            if (fieldMapping.floor && item[fieldMapping.floor] !== undefined && item[fieldMapping.floor] !== null) {
                floors.add(item[fieldMapping.floor]);
            }
            // 设备类型
            if (fieldMapping.deviceType && item[fieldMapping.deviceType]) {
                deviceTypes.add(item[fieldMapping.deviceType]);
            }
        });
        // 楼宇原始名称排序（按中文）
        const buildingArr = Array.from(buildingNames);
        buildingArr.sort((a, b) => a.localeCompare(b, 'zh'));
        buildingArr.forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            option.textContent = b;
            buildingSelect.appendChild(option);
        });
        // 楼层排序（数字在前，非数字在后）
        const floorArr = Array.from(floors);
        floorArr.sort((a, b) => {
            const na = extractFloorNum(a);
            const nb = extractFloorNum(b);
            if (typeof na === 'number' && typeof nb === 'number') return na - nb;
            if (typeof na === 'number') return -1;
            if (typeof nb === 'number') return 1;
            return a.toString().localeCompare(b.toString(), 'zh');
        });
        floorArr.forEach(f => {
            const option = document.createElement('option');
            option.value = f;
            option.textContent = f;
            floorSelect.appendChild(option);
        });
        deviceTypes.forEach(deviceType => {
            const option = document.createElement('option');
            option.value = deviceType;
            option.textContent = deviceType;
            deviceTypeSelect.appendChild(option);
        });
        afterFilterInit();
    }
    
    // 多选获取选中值
    function getMultiSelectValues(select) {
        return $(select).val() ? $(select).val().filter(v => v !== 'all') : [];
    }
    
    // 应用数据筛选
    function applyFilters() {
        if (!inspectionData) return;
        
        // 多选
        const selectedBuildings = getMultiSelectValues(buildingSelect);
        const selectedFloors = getMultiSelectValues(floorSelect);
        const selectedDeviceTypes = getMultiSelectValues(deviceTypeSelect);
        
        filteredData = inspectionData.filter(item => {
            // 楼宇多选
            let buildingMatch = true;
            if (selectedBuildings.length > 0) {
                buildingMatch = selectedBuildings.includes(item[fieldMapping.building]);
            }
            // 楼层多选
            let floorMatch = true;
            if (selectedFloors.length > 0) {
                floorMatch = selectedFloors.includes(item[fieldMapping.floor]?.toString());
            }
            // 设备类型多选
            let deviceTypeMatch = true;
            if (selectedDeviceTypes.length > 0) {
                deviceTypeMatch = selectedDeviceTypes.includes(item[fieldMapping.deviceType]);
            }
            return buildingMatch && floorMatch && deviceTypeMatch;
        });
        
        // 更新统计信息
        displayedDevicesEl.textContent = filteredData.length;
        
        // 更新当前视图
        updateCurrentView();
        
        // 重置为第一页
        currentPage = 1;
        updateTablePagination();
    }
    
    // 重置筛选器
    function resetFilters() {
        buildingSelect.value = 'all';
        floorSelect.value = 'all';
        deviceTypeSelect.value = 'all';
        tableSearch.value = '';
        
        // 应用重置后的筛选条件
        applyFilters();
    }
    
    // 更新统计信息
    function updateStatistics() {
        if (!inspectionData) return;
        
        // 计算统计信息
        totalDevicesEl.textContent = inspectionData.length;
        
        const buildings = new Set();
        const deviceTypes = new Set();
        
        inspectionData.forEach(item => {
            if (fieldMapping.building && item[fieldMapping.building])
                buildings.add(item[fieldMapping.building]);
            if (fieldMapping.deviceType && item[fieldMapping.deviceType])
                deviceTypes.add(item[fieldMapping.deviceType]);
        });
        
        totalBuildingsEl.textContent = buildings.size;
        totalDeviceTypesEl.textContent = deviceTypes.size;
        displayedDevicesEl.textContent = filteredData ? filteredData.length : 0;
    }
    
    // 启用UI控件
    function enableUIControls() {
        applyFilter.disabled = false;
        resetFilter.disabled = false;
        exportDataBtn.disabled = false;
    }
    
    // 切换标签页
    function switchTab(tabId) {
        // 移除所有活跃标签和内容
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        // 激活选定的标签和内容
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        // 更新当前视图
        updateCurrentView();
    }
    
    // 更新当前视图（基于当前活跃标签页）
    function updateCurrentView() {
        const activeTabId = document.querySelector('.tab-btn.active').getAttribute('data-tab');
        
        switch (activeTabId) {
            case 'device-tab':
                updateDeviceCategories();
                break;
            case 'location-tab':
                updateLocationTree();
                break;
            case 'table-tab':
                updateDeviceTable();
                break;
        }
    }
    
    // 更新按设备分类视图
    function updateDeviceCategories() {
        if (!filteredData || filteredData.length === 0) {
            deviceCategories.innerHTML = '<p class="placeholder-text">没有匹配的设备数据</p>';
            return;
        }
        
        deviceCategories.innerHTML = '';
        
        // 按设备类型分组
        const deviceGroups = {};
        
        filteredData.forEach(item => {
            const deviceType = fieldMapping.deviceType ? (item[fieldMapping.deviceType] || '未分类') : '未分类';
            if (!deviceGroups[deviceType]) {
                deviceGroups[deviceType] = [];
            }
            deviceGroups[deviceType].push(item);
        });
        
        // 创建设备分类卡片
        for (const deviceType in deviceGroups) {
            const devices = deviceGroups[deviceType];
            
            const deviceCard = document.createElement('div');
            deviceCard.className = 'device-card';
            
            // 标题和计数
            const cardHeader = document.createElement('h3');
            cardHeader.textContent = deviceType;
            
            const deviceCount = document.createElement('span');
            deviceCount.className = 'device-count';
            deviceCount.textContent = devices.length;
            
            cardHeader.appendChild(deviceCount);
            deviceCard.appendChild(cardHeader);
            
            // 设备列表
            const deviceList = document.createElement('ul');
            deviceList.className = 'device-list';
            
            // 显示前5个设备
            const displayCount = Math.min(5, devices.length);
            for (let i = 0; i < displayCount; i++) {
                const device = devices[i];
                const deviceItem = document.createElement('li');
                
                // 设备名称
                const deviceName = document.createElement('span');
                deviceName.textContent = fieldMapping.deviceId && device[fieldMapping.deviceId] 
                    ? device[fieldMapping.deviceId] 
                    : `设备${i + 1}`;
                deviceItem.appendChild(deviceName);
                
                // 所在楼宇/楼层
                const building = document.createElement('span');
                building.className = 'building';
                
                const buildingText = fieldMapping.building && device[fieldMapping.building] 
                    ? device[fieldMapping.building] 
                    : '未知楼宇';
                    
                const floorText = fieldMapping.floor && device[fieldMapping.floor] 
                    ? device[fieldMapping.floor] 
                    : '未知楼层';
                
                building.textContent = ` (${buildingText} ${floorText})`;
                deviceItem.appendChild(building);
                
                // 点击查看详情
                deviceItem.addEventListener('click', () => {
                    showDeviceDetails(device);
                });
                deviceItem.style.cursor = 'pointer';
                
                deviceList.appendChild(deviceItem);
            }
            
            // 如果设备超过5个，显示更多
            if (devices.length > 5) {
                const moreItem = document.createElement('li');
                moreItem.textContent = `... 还有${devices.length - 5}个设备`;
                moreItem.style.color = '#666';
                deviceList.appendChild(moreItem);
            }
            
            deviceCard.appendChild(deviceList);
            deviceCategories.appendChild(deviceCard);
        }
    }
    
    // 更新按位置分类视图
    function updateLocationTree() {
        if (!filteredData || filteredData.length === 0) {
            locationTree.innerHTML = '<p class="placeholder-text">没有匹配的设备数据</p>';
            return;
        }
        
        locationTree.innerHTML = '';
        
        // 按楼宇和楼层分组
        const locationGroups = {};
        
        filteredData.forEach(item => {
            const building = fieldMapping.building && item[fieldMapping.building] 
                ? item[fieldMapping.building] 
                : '未知楼宇';
                
            const floor = fieldMapping.floor && item[fieldMapping.floor] 
                ? item[fieldMapping.floor] 
                : '未知楼层';
            
            if (!locationGroups[building]) {
                locationGroups[building] = {};
            }
            
            if (!locationGroups[building][floor]) {
                locationGroups[building][floor] = [];
            }
            
            locationGroups[building][floor].push(item);
        });
        
        // 创建楼宇和楼层树形结构
        for (const building in locationGroups) {
            const buildingCard = document.createElement('div');
            buildingCard.className = 'building-card';
            
            // 楼宇标题
            const buildingHeader = document.createElement('div');
            buildingHeader.className = 'building-header';
            
            const buildingName = document.createElement('span');
            buildingName.textContent = building;
            
            const deviceCount = document.createElement('span');
            let totalDevices = 0;
            Object.values(locationGroups[building]).forEach(devices => {
                totalDevices += devices.length;
            });
            deviceCount.textContent = `共${totalDevices}个设备`;
            
            buildingHeader.appendChild(buildingName);
            buildingHeader.appendChild(deviceCount);
            buildingCard.appendChild(buildingHeader);
            
            // 楼层列表
            const floorList = document.createElement('ul');
            floorList.className = 'floor-list';
            
            for (const floor in locationGroups[building]) {
                const devices = locationGroups[building][floor];
                
                const floorItem = document.createElement('li');
                floorItem.className = 'floor-item';
                
                // 楼层标题（可点击展开/折叠）
                const floorHeader = document.createElement('div');
                floorHeader.className = 'floor-header';
                
                const floorName = document.createElement('span');
                floorName.textContent = floor;
                
                const floorDeviceCount = document.createElement('span');
                floorDeviceCount.textContent = `${devices.length}个设备`;
                
                floorHeader.appendChild(floorName);
                floorHeader.appendChild(floorDeviceCount);
                floorItem.appendChild(floorHeader);
                
                // 楼层中的设备列表
                const floorDevices = document.createElement('div');
                floorDevices.className = 'floor-devices';
                
                devices.forEach(device => {
                    const deviceItem = document.createElement('div');
                    deviceItem.className = 'device-item';
                    
                    const deviceType = document.createElement('span');
                    deviceType.className = 'device-type';
                    deviceType.textContent = fieldMapping.deviceType && device[fieldMapping.deviceType]
                        ? device[fieldMapping.deviceType]
                        : '未知类型';
                    
                    const deviceLocation = document.createElement('span');
                    deviceLocation.className = 'device-location';
                    
                    if (fieldMapping.location && device[fieldMapping.location]) {
                        deviceLocation.textContent = device[fieldMapping.location];
                    } else if (fieldMapping.deviceId && device[fieldMapping.deviceId]) {
                        deviceLocation.textContent = `设备编号: ${device[fieldMapping.deviceId]}`;
                    } else {
                        deviceLocation.textContent = '无位置信息';
                    }
                    
                    deviceItem.appendChild(deviceType);
                    deviceItem.appendChild(deviceLocation);
                    
                    // 点击查看详情
                    deviceItem.addEventListener('click', () => {
                        showDeviceDetails(device);
                    });
                    deviceItem.style.cursor = 'pointer';
                    
                    floorDevices.appendChild(deviceItem);
                });
                
                floorItem.appendChild(floorDevices);
                floorList.appendChild(floorItem);
                
                // 点击楼层标题展开/折叠设备列表
                floorHeader.addEventListener('click', () => {
                    floorDevices.classList.toggle('active');
                });
            }
            
            buildingCard.appendChild(floorList);
            locationTree.appendChild(buildingCard);
        }
    }
    
    // 更新设备表格视图
    function updateDeviceTable() {
        if (!filteredData || filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="empty-table">没有匹配的设备数据</td></tr>';
            pagination.innerHTML = '';
            return;
        }
        
        // 计算分页
        updateTablePagination();
    }
    
    // 更新表格分页
    function updateTablePagination() {
        if (!filteredData) return;
        
        // 计算总页数
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        
        // 确保当前页在有效范围内
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        // 计算当前页的数据范围
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
        
        // 填充表格数据
        tableBody.innerHTML = '';
        
        for (let i = startIndex; i < endIndex; i++) {
            const device = filteredData[i];
            const row = document.createElement('tr');
            
            // 序号
            const indexCell = document.createElement('td');
            indexCell.textContent = i + 1;
            row.appendChild(indexCell);
            
            // 设备类型
            const typeCell = document.createElement('td');
            typeCell.textContent = fieldMapping.deviceType && device[fieldMapping.deviceType]
                ? device[fieldMapping.deviceType]
                : '未知';
            row.appendChild(typeCell);
            
            // 楼宇
            const buildingCell = document.createElement('td');
            buildingCell.textContent = fieldMapping.building && device[fieldMapping.building]
                ? device[fieldMapping.building]
                : '未知';
            row.appendChild(buildingCell);
            
            // 楼层
            const floorCell = document.createElement('td');
            floorCell.textContent = fieldMapping.floor && device[fieldMapping.floor]
                ? device[fieldMapping.floor]
                : '未知';
            row.appendChild(floorCell);
            
            // 位置描述
            const locationCell = document.createElement('td');
            locationCell.textContent = fieldMapping.location && device[fieldMapping.location]
                ? device[fieldMapping.location]
                : '未知';
            row.appendChild(locationCell);
            
            // 设备编号
            const idCell = document.createElement('td');
            idCell.textContent = fieldMapping.deviceId && device[fieldMapping.deviceId]
                ? device[fieldMapping.deviceId]
                : '未知';
            row.appendChild(idCell);
            
            // 详情按钮
            const actionCell = document.createElement('td');
            const detailBtn = document.createElement('button');
            detailBtn.className = 'action-btn';
            detailBtn.textContent = '详情';
            detailBtn.addEventListener('click', () => {
                showDeviceDetails(device);
            });
            actionCell.appendChild(detailBtn);
            row.appendChild(actionCell);
            
            tableBody.appendChild(row);
        }
        
        // 创建分页控件
        pagination.innerHTML = '';
        
        if (totalPages > 1) {
            // 首页按钮
            const firstPageBtn = document.createElement('button');
            firstPageBtn.textContent = '首页';
            firstPageBtn.disabled = currentPage === 1;
            firstPageBtn.addEventListener('click', () => {
                currentPage = 1;
                updateTablePagination();
            });
            pagination.appendChild(firstPageBtn);
            
            // 上一页按钮
            const prevPageBtn = document.createElement('button');
            prevPageBtn.textContent = '上一页';
            prevPageBtn.disabled = currentPage === 1;
            prevPageBtn.addEventListener('click', () => {
                currentPage--;
                updateTablePagination();
            });
            pagination.appendChild(prevPageBtn);
            
            // 页码按钮
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            
            if (endPage - startPage < 4 && totalPages > 4) {
                startPage = Math.max(1, endPage - 4);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                
                if (i === currentPage) {
                    pageBtn.className = 'active';
                }
                
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    updateTablePagination();
                });
                
                pagination.appendChild(pageBtn);
            }
            
            // 下一页按钮
            const nextPageBtn = document.createElement('button');
            nextPageBtn.textContent = '下一页';
            nextPageBtn.disabled = currentPage === totalPages;
            nextPageBtn.addEventListener('click', () => {
                currentPage++;
                updateTablePagination();
            });
            pagination.appendChild(nextPageBtn);
            
            // 尾页按钮
            const lastPageBtn = document.createElement('button');
            lastPageBtn.textContent = '尾页';
            lastPageBtn.disabled = currentPage === totalPages;
            lastPageBtn.addEventListener('click', () => {
                currentPage = totalPages;
                updateTablePagination();
            });
            pagination.appendChild(lastPageBtn);
        }
    }
    
    // 显示设备详情
    function showDeviceDetails(device) {
        const title = fieldMapping.deviceType && device[fieldMapping.deviceType] 
            ? `${device[fieldMapping.deviceType]} 详情` 
            : '设备详情';
            
        modalTitle.textContent = title;
        modalBody.innerHTML = '';
        
        // 创建详情行
        const createDetailRow = (label, value) => {
            const row = document.createElement('div');
            row.className = 'detail-row';
            
            const labelElem = document.createElement('div');
            labelElem.className = 'detail-label';
            labelElem.textContent = label + '：';
            
            const valueElem = document.createElement('div');
            valueElem.className = 'detail-value';
            valueElem.textContent = value || '未提供';
            
            row.appendChild(labelElem);
            row.appendChild(valueElem);
            
            return row;
        };
        
        // 添加所有属性到详情视图
        for (const key in device) {
            // 跳过一些可能的内部属性
            if (key.startsWith('_') || key === 'index') continue;
            
            const detailRow = createDetailRow(key, device[key]);
            modalBody.appendChild(detailRow);
        }
        
        // 显示模态框
        modal.style.display = 'block';
    }
    
    // 表格搜索处理
    function handleTableSearch() {
        const searchTerm = tableSearch.value.toLowerCase().trim();
        
        if (!inspectionData) return;
        
        // 如果搜索框为空，恢复到筛选后的数据状态
        if (searchTerm === '') {
            applyFilters();
            return;
        }
        
        // 在已筛选的数据中搜索
        let searchResult = filteredData.filter(device => {
            // 在所有字段中搜索匹配项
            return Object.values(device).some(value => {
                if (value === null || value === undefined) return false;
                return value.toString().toLowerCase().includes(searchTerm);
            });
        });
        
        // 更新filteredData为搜索结果
        filteredData = searchResult;
        
        // 更新统计信息
        displayedDevicesEl.textContent = filteredData.length;
        
        // 重置为第一页并更新表格
        currentPage = 1;
        updateCurrentView();
    }
    
    // 导出数据为JSON
    function exportDataToJson() {
        if (!filteredData || filteredData.length === 0) {
            alert('没有可导出的数据');
            return;
        }
        
        // 创建Blob对象
        const jsonData = JSON.stringify(filteredData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '巡检设备数据.json';
        
        // 模拟点击下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 防抖函数，限制高频操作的执行频率
    function debounce(func, delay) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, delay);
        };
    }

    // SheetJS解析Excel支持
    function handleExcelUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        fileNameDisplay.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                let allItems = [];
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, {defval: ''});
                    json.forEach(item => {
                        item['工作表'] = sheetName;
                        allItems.push(item);
                    });
                });
                inspectionData = allItems;
                // 字段映射面板激活并填充
                fillFieldMappingPanel();
                // 初始化筛选器
                initFilters();
                // 应用数据筛选
                applyFilters();
                // 更新统计
                updateStatistics();
                enableUIControls();
            } catch (error) {
                alert('解析Excel文件时出错：' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // 绑定事件
    const excelInput = document.getElementById('excel-file');
    if (excelInput) {
        excelInput.addEventListener('change', handleExcelUpload);
    }

    // 字段映射面板填充逻辑
    function fillFieldMappingPanel() {
        const fields = inspectionData && inspectionData.length > 0 ? Object.keys(inspectionData[0]) : [];
        // 字段优先级自动匹配
        const autoMatch = {
            building: ['楼宇名称', '楼宇', '建筑', 'building'],
            floor: ['所在楼层', '楼层', 'floor'],
            deviceType: ['具体巡检计划主题', '设备类型', '类型', 'deviceType'],
            deviceId: ['序号', '设备编号', '编号', 'id'],
            location: ['所在区域', '位置', '位置描述', 'address', 'region']
        };
        const mappingIds = [
            ['building-field', 'building'],
            ['floor-field', 'floor'],
            ['device-type-field', 'deviceType'],
            ['device-id-field', 'deviceId'],
            ['location-field', 'location']
        ];
        mappingIds.forEach(([selectId, mappingKey]) => {
            const select = document.getElementById(selectId);
            if (!select) return;
            select.innerHTML = '';
            fields.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f;
                select.appendChild(opt);
            });
            select.disabled = false;
            // 自动优先匹配（完全等于优先，否则包含优先，否则不选）
            let matched = fields.find(f => autoMatch[mappingKey] && autoMatch[mappingKey].some(key => f === key));
            if (!matched) matched = fields.find(f => autoMatch[mappingKey] && autoMatch[mappingKey].some(key => f.includes(key)));
            select.value = matched || '';
            fieldMapping[mappingKey] = select.value;
        });
        document.getElementById('apply-mapping').disabled = false;
    }

    // 字段映射面板应用按钮
    const applyMappingBtn = document.getElementById('apply-mapping');
    if (applyMappingBtn) {
        applyMappingBtn.addEventListener('click', () => {
            fieldMapping.building = document.getElementById('building-field').value;
            fieldMapping.floor = document.getElementById('floor-field').value;
            fieldMapping.deviceType = document.getElementById('device-type-field').value;
            fieldMapping.deviceId = document.getElementById('device-id-field').value;
            fieldMapping.location = document.getElementById('location-field').value;
            // 重新初始化筛选器和视图
            initFilters();
            applyFilters();
            updateStatistics();
        });
    }

    // 初始化Select2多选下拉
    function initSelect2() {
        $('.multi-select').select2({
            placeholder: '请选择',
            allowClear: true,
            width: 'resolve',
            language: 'zh-CN'
        });
    }
    // 在数据加载和筛选器初始化后调用
    function afterFilterInit() {
        setTimeout(() => {
            initSelect2();
        }, 0);
    }
}); 