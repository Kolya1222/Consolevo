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
        return view('consolevo::sql-console');
    }

    public function execute(Request $request): JsonResponse
    {
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
                
                try {
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

    private function getTablePrefix(): string
    {
        $fullTableName = $this->evo->getFullTableName('site_content');
        $prefix = str_replace('site_content', '', $fullTableName);
        return $prefix ?: '';
    }

    /**
     * Получить информацию о базе данных
     */
    public function getDatabaseInfo(): JsonResponse
    {
        try {
            $databaseName = DB::getDatabaseName();
            $prefix = $this->getTablePrefix();
            
            return response()->json([
                'success' => true,
                'database_name' => $databaseName,
                'table_prefix' => $prefix,
                'connection' => DB::connection()->getConfig('driver')
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Не удалось получить информацию о базе данных: ' . $e->getMessage()
            ]);
        }
    }
    
    private function addTablePrefix(string $query): string
    {
        $prefixedQuery = $query;
        $prefix = $this->getTablePrefix();
        
        $allTables = DB::select("SHOW TABLES");
        $databaseName = DB::getDatabaseName();
        $tableKey = 'Tables_in_' . $databaseName;
        
        foreach ($allTables as $tableInfo) {
            $tableName = $tableInfo->{$tableKey};
            $cleanName = str_replace($prefix, '', $tableName);
            
            if ($tableName !== $cleanName) {
                $pattern = '/\b' . preg_quote($cleanName) . '\b/i';
                $prefixedQuery = preg_replace($pattern, $tableName, $prefixedQuery);
            }
        }
        
        return $prefixedQuery;
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