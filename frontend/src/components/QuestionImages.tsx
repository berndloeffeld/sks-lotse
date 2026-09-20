import type { QuestionImage } from '../api/types'

// The catalog's images are line art at roughly 72 dpi. The small ones (light
// configurations) are shown at twice their pixel size so they read like the
// printed catalog; the large ones (sketches, weather maps) already fill the
// column at their natural size. They are static files of this site (see ADR-0033).
const LARGE_IMAGE_WIDTH = 200

const scaleFor = (image: QuestionImage) => (image.width >= LARGE_IMAGE_WIDTH ? 1 : 2)

const LABELS = { question: 'Abbildung zur Frage', answer: 'Abbildung zur amtlichen Antwort' }

/** The images belonging to a question or to its official answer, if any. */
export function QuestionImages({ images, part }: { images: QuestionImage[]; part: 'question' | 'answer' }) {
  if (images.length === 0) return null
  return (
    <div className="flex flex-wrap items-start gap-3">
      {images.map((image, i) => (
        <img
          key={image.src}
          src={`/catalog/${image.src}`}
          width={image.width * scaleFor(image)}
          height={image.height * scaleFor(image)}
          alt={images.length > 1 ? `${LABELS[part]} ${i + 1} von ${images.length}` : LABELS[part]}
          // The catalog's images are drawn on white; keep it white in dark mode.
          className="h-auto max-w-full rounded border border-border bg-white"
        />
      ))}
    </div>
  )
}
