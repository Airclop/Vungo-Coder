// Monaco Editor 配置
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});

let editor; // 编辑器实例
let openFiles = new Map(); // 保存打开的文件
let currentDirectory = null; // 当前目录句柄
let directoryFiles = new Map(); // 存储目录中的文件

// 添加新的全局变量
let autoSaveTimer = null; // 自动保存定时器
const AUTO_SAVE_DELAY = 1000; // 自动保存延迟（毫秒）
let isFileModified = false; // 文件是否被修改

// 在文件开头添加支持的图片格式
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const MAX_FILE_SIZE = 1024 * 1024 * 10; // 最大文件大小（10MB）

// 初始化编辑器
require(['vs/editor/editor.main'], function() {
    // 确保monaco对象已经加载
    if (!window.monaco) {
        console.error('Monaco Editor 加载失败');
        return;
    }

    try {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '// 欢迎使用轻量级代码编辑器',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: {
                enabled: true
            },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line'
        });

        // 添加保存快捷键
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
            saveCurrentFile();
        });

        console.log('Monaco Editor 初始化成功');
    } catch (err) {
        console.error('Monaco Editor 初始化失败:', err);
    }
});

// 当前激活的文件名
let currentFileName = null;

// 检查浏览器是否支持 File System Access API
function checkFileSystemSupport() {
    if ('showOpenFilePicker' in window) {
        return true;
    }
    alert('您的浏览器不支持文件系统访问，请使用最新版本的Chrome、Edge或其他支持的浏览器。');
    return false;
}

// 打开文件按钮事件处理
document.getElementById('openFileBtn').addEventListener('click', async () => {
    if (!checkFileSystemSupport()) return;
    
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: '文本文件',
                    accept: {
                        'text/*': ['.txt', '.js', '.html', '.css', '.json', '.ts']
                    }
                }
            ],
            multiple: false
        });
        
        if (!fileHandle) {
            throw new Error('未选择文件');
        }

        const file = await fileHandle.getFile();
        const content = await file.text();
        
        // 保存文件句柄以便后续保存操作
        openFiles.set(file.name, {
            handle: fileHandle,
            content: content
        });
        
        // 创建新标签页
        createTab(file.name, content);
        
        // 更新当前文件名
        currentFileName = file.name;
        
        // 更新编辑器内容
        editor.setValue(content);
        
        // 根据文件扩展名设置语言
        const fileExtension = file.name.split('.').pop();
        setEditorLanguage(fileExtension);
        
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('用户取消了文件选择');
            return;
        }
        console.error('打开文件失败:', err);
        alert('打开文件失败: ' + err.message);
    }
});

// 根据文件扩展名设置编辑器语言
function setEditorLanguage(extension) {
    const languageMap = {
        'js': 'javascript',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'ts': 'typescript',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'py': 'python',
        'pl': 'perl',
        'pm': 'perl',
        'go': 'go',
        'rs': 'rust',
        'hs': 'haskell',
        'lua': 'lua',
        'r': 'r',
        'sh': 'bash',
        'bash': 'bash',
        'ps1': 'powershell',
        'psm1': 'powershell',
        'bat': 'batch',
        'cmd': 'batch',
        'groovy': 'groovy',
        'svg': 'xml',
    };
    
    const language = languageMap[extension] || 'plaintext';
    monaco.editor.setModelLanguage(editor.getModel(), language);
}

// 更新标签页状态
function updateTabStatus(filename) {
    const fileInfo = openFiles.get(filename);
    if (!fileInfo || !fileInfo.tab) return;
    
    const tab = fileInfo.tab;
    const saveButton = tab.querySelector('.tab-save-button');
    const cancelButton = tab.querySelector('.tab-cancel-button');
    
    if (isFileModified) {
        if (!tab.classList.contains('modified')) {
            tab.classList.add('modified');
            saveButton.innerHTML = '✔';
            saveButton.style.color = '#ffd700';
        }
    } else {
        tab.classList.remove('modified');
        saveButton.innerHTML = '✔';
        saveButton.style.color = '#4CAF50';
    }
}

// 修改保存文件函数
async function saveCurrentFile(isAutoSave = false) {
    const fileInfo = openFiles.get(currentFileName);
    if (!fileInfo || !fileInfo.handle) {
        alert('文件信息不完整');
        return;
    }

    try {
        // 获取当前编辑器内容
        const content = editor.getValue();

        // 检查写入权限
        if ((await fileInfo.handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
            const permission = await fileInfo.handle.requestPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                throw new Error('没有写入权限');
            }
        }

        // 创建写入流
        const writable = await fileInfo.handle.createWritable();
        
        // 写入内容
        await writable.write(content);
        await writable.close();

        // 更新存储的内容
        fileInfo.content = content;
        
        // 重置修改状态
        isFileModified = false;
        updateTabStatus(currentFileName);
        
        // 仅在非自动保存时显示提示
        if (!isAutoSave) {
            showSaveSuccess();
        }

    } catch (err) {
        console.error('保存文件失败:', err);
        if (!isAutoSave) {
            alert('保存文件失败: ' + err.message);
        }
    }
}

// 显示保存成功提示
function showSaveSuccess() {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = '文件已保存';
    document.body.appendChild(notification);

    // 2秒后移除提示
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 修改 activateTab 函数
function activateTab(filename) {
    const fileInfo = openFiles.get(filename);
    if (!fileInfo) return;
    
    // 更新当前文件名
    currentFileName = filename;
    
    // 更新标签页样式
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    fileInfo.tab.classList.add('active');
    
    // 检查是否是图片文件
    const extension = filename.split('.').pop().toLowerCase();
    if (IMAGE_EXTENSIONS.includes(extension)) {
        // 显示图片内容
        document.getElementById('editor-container').innerHTML = fileInfo.content;
        editor.layout();
    } else {
        // 恢复编辑器内容
        editor.setValue(fileInfo.content);
        setEditorLanguage(extension);
    }
}

// 修改 createTab 函数，添加取消编辑按钮
function createTab(filename, content) {
    const tabsContainer = document.getElementById('editorTabs');
    
    // 检查是否已存在相同文件的标签页
    const existingTab = openFiles.get(filename)?.tab;
    if (existingTab) {
        activateTab(filename);
        tabsContainer.removeChild(existingTab);
        return;
    }
    
    const tab = document.createElement('div');
    tab.className = 'tab active';
    
    // 添加文件名
    const tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.textContent = filename;
    tab.appendChild(tabName);
    
    // 添加按钮容器
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'tab-buttons';
    
    // 添加取消编辑按钮
    const cancelButton = document.createElement('span');
    cancelButton.className = 'tab-cancel-button';
    cancelButton.title = '重置';
    cancelButton.innerHTML = '❌';  // 使用更简单的箭头
    cancelButton.onclick = (e) => {
        e.stopPropagation();
        tabsContainer.removeChild(tab); // 移除标签页
        showNotification('已关闭文件');
        openFiles.delete(filename);
        if (currentFileName === filename) {
            currentFileName = null;
            editor.setValue('');
        } else {
            activateTab(currentFileName); // 激活当前文件标签页
        }
    };
    
    
    // 添加保存按钮
    const saveButton = document.createElement('span');
    saveButton.className = 'tab-save-button';
    saveButton.title = '保存文件 (Ctrl+S)';
    saveButton.innerHTML = '✔';
    saveButton.onclick = (e) => {
        e.stopPropagation();
        currentFileName = filename;
        saveCurrentFile();
    };
    
    // 将按钮添加到容器
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(saveButton);
    tab.appendChild(buttonsContainer);
    
    // 为标签页添加点击事件
    tab.addEventListener('click', () => activateTab(filename));
    
    // 移除其他标签页的active类
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // 存储文件信息
    openFiles.set(filename, {
        ...openFiles.get(filename),
        tab: tab,
        content: content,
        originalContent: content // 保存原始内容
    });
    
    currentFileName = filename;
    tabsContainer.appendChild(tab);
}

// 添加通用提示函数
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `save-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 在文件树标题旁添加打开目录按钮事件
document.getElementById('openDirBtn').addEventListener('click', async () => {
    if (!checkFileSystemSupport()) return;
    
    try {
        const dirHandle = await window.showDirectoryPicker();
        await loadDirectory(dirHandle);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('用户取消了目录选择');
            return;
        }
        console.error('打开目录失败:', err);
        alert('打开目录失败: ' + err.message);
    }
});

// 修改加载目录函数，使其支持递归
async function loadDirectory(dirHandle, parentElement = null) {
    try {
        if (!parentElement) {
            // 根目录的情况
            currentDirectory = dirHandle;
            directoryFiles.clear();
            
            const fileTreeContent = document.getElementById('fileTreeContent');
            fileTreeContent.innerHTML = '';
            
            // 创建目录标题
            const dirTitle = document.createElement('div');
            dirTitle.className = 'directory-title';
            dirTitle.innerHTML = `<span class="icon folder-icon">📂</span> ${dirHandle.name}`;
            fileTreeContent.appendChild(dirTitle);
            
            parentElement = document.createElement('div');
            parentElement.className = 'file-list';
            fileTreeContent.appendChild(parentElement);
        }

        // 收集所有条目并排序
        const entries = [];
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }
        
        // 排序：文件夹在前，文件在后，同类型按字母排序
        entries.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        // 处理所有条目
        for (const entry of entries) {
            const item = document.createElement('div');
            item.className = 'file-item';
            
            if (entry.kind === 'directory') {
                item.innerHTML = `<span class="icon folder-icon">📁</span> ${entry.name}`;
                item.classList.add('directory');
                
                // 创建子目录容器，但暂不加载内容
                const subList = document.createElement('div');
                subList.className = 'sub-file-list';
                
                // 添加点击事件
                item.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const isExpanded = item.classList.contains('expanded');
                    
                    if (isExpanded) {
                        // 折叠：移除所有子元素
                        item.classList.remove('expanded');
                        const subList = item.querySelector('.sub-file-list');
                        if (subList) {
                            subList.remove();
                        }
                    } else {
                        // 展开：加载子目录内容
                        item.classList.add('expanded');
                        const subList = document.createElement('div');
                        subList.className = 'sub-file-list';
                        item.appendChild(subList);
                        await loadDirectory(entry, subList);
                    }
                });
            } else {
                const fileIcon = getFileIcon(entry.name);
                item.innerHTML = `<span class="icon file-icon">${fileIcon}</span> ${entry.name}`;
                item.classList.add('file');
                directoryFiles.set(entry.name, entry);
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openFileFromDirectory(entry);
                });
            }
            
            parentElement.appendChild(item);
        }
        
    } catch (err) {
        console.error('加载目录失败:', err);
        alert('加载目录失败: ' + err.message);
    }
}

// 根据文件类型返回对应的图标
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'html': '🌐',
        'css': '🎨',
        'js': '📜',
        'json': '📋',
        'md': '📝',
        'txt': '📄',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'svg': '🎯',
        'pdf': '📕',
        'zip': '📦',
        'rar': '📦',
        'exe': '⚙️',
        'ts': '📘',
        'jsx': '⚛️',
        'tsx': '⚛️',
        'vue': '🟩',
        'php': '🐘',
        'py': '🐍',
        'rb': '💎',
        'java': '☕',
        'c': '©️',
        'cpp': '➕',
        'go': '🔵',
        'rs': '��',
        'sql': '🗄️',
        'yaml': '📐',
        'yml': '📐',
        'xml': '📰',
        'mp3': '🎵',
        'mp4': '🎬',
        'wav': '🔊',
        'ttf': '🔤',
        'woff': '🔤',
        'woff2': '🔤',
        'webp': '🖼️',
        'bmp': '🖼️',
    };
    
    return iconMap[ext] || '📄';
}

// 从目录中打开文件
async function openFileFromDirectory(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const extension = file.name.split('.').pop().toLowerCase();
        
        // 检查是否是图片文件
        if (IMAGE_EXTENSIONS.includes(extension)) {
            // 预览图片
            previewImage(file);
            return;
        }
        
        // 原有的文本文件处理逻辑
        const content = await file.text();
        if (content.length > MAX_FILE_SIZE) {
            // 提示用户文件过大
            alert('文件过大，无法打开');
            return;
        }
        
        openFiles.set(file.name, {
            handle: fileHandle,
            content: content
        });
        
        createTab(file.name, content);
        currentFileName = file.name;
        editor.setValue(content);
        setEditorLanguage(extension);
        
    } catch (err) {
        console.error('打开文件失败:', err);
        alert('打开文件失败: ' + err.message);
    }
}

// 修改图片预览函数
async function previewImage(file) {
    const imagePreview = document.getElementById('imagePreview');
    const previewTitle = imagePreview.querySelector('.preview-title');
    const previewImage = imagePreview.querySelector('img');
    const previewContent = imagePreview.querySelector('.preview-content');
    
    // 设置预览标题
    previewTitle.textContent = file.name;
    
    // 创建图片URL
    const imageUrl = URL.createObjectURL(file);
    previewImage.src = imageUrl;
    
    // 显示预览
    imagePreview.classList.add('active');
    
    // 清理函数
    const cleanup = () => {
        URL.revokeObjectURL(imageUrl);
        imagePreview.classList.remove('active');
    };
    
    // 添加关闭按钮事件
    imagePreview.querySelector('.close-preview').onclick = (e) => {
        e.stopPropagation();
        cleanup();
    };
    // 添加点击背景关闭预览
    previewContent.onclick = (e) => {
        if (e.target === previewContent) {
            cleanup();
        }
    };

    // 防止图片点击事件冒泡
    previewImage.onclick = (e) => {
        e.stopPropagation();
    };

    // 添加点击整个预览容器的事件
    imagePreview.onclick = (e) => {
        if (e.target === imagePreview) {
            cleanup();
        }
    };

    // 添加ESC键关闭预览
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            cleanup();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// 侧边栏宽度调整功能
function initSidebarResize() {
const sidebar = document.querySelector('.sidebar');
    let isResizing = false;
    let startX;
    let startWidth;
    // 监听鼠标按下事件
    sidebar.addEventListener('mousedown', function(e) {
    // 只在右边缘4px范围内响应
        if (e.offsetX > sidebar.offsetWidth - 4) {
          isResizing = true;
         startX = e.pageX;
         startWidth = sidebar.offsetWidth;
      }
    });

    // 监听鼠标移动事件
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        const width = startWidth + (e.pageX - startX);
            
            // 限制最小和最大宽度
        if (width >= 200 && width <= 800) {
            sidebar.style.width = width + 'px';
            // 刷新编辑器布局
            if (editor) {
                editor.layout();
            }
        }

        // 防止选中文本
        e.preventDefault();
    });

    // 监听鼠标松开事件
    document.addEventListener('mouseup', function() {
        isResizing = false;
    });
}

// 初始化侧边栏调整功能
initSidebarResize();
