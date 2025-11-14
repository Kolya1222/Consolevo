<?php
namespace roilafx\Consolevo\Middleware;

use Closure;
use Illuminate\Http\Request;

class ConsoleVoAccess
{
    public function handle(Request $request, Closure $next)
    {
        if (\ManagerTheme::hasManagerAccess() === false) {
            return response()->json(['error' => 'No Manager Access'], 403);
        }

        return $next($request);
    }
}