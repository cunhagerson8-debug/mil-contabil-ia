$ErrorActionPreference = 'Stop'

$containerName = 'mil-contabil-postgres-teste'
$databaseName = 'mil_contabil_teste'
$adminRole = 'mil_contabil_teste_admin'
$containerPort = 5432
$publishedPort = '127.0.0.1:5434'
$targetLogins = @('mil_app_login', 'mil_platform_login')

function Invoke-DockerReadOnly {
    param([string[]]$Arguments)

    $output = @(& $script:dockerPath @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw 'A consulta local ao container falhou.'
    }

    return ,$output
}

function Test-HbaAddressMatch {
    param(
        [string]$RuleAddress,
        [string]$RuleNetmask,
        [System.Net.IPAddress]$ClientAddress
    )

    if ($RuleAddress -eq 'all') {
        return $true
    }

    if ([string]::IsNullOrWhiteSpace($RuleAddress)) {
        return $false
    }

    $parts = $RuleAddress.Split('/')
    $networkAddress = $null
    if (-not [System.Net.IPAddress]::TryParse($parts[0], [ref]$networkAddress)) {
        throw 'HBA contains an unsupported address.'
    }

    if ($networkAddress.AddressFamily -ne $ClientAddress.AddressFamily) {
        return $false
    }

    if (-not [string]::IsNullOrWhiteSpace($RuleNetmask)) {
        if ($parts.Count -ne 1) {
            throw 'HBA contains both CIDR and a separate netmask.'
        }

        $maskAddress = $null
        if (-not [System.Net.IPAddress]::TryParse($RuleNetmask, [ref]$maskAddress) -or $maskAddress.AddressFamily -ne $ClientAddress.AddressFamily) {
            throw 'HBA contains an unsupported netmask.'
        }

        $networkBytes = $networkAddress.GetAddressBytes()
        $maskBytes = $maskAddress.GetAddressBytes()
        $clientBytes = $ClientAddress.GetAddressBytes()
        for ($index = 0; $index -lt $networkBytes.Length; $index++) {
            if (($networkBytes[$index] -band $maskBytes[$index]) -ne ($clientBytes[$index] -band $maskBytes[$index])) {
                return $false
            }
        }

        return $true
    }

    if ($parts.Count -eq 1) {
        return $networkAddress.Equals($ClientAddress)
    }

    $prefixLength = 0
    if (-not [int]::TryParse($parts[1], [ref]$prefixLength)) {
        throw 'HBA contains an unsupported CIDR mask.'
    }

    $networkBytes = $networkAddress.GetAddressBytes()
    $clientBytes = $ClientAddress.GetAddressBytes()
    $maximumPrefix = $networkBytes.Length * 8
    if ($prefixLength -lt 0 -or $prefixLength -gt $maximumPrefix) {
        throw 'HBA contains an invalid CIDR mask.'
    }

    $wholeBytes = [math]::Floor($prefixLength / 8)
    $remainingBits = $prefixLength % 8
    for ($index = 0; $index -lt $wholeBytes; $index++) {
        if ($networkBytes[$index] -ne $clientBytes[$index]) {
            return $false
        }
    }

    if ($remainingBits -gt 0) {
        $mask = (255 -shl (8 - $remainingBits)) -band 255
        if (($networkBytes[$wholeBytes] -band $mask) -ne ($clientBytes[$wholeBytes] -band $mask)) {
            return $false
        }
    }

    return $true
}

function Test-HbaRuleMatch {
    param(
        [psobject]$Rule,
        [string]$Database,
        [string]$UserName,
        [System.Net.IPAddress]$ClientAddress
    )

    if ($Rule.type -eq 'local') {
        return $false
    }

    if ($Rule.type -ne 'host') {
        throw 'HBA selection depends on a connection type not verified by preflight.'
    }

    $databaseMatches = $false
    foreach ($entry in @($Rule.database)) {
        if ($entry -eq 'all' -or $entry -eq $Database) {
            $databaseMatches = $true
        } elseif ($entry -eq 'replication') {
            continue
        } else {
            throw 'HBA selection depends on a database selector not verified by preflight.'
        }
    }

    $userMatches = $false
    foreach ($entry in @($Rule.user_name)) {
        if ($entry -eq 'all' -or $entry -eq $UserName) {
            $userMatches = $true
        } else {
            throw 'HBA selection depends on a user selector not verified by preflight.'
        }
    }

    return ($databaseMatches -and $userMatches -and (Test-HbaAddressMatch $Rule.address $Rule.netmask $ClientAddress))
}

try {
    $stage = 'container-target'
    $dockerCommand = Get-Command docker.exe -ErrorAction Stop
    $script:dockerPath = $dockerCommand.Source

    $running = Invoke-DockerReadOnly @('inspect', '--format', '{{.State.Running}}', $containerName)
    if ($running.Count -ne 1 -or [string]$running[0] -ne 'true') {
        throw 'The local test container is not running.'
    }

    $portMapping = Invoke-DockerReadOnly @('port', $containerName, '5432/tcp')
    if ($portMapping.Count -ne 1 -or [string]$portMapping[0] -ne $publishedPort) {
        throw 'The published local port does not match the authorized target.'
    }

    $ipOutput = Invoke-DockerReadOnly @('inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}', $containerName)
    $ipCandidates = @(([string]$ipOutput[0]).Trim() -split '\s+' | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })
    if ($ipCandidates.Count -ne 1) {
        throw 'Could not determine a unique container address.'
    }

    $containerIp = $null
    if (-not [System.Net.IPAddress]::TryParse($ipCandidates[0], [ref]$containerIp) -or [System.Net.IPAddress]::IsLoopback($containerIp)) {
        throw 'The container address is not a valid non-loopback TCP destination.'
    }

    $stage = 'database-identity'
    $identitySql = "SELECT json_build_object('database', current_database(), 'current_user', current_user, 'session_user', session_user)::text;"
    $identityOutput = Invoke-DockerReadOnly @(
        'exec', $containerName, 'psql', '-X', '-q', '-A', '-t', '-w',
        '-v', 'ON_ERROR_STOP=1', '-U', $adminRole, '-d', $databaseName,
        '-c', $identitySql
    )
    if ($identityOutput.Count -ne 1) {
        throw 'The database identity could not be validated.'
    }

    $identity = ([string]$identityOutput[0]) | ConvertFrom-Json
    if ($identity.database -ne $databaseName -or $identity.current_user -ne $adminRole -or $identity.session_user -ne $adminRole) {
        throw 'The connected identity or database does not match the authorized local target.'
    }

    $stage = 'tcp-route'
    $routeOutput = Invoke-DockerReadOnly @('exec', $containerName, 'ip', '-4', 'route', 'get', $containerIp.ToString())
    $routeText = [string]::Join(' ', $routeOutput)
    if ($routeText -notmatch '(?:^|\s)src\s+(?<source>\d+\.\d+\.\d+\.\d+)(?:\s|$)') {
        throw 'Could not determine the TCP route source address.'
    }

    $sourceIp = $null
    if (-not [System.Net.IPAddress]::TryParse($Matches.source, [ref]$sourceIp) -or [System.Net.IPAddress]::IsLoopback($sourceIp)) {
        throw 'The selected TCP route has no verifiable non-loopback source.'
    }

    $stage = 'ordered-hba-rules'
    $hbaSql = @"
SELECT json_build_object(
    'rules',
    coalesce(
        json_agg(
        json_build_object(
            'line_number', line_number,
            'type', type,
            'database', database,
            'user_name', user_name,
            'address', address,
            'netmask', netmask,
            'auth_method', auth_method,
            'error', error
        ) ORDER BY line_number
        ),
        '[]'::json
    )
)::text
FROM pg_hba_file_rules;
"@
    $hbaOutput = Invoke-DockerReadOnly @(
        'exec', $containerName, 'psql', '-X', '-q', '-A', '-t', '-w',
        '-v', 'ON_ERROR_STOP=1', '-U', $adminRole, '-d', $databaseName,
        '-c', $hbaSql
    )
    if ($hbaOutput.Count -ne 1) {
        throw 'HBA rules could not be read as structured results.'
    }

    $hbaDocument = ConvertFrom-Json ([string]$hbaOutput[0])
    $hbaRules = @($hbaDocument.rules)
    $hbaErrors = @($hbaRules | Where-Object { $null -ne $_.error -and -not [string]::IsNullOrWhiteSpace([string]$_.error) })
    if ($hbaRules.Count -eq 0 -or $hbaErrors.Count -gt 0) {
        throw 'The HBA configuration is empty or contains errors.'
    }

    $stage = 'tcp-readiness'
    $tcpProbe = Invoke-DockerReadOnly @(
        'exec', $containerName, 'pg_isready', '-h', $containerIp.ToString(),
        '-p', [string]$containerPort, '-d', $databaseName, '-U', $targetLogins[0]
    )
    $tcpProbeText = [string]::Join(' ', $tcpProbe)
    if ($tcpProbeText -notmatch 'accepting connections') {
        throw 'The local TCP endpoint did not confirm availability.'
    }

    $stage = 'select-effective-hba-rule'
    $selectedHbaRules = @()
    foreach ($login in $targetLogins) {
        $matchingRule = $null
        foreach ($rule in @($hbaRules | Sort-Object { [int]$_.line_number })) {
            if (Test-HbaRuleMatch $rule $databaseName $login $sourceIp) {
                $matchingRule = $rule
                break
            }
        }
        if ($null -eq $matchingRule) {
            throw ('No HBA rule matched the selected TCP route for ' + $login + '.')
        }
        $selectedHbaRules += [PSCustomObject]@{ Login = $login; Rule = $matchingRule }
    }

    $orderedLines = @($hbaRules | Sort-Object { [int]$_.line_number } | ForEach-Object { [string]$_.line_number })
    Write-Output 'PREFLIGHT=PASS'
    Write-Output ('DESTINO=' + $containerName + '|' + $databaseName + '|127.0.0.1:5434')
    Write-Output ('TCP_ENDPOINT=' + $containerIp.ToString() + ':' + $containerPort + '|SOURCE=' + $sourceIp.ToString())
    Write-Output ('TCP_ACCEPTING=' + $true)
    Write-Output ('PG_HBA_ORDER=' + ($orderedLines -join ','))
    foreach ($rule in @($hbaRules | Sort-Object { [int]$_.line_number })) {
        $databaseSelectors = @($rule.database) -join ','
        $userSelectors = @($rule.user_name) -join ','
        $ruleAddress = if ($null -eq $rule.address) { '' } else { [string]$rule.address }
        $ruleNetmask = if ($null -eq $rule.netmask) { '' } else { [string]$rule.netmask }
        Write-Output ('PG_HBA_RULE=' + $rule.line_number + '|' + $rule.type + '|' + $databaseSelectors + '|' + $userSelectors + '|' + $ruleAddress + '|' + $ruleNetmask + '|' + $rule.auth_method)
    }
    foreach ($selection in $selectedHbaRules) {
        Write-Output ('PG_HBA_MATCH_LOGIN=' + $selection.Login + '|LINE=' + $selection.Rule.line_number + '|TYPE=' + $selection.Rule.type + '|AUTH=' + $selection.Rule.auth_method)
    }
    Write-Output 'SCRAM_AUTHENTICATION=NOT_TESTED'
} catch {
    Write-Output ('PREFLIGHT=STOPPED|' + $stage + '|' + $_.Exception.Message)
    exit 1
}
