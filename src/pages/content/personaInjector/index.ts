import { ContextCaptureService } from '../contextSync/capture';

const LOG_PREFIX = '[PersonaInjector]';
const STORAGE_KEY = 'user_persona_config';

let cleanupFns: (() => void)[] = [];

async function getPersonaConfig(): Promise<{ text: string; enabled: boolean }> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
            if (res[STORAGE_KEY]) {
                resolve({
                    text: res[STORAGE_KEY].text || '',
                    enabled: res[STORAGE_KEY].enabled !== false,
                });
            } else {
                resolve({ text: '', enabled: false });
            }
        });
    });
}

function saveConfig(text: string, enabled: boolean) {
    chrome.storage.local.set({
        [STORAGE_KEY]: {
            text,
            enabled,
        },
    });
}

// ----------------------------------------------------
// Core Injection Logic
// ----------------------------------------------------
async function injectPersona(inputElement: HTMLElement) {
    const config = await getPersonaConfig();
    if (!config.enabled || !config.text.trim()) {
        return;
    }

    const promptText = `[System Instruction: 已知用户画像与偏好如下，请以下述方式回答我的问题：\n${config.text.trim()}]\n\n我的问题是：`;

    const currentText = inputElement.innerText || inputElement.textContent || '';
    if (currentText.includes('System Instruction:')) {
        return; // Already injected
    }

    console.log(LOG_PREFIX, 'Injecting persona loaded from storage...');

    if (
        inputElement.isContentEditable ||
        inputElement.getAttribute('contenteditable') === 'true'
    ) {
        inputElement.focus();
        const textNode = document.createTextNode(promptText);
        if (inputElement.firstChild) {
            inputElement.insertBefore(textNode, inputElement.firstChild);
        } else {
            inputElement.appendChild(textNode);
        }
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputElement.tagName === 'TEXTAREA') {
        const textarea = inputElement as HTMLTextAreaElement;
        textarea.value = promptText + textarea.value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// ----------------------------------------------------
// UI Creation
// ----------------------------------------------------
function createUIPanel() {
    const container = document.createElement('div');
    container.id = 'gv-persona-injector-root';
    container.style.position = 'fixed';
    container.style.bottom = '96px';
    container.style.right = '24px';
    container.style.zIndex = '9999';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    let isOpen = false;
    let isCapturing = false;

    // Render minimal styling via JS, no tailwind dependencies
    const render = async () => {
        container.innerHTML = ''; // Clear

        if (!isOpen) {
            const btn = document.createElement('button');
            btn.title = '设置长期画像';
            Object.assign(btn.style, {
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
            btn.onclick = () => {
                isOpen = true;
                render();
            };
            container.appendChild(btn);
        } else {
            const config = await getPersonaConfig();

            const panel = document.createElement('div');
            Object.assign(panel.style, {
                width: '320px',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 'bold',
                color: '#1f2937'
            });
            header.innerHTML = '<span>🤖 长期助理画像</span>';

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            Object.assign(closeBtn.style, {
                background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280'
            });
            closeBtn.onclick = () => {
                isOpen = false;
                render();
            };
            header.appendChild(closeBtn);
            panel.appendChild(header);

            // Body
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            });

            // Checkbox
            const label = document.createElement('label');
            Object.assign(label.style, { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '14px' });

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = config.enabled;
            checkbox.onchange = (e) => saveConfig(textarea.value, (e.target as HTMLInputElement).checked);

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode('开启画像隐式注入'));
            body.appendChild(label);

            // Textarea
            const textarea = document.createElement('textarea');
            textarea.value = config.text;
            textarea.placeholder = '在此粘贴由 Gemini 提取并浓缩出的 [System Instruction] 画像配置...';
            Object.assign(textarea.style, {
                width: '100%', height: '120px', padding: '8px', boxSizing: 'border-box',
                border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px',
                resize: 'none', outline: 'none', color: '#1f2937'
            });
            textarea.oninput = () => saveConfig(textarea.value, checkbox.checked);
            body.appendChild(textarea);

            // Extract button
            const extractBtn = document.createElement('button');
            extractBtn.innerText = isCapturing ? '正在提取历史...' : '✨ 提取历史并生成新画像指令';
            extractBtn.disabled = isCapturing;
            Object.assign(extractBtn.style, {
                width: '100%', padding: '10px', background: 'linear-gradient(to right, #3b82f6, #4f46e5)',
                color: 'white', border: 'none', borderRadius: '8px', cursor: isCapturing ? 'not-allowed' : 'pointer',
                fontWeight: '500', opacity: isCapturing ? '0.7' : '1'
            });

            extractBtn.onclick = async () => {
                isCapturing = true;
                render();

                try {
                    const captureService = ContextCaptureService.getInstance();
                    const nodes = await captureService.captureDialogue();

                    let contextStr = nodes.map(n => {
                        const role = n.is_user_likely ? 'Me' : (n.is_ai_likely ? 'Gemini' : 'Unknown');
                        return `[${role}]: ${n.text}`;
                    }).join('\\n\\n');

                    if (contextStr.length > 5000) {
                        contextStr = contextStr.substring(0, 5000) + '\\n...[省略多余历史记录]';
                    }

                    const prompt = `请作为一位心理学、人类行为学专家和技术导师，阅读以下我和你的对话历史。
请综合分析并详细总结出我的：
1. 职业技能栈与技术水平
2. 思维方式特点与性格偏好
3. 语言沟通偏好（喜欢冗长还是精简？喜欢代码还是解释？）
4. 常见的提问痛点。

请以一份清晰的 Markdown 格式返回，并在末尾附上一段浓缩版的【System Instruction: 用户画像预设】，供我之后与你的提问中作为前置条件注入使用，要求尽量准确、深刻判断。

------------
近期对话历史：
${contextStr}
`;

                    const editables = document.querySelectorAll<HTMLElement>('[contenteditable="true"], [role="textbox"], textarea');
                    const inputElement = Array.from(editables).find(el => el.offsetParent !== null);

                    if (inputElement) {
                        inputElement.focus();

                        if (inputElement.isContentEditable || inputElement.getAttribute('contenteditable') === 'true') {
                            inputElement.innerHTML = '';
                            const textNode = document.createTextNode(prompt);
                            inputElement.appendChild(textNode);
                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        } else if (inputElement.tagName === 'TEXTAREA') {
                            (inputElement as HTMLTextAreaElement).value = prompt;
                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        alert('已经将【画像提取指令】填入聊天框中！请直接发送给 Gemini。收到它的回复后，把画像概括复制下来填入面板中。');
                        isOpen = false;
                    } else {
                        alert('没有找到输入框，请手动复制提取指令！');
                        await navigator.clipboard.writeText(prompt);
                    }
                } catch (e) {
                    console.error(LOG_PREFIX, e);
                    alert('历史提取失败');
                } finally {
                    isCapturing = false;
                    render();
                }
            };
            body.appendChild(extractBtn);

            const helpText = document.createElement('p');
            helpText.innerText = '注入的画像会被发送出去。由于 Gemini 没有原生系统提示词功能，每次新对话都会偷偷附带。';
            Object.assign(helpText.style, { fontSize: '11px', color: '#9ca3af', margin: '0' });
            body.appendChild(helpText);

            panel.appendChild(body);

            // Auto dark mode basic support
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                Object.assign(panel.style, { backgroundColor: '#18181b', borderColor: '#27272a' });
                Object.assign(header.style, { backgroundColor: '#27272a', color: '#e4e4e7', borderColor: '#3f3f46' });
                Object.assign(textarea.style, { backgroundColor: '#27272a', color: '#e4e4e7', borderColor: '#3f3f46' });
                Object.assign(label.style, { color: '#d4d4d8' });
            }

            container.appendChild(panel);
        }
    };

    render(); // Initial async render
    document.body.appendChild(container);

    return container;
}

// ----------------------------------------------------
// Event Interceptors
// ----------------------------------------------------
function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        const target = event.target as HTMLElement;
        const isContentEditable = target.isContentEditable || target.getAttribute('contenteditable') === 'true';
        const isTextarea = target.tagName === 'TEXTAREA';

        if (!isContentEditable && !isTextarea) return;
        void injectPersona(target);
    }
}

function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    const label = button.getAttribute('aria-label') || button.getAttribute('data-tooltip') || button.textContent || '';
    const isSendButton = /send|update|save|submit|更新|保存|提交|修改/i.test(label) ||
        button.querySelector('mat-icon[fonticon="send"]') ||
        button.querySelector('.material-symbols-outlined')?.textContent === 'send';

    if (isSendButton) {
        const inputContainer = button.closest('.conversation-container, main, body');
        if (inputContainer) {
            const inputElement = inputContainer.querySelector('[contenteditable="true"], [role="textbox"], textarea') as HTMLElement;
            if (inputElement) {
                void injectPersona(inputElement);
            }
        }
    }
}

export function startPersonaInjector() {
    console.log(LOG_PREFIX, 'Starting Persona module with Vanilla UI');

    const panelContainer = createUIPanel();

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('click', handleClick, { capture: true });

    cleanupFns.push(() => {
        document.removeEventListener('keydown', handleKeyDown, { capture: true });
        document.removeEventListener('click', handleClick, { capture: true });
        panelContainer.remove();
    });

    return () => {
        cleanupFns.forEach(fn => fn());
        cleanupFns = [];
        console.log(LOG_PREFIX, 'Stopped Persona module');
    };
}
