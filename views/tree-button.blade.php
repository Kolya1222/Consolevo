<script>
document.addEventListener('DOMContentLoaded', function() {
    const treeMenu = document.getElementById('treeMenu');
    if (treeMenu) {
        const consoleButton = document.createElement('a');
        consoleButton.className = 'treeButton';
        consoleButton.id = 'consoleButton';
        consoleButton.title = 'Консоль';
        consoleButton.style.cssText = 'cursor:pointer; margin-left:5px;';
        consoleButton.innerHTML = '<i class="fa fa-terminal fa-lg"></i>';
        
        consoleButton.addEventListener('click', function() {
            openConsole();
        });
        
        treeMenu.appendChild(consoleButton);
    }

    function openConsole() {
        const consoleUrl = '{{ evo()->make("url")->to("consolevo") }}';
        
        // Используем modx.popup если доступен, иначе fallback
        if (typeof window.modx !== 'undefined' && typeof window.modx.popup === 'function') {
            window.modx.popup({
                url: consoleUrl,
                icon: 'fa-terminal',
                title: 'Evolution Console',
                draggable: true,
                width: '90%',
                height: '90%',
                hide: 0,
                hover: 0,
                overlay: 1,
                minwidth: 800,
                minheight: 600
            });
        } else {
            // Fallback для случая когда modx.popup недоступен
            const width = 1200;
            const height = 800;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            window.open(
                consoleUrl, 
                'evolution-console',
                `width=${width},height=${height},top=${top},left=${left},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
            );
        }
    }
});
</script>