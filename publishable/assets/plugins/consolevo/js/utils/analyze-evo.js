import { getCsrfToken } from '../utils/helpers.js';
/**
 * Анализатор Evolution CMS с загрузкой данных с сервера
 */
export async function analyzeEvolutionCMS() {
    try {
        console.log('Загрузка данных Evolution CMS с сервера...');
        
        // Просто добавляем заголовки авторизации
        const headers = {
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        };
        
        // Сначала пробуем получить динамические данные
        let response = await fetch('/consolevo/analysis/evo-data', {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Если не получилось, используем статические данные
            console.log('Динамические данные недоступны, используем статические...');
            response = await fetch('/consolevo/analysis/static-data', {
                method: 'GET', 
                headers: headers,
                credentials: 'include'
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Данные Evolution CMS загружены успешно', {
                source: result.source || 'dynamic',
                methods: result.data.methods.length,
                properties: result.data.properties.length,
                constants: result.data.constants.length,
                functions: result.data.functions.length
            });
            return result.data;
        } else {
            throw new Error(result.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных Evolution CMS:', error);
        // Возвращаем статические данные как fallback
        return getStaticFallbackData();
    }
}

/**
 * Статические данные для fallback
 */
function getStaticFallbackData() {
    return {
        methods: [
            {
                name: 'DocumentParser::getConfig',
                params: [{name: '$key', default: '', full: '$key'}],
                full_signature: 'getConfig($key)'
            },
            {
                name: 'DocumentParser::getDocumentObject', 
                params: [{name: '$id', default: '', full: '$id'}],
                full_signature: 'getDocumentObject($id)'
            },
            {
                name: 'DocumentParser::runSnippet',
                params: [
                    {name: '$snippetName', default: '', full: '$snippetName'},
                    {name: '$params', default: '[]', full: '$params = []'}
                ],
                full_signature: 'runSnippet($snippetName, $params = [])'
            },
            {
                name: 'DocumentParser::getTemplateVars',
                params: [{name: '$docId', default: '', full: '$docId'}],
                full_signature: 'getTemplateVars($docId)'
            },
            {
                name: 'DocumentParser::makeUrl',
                params: [
                    {name: '$id', default: '', full: '$id'},
                    {name: '$args', default: '[]', full: '$args = []'}
                ],
                full_signature: 'makeUrl($id, $args = [])'
            },
            {
                name: 'DocumentParser::getLoginUserId',
                params: [],
                full_signature: 'getLoginUserId()'
            },
            {
                name: 'DocumentParser::clearCache',
                params: [{name: '$type', default: '""', full: '$type = ""'}],
                full_signature: 'clearCache($type = "")'
            }
            // Добавьте остальные методы по необходимости
        ],
        properties: [
            'config', 'documentObject', 'documentIdentifier', 'documentContent',
            'documentGenerated', 'template', 'snippet', 'chunk', 'plugin'
        ],
        constants: [
            'MODX_BASE_PATH', 'MODX_BASE_URL', 'MODX_SITE_URL', 
            'MODX_MANAGER_PATH', 'MODX_MANAGER_URL'
        ],
        functions: [
            {
                name: 'evolutionCMS',
                params: [],
                full_signature: 'evolutionCMS()'
            },
            {
                name: 'db',
                params: [{name: '$sql', default: '', full: '$sql'}],
                full_signature: 'db($sql)'
            },
            {
                name: 'getTV',
                params: [
                    {name: '$tvName', default: '', full: '$tvName'},
                    {name: '$docId', default: '', full: '$docId'},
                    {name: '$published', default: '1', full: '$published = 1'}
                ],
                full_signature: 'getTV($tvName, $docId, $published = 1)'
            },
            {
                name: 'getTemplate',
                params: [{name: '$templateId', default: '', full: '$templateId'}],
                full_signature: 'getTemplate($templateId)'
            },
            {
                name: 'getDocument',
                params: [{name: '$docId', default: '', full: '$docId'}],
                full_signature: 'getDocument($docId)'
            }
        ],
        generated_at: new Date().toISOString(),
        source: 'fallback'
    };
}

function generateMethodDocHTML(methodName, params, fullSignature) {
    let html = `<div class="ace_doc-tooltip">
        <div class="ace_doc-title">${methodName}</div>
        <div class="ace_doc-signature">${fullSignature}</div>`;
    
    if (params && params.length > 0) {
        html += `<div class="ace_doc-section">
            <div class="ace_doc-section-title">Параметры:</div>`;
        
        params.forEach((param) => {
            const paramName = typeof param === 'object' ? param.name : `param`;
            const paramDefault = typeof param === 'object' && param.default ? ` = ${param.default}` : '';
            const paramType = getParamType(paramName); // ТИПЫ
            const paramDesc = getParamDescription(methodName, paramName); // ОПИСАНИЯ
            
            html += `<div class="ace_doc-param">
                <span class="ace_doc-param-type">${paramType}</span>
                <span class="ace_doc-param-name">${paramName}</span>
                <span class="ace_doc-param-default">${paramDefault}</span>
                ${paramDesc ? `<div class="ace_doc-param-desc">${paramDesc}</div>` : ''}
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // ДОБАВИТЬ ОПИСАНИЕ МЕТОДА
    const methodDescription = getMethodDescription(methodName);
    if (methodDescription) {
        html += `<div class="ace_doc-section">
            <div class="ace_doc-section-title">Описание:</div>
            <div class="ace_doc-description">${methodDescription}</div>
        </div>`;
    }
    
    html += `</div>`;
    return html;
}

function getMethodDescription(methodName) {
    const descriptions = {
        'getDocumentObject': 'Получает полный объект документа по ID',
        'getTemplateVars': 'Возвращает TV-параметры для указанного документа', 
        'runSnippet': 'Выполняет сниппет с переданными параметрами',
        'makeUrl': 'Генерирует URL для документа',
        'getConfig': 'Возвращает значение из конфигурации Evolution CMS',
        '_fetchContent': 'Внутренний метод для обработки контента'
    };
    return descriptions[methodName] || '';
}

function getParamDescription(methodName, paramName) {
    const descriptions = {
        'getDocumentObject': {
            '$id': 'ID документа (integer)'
        },
        'getTemplateVars': {
            '$docId': 'ID документа для получения TV'
        },
        'runSnippet': {
            '$snippetName': 'Имя сниппета (string)',
            '$params': 'Массив параметров (array)'
        },
        '_fetchContent': {
            '$string': 'Обрабатываемая строка',
            '$delim': 'Разделитель для парсинга'
        }
    };
    
    return descriptions[methodName]?.[paramName] || '';
}

function getParamType(paramName) {
    const types = {
        '$id': 'int',
        '$docId': 'int', 
        '$snippetName': 'string',
        '$params': 'array',
        '$string': 'string',
        '$delim': 'string',
        '$key': 'string',
        '$templateId': 'int',
        '$tvName': 'string'
    };
    return types[paramName] || 'mixed';
}

/**
 * Генерация данных для автодополнения на основе анализа (с параметрами)
 */
export function generateEvoCompletionsFromAnalysis(analysis) {
    const completions = [];

    // Преобразуем данные в массивы
    const methods = convertToArray(analysis.methods);
    const properties = convertToArray(analysis.properties);
    const functions = convertToArray(analysis.functions);
    const constants = convertToArray(analysis.constants);

    console.log('Генерация автодополнения из анализа:', {
        methods: methods.length,
        properties: properties.length,
        functions: functions.length,
        constants: constants.length
    });

    // Методы для evo объекта (с параметрами)
    methods.forEach(method => {
        if (typeof method === 'object' && method.name && method.params) {
            // Структурированные данные с параметрами
            const methodName = method.name.replace(/.*::/, ''); // Убираем namespace
            const paramsString = generateParamsString(method.params);
            
            completions.push({
                name: `$evo->${methodName}(${paramsString})`,
                value: `$evo->${methodName}`,
                score: 1000,
                meta: 'evo method',
                description: method.full_signature || `Метод ${methodName}`,
                params: method.params,
                docHTML: generateMethodDocHTML(methodName, method.params, method.full_signature)
            });
        } else if (typeof method === 'string') {
            // Простые строковые данные (fallback)
            completions.push({
                name: `$evo->${method}`,
                value: `$evo->${method}`,
                score: 1000,
                meta: 'evo method',
                description: `Метод ${method}`
            });
        }
    });

    // Свойства для evo объекта
    properties.forEach(property => {
        completions.push({
            name: `$evo->${property}`,
            value: `$evo->${property}`,
            score: 900,
            meta: 'evo property',
            description: `Свойство Evolution CMS`
        });
    });

    // Глобальные функции (с параметрами)
    functions.forEach(func => {
        if (typeof func === 'object' && func.name && func.params) {
            // Структурированные данные с параметрами
            const paramsString = generateParamsString(func.params);
            
            completions.push({
                name: `${func.name}(${paramsString})`,
                value: func.name,
                score: 800,
                meta: 'evo function',
                description: func.full_signature || `Функция ${func.name}`,
                params: func.params
            });
        } else if (typeof func === 'string') {
            // Простые строковые данные (fallback)
            completions.push({
                name: func,
                value: func,
                score: 800,
                meta: 'evo function',
                description: `Функция ${func}`
            });
        }
    });

    // Константы
    constants.forEach(constant => {
        completions.push({
            name: constant,
            value: constant,
            score: 700,
            meta: 'evo constant',
            description: `Константа Evolution CMS`
        });
    });

    console.log('Сгенерировано подсказок с параметрами:', completions.length);
    return completions;
}


/**
 * Генерация строки параметров для отображения
 */
function generateParamsString(params) {
    if (!Array.isArray(params) || params.length === 0) {
        return '';
    }
    
    return params.map(param => {
        if (typeof param === 'object' && param.name) {
            return param.name + (param.default ? ` = ${param.default}` : '');
        }
        return String(param);
    }).join(', ');
}

/**
 * Улучшенная генерация сниппетов с параметрами
 */
export function generateEvoSnippetsFromAnalysis(analysis) {
    const snippets = [];

    // Преобразуем methods в массив
    const methods = convertToArray(analysis.methods);
    const functions = convertToArray(analysis.functions);

    console.log('Генерация сниппетов с параметрами:', {
        methods: methods.length,
        functions: functions.length
    });

    // Сниппеты для методов с параметрами
    methods.forEach(method => {
        if (typeof method === 'object' && method.name && method.params) {
            const methodName = method.name.replace(/.*::/, '');
            const snippet = generateMethodSnippet(methodName, method.params, method.full_signature);
            if (snippet) {
                snippets.push(snippet);
            }
        }
    });

    // Сниппеты для функций с параметрами
    functions.forEach(func => {
        if (typeof func === 'object' && func.name && func.params) {
            const snippet = generateFunctionSnippet(func.name, func.params, func.full_signature);
            if (snippet) {
                snippets.push(snippet);
            }
        }
    });

    // Базовые сниппеты для популярных операций
    snippets.push(...generateBaseSnippets(methods, functions));

    console.log('Сгенерировано сниппетов с параметрами:', snippets.length);
    return snippets;
}

/**
 * Генерация сниппета для метода
 */
function generateMethodSnippet(methodName, params, fullSignature) {
    const tabStops = generateTabStops(params);
    const paramsString = params.map(param => 
        typeof param === 'object' ? param.name : String(param)
    ).join(', ');

    return {
        name: `$evo->${methodName}`,
        content: `$evo->${methodName}(${tabStops})`,
        tabTrigger: methodName.toLowerCase(),
        description: fullSignature || `Метод ${methodName}(${paramsString})`,
        meta: 'evo method'
    };
}

/**
 * Генерация сниппета для функции
 */
function generateFunctionSnippet(funcName, params, fullSignature) {
    const tabStops = generateTabStops(params);
    const paramsString = params.map(param => 
        typeof param === 'object' ? param.name : String(param)
    ).join(', ');

    return {
        name: funcName,
        content: `${funcName}(${tabStops})`,
        tabTrigger: funcName.toLowerCase(),
        description: fullSignature || `Функция ${funcName}(${paramsString})`,
        meta: 'evo function'
    };
}

/**
 * Генерация таб-стопов для параметров
 */
function generateTabStops(params) {
    if (!Array.isArray(params) || params.length === 0) {
        return '';
    }

    return params.map((param, index) => {
        const paramName = typeof param === 'object' ? param.name : `param${index + 1}`;
        return `\${${index + 1}:${paramName}}`;
    }).join(', ');
}

/**
 * Базовые сниппеты для популярных операций
 */
function generateBaseSnippets(methods, functions) {
    const baseSnippets = [];

    // Сниппет для получения документа
    if (methods.some(m => 
        (typeof m === 'object' && m.name && m.name.includes('getDocumentObject')) ||
        (typeof m === 'string' && m === 'getDocumentObject')
    )) {
        baseSnippets.push({
            name: 'get_document_info',
            content: `// Получить информацию о документе
$doc = $evo->getDocumentObject(\${1:id});
if ($doc) {
    echo "Заголовок: " . $doc['pagetitle'] . "\\\\n";
    echo "Родитель: " . $doc['parent'] . "\\\\n";
    echo "Опубликован: " . ($doc['published'] ? 'Да' : 'Нет') . "\\\\n";
}`,
            tabTrigger: 'docinfo',
            description: 'Получить информацию о документе',
            meta: 'evo snippet'
        });
    }

    // Сниппет для TV параметров
    if (methods.some(m => 
        (typeof m === 'object' && m.name && m.name.includes('getTemplateVars')) ||
        (typeof m === 'string' && m === 'getTemplateVars')
    )) {
        baseSnippets.push({
            name: 'get_tv_values',
            content: `// Получить TV параметры документа
$tvs = $evo->getTemplateVars(\${1:id});
foreach ($tvs as $tv) {
    echo $tv['name'] . ": " . $tv['value'] . "\\\\n";
}`,
            tabTrigger: 'gettvs',
            description: 'Получить TV параметры документа',
            meta: 'evo snippet'
        });
    }

    return baseSnippets;
}

/**
 * Преобразует объект с числовыми ключами в массив
 */
function convertToArray(data) {
    if (Array.isArray(data)) {
        return data;
    }
    
    if (data && typeof data === 'object') {
        return Object.values(data);
    }
    
    return [];
}