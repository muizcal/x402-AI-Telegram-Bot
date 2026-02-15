(define-non-fungible-token ai-nft uint)

(define-data-var last-id uint u0)

(define-public (mint (recipient principal))
  (let ((new-id (+ (var-get last-id) u1)))
    (begin
      (var-set last-id new-id)
      (nft-mint? ai-nft new-id recipient)
      (ok new-id)
    )
  )
)
