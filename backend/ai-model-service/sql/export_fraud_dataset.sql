WITH latest_review AS (
  SELECT DISTINCT ON (frl."credentialId")
    frl."credentialId",
    frl.label,
    frl."reviewedAt"
  FROM "FraudReviewLabel" frl
  ORDER BY frl."credentialId", frl."reviewedAt" DESC
),
hash_stats AS (
  SELECT
    c."fileHash",
    COUNT(*) AS duplicate_hash_count,
    COUNT(DISTINCT su."institutionId") AS institution_count
  FROM "Credential" c
  JOIN "User" su ON su.id = c."studentId"
  WHERE c."fileHash" IS NOT NULL AND c."fileHash" <> ''
  GROUP BY c."fileHash"
)
SELECT
  CASE
    WHEN lr.label = 'FRAUD' THEN 1
    WHEN lr.label = 'CLEAN' THEN 0
    WHEN c."aiReviewStatus" = 'REJECTED' OR c."aiDecision" = 'BLOCK' THEN 1
    WHEN c."aiReviewStatus" = 'APPROVED' OR c."aiDecision" = 'CLEAR' THEN 0
    ELSE NULL
  END AS label_fraud,
  c.type::text AS credential_type,
  c.status::text AS credential_status,
  COALESCE(c."mimeType", 'unknown') AS mime_type,
  LENGTH(COALESCE(c.filename, ''))::int AS filename_len,
  CASE WHEN c."fileHash" IS NOT NULL AND c."fileHash" <> '' THEN 1 ELSE 0 END AS has_file_hash,
  COALESCE(hs.duplicate_hash_count, 0)::int AS duplicate_hash_count,
  CASE WHEN COALESCE(hs.institution_count, 0) > 1 THEN 1 ELSE 0 END AS cross_institution_hash_reuse,
  COALESCE(c."aiScore", 0)::float AS ai_score_prev,
  iu.role::text AS issuer_role,
  su.status::text AS student_status
FROM "Credential" c
JOIN "User" su ON su.id = c."studentId"
JOIN "User" iu ON iu.id = c."issuedById"
LEFT JOIN latest_review lr ON lr."credentialId" = c.id
LEFT JOIN hash_stats hs ON hs."fileHash" = c."fileHash"
WHERE c."fileHash" IS NOT NULL
  AND c."fileHash" <> ''
  AND (
    lr.label IN ('CLEAN', 'FRAUD')
    OR c."aiReviewStatus" IN ('APPROVED', 'REJECTED')
    OR c."aiDecision" IN ('CLEAR', 'BLOCK')
  )
ORDER BY c."createdAt" DESC;
