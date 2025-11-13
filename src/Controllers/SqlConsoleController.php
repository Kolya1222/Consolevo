<?php
namespace roilafx\Consolevo\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class SqlConsoleController
{
    private \DocumentParser $evo;

    public function __construct()
    {
        $this->evo = evolutionCMS();
    }

    public function index()
    {
        if (!$this->hasAccess()) {
            \abort(403, 'Доступ запрещен');
        }
        
        return view('consolevo::sql-console');
    }

    public function execute(Request $request): JsonResponse
    {
        if (!$this->hasAccess()) {
            return response()->json([
                'success' => false,
                'error' => 'Доступ запрещен. Только для администраторов.'
            ], 403);
        }
        
        $query = trim($request->input('query', ''));
        
        if (empty($query)) {
            return $this->errorResponse('SQL запрос не может быть пустым');
        }

        try {
            $prefixedQuery = $this->addTablePrefix($query);
            $validationResult = $this->validateQuery($prefixedQuery);
            
            if (!$validationResult['valid']) {
                return $this->errorResponse($validationResult['error']);
            }

            $queryType = $validationResult['type'];
            $startTime = microtime(true);
            $result = $this->executeQuery($prefixedQuery, $queryType);
            $executionTime = round(microtime(true) - $startTime, 4);

            return $this->successResponse($result, $queryType, $executionTime, $query);
            
        } catch (QueryException $e) {
            return $this->errorResponse(
                "Ошибка базы данных: " . $this->formatSqlError($e->getMessage())
            );
        } catch (\Exception $e) {
            return $this->errorResponse(
                "Ошибка выполнения: " . $e->getMessage()
            );
        }
    }

    /**
     * Получить список таблиц для автодополнения
     */
    public function getTablesForAutocomplete(): JsonResponse
    {
        try {
            $tables = [];
            $tableStructures = [];
            
            // Получаем все таблицы базы данных
            $allTables = DB::select("SHOW TABLES");
            $databaseName = DB::getDatabaseName();
            $tableKey = 'Tables_in_' . $databaseName;
            $prefix = $this->getTablePrefix();
            
            foreach ($allTables as $table) {
                $tableName = $table->{$tableKey};
                $cleanTableName = str_replace($prefix, '', $tableName);
                
                $tables[] = [
                    'name' => $tableName,
                    'clean_name' => $cleanTableName,
                    'prefixed' => $tableName !== $cleanTableName
                ];
                
                // СТРУКТУРА ДЛЯ ВСЕХ ТАБЛИЦ С ОБРАБОТКОЙ ОШИБОК
                try {
                    // ПРОБУЕМ DESCRIBE
                    $columns = DB::select("DESCRIBE `" . $tableName . "`");
                    $tableStructures[$cleanTableName] = array_map(function($col) {
                        return [
                            'field' => $col->Field,
                            'type' => $col->Type,
                            'caption' => $col->Key ? "Key: {$col->Key}" : ''
                        ];
                    }, $columns);
                    
                } catch (\Exception $e) {
                    $columns = DB::select("SHOW COLUMNS FROM `" . $tableName . "`");
                    $tableStructures[$cleanTableName] = array_map(function($col) {
                        return [
                            'field' => $col->Field,
                            'type' => $col->Type,
                            'caption' => $col->Key ? "Key: {$col->Key}" : ''
                        ];
                    }, $columns);
                }
            }
            
            return response()->json([
                'success' => true,
                'tables' => $tables,
                'table_structures' => $tableStructures,
                'table_prefix' => $prefix,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Не удалось получить список таблиц: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * ПРОВЕРКА ДОСТУПА
     */
    private function hasAccess(): bool
    {
        // Способ 1: Прямая проверка сессии менеджера
        if (isset($_SESSION['mgrValidated']) && $_SESSION['mgrValidated'] === true) {
            return true;
        }
        
        // Способ 2: Проверка через метод Evolution CMS с указанием контекста
        if (method_exists($this->evo, 'getLoginUserType')) {
            $userType = $this->evo->getLoginUserType('mgr');
            if ($userType === 'manager') {
                return true;
            }
        }
        
        // Способ 3: Проверка роли пользователя
        if (isset($_SESSION['mgrRole']) && $_SESSION['mgrRole'] == 1) {
            return true;
        }
        
        // Способ 4: Проверка внутреннего ключа
        if (isset($_SESSION['mgrInternalKey']) && !empty($_SESSION['mgrInternalKey'])) {
            return true;
        }
        
        return false;
    }

    /**
     * Отладочная информация для проверки доступа
     */
    private function getAccessDebugInfo(): array
    {
        return [
            'session_mgrValidated' => $_SESSION['mgrValidated'] ?? 'not set',
            'session_mgrRole' => $_SESSION['mgrRole'] ?? 'not set', 
            'session_mgrInternalKey' => $_SESSION['mgrInternalKey'] ?? 'not set',
            'evo_getLoginUserType_mgr' => method_exists($this->evo, 'getLoginUserType') ? 
                $this->evo->getLoginUserType('mgr') : 'method not exists',
            'evo_getLoginUserType_empty' => method_exists($this->evo, 'getLoginUserType') ? 
                $this->evo->getLoginUserType() : 'method not exists',
            'has_evolutionCMS_object' => !empty($this->evo) ? 'yes' : 'no'
        ];
    }

    // ... остальные методы (addTablePrefix, getTablePrefix, validateQuery и т.д.) без изменений ...
    
    private function addTablePrefix(string $query): string
    {
        $prefixedQuery = $query;
        $prefix = $this->getTablePrefix();
        
        $evo_tables = [
            'site_content', 'site_templates', 'site_htmlsnippets', 'site_snippets', 
            'site_plugins', 'site_modules', 'manager_users', 'user_attributes',
            'site_tmplvars', 'site_tmplvar_contentvalues', 'categories'
        ];
        
        foreach ($evo_tables as $table) {
            $fullTableName = $this->evo->getFullTableName($table);
            
            $pattern = '/\b' . preg_quote($table) . '\b/i';
            $prefixedQuery = preg_replace($pattern, $fullTableName, $prefixedQuery);
            
            $qualifiedPattern = '/\b' . preg_quote($table) . '\.(\w+)\b/i';
            $prefixedQuery = preg_replace($qualifiedPattern, $fullTableName . '.$1', $prefixedQuery);
        }
        
        return $prefixedQuery;
    }

    private function getTablePrefix(): string
    {
        $fullTableName = $this->evo->getFullTableName('site_content');
        $prefix = str_replace('site_content', '', $fullTableName);
        return $prefix ?: '';
    }

    private function validateQuery(string $query): array
    {
        if (empty(trim($query))) {
            return ['valid' => false, 'error' => 'Запрос не может быть пустым'];
        }

        if (!$this->validateSqlSyntax($query)) {
            return ['valid' => false, 'error' => 'Неверный синтаксис SQL запроса'];
        }

        $dangerCheck = $this->checkCriticalDangers($query);
        if (!$dangerCheck['safe']) {
            return ['valid' => false, 'error' => $dangerCheck['reason']];
        }

        $queryType = $this->getQueryType($query);
        return ['valid' => true, 'type' => $queryType];
    }

    private function checkCriticalDangers(string $query): array
    {
        $upperQuery = strtoupper($query);

        $criticalPatterns = [
            '/DROP\s+DATABASE/i',
            '/INTO\s+(OUTFILE|DUMPFILE)\s*[\'"](?:\/etc|\/root|\/windows|\.\.\/)/i',
            '/\b(KILL|SHUTDOWN|RESTART)\s+/i',
        ];

        foreach ($criticalPatterns as $pattern) {
            if (preg_match($pattern, $upperQuery)) {
                return [
                    'safe' => false,
                    'reason' => 'Обнаружена критически опасная операция'
                ];
            }
        }

        return ['safe' => true, 'reason' => ''];
    }

    private function getQueryType(string $query): string
    {
        $query = trim($query);
        $firstWord = strtoupper(strtok($query, " \t\n\r\0\x0B"));
        return $firstWord ?: 'UNKNOWN';
    }

    private function validateSqlSyntax(string $query): bool
    {
        return $this->checkBalancedQuotes($query) && $this->checkBalancedParentheses($query);
    }

    private function checkBalancedQuotes(string $query): bool
    {
        $singleQuotes = substr_count($query, "'") % 2;
        $doubleQuotes = substr_count($query, '"') % 2;
        $backticks = substr_count($query, '`') % 2;
        return $singleQuotes === 0 && $doubleQuotes === 0 && $backticks === 0;
    }

    private function checkBalancedParentheses(string $query): bool
    {
        $open = substr_count($query, '(');
        $close = substr_count($query, ')');
        return $open === $close;
    }

    private function executeQuery(string $query, string $queryType): array
    {
        $result = [];
        set_time_limit(30);
        
        switch ($queryType) {
            case 'SELECT':
            case 'SHOW':
            case 'DESCRIBE':
            case 'EXPLAIN':
                $result['data'] = DB::select($query);
                $result['count'] = count($result['data']);
                $result['affected_rows'] = 0;
                break;

            case 'INSERT':
            case 'UPDATE':
            case 'DELETE':
            case 'REPLACE':
                $affectedRows = DB::affectingStatement($query);
                $result['data'] = [];
                $result['count'] = 0;
                $result['affected_rows'] = $affectedRows;
                
                if ($queryType === 'INSERT') {
                    $result['last_insert_id'] = DB::getPdo()->lastInsertId();
                }
                break;

            case 'CREATE':
            case 'ALTER':
            case 'DROP':
            case 'TRUNCATE':
                $affectedRows = DB::statement($query);
                $result['data'] = [];
                $result['count'] = 0;
                $result['affected_rows'] = $affectedRows;
                $result['ddl_operation'] = true;
                break;

            default:
                $result['data'] = DB::select($query);
                $result['count'] = count($result['data']);
                $result['affected_rows'] = 0;
        }

        return $result;
    }

    private function successResponse(array $result, string $queryType, float $executionTime, string $originalQuery): JsonResponse
    {
        $response = [
            'success' => true,
            'data' => $result['data'],
            'count' => $result['count'],
            'affected_rows' => $result['affected_rows'],
            'execution_time' => $executionTime,
            'query_type' => $queryType,
            'table_prefix' => $this->getTablePrefix()
        ];

        if ($queryType === 'INSERT' && isset($result['last_insert_id'])) {
            $response['last_insert_id'] = $result['last_insert_id'];
        }

        if (isset($result['ddl_operation'])) {
            $response['ddl_operation'] = true;
        }

        $response['query_info'] = $this->getQueryInfo($queryType, $result);
        return response()->json($response);
    }

    private function errorResponse(string $message, int $code = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => $message,
            'query_type' => 'ERROR',
            'table_prefix' => $this->getTablePrefix()
        ], $code);
    }

    private function getQueryInfo(string $queryType, array $result): string
    {
        switch ($queryType) {
            case 'SELECT':
                return "Найдено записей: {$result['count']}";
            case 'INSERT':
                $info = "Добавлено записей: {$result['affected_rows']}";
                if (isset($result['last_insert_id'])) {
                    $info .= ", ID новой записи: {$result['last_insert_id']}";
                }
                return $info;
            case 'UPDATE':
                return "Обновлено записей: {$result['affected_rows']}";
            case 'DELETE':
                return "Удалено записей: {$result['affected_rows']}";
            case 'CREATE':
            case 'ALTER':
            case 'DROP':
                return "Операция DDL выполнена успешно";
            case 'SHOW':
            case 'DESCRIBE':
                return "Показано информации: {$result['count']}";
            default:
                return "Запрос выполнен успешно";
        }
    }

    private function formatSqlError(string $error): string
    {
        $error = preg_replace('/SQLSTATE\[.*\]:\s*/', '', $error);
        $error = preg_replace('/\(Connection: [^,]+, SQL: [^)]+\)/', '', $error);
        return trim($error);
    }
}