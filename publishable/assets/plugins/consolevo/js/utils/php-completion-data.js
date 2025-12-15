import { 
    analyzeEvolutionCMS, 
    generateEvoCompletionsFromAnalysis,
    generateEvoSnippetsFromAnalysis 
} from './analyze-evo.js';

// Базовые PHP сниппеты
export const PHP_SNIPPETS = [
    { 
        name: 'echo', 
        content: 'echo "${1:text}";',
        tabTrigger: 'echo',
        scope: 'php'
    },
    { 
        name: 'foreach', 
        content: 'foreach ($${1:array} as $${2:value}) {\n\t${3:// code}\n}',
        tabTrigger: 'foreach',
        scope: 'php'
    },
    { 
        name: 'if', 
        content: 'if (${1:condition}) {\n\t${2:// code}\n}',
        tabTrigger: 'if',
        scope: 'php'
    },
    { 
        name: 'function', 
        content: 'function ${1:functionName}(${2:parameters}) {\n\t${3:// code}\n}',
        tabTrigger: 'func',
        scope: 'php'
    },
    { 
        name: 'class', 
        content: 'class ${1:ClassName} {\n\t${2:// code}\n}',
        tabTrigger: 'class',
        scope: 'php'
    }
];

// Статические данные по умолчанию
export const EVO_OBJECTS = [
    {
        name: 'evo',
        type: 'object',
        description: 'Главный объект Evolution CMS',
        methods: [
            'getConfig', 'getDatabase', 'getManagerApi', 'getDocumentObject',
            'getDocumentChildren', 'runSnippet', 'runPlugin', 'chunkProcessor',
            'getPhpCompat', 'getUrl', 'makeUrl', 'getLoginUserId', 'getLoginUserName',
            'getUserData', 'getTemplateVars', 'getTemplateVar', 'getTemplateVarOutput',
            'getPageInfo', 'getAllChildren', 'getActiveChildren', 'getDocument',
            'getDocumentList', 'getVersionData', 'clearCache', 'invokeEvent'
        ]
    },
    {
        name: 'modx',
        type: 'object', 
        description: 'Псевдоним для evo (совместимость)',
        methods: [
            'getConfig', 'getDatabase', 'getDocumentObject', 'getTemplateVars'
        ]
    }
];

export const EVO_SNIPPETS = [
    {
        name: '$evo->getConfig',
        content: '$evo->getConfig(\'${1:key}\')',
        description: 'Получить значение конфигурации',
        meta: 'evo method'
    },
    {
        name: '$evo->getDocumentObject',
        content: '$evo->getDocumentObject(${1:id})',
        description: 'Получить объект документа по ID',
        meta: 'evo method'
    },
    {
        name: '$evo->runSnippet',
        content: '$evo->runSnippet(\'${1:snippet_name}\', [\'${2:param}\' => \'${3:value}\'])',
        description: 'Выполнить сниппет',
        meta: 'evo method'
    },
    {
        name: '$evo->getTemplateVars',
        content: '$evo->getTemplateVars(${1:doc_id})',
        description: 'Получить TV параметры документа',
        meta: 'evo method'
    },
    {
        name: '$evo->makeUrl',
        content: '$evo->makeUrl(${1:id})',
        description: 'Сгенерировать URL документа',
        meta: 'evo method'
    }
];

export const EVO_CONSTANTS = [
    {
        name: '$_SESSION',
        description: 'Сессия менеджера',
        fields: ['mgrValidated', 'mgrInternalKey', 'mgrShortname', 'mgrRole', 'mgrEmail', 'mgrFullName']
    },
    {
        name: '$evo->config',
        description: 'Конфигурация Evolution CMS',
        fields: ['site_name', 'site_start', 'error_page', 'unauthorized_page', 'base_url', 'site_url']
    }
];

export const EVO_SAFE_FUNCTIONS = [
    'evolutionCMS', 'db', 'getTV', 'getTemplate', 'getDocument',
    'getDocuments', 'getDocumentChildren', 'getDocumentList',
    'getTemplateVar', 'getTemplateVars', 'setTemplateVar',
    'getWebUserInfo', 'getManagerUserInfo', 'isLoggedIn',
    'setCache', 'getCache', 'deleteCache'
];

export const EVO_QUICK_SNIPPETS = [
    {
        name: 'get_document_info',
        content: `// Получить информацию о документе
$doc = $evo->getDocumentObject(\${1:id});
if ($doc) {
    echo "Заголовок: " . $doc['pagetitle'] . "\\n";
    echo "Родитель: " . $doc['parent'] . "\\n";
    echo "Опубликован: " . ($doc['published'] ? 'Да' : 'Нет') . "\\n";
}`,
        tabTrigger: 'docinfo',
        description: 'Получить информацию о документе'
    },
    {
        name: 'get_tv_values',
        content: `// Получить TV параметры документа
$tvs = $evo->getTemplateVars(\${1:id});
foreach ($tvs as $tv) {
    echo $tv['name'] . ": " . $tv['value'] . "\\n";
}`,
        tabTrigger: 'gettvs',
        description: 'Получить TV параметры документа'
    },
    {
        name: 'run_snippet',
        content: `// Выполнить сниппет
$result = $evo->runSnippet('\${1:snippet_name}', [
    '\${2:param1}' => '\${3:value1}',
    '\${4:param2}' => '\${5:value2}'
]);
echo "Результат: " . $result;`,
        tabTrigger: 'runsnip',
        description: 'Выполнить сниппет с параметрами'
    },
    {
        name: 'current_user_info',
        content: `// Информация о текущем пользователе
if (isset($_SESSION['mgrValidated']) && $_SESSION['mgrValidated']) {
    echo "ID: " . $_SESSION['mgrInternalKey'] . "\\n";
    echo "Имя: " . $_SESSION['mgrShortname'] . "\\n"; 
    echo "Роль: " . $_SESSION['mgrRole'] . "\\n";
    echo "Email: " . $_SESSION['mgrEmail'] . "\\n";
    echo "Полное имя: " . $_SESSION['mgrFullName'] . "\\n";
} else {
    echo "Пользователь не авторизован\\n";
}`,
        tabTrigger: 'userinfo',
        description: 'Информация о текущем пользователе'
    },
    {
        name: 'site_config',
        content: `// Основные настройки сайта
echo "Название сайта: " . $evo->getConfig('site_name') . "\\n";
echo "Главная страница: " . $evo->getConfig('site_start') . "\\n";
echo "Базовый URL: " . $evo->getConfig('base_url') . "\\n";
echo "URL сайта: " . $evo->getConfig('site_url') . "\\n";`,
        tabTrigger: 'config',
        description: 'Основные настройки сайта'
    }
];

/**
 * Динамические данные для автодополнения Evolution CMS
 */
export class DynamicEvoCompletion {
    constructor() {
        this.analysis = null;
        this.isAnalyzed = false;
    }

    /**
     * Загружает и анализирует Evolution CMS
     */
    async initialize() {
        if (this.isAnalyzed) return;

        try {
            this.analysis = await analyzeEvolutionCMS();
            this.isAnalyzed = true;
        } catch (error) {
            console.error('Ошибка загрузки данных Evolution CMS:', error);
            // Возвращаем данные по умолчанию
            this.analysis = this.getDefaultAnalysis();
            this.isAnalyzed = true;
        }
    }

    /**
     * Данные по умолчанию если анализ не удался
     */
    getDefaultAnalysis() {
        return {
            methods: [
                'getConfig', 'getDatabase', 'getManagerApi', 'getDocumentObject',
                'getDocumentChildren', 'runSnippet', 'runPlugin', 'chunkProcessor',
                'getPhpCompat', 'getUrl', 'makeUrl', 'getLoginUserId', 'getLoginUserName',
                'getUserData', 'getTemplateVars', 'getTemplateVar', 'getTemplateVarOutput',
                'getPageInfo', 'getAllChildren', 'getActiveChildren', 'getDocument',
                'getDocumentList', 'getVersionData', 'clearCache', 'invokeEvent'
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
                'evolutionCMS', 'db', 'getTV', 'getTemplate', 'getDocument'
            ]
        };
    }

    /**
     * Генерация данных для автодополнения
     */
    generateCompletions() {
        if (!this.isAnalyzed) {
            return this.getDefaultCompletions();
        }

        return generateEvoCompletionsFromAnalysis(this.analysis);
    }

    /**
     * Генерация сниппетов
     */
    generateSnippets() {
        if (!this.isAnalyzed) {
            return this.getDefaultSnippets();
        }

        return generateEvoSnippetsFromAnalysis(this.analysis);
    }

    /**
     * Данные автодополнения по умолчанию
     */
    getDefaultCompletions() {
        const completions = [];
        
        // Evolution CMS объекты
        EVO_OBJECTS.forEach(obj => {
            completions.push({
                name: obj.name,
                value: obj.name,
                score: 1000,
                meta: `evo ${obj.type}`,
                description: obj.description
            });
            
            // Методы объектов
            obj.methods?.forEach(method => {
                completions.push({
                    name: `${obj.name}->${method}`,
                    value: `${obj.name}->${method}`,
                    score: 900,
                    meta: `evo method`,
                    description: `Метод ${obj.name}`
                });
            });
        });
        
        // Evolution CMS константы
        EVO_CONSTANTS.forEach(constant => {
            completions.push({
                name: constant.name,
                value: constant.name,
                score: 800,
                meta: 'evo constant',
                description: constant.description
            });
            
            // Поля констант
            constant.fields?.forEach(field => {
                completions.push({
                    name: `${constant.name}['${field}']`,
                    value: `${constant.name}['${field}']`,
                    score: 700,
                    meta: 'evo field',
                    description: `Поле ${constant.name}`
                });
            });
        });
        
        // Evolution CMS функции
        EVO_SAFE_FUNCTIONS.forEach(func => {
            completions.push({
                name: func,
                value: func,
                score: 600,
                meta: 'evo function',
                description: 'Evolution CMS функция'
            });
        });
        
        return completions;
    }

    /**
     * Сниппеты по умолчанию
     */
    getDefaultSnippets() {
        return [
            ...EVO_SNIPPETS,
            ...EVO_QUICK_SNIPPETS
        ];
    }
}

// Создаем глобальный экземпляр
export const evoCompletion = new DynamicEvoCompletion();

// Экспортируем функции для обратной совместимости
export async function generatePhpCompletions() {
    await evoCompletion.initialize();
    return evoCompletion.generateCompletions();
}

export async function generateEvoSnippets() {
    await evoCompletion.initialize();
    return evoCompletion.generateSnippets();
}