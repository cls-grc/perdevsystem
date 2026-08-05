Write-Host '=== CREATE TABLE across all migrations ==='
Get-ChildItem 'c:/Users/User/OneDrive/Desktop/perdevsys/pds/server/db/migrations' -Filter *.sql | ForEach-Object {
    Write-Host ('--- ' + $_.Name)
    Select-String -Path $_.FullName -Pattern 'CREATE TABLE'
}
Write-Host ''
Write-Host '=== DONE ==='
