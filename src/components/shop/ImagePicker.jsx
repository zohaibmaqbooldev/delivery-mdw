import { useEffect, useId, useState } from 'react'
import { checkImage } from '../../lib/images'
import { ImageTile } from '../user/ui'

/**
 * value: { file: File | null, url: string | null, removed: boolean }
 * Shows the current image (or the newly chosen one) with change / remove buttons.
 */
export default function ImagePicker({ label, name, value, onChange }) {
  const inputId = useId()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!value.file) return setPreview(null)
    const url = URL.createObjectURL(value.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value.file])

  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = checkImage(file)
    setError(problem)
    if (!problem) onChange({ ...value, file, removed: false })
  }

  const shown = preview || (!value.removed ? value.url : null)

  return (
    <div className="field">
      <span>{label}</span>
      <div className="image-picker">
        {shown ? (
          <img src={shown} alt={`${name || 'Image'} preview`} className="image-picker-preview" />
        ) : (
          <ImageTile name={name || '?'} className="image-picker-preview" />
        )}
        <div className="image-picker-actions">
          <label htmlFor={inputId} className="btn btn-outline btn-sm">
            {shown ? 'Change image' : 'Upload image'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={pick}
            aria-label={label}
          />
          {shown && (
            <button type="button" className="link-btn danger" onClick={() => onChange({ ...value, file: null, removed: true })}>
              Remove image
            </button>
          )}
          <small className="muted">JPG, PNG or WebP, up to 10 MB. Large photos are resized automatically.</small>
        </div>
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
