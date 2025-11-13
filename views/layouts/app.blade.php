<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Evolution Console')</title>
    <link rel="stylesheet" href="{{ MODX_BASE_URL }}assets/plugins/consolevo/fontawesome-7.1.0/css/all.min.css">
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --primary-light: #818cf8;
            --surface: #0f172a;
            --surface-light: #1e293b;
            --surface-lighter: #334155;
            --surface-dark: #020617;
            --text: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-muted: #64748b;
            --success: #10b981;
            --success-dark: #059669;
            --warning: #f59e0b;
            --warning-dark: #d97706;
            --danger: #ef4444;
            --danger-dark: #dc2626;
            --glass: rgba(255, 255, 255, 0.05);
            --glass-hover: rgba(255, 255, 255, 0.08);
            --glass-border: rgba(255, 255, 255, 0.1);
            --glass-border-hover: rgba(255, 255, 255, 0.15);
            --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.36);
            --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.4);
            --radius: 12px;
            --radius-sm: 8px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            --transition-fast: all 0.15s ease;
            --gradient-primary: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            --gradient-surface: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            --gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: linear-gradient(135deg, var(--surface-dark) 0%, var(--surface) 50%, #1e1b4b 100%);
            color: var(--text);
            min-height: 100vh;
            padding: 20px;
            line-height: 1.6;
            font-family: cursive;
        }

        /* Анимации */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px var(--primary); }
            50% { box-shadow: 0 0 20px var(--primary); }
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out;
        }

        .slide-in {
            animation: slideIn 0.4s ease-out;
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        .glow {
            animation: glow 2s infinite;
        }

        /* Кастомный скроллбар */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--surface-light);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--surface-lighter);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--primary);
        }

        /* Выделение текста */
        ::selection {
            background: var(--primary);
            color: white;
        }
    </style>
    @yield('styles')
</head>
<body>
    @yield('content')
    
    @yield('scripts')
</body>
</html>