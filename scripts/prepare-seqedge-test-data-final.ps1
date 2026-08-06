$ErrorActionPreference = 'Stop'

$sourceSeqEdge = 'D:\YL2026\html-deploy\deploy-notes\seqedge-data'
$sourceTest = 'D:\YL2026\html-deploy\deploy-notes\test-data'
$targetRoot = 'D:\YL2026\html-deploy\deploy-notes\test-data-final'
$bundleRoot = Join-Path $targetRoot 'seqedge-test-data'
$zipPath = Join-Path $targetRoot 'seqedge-test-data.zip'

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

Ensure-Dir -Path $targetRoot

if (Test-Path -LiteralPath $bundleRoot) {
    Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Ensure-Dir -Path $bundleRoot

$sarsRoot = Join-Path $bundleRoot 'sars-cov-2-lite'
$volvoxRoot = Join-Path $bundleRoot 'volvox-advanced'

Ensure-Dir -Path $sarsRoot
Ensure-Dir -Path $volvoxRoot

$sarsFiles = @(
    'scov2.fa',
    'scov2.fa.fai',
    'scov2.gb',
    'scov2.genes.bed',
    'scov2.genes.gff3'
)

foreach ($file in $sarsFiles) {
    Copy-Item -LiteralPath (Join-Path $sourceSeqEdge $file) -Destination (Join-Path $sarsRoot $file) -Force
}

$volvoxGenomeFiles = @(
    'volvox.fa',
    'volvox.fa.fai'
)

foreach ($file in $volvoxGenomeFiles) {
    Copy-Item -LiteralPath (Join-Path (Join-Path $sourceTest 'genomes') $file) -Destination (Join-Path $volvoxRoot $file) -Force
}

$volvoxTrackFiles = @(
    'volvox.gff3',
    'volvox.sort.gff3.gz',
    'volvox-bed12.bed.gz',
    'volvox-bed12.bed.gz.tbi',
    'volvox.bb',
    'volvox-sorted.bam',
    'volvox-sorted.bam.bai'
)

foreach ($file in $volvoxTrackFiles) {
    Copy-Item -LiteralPath (Join-Path (Join-Path $sourceTest 'tracks') $file) -Destination (Join-Path $volvoxRoot $file) -Force
}

$readmePath = Join-Path $bundleRoot 'README.md'
$readme = @'
# SeqEdge JBrowse Test Data

This bundle contains only real public files that can be used to validate SeqEdge object-storage routing and JBrowse 2 rendering.

Recommended GitHub Releases asset naming:
- versioned asset: `seqedge-test-data-20260724.zip`
- stable alias for latest bundle: `seqedge-test-data.zip`

It is organized into two datasets.

## 1. sars-cov-2-lite

Recommended for SeqEdge's default lightweight browser validation.

Files:
- `scov2.fa`
- `scov2.fa.fai`
- `scov2.gb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

What it validates:
- reference sequence loading
- FASTA index access
- BED/GFF3 annotation rendering
- locus navigation against a real SARS-CoV-2 assembly

## 2. volvox-advanced

Recommended for richer JBrowse capability checks.

Files:
- `volvox.fa`
- `volvox.fa.fai`
- `volvox.gff3`
- `volvox.sort.gff3.gz`
- `volvox-bed12.bed.gz`
- `volvox-bed12.bed.gz.tbi`
- `volvox.bb`
- `volvox-sorted.bam`
- `volvox-sorted.bam.bai`

What it validates:
- reference sequence loading
- plain GFF3 annotation tracks
- tabix-indexed BED tracks
- BigBed tracks
- BAM alignment tracks

## 3. Important boundary

This package is for browser and storage validation only.

It does not populate SeqEdge metadata tables:
- `genome_samples`
- `predicted_promoters`
- `variant_index`

If you want homepage counters, searchable promoter tables, and sample detail pages to show real records, import real metadata into Supabase separately.

## 4. Suggested usage

1. Upload one dataset folder to a public object store with CORS and range-request support.
2. Point `NEXT_PUBLIC_STORAGE_BASE_URL` to that public base.
3. Set `NEXT_PUBLIC_REFERENCE_*` variables to the matching filenames.
4. For Hugging Face-hosted files, prefer `NEXT_PUBLIC_HF_PROXY_URL` for browser delivery.

## 5. Provenance

- `sars-cov-2-lite` | SeqEdge SARS-CoV-2 browser validation bundle | Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`
- `volvox-advanced` | GMOD / JBrowse public example-data ecosystem | JBrowse 2 documentation: https://jbrowse.org/jb2/
- JBrowse browser integration reference | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023.
- GMOD JBrowse repository | https://github.com/GMOD/jbrowse-components
'@

[System.IO.File]::WriteAllText($readmePath, $readme, [System.Text.Encoding]::UTF8)

Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Prepared bundle at: $bundleRoot"
Write-Host "Prepared zip at: $zipPath"
