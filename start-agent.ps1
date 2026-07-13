# Sobe o servidor do agente e o túnel ngrok, e reinicia qualquer um dos dois
# automaticamente se ele cair. Pensado para rodar como tarefa agendada no
# login do Windows (veja README.md).

$ProjectDir = "C:\Users\Mariana\OneDrive\Agente Financeiro\agente-whatsapp"
$NgrokExe = "C:\Users\Mariana\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
$NgrokDomain = "anew-sugar-detest.ngrok-free.dev"
$LogDir = Join-Path $ProjectDir "logs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Start-ServerProcess {
    Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $ProjectDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $LogDir "server.log") `
        -RedirectStandardError (Join-Path $LogDir "server-err.log") `
        -PassThru
}

function Start-NgrokProcess {
    Start-Process -FilePath $NgrokExe -ArgumentList "http --url=$NgrokDomain 3000" `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $LogDir "ngrok.log") `
        -RedirectStandardError (Join-Path $LogDir "ngrok-err.log") `
        -PassThru
}

$serverProc = Start-ServerProcess
$ngrokProc = Start-NgrokProcess

while ($true) {
    Start-Sleep -Seconds 15

    if ($serverProc.HasExited) {
        $serverProc = Start-ServerProcess
    }
    if ($ngrokProc.HasExited) {
        $ngrokProc = Start-NgrokProcess
    }
}
