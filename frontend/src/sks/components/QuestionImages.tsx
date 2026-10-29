import type { QuestionImage } from '../api/types'

// The catalog's images are line art at roughly 72 dpi. The small ones (light
// configurations) are shown at twice their pixel size so they read like the
// printed catalog; the large ones (sketches, weather maps) already fill the
// column at their natural size. They are static files of this site (see ADR-0033).
const LARGE_IMAGE_WIDTH = 200

const scaleFor = (image: QuestionImage) => (image.width >= LARGE_IMAGE_WIDTH ? 1 : 2)

const LABELS = { question: 'Abbildung zur Frage', answer: 'Abbildung zur amtlichen Antwort' }

/**
 * The images belonging to a question or to its official answer, if any. Several images of a question
 * are captioned "Bild 1", "Bild 2" …: the question text may refer to them that way.
 */
export function QuestionImages({ images, part }: { images: QuestionImage[]; part: 'question' | 'answer' }) {
  if (images.length === 0) return null
  const captioned = part === 'question' && images.length > 1
  return (
    <div className="flex flex-wrap items-start gap-3">
      {images.map((image, i) => (
        <figure key={image.src} className="m-0">
          <img
            src={`/catalog/${image.src}`}
            width={image.width * scaleFor(image)}
            height={image.height * scaleFor(image)}
            alt={images.length > 1 ? `${LABELS[part]} ${i + 1} von ${images.length}` : LABELS[part]}
            // The catalog's images are drawn on white: on `surface` (white), transparent parts stay white.
            className="h-auto max-w-full rounded-tile border border-border bg-surface"
          />
          {captioned && <figcaption className="mt-1 text-sm text-ink-soft">Bild {i + 1}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
