type Props = {
  label?: string
  hint?: string
  uploading?: boolean
  fileName?: string | null
  onFile: (file: File) => void
  disabled?: boolean
}

export default function PaymentReceiptUpload({
  label = 'Upload payment receipt',
  hint = 'Screenshot or PDF from your bank showing the completed transfer.',
  uploading = false,
  fileName,
  onFile,
  disabled = false,
}: Props) {
  return (
    <div className="rounded-xl border border-dashed border-school-border bg-white p-4">
      <p className="text-sm font-medium text-school-navy">{label} *</p>
      {hint && <p className="mt-1 text-xs text-school-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`btn-admin-sm cursor-pointer ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Uploading…' : fileName ? 'Replace receipt' : 'Choose receipt'}
          <input
            type="file"
            accept="image/*,.pdf"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ''
            }}
          />
        </label>
        {fileName && <span className="text-sm text-school-green">✓ {fileName}</span>}
      </div>
    </div>
  )
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
