import { useEffect, useId, useRef, useState } from 'react'
import { ACCEPT_ATTR, checkImage, formatBytes, prepareImage } from '../../lib/images'
import { ImageTile } from '../user/ui'

/**
 * value: { file: File | null, url: string | null, removed: boolean }
 * Picking (or dropping) an image optimises it right away: the shop owner sees the real result
 * and the saved size, and the optimised file is what gets uploaded when the form is saved.
 * `showStats` can be turned off for screens where size details would only distract.
 */
export default function ImagePicker({ label, name, value, onChange, showStats = true }) {
  const inputId = useId()
  const run = useRef(0)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!value.file) return setPreview(null)
    const url = URL.createObjectURL(value.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value.file])

  async function handleFile(file) {
    if (!file) return
    const id = ++run.current
    setStats(null)
    const problem = checkImage(file)
    setError(problem)
    if (problem) return
    setBusy(true)
    try {
      const result = await prepareImage(file)
      if (id !== run.current) return // a newer pick replaced this one
      onChange({ ...value, file: result.blob, removed: false })
      setStats(result)
    } catch (err) {
      if (id === run.current) setError(err.message)
    } finally {
      if (id === run.current) setBusy(false)
    }
  }

  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    handleFile(file)
  }

  function drop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer?.files?.[0])
  }

  function remove() {
    run.current += 1
    setBusy(false)
    setStats(null)
    setError('')
    onChange({ ...value, file: null, removed: true })
  }

  const shown = preview || (!value.removed ? value.url : null)

  return (
    <div className="field">
      <span>{label}</span>
      <div
        className={`image-picker${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {shown ? (
          <img src={shown} alt={`${name || 'Image'} preview`} className="image-picker-preview" decoding="async" />
        ) : (
          <ImageTile name={name || '?'} className="image-picker-preview" />
        )}
        <div className="image-picker-actions">
          <label htmlFor={inputId} className="btn btn-outline btn-sm" aria-disabled={busy}>
            {shown ? 'Change image' : 'Upload image'}
          </label>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={pick}
            disabled={busy}
            aria-label={label}
          />
          {shown && !busy && (
            <button type="button" className="link-btn danger" onClick={remove}>
              Remove image
            </button>
          )}
          {busy ? (
            <small className="image-picker-status" role="status">
              <span className="image-picker-spinner" aria-hidden="true" /> Optimising your image…
            </small>
          ) : stats && showStats ? (
            <small className="image-picker-status image-picker-ok" role="status">
              Ready: {formatBytes(stats.originalBytes)} → {formatBytes(stats.optimizedBytes)}
              {stats.savedPercent > 0 ? ` (saved ${stats.savedPercent}%)` : ''}
            </small>
          ) : stats ? (
            <small className="image-picker-status image-picker-ok" role="status">
              Image ready
            </small>
          ) : (
            <small className="muted">Drop an image here or choose one: JPG, PNG, WebP, GIF or HEIC, up to 15 MB. It is resized and compressed automatically.</small>
          )}
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
