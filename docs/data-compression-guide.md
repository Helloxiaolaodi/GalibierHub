# SeqEdge Input Data — Extreme Compression Guide

> A pragmatic checklist for shrinking the genomics files you upload to Cloudflare R2
> (or any S3‑compatible object storage) *before* they get served to a browser‑side
> JBrowse 2 viewer.
>
> The formats below are all **random‑access friendly** — the browser only needs to
> range‑request the bytes for the currently visible locus, so the wire savings
> translate directly into faster panning, cheaper egress, and a smaller R2 bill.

---

## TL;DR — the recommended upgrade matrix

| Category | Legacy (avoid) | Upgrade to | Typical size saving | Random access | Required indexes |
|---|---|---|---|---|---|
| Reference genome | `.fa`, `.fasta` | **bgzipped FASTA** (`.fa.gz`) | ~65–75 % | ✅ | `.fa.gz.fai` + `.fa.gz.gzi` |
| Aligned reads | `.sam`, `.bam` | **CRAM** | ~30–50 % vs BAM (~90 % vs SAM) | ✅ | `.cram.crai` |
| Intervals / annotations | `.bed`, `.gff`, `.gff3` | **bgzip + tabix** (`.bed.gz`, `.gff3.gz`) | ~80–90 % | ✅ | `.tbi` (or `.csi`) |
| Interval features (dense) | `.bed` | **BigBed** (`.bb`) | ~85 % | ✅ | *(self‑indexed)* |
| Variants | `.vcf` | **bgzipped VCF** (`.vcf.gz`) | ~85–95 % | ✅ | `.tbi` (or `.csi`) |
| Quantitative signal | `.wig`, `.bedgraph` | **BigWig** (`.bw`) | ~90 % | ✅ | *(self‑indexed)* |

Rule of thumb: **never upload the uncompressed sibling and the compressed one together** — you pay double storage for the redundancy.

---

## 1. Reference genome: FASTA → bgzipped FASTA

Plain `gzip` won't work: JBrowse (and IGV, samtools, etc.) need **block‑gzip**
so random reads land on block boundaries.

```bash
# Requires htslib / samtools ≥ 1.10
bgzip -@ 8 volvox.fa                 # -> volvox.fa.gz  (block-gzip)
samtools faidx volvox.fa.gz          # -> volvox.fa.gz.fai + volvox.fa.gz.gzi
```

Upload **three files**:
```
test-data/volvox.fa.gz
test-data/volvox.fa.gz.fai
test-data/volvox.fa.gz.gzi
```

JBrowse adapter change:
```ts
adapter: {
  type: 'BgzipFastaAdapter',                       // was: IndexedFastaAdapter
  fastaLocation: { uri: `${baseUrl}/test-data/volvox.fa.gz` },
  faiLocation:   { uri: `${baseUrl}/test-data/volvox.fa.gz.fai` },
  gziLocation:   { uri: `${baseUrl}/test-data/volvox.fa.gz.gzi` },
}
```

> ⚠️ If you accidentally used `gzip` instead of `bgzip`, the `.gzi` won't
> exist and `samtools faidx` will fail with *"file compression not supported"*.

---

## 2. Aligned reads: BAM → CRAM

CRAM stores read sequences **relative to the reference**, so identical
bases become empty deltas. Typical WGS BAM → CRAM savings are 30–50 %, and
much more if reads are highly redundant (amplicon, virome, deep resequencing).

```bash
# Convert (requires the exact FASTA that reads were aligned against)
samtools view -@ 8 -C -T reference.fa \
    -o volvox-sorted.cram \
    volvox-sorted.bam

# Index
samtools index volvox-sorted.cram    # -> volvox-sorted.cram.crai
```

Upload:
```
test-data/volvox-sorted.cram
test-data/volvox-sorted.cram.crai
```

JBrowse adapter change:
```ts
adapter: {
  type: 'CramAdapter',                             // was: BamAdapter
  cramLocation: { uri: `${baseUrl}/test-data/volvox-sorted.cram` },
  craiLocation: { uri: `${baseUrl}/test-data/volvox-sorted.cram.crai` },
  sequenceAdapter: {                               // required for CRAM decoding
    type: 'BgzipFastaAdapter',
    fastaLocation: { uri: `${baseUrl}/test-data/volvox.fa.gz` },
    faiLocation:   { uri: `${baseUrl}/test-data/volvox.fa.gz.fai` },
    gziLocation:   { uri: `${baseUrl}/test-data/volvox.fa.gz.gzi` },
  },
}
```

> ⚠️ CRAM **requires** access to the same reference that produced it. Serve
> the bgzipped FASTA (section 1) from the same R2 bucket — otherwise reads
> can't be decoded.

For maximum compression, ask CRAM to bin base‑qualities:
```bash
samtools view -C -T reference.fa \
    --output-fmt-option lossy_names=1 \
    --output-fmt-option store_md=0 \
    --output-fmt-option store_nm=0 \
    -o reads.cram reads.bam
```
(Only do this if you don't need per‑base Phred scores downstream.)

---

## 3. Annotations: BED / GFF3 → bgzip + tabix

`bgzip` + `tabix` gives you a compressed *and* queryable annotation file.
The index (`.tbi`) is what makes range requests possible in the browser.

```bash
# BED must be pre-sorted on (chrom, start)
sort -k1,1 -k2,2n annotations.bed > annotations.sorted.bed
bgzip annotations.sorted.bed        # -> annotations.sorted.bed.gz
tabix -p bed annotations.sorted.bed.gz   # -> annotations.sorted.bed.gz.tbi

# GFF3
sort -k1,1 -k4,4n genes.gff3 > genes.sorted.gff3
bgzip genes.sorted.gff3
tabix -p gff genes.sorted.gff3.gz
```

For **very large** annotations (> 2 GB) use CSI instead of TBI:
```bash
tabix -p bed --csi annotations.sorted.bed.gz    # -> .csi
```

JBrowse adapter (already used by the template):
```ts
adapter: {
  type: 'BedTabixAdapter',
  bedGzLocation: { uri: `${baseUrl}/test-data/volvox-bed12.bed.gz` },
  index: {
    location:  { uri: `${baseUrl}/test-data/volvox-bed12.bed.gz.tbi` },
    indexType: 'TBI',
  },
}
```

---

## 4. Dense interval sets: BED → BigBed

BigBed is the right choice when you have **millions of features** (peaks,
uniquely mappable regions, promoter atlases) and you want static tracks
without a `.tbi` sidecar.

```bash
# 1. sort
sort -k1,1 -k2,2n peaks.bed > peaks.sorted.bed
# 2. chrom sizes for your assembly
samtools faidx reference.fa
cut -f1,2 reference.fa.fai > chrom.sizes
# 3. convert (bedToBigBed from UCSC kentUtils)
bedToBigBed peaks.sorted.bed chrom.sizes peaks.bb
```

JBrowse adapter:
```ts
adapter: {
  type: 'BigBedAdapter',
  bigBedLocation: { uri: `${baseUrl}/tracks/peaks.bb` },
}
```

Choose **BigBed** when features are numerous and static; choose
**bgzip + tabix BED** when you still want to `zcat` / diff / patch by hand.

---

## 5. Variants: VCF → bgzipped VCF + tabix

Exact same recipe as BED, different tabix flavour:

```bash
bcftools sort -Oz -o variants.sorted.vcf.gz variants.vcf
tabix -p vcf variants.sorted.vcf.gz
```

For call sets larger than 2 GB use CSI (`tabix -p vcf --csi`).

Upload:
```
tracks/variants.sorted.vcf.gz
tracks/variants.sorted.vcf.gz.tbi
```

> Cohort VCFs compress *dramatically* — a 40 GB multi‑sample VCF often ends
> up under 2 GB bgzipped, because most columns are the reference allele.

---

## 6. Quantitative signal: WIG / BedGraph → BigWig

Already the accepted standard for coverage / signal tracks.

```bash
# From BAM (with deepTools)
bamCoverage -b reads.bam -o coverage.bw \
    --binSize 10 --normalizeUsing CPM

# From BedGraph (kentUtils)
sort -k1,1 -k2,2n signal.bedgraph > signal.sorted.bedgraph
bedGraphToBigWig signal.sorted.bedgraph chrom.sizes signal.bw
```

No index sidecar needed — BigWig is self‑describing.

---

## 7. R2 upload etiquette

Once files are compressed, one more win is available at the storage layer.

### 7.1 Set the right `Content-Type`

Object metadata affects both browser behaviour and Cloudflare's byte‑range
handling.

| Extension | `Content-Type` |
|---|---|
| `.fa.gz`, `.bam`, `.cram`, `.bb`, `.bw`, `.tbi`, `.csi`, `.crai`, `.bai`, `.fai`, `.gzi` | `application/octet-stream` |
| `.vcf.gz`, `.bed.gz`, `.gff3.gz` | `application/octet-stream` |
| `.json`, `.jbrowse.json` | `application/json` |

Never set `Content-Encoding: gzip` on a bgzipped file — that would ask the
browser to double‑decompress, which breaks range requests.

### 7.2 Confirm `Accept-Ranges: bytes`

Cloudflare R2 supports range GETs by default. You can verify from a shell:
```bash
curl -I "https://<your-r2-host>/test-data/volvox.fa.gz"
# HTTP/2 200
# accept-ranges: bytes
```

If `accept-ranges` is missing, JBrowse will fall back to full‑file reads
and cancel out most of the compression savings.

### 7.3 Enable CORS

For a JBrowse viewer on `seqedge.pages.dev` fetching from
`pub-*.r2.dev`, add a CORS rule on the bucket allowing `GET`, `HEAD`,
`Range` from your Pages origin (or `*` for a public open‑source template).

---

## 8. Suggested folder layout in R2

Matches the paths referenced by `src/components/jbrowse-viewer.tsx`:

```
test-data/
├── volvox.fa.gz              (bgzipped reference)
├── volvox.fa.gz.fai
├── volvox.fa.gz.gzi
├── volvox.gff3.gz
├── volvox.gff3.gz.tbi
├── volvox-bed12.bed.gz
├── volvox-bed12.bed.gz.tbi
├── volvox-sorted.cram        (was: .bam)
├── volvox-sorted.cram.crai
└── volvox.bb                 (BigBed peaks / features)
```

---

## 9. End‑to‑end example: BAM + BED + VCF pack in one script

```bash
#!/usr/bin/env bash
set -euo pipefail

REF=volvox.fa
BAM=volvox-sorted.bam
BED=volvox-bed12.bed
VCF=volvox.vcf

# 1. bgzip the reference
bgzip -k -@ 8 "$REF"
samtools faidx "$REF.gz"

# 2. BAM -> CRAM
samtools view -@ 8 -C -T "$REF" -o "${BAM%.bam}.cram" "$BAM"
samtools index "${BAM%.bam}.cram"

# 3. BED -> bgzip + tabix
sort -k1,1 -k2,2n "$BED" | bgzip > "${BED}.gz"
tabix -p bed "${BED}.gz"

# 4. VCF -> bgzip + tabix
bcftools sort -Oz -o "${VCF}.gz" "$VCF"
tabix -p vcf "${VCF}.gz"

# 5. Upload
wrangler r2 object put seqedge-bucket/test-data/volvox.fa.gz         --file "$REF.gz"
wrangler r2 object put seqedge-bucket/test-data/volvox.fa.gz.fai     --file "$REF.gz.fai"
wrangler r2 object put seqedge-bucket/test-data/volvox.fa.gz.gzi     --file "$REF.gz.gzi"
wrangler r2 object put seqedge-bucket/test-data/${BAM%.bam}.cram     --file "${BAM%.bam}.cram"
wrangler r2 object put seqedge-bucket/test-data/${BAM%.bam}.cram.crai --file "${BAM%.bam}.cram.crai"
wrangler r2 object put seqedge-bucket/test-data/${BED}.gz            --file "${BED}.gz"
wrangler r2 object put seqedge-bucket/test-data/${BED}.gz.tbi        --file "${BED}.gz.tbi"
wrangler r2 object put seqedge-bucket/test-data/${VCF}.gz            --file "${VCF}.gz"
wrangler r2 object put seqedge-bucket/test-data/${VCF}.gz.tbi        --file "${VCF}.gz.tbi"
```

---

## 10. Common pitfalls

1. **`gzip` vs `bgzip`** — plain gzip breaks random access. Always use `bgzip`.
2. **Unsorted input** — `tabix` and `bedToBigBed` both require sorted input; unsorted files produce nonsense indexes or outright errors.
3. **Missing reference for CRAM** — a CRAM without its exact reference genome is unreadable. Store both together.
4. **Uploading `.tbi` before `.gz`** — Cloudflare's cache is per‑object, but browsers assume the index matches the current data file. Re‑upload both when you regenerate.
5. **CORS blocked** — JBrowse will report *"Failed to fetch"* if the R2 bucket doesn't allow your Pages origin.
6. **Wrong `Content-Encoding`** — never set `gzip`; leave it empty for bgzipped payloads.

---

## References

- [samtools documentation](http://www.htslib.org/doc/)
- [bcftools documentation](http://www.htslib.org/doc/bcftools.html)
- [UCSC kentUtils (bedToBigBed, bedGraphToBigWig)](https://hgdownload.soe.ucsc.edu/admin/exe/)
- [JBrowse 2 adapter reference](https://jbrowse.org/jb2/docs/config_guides/adapters/)
- [Cloudflare R2 CORS docs](https://developers.cloudflare.com/r2/buckets/cors/)
