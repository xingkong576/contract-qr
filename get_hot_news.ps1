# Get hot news from multiple sources
$headers = @{
    'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    'Referer' = 'https://weibo.com/'
    'Accept' = 'application/json'
}

Write-Host "=== 微博热搜 ==="
try {
    $r1 = Invoke-RestMethod -Uri 'https://weibo.com/ajax/statuses/hot_bursts' -Headers $headers -TimeoutSec 15
    $r1.data | ForEach-Object { Write-Host "$($_.realpos): $($_.word) ($($_.num))" }
} catch { Write-Host "微博失败: $_" }

Write-Host "`n=== 百度热搜 ==="
try {
    $r2 = Invoke-RestMethod -Uri 'https://top.baidu.com/api/searchbox?prod=entire' -Headers $headers -TimeoutSec 15
    $r2.data.coldDataMsg | Out-String
    $r2 | ConvertTo-Json -Depth 3
} catch { Write-Host "百度失败: $_" }

Write-Host "`n=== 今日热榜 API ==="
try {
    $r3 = Invoke-RestMethod -Uri 'https://tophub.today/api/node/hotitem?id=XK3gkXGQl1' -Headers $headers -TimeoutSec 15
    $r3 | ConvertTo-Json -Depth 3
} catch { Write-Host "热榜失败: $_" }
